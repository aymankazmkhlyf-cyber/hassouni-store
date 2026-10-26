import { randomUUID } from "node:crypto";
import { count, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { auditLogs, orderItems, orders, orderStatusHistory, payments, productPackages, products } from "@/lib/db/schema";
import { createOrder, getOrderByAccessKey, getOrderForUser, reviewPayment, ServiceError, submitPaymentProof, transitionOrder } from "@/lib/services/orders";
import { dashboardStats, listOrders } from "@/lib/services/admin-orders";
import { quoteCart } from "@/lib/services/quote";
import type { CartItemInput } from "@/lib/validation/schemas";
import { checkoutInput, enabledMethodId, hasDb, makeUser, productBySlug } from "./helpers";

const expectCode = async (p: Promise<unknown>, code: string) => {
  await expect(p).rejects.toBeInstanceOf(ServiceError);
  await expect(p).rejects.toMatchObject({ code });
};

describe.skipIf(!hasDb)("order creation", () => {
  it("computes totals from the database and snapshots names and prices", async () => {
    const input = await checkoutInput();
    const res = await createOrder(input, { userId: null });
    expect(res.duplicate).toBe(false);
    expect(res.reference).toMatch(/^HDS-/);

    const order = await db.query.orders.findFirst({ where: eq(orders.id, res.orderId), with: { items: true, payments: true, history: true } });
    expect(order!.total).toBe(14000); // 2 × 7000 (325 UC package)
    expect(order!.status).toBe("pending_payment");
    expect(order!.items[0]).toMatchObject({ productNameEn: "PUBG Mobile UC", packageLabelEn: "325 UC", unitPrice: 7000, quantity: 2, lineTotal: 14000 });
    expect(order!.items[0]!.inputs).toEqual([{ key: "player_id", labelAr: "رقم اللاعب (Player ID)", labelEn: "Player ID", value: "5123456789" }]);
    expect(order!.payments).toHaveLength(1);
    expect(order!.payments[0]!.status).toBe("awaiting");
    expect(order!.history.map((h) => h.toStatus)).toEqual(["pending_payment"]);
    // Only a hash of the access key is stored.
    expect(order!.accessKeyHash).not.toContain(res.accessKey);
  });

  it("uses the current DB price even if the catalog changed after the cart was built", async () => {
    const pubg = await productBySlug("pubg-mobile-uc");
    const pkg = pubg.packages.find((p) => p.labelEn === "60 UC")!;
    const input = await checkoutInput({ items: [{ productId: pubg.id, packageId: pkg.id, quantity: 1, inputs: { player_id: "1" } }] });
    await db.update(productPackages).set({ price: 1750 }).where(eq(productPackages.id, pkg.id));
    try {
      const res = await createOrder(input, { userId: null });
      const order = await db.query.orders.findFirst({ where: eq(orders.id, res.orderId) });
      expect(order!.total).toBe(1750);
    } finally {
      await db.update(productPackages).set({ price: 1500 }).where(eq(productPackages.id, pkg.id));
    }
  });

  it("keeps historical snapshots when the product is renamed later", async () => {
    const res = await createOrder(await checkoutInput(), { userId: null });
    const pubg = await productBySlug("pubg-mobile-uc");
    await db.update(products).set({ nameEn: "Renamed" }).where(eq(products.id, pubg.id));
    try {
      const [item] = await db.select().from(orderItems).where(eq(orderItems.orderId, res.orderId));
      expect(item!.productNameEn).toBe("PUBG Mobile UC");
    } finally {
      await db.update(products).set({ nameEn: "PUBG Mobile UC" }).where(eq(products.id, pubg.id));
    }
  });

  it("applies quantity tiers server-side", async () => {
    const likes = await productBySlug("instagram-likes");
    const quote = await quoteCart([{ productId: likes.id, packageId: null, quantity: 1500, inputs: { post_url: "https://instagram.com/p/x" } }]);
    expect(quote.valid).toBe(true);
    expect(quote.total).toBe(1500 * 8);
  });

  it("rejects invalid quantities, inactive products, foreign packages and missing fields", async () => {
    const likes = await productBySlug("instagram-likes");
    const pubg = await productBySlug("pubg-mobile-uc");
    const ff = await productBySlug("free-fire-diamonds");
    const cases: CartItemInput[] = [
      { productId: likes.id, packageId: null, quantity: 5, inputs: { post_url: "https://instagram.com/p/x" } }, // below min 100
      { productId: pubg.id, packageId: ff.packages[0]!.id, quantity: 1, inputs: { player_id: "1" } }, // package of another product
      { productId: pubg.id, packageId: pubg.packages[0]!.id, quantity: 1, inputs: {} }, // missing player_id
      { productId: 999999, packageId: null, quantity: 1, inputs: {} }, // unknown product
    ];
    for (const item of cases) {
      await expectCode(createOrder(await checkoutInput({ items: [item] }), { userId: null }), "cartInvalid");
    }

    await db.update(products).set({ isActive: false }).where(eq(products.id, ff.id));
    try {
      const item = { productId: ff.id, packageId: ff.packages[0]!.id, quantity: 1, inputs: { player_id: "1" } };
      await expectCode(createOrder(await checkoutInput({ items: [item] }), { userId: null }), "cartInvalid");
    } finally {
      await db.update(products).set({ isActive: true }).where(eq(products.id, ff.id));
    }
  });

  it("rejects disabled payment methods", async () => {
    const mastercard = await enabledMethodId("mastercard"); // disabled in seed
    await expectCode(createOrder(await checkoutInput({ paymentMethodId: mastercard }), { userId: null }), "paymentMethod");
  });

  it("treats a repeated submission as the same order (idempotent)", async () => {
    const input = await checkoutInput();
    const first = await createOrder(input, { userId: null });
    const second = await createOrder(input, { userId: null });
    expect(second.orderId).toBe(first.orderId);
    expect(second.duplicate).toBe(true);
    const [n] = await db.select({ n: count() }).from(orders).where(eq(orders.idempotencyKey, input.idempotencyKey));
    expect(n!.n).toBe(1);
    // The rotated key works, the old one no longer does.
    expect(await getOrderByAccessKey(first.reference, second.accessKey)).toBeTruthy();
    expect(await getOrderByAccessKey(first.reference, first.accessKey)).toBeFalsy();
  });

  it("creates exactly one order under concurrent double-submits", async () => {
    const input = await checkoutInput();
    const results = await Promise.allSettled(Array.from({ length: 5 }, () => createOrder(input, { userId: null })));
    const ok = results.filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof createOrder>>> => r.status === "fulfilled");
    expect(ok.length).toBeGreaterThan(0);
    expect(new Set(ok.map((r) => r.value.orderId)).size).toBe(1);
    const [n] = await db.select({ n: count() }).from(orders).where(eq(orders.idempotencyKey, input.idempotencyKey));
    expect(n!.n).toBe(1);
  });
});

