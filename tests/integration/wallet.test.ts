import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { orders, payments, users, walletTopups, walletTransactions } from "@/lib/db/schema";
import { anonymizeCustomer, authenticate, registerCustomer } from "@/lib/services/accounts";
import { createOrder, ServiceError, transitionOrder } from "@/lib/services/orders";
import {
  adminAdjustWallet,
  createTopup,
  findCustomer,
  getWallet,
  normalizeUsername,
  reviewTopup,
  setUsername,
  usernameProblem,
} from "@/lib/services/wallet";
import { registerSchema } from "@/lib/validation/schemas";
import { checkoutInput, enabledMethodId, hasDb, makeUser } from "./helpers";

const expectCode = async (p: Promise<unknown>, code: string) => {
  await expect(p).rejects.toBeInstanceOf(ServiceError);
  await expect(p).rejects.toMatchObject({ code });
};

const uname = () => `u${randomUUID().replace(/-/g, "").slice(0, 12)}`;

async function customer(balance = 0) {
  const u = await makeUser("customer");
  const username = uname();
  await db.update(users).set({ username }).where(eq(users.id, u.id));
  if (balance) {
    const admin = await makeUser("admin");
    await adminAdjustWallet(u.id, balance, "test credit", admin);
  }
  return { ...u, username };
}

describe("usernames", () => {
  it("normalises and validates wallet usernames", () => {
    expect(normalizeUsername("  @Ali_92 ")).toBe("ali_92");
    expect(usernameProblem("ali_92")).toBeNull();
    expect(usernameProblem("ab")).toBe("usernameInvalid");
    expect(usernameProblem("9ali")).toBe("usernameInvalid");
    expect(usernameProblem("ali..x")).toBe("usernameInvalid");
    expect(usernameProblem("علي")).toBe("usernameInvalid");
    expect(usernameProblem("admin")).toBe("usernameTaken");
    const ok = registerSchema.safeParse({ name: "Ali", username: "@Ali.K", email: "a@b.co", phone: "", password: "long-enough-pass" });
    expect(ok.success && ok.data.username).toBe("ali.k");
  });
});