describe.skipIf(!hasDb)("order access control", () => {
  let reference = "";
  let key = "";
  let ownerId = "";
  beforeAll(async () => {
    const owner = await makeUser("customer");
    ownerId = owner.id;
    const res = await createOrder(await checkoutInput(), { userId: owner.id });
    reference = res.reference;
    key = res.accessKey;
  });

  it("opens with the correct access key (case/format-insensitive)", async () => {
    expect((await getOrderByAccessKey(reference, key))?.reference).toBe(reference);
    expect((await getOrderByAccessKey(reference.toLowerCase(), `${key.slice(0, 8)}-${key.slice(8)}`.toLowerCase()))?.reference).toBe(reference);
  });

  it("does not open with a wrong key, a key for another order, or no key", async () => {
    const other = await createOrder(await checkoutInput(), { userId: null });
    expect(await getOrderByAccessKey(reference, "A".repeat(24))).toBeFalsy();
    expect(await getOrderByAccessKey(reference, other.accessKey)).toBeFalsy();
    expect(await getOrderByAccessKey(reference, "")).toBeFalsy();
  });

  it("does not open after the access key expires", async () => {
    const res = await createOrder(await checkoutInput(), { userId: null });
    await db.update(orders).set({ accessKeyExpiresAt: new Date(Date.now() - 1000) }).where(eq(orders.id, res.orderId));
    expect(await getOrderByAccessKey(res.reference, res.accessKey)).toBeFalsy();
  });

  it("a logged-in customer sees only their own orders", async () => {
    const stranger = await makeUser("customer");
    expect((await getOrderForUser(reference, ownerId))?.reference).toBe(reference);
    expect(await getOrderForUser(reference, stranger.id)).toBeUndefined();
  });
});

describe.skipIf(!hasDb)("manual payment review workflow", () => {
  it("proof moves the order to review but never to paid; staff confirms", async () => {
    const staff = await makeUser("staff");
    const res = await createOrder(await checkoutInput(), { userId: null });
    await submitPaymentProof(res.orderId, { customerReference: "ZC-1", receipt: null }, { userId: null });

    let order = await db.query.orders.findFirst({ where: eq(orders.id, res.orderId), with: { payments: true } });
    expect(order!.status).toBe("payment_review");
    expect(order!.paidAt).toBeNull();
    expect(order!.payments[0]).toMatchObject({ status: "submitted", customerReference: "ZC-1" });

    await reviewPayment(order!.payments[0]!.id, "confirm", "", staff);
    order = await db.query.orders.findFirst({ where: eq(orders.id, res.orderId), with: { payments: true } });
    expect(order!.status).toBe("paid");
    expect(order!.paidAt).not.toBeNull();
    expect(order!.payments[0]).toMatchObject({ status: "confirmed", reviewedById: staff.id });

    // Paid orders accept no further proofs.
    await expectCode(submitPaymentProof(res.orderId, { customerReference: "again", receipt: null }, { userId: null }), "orderLocked");
    // Audit trail
    const logs = await db.select().from(auditLogs).where(eq(auditLogs.entityId, order!.payments[0]!.id));
    expect(logs.map((l) => l.action)).toContain("payment.confirm");
  });

  it("rejection returns the order to pending payment and allows a new proof", async () => {
    const staff = await makeUser("staff");
    const res = await createOrder(await checkoutInput(), { userId: null });
    await submitPaymentProof(res.orderId, { customerReference: "bad", receipt: { mime: "image/png", bytes: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1]) } }, { userId: null });
    const [p] = await db.select().from(payments).where(eq(payments.orderId, res.orderId));
    expect(p!.receiptFileId).not.toBeNull();
    await reviewPayment(p!.id, "reject", "Amount not received", staff);

    let order = await db.query.orders.findFirst({ where: eq(orders.id, res.orderId) });
    expect(order!.status).toBe("pending_payment");

    await submitPaymentProof(res.orderId, { customerReference: "good", receipt: null }, { userId: null });
    const all = await db.select().from(payments).where(eq(payments.orderId, res.orderId));
    expect(all.map((x) => x.status).sort()).toEqual(["rejected", "submitted"]);
    order = await db.query.orders.findFirst({ where: eq(orders.id, res.orderId) });
    expect(order!.status).toBe("payment_review");
  });

  it("cannot review a proof twice", async () => {
    const staff = await makeUser("staff");
    const res = await createOrder(await checkoutInput(), { userId: null });
    await submitPaymentProof(res.orderId, { customerReference: "x", receipt: null }, { userId: null });
    const [p] = await db.select().from(payments).where(eq(payments.orderId, res.orderId));
    await reviewPayment(p!.id, "confirm", "", staff);
    await expectCode(reviewPayment(p!.id, "reject", "", staff), "invalidTransition");
  });

  it("requires a reference when the method demands one", async () => {
    const res = await createOrder(await checkoutInput(), { userId: null }); // zain_cash requires reference
    await expectCode(submitPaymentProof(res.orderId, { customerReference: null, receipt: { mime: "image/png", bytes: Buffer.from([1]) } }, { userId: null }), "proofNeedOne");
  });
});