describe.skipIf(!hasDb)("wallet", () => {
  it("registers with a unique username and signs in with it or the email", async () => {
    const username = uname();
    const email = `${username}@example.test`;
    const res = await registerCustomer({ name: "Wallet User", username, email, phone: null, password: "a-strong-test-password" });
    expect(res.ok).toBe(true);
    expect(await registerCustomer({ name: "Other", username, email: `x${email}`, phone: null, password: "a-strong-test-password" })).toEqual({ ok: false, reason: "usernameTaken" });
    expect(await authenticate(username.toUpperCase(), "a-strong-test-password")).toMatchObject({ ok: true });
    expect(await authenticate(email, "a-strong-test-password")).toMatchObject({ ok: true });
    expect(await authenticate(username, "wrong-password")).toEqual({ ok: false, reason: "invalid" });
  });

  it("lets an older account choose its username once", async () => {
    const u = await makeUser("customer");
    const name = uname();
    expect(await setUsername(u.id, `@${name.toUpperCase()}`)).toBe(name);
    await expectCode(setUsername(u.id, uname()), "usernameLocked");
    const other = await makeUser("customer");
    await expectCode(setUsername(other.id, name), "usernameTaken");
  });

  it("top-up requests credit the wallet only after staff approval, with a ledger row", async () => {
    const c = await customer();
    const staff = await makeUser("staff");
    const methodId = await enabledMethodId();
    await expectCode(createTopup(c.id, { amount: 500, methodId, customerReference: "X1", receipt: null }), "topupAmount");
    await expectCode(createTopup(c.id, { amount: 10000, methodId, customerReference: null, receipt: null }), "proofNeedOne");

    const { id } = await createTopup(c.id, { amount: 25000, methodId, customerReference: "ZC-1", receipt: null });
    expect((await getWallet(c.id))!.balance).toBe(0);
    await expectCode(reviewTopup(id, "reject", " ", staff), "reasonRequired");
    const approved = await reviewTopup(id, "approve", "", staff);
    expect(approved.balance).toBe(25000);
    await expectCode(reviewTopup(id, "approve", "", staff), "invalidTransition");

    const w = (await getWallet(c.id))!;
    expect(w.balance).toBe(25000);
    expect(w.transactions[0]).toMatchObject({ type: "topup", amount: 25000, balanceAfter: 25000, topupId: id });
    expect(w.topups[0]).toMatchObject({ status: "approved", amount: 25000 });
  });

  it("limits open top-up requests and rejects with a visible reason", async () => {
    const c = await customer();
    const staff = await makeUser("staff");
    const methodId = await enabledMethodId();
    const ids = [];
    for (let i = 0; i < 3; i++) ids.push((await createTopup(c.id, { amount: 1000, methodId, customerReference: `R${i}`, receipt: null })).id);
    await expectCode(createTopup(c.id, { amount: 1000, methodId, customerReference: "R4", receipt: null }), "topupTooMany");
    await reviewTopup(ids[0]!, "reject", "Transfer not received", staff);
    const row = await db.query.walletTopups.findFirst({ where: eq(walletTopups.id, ids[0]!) });
    expect(row).toMatchObject({ status: "rejected", reviewNote: "Transfer not received" });
    expect((await getWallet(c.id))!.balance).toBe(0);
  });

  it("admin adjustments need a reason and can never overdraw", async () => {
    const c = await customer(5000);
    const admin = await makeUser("admin");
    await expectCode(adminAdjustWallet(c.id, 1000, "", admin), "reasonRequired");
    await expectCode(adminAdjustWallet(c.id, -6000, "too much", admin), "insufficientBalance");
    expect(await adminAdjustWallet(c.id, -5000, "cash refund", admin)).toBe(0);
  });

  it("pays an order from the wallet instantly and refunds it back to the wallet", async () => {
    const c = await customer(20000);
    const staff = await makeUser("staff");
    const res = await createOrder(await checkoutInput({ paymentMethodId: "wallet", customerPhone: "+9647711110001" }), { userId: c.id });
    const order = await db.query.orders.findFirst({ where: eq(orders.id, res.orderId), with: { payments: true, history: true } });
    expect(order).toMatchObject({ status: "paid", paymentMethodCode: "wallet", total: 14000 });
    expect(order!.paidAt).not.toBeNull();
    expect(order!.payments[0]).toMatchObject({ status: "confirmed", methodCode: "wallet", amount: 14000 });
    expect(order!.history.map((h) => h.toStatus)).toEqual(["paid"]);
    expect((await getWallet(c.id))!.balance).toBe(6000);

    // Retrying the same submission does not charge twice.
    const again = await createOrder(await checkoutInput({ paymentMethodId: "wallet", customerPhone: "+9647711110001", idempotencyKey: (await db.query.orders.findFirst({ where: eq(orders.id, res.orderId) }))!.idempotencyKey }), { userId: c.id });
    expect(again.duplicate).toBe(true);
    expect((await getWallet(c.id))!.balance).toBe(6000);

    await transitionOrder(res.orderId, "refunded", { type: "staff", user: staff });
    expect((await getWallet(c.id))!.balance).toBe(20000);
    const tx = await db.select().from(walletTransactions).where(and(eq(walletTransactions.orderId, res.orderId)));
    expect(tx.map((t) => t.type).sort()).toEqual(["order_payment", "order_refund"]);
    const pay = await db.select().from(payments).where(eq(payments.orderId, res.orderId));
    expect(pay[0]!.status).toBe("refunded");
  });

  it("refuses wallet payment without enough balance or without login, leaving nothing behind", async () => {
    const c = await customer(3000);
    const input = await checkoutInput({ paymentMethodId: "wallet", customerPhone: "+9647711110002" });
    await expectCode(createOrder(input, { userId: c.id }), "insufficientBalance");
    expect(await db.query.orders.findFirst({ where: eq(orders.idempotencyKey, input.idempotencyKey) })).toBeUndefined();
    expect((await getWallet(c.id))!.balance).toBe(3000);
    await expectCode(createOrder(await checkoutInput({ paymentMethodId: "wallet" }), { userId: null }), "walletLoginRequired");
  });

  it("finds customers by username, email or phone, and blocks erasing a funded account", async () => {
    const c = await customer(1000);
    expect((await findCustomer(`@${c.username}`))?.id).toBe(c.id);
    expect((await findCustomer(c.email.toUpperCase()))?.id).toBe(c.id);
    expect(await findCustomer("nobody-here")).toBeNull();
    await expectCode(anonymizeCustomer(c.id, null), "walletNotEmpty");
  });
});

describe.skipIf(!hasDb)("overlapping orders", () => {
  it("blocks the same service + same target while an earlier order is in progress", async () => {
    const staff = await makeUser("staff");
    const phone = "+9647722220001";
    const first = await createOrder(await checkoutInput({ customerPhone: phone }), { userId: null });

    // Unpaid orders do not block (the customer may simply re-order).
    const unpaidSecond = await createOrder(await checkoutInput({ customerPhone: phone }), { userId: null });
    expect(unpaidSecond.duplicate).toBe(false);

    await transitionOrder(first.orderId, "paid", { type: "staff", user: staff });
    const blocked = createOrder(await checkoutInput({ customerPhone: phone }), { userId: null });
    await expectCode(blocked, "activeOrderExists");
    await expect(blocked).rejects.toMatchObject({ extra: { reference: first.reference } });

    // A different player ID, or another customer, is fine.
    const base = await checkoutInput({ customerPhone: phone });
    const otherId = await createOrder({ ...base, items: [{ ...base.items[0]!, inputs: { player_id: "5999999999" } }] }, { userId: null });
    expect(otherId.duplicate).toBe(false);
    const otherCustomer = await createOrder(await checkoutInput({ customerPhone: "+9647722220002" }), { userId: null });
    expect(otherCustomer.duplicate).toBe(false);

    // Once completed, the same order can be placed again.
    await transitionOrder(first.orderId, "completed", { type: "staff", user: staff });
    const later = await createOrder(await checkoutInput({ customerPhone: phone }), { userId: null });
    expect(later.duplicate).toBe(false);
  });
});