describe.skipIf(!hasDb)("status transitions", () => {
  it("rejects invalid transitions and records valid ones with actor", async () => {
    const staff = await makeUser("staff");
    const res = await createOrder(await checkoutInput(), { userId: null });
    await expectCode(transitionOrder(res.orderId, "completed", { type: "staff", user: staff }), "invalidTransition");

    await transitionOrder(res.orderId, "paid", { type: "staff", user: staff }, "verified by phone");
    await transitionOrder(res.orderId, "processing", { type: "staff", user: staff });
    await transitionOrder(res.orderId, "completed", { type: "staff", user: staff });
    await expectCode(transitionOrder(res.orderId, "cancelled", { type: "staff", user: staff }), "invalidTransition");

    const history = await db.select().from(orderStatusHistory).where(eq(orderStatusHistory.orderId, res.orderId)).orderBy(orderStatusHistory.id);
    expect(history.map((h) => h.toStatus)).toEqual(["pending_payment", "paid", "processing", "completed"]);
    expect(history[1]).toMatchObject({ actorType: "staff", actorId: staff.id, note: "verified by phone" });

    const order = await db.query.orders.findFirst({ where: eq(orders.id, res.orderId), with: { payments: true } });
    expect(order!.completedAt).not.toBeNull();
    // Marking paid directly confirms the open payment record.
    expect(order!.payments[0]!.status).toBe("confirmed");

    await transitionOrder(res.orderId, "refunded", { type: "staff", user: staff });
    const refunded = await db.query.orders.findFirst({ where: eq(orders.id, res.orderId), with: { payments: true } });
    expect(refunded!.payments[0]!.status).toBe("refunded");
  });
});

describe.skipIf(!hasDb)("admin reporting", () => {
  it("confirmed revenue excludes unpaid, cancelled and refunded orders", async () => {
    const staff = await makeUser("staff");
    const before = await dashboardStats();
    const unpaid = await createOrder(await checkoutInput(), { userId: null });
    const cancelled = await createOrder(await checkoutInput(), { userId: null });
    const paid = await createOrder(await checkoutInput(), { userId: null });
    await transitionOrder(cancelled.orderId, "cancelled", { type: "staff", user: staff });
    await transitionOrder(paid.orderId, "paid", { type: "staff", user: staff });
    void unpaid;

    const after = await dashboardStats();
    expect(after.confirmedRevenue - before.confirmedRevenue).toBe(14000);
    expect(after.grossValue - before.grossValue).toBe(28000); // unpaid + paid; cancelled excluded
    expect(after.totalOrders - before.totalOrders).toBe(3);
    expect(after.bestSellers[0]!.nameEn).toBe("PUBG Mobile UC");
  });

  it("filters orders by latest payment status and text", async () => {
    const res = await createOrder(await checkoutInput({ customerName: `Filter ${randomUUID().slice(0, 6)}` }), { userId: null });
    await submitPaymentProof(res.orderId, { customerReference: "F-1", receipt: null }, { userId: null });
    const submitted = await listOrders({ paymentStatus: "submitted", q: res.reference });
    expect(submitted.rows.map((r) => r.reference)).toEqual([res.reference]);
    expect(submitted.rows[0]!.paymentStatus).toBe("submitted");
    const awaiting = await listOrders({ paymentStatus: "awaiting", q: res.reference });
    expect(awaiting.rows).toHaveLength(0);
    const byStatus = await listOrders({ status: "payment_review", q: res.reference });
    expect(byStatus.total).toBe(1);
    // LIKE wildcards in user input are escaped
    expect((await listOrders({ q: "%" })).total).toBe(0);
  });
});
