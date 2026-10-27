import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { auditLogs, orderItems, pushSubscriptions, reviews } from "@/lib/db/schema";
import { listProducts } from "@/lib/services/catalog";
import { createOrder, ServiceError, transitionOrder } from "@/lib/services/orders";
import { eventForStatus, notifyCustomer } from "@/lib/services/order-notify";
import { getVapidKeys, isAllowedPushEndpoint, pushToOrder, saveSubscription, type PushSender } from "@/lib/services/push";
import {
  defaultDisplayName,
  latestReviews,
  listProductReviews,
  listReviewsAdmin,
  productRatingSummary,
  replyToReview,
  reviewsForOrder,
  setReviewStatus,
  submitReview,
} from "@/lib/services/reviews";
import { reviewSchema } from "@/lib/validation/schemas";
import { checkoutInput, hasDb, makeUser, productBySlug } from "./helpers";

const expectCode = async (p: Promise<unknown>, code: string) => {
  await expect(p).rejects.toBeInstanceOf(ServiceError);
  await expect(p).rejects.toMatchObject({ code });
};

async function completedOrder() {
  const staff = await makeUser("staff");
  const res = await createOrder(await checkoutInput(), { userId: null });
  for (const to of ["paid", "processing", "completed"] as const) await transitionOrder(res.orderId, to, { type: "staff", user: staff });
  const [item] = await db.select().from(orderItems).where(eq(orderItems.orderId, res.orderId));
  return { ...res, itemId: item!.id, productId: item!.productId!, staff };
}

describe("review input validation", () => {
  it("requires 1–5 stars and a name, and rejects links", () => {
    expect(reviewSchema.safeParse({ orderItemId: 1, rating: 0, displayName: "Ali" }).success).toBe(false);
    expect(reviewSchema.safeParse({ orderItemId: 1, rating: 6, displayName: "Ali" }).success).toBe(false);
    expect(reviewSchema.safeParse({ orderItemId: 1, rating: 5, displayName: "A" }).success).toBe(false);
    expect(reviewSchema.safeParse({ orderItemId: 1, rating: 5, displayName: "Ali", comment: "visit https://spam.example" }).success).toBe(false);
    expect(reviewSchema.safeParse({ orderItemId: 1, rating: 5, displayName: "Ali", comment: "go to spam.com now" }).success).toBe(false);
    const ok = reviewSchema.safeParse({ orderItemId: "3", rating: "4", displayName: "  علي ", comment: " وصل بسرعة " });
    expect(ok.success && ok.data).toEqual({ orderItemId: 3, rating: 4, displayName: "علي", comment: "وصل بسرعة" });
  });

  it("defaults the display name to the first name only", () => {
    expect(defaultDisplayName("  Ahmed Kareem Ali ")).toBe("Ahmed");
  });
});

describe("push endpoint allowlist", () => {
  it("accepts real browser push services only", () => {
    expect(isAllowedPushEndpoint("https://fcm.googleapis.com/fcm/send/abc")).toBe(true);
    expect(isAllowedPushEndpoint("https://updates.push.services.mozilla.com/wpush/v2/abc")).toBe(true);
    expect(isAllowedPushEndpoint("https://web.push.apple.com/QH1")).toBe(true);
    expect(isAllowedPushEndpoint("https://wns2-db5p.notify.windows.com/w/?token=1")).toBe(true);
    expect(isAllowedPushEndpoint("http://fcm.googleapis.com/fcm/send/abc")).toBe(false);
    expect(isAllowedPushEndpoint("https://evil.example/fcm.googleapis.com")).toBe(false);
    expect(isAllowedPushEndpoint("https://fcm.googleapis.com.evil.example/x")).toBe(false);
    expect(isAllowedPushEndpoint("https://localhost/x")).toBe(false);
    expect(isAllowedPushEndpoint("https://fcm.googleapis.com:8443/x")).toBe(false);
    expect(isAllowedPushEndpoint("not a url")).toBe(false);
  });

  it("notifies only on staff-driven status changes", () => {
    expect(eventForStatus("paid")).toBe("paid");
    expect(eventForStatus("completed")).toBe("completed");
    expect(eventForStatus("payment_review")).toBeNull();
    expect(eventForStatus("pending_payment")).toBeNull();
  });
});

describe.skipIf(!hasDb)("verified reviews", () => {
  it("cannot be written before the order is completed", async () => {
    const res = await createOrder(await checkoutInput(), { userId: null });
    const [item] = await db.select().from(orderItems).where(eq(orderItems.orderId, res.orderId));
    await expectCode(submitReview(res.orderId, { orderItemId: item!.id, rating: 5, comment: "", displayName: "Ali" }), "reviewNotAllowed");
  });

  it("is created once per purchased line and editing updates it", async () => {
    const o = await completedOrder();
    const first = await submitReview(o.orderId, { orderItemId: o.itemId, rating: 4, comment: "Fast", displayName: "Ali" });
    expect(first.created).toBe(true);
    const again = await submitReview(o.orderId, { orderItemId: o.itemId, rating: 5, comment: "Fast and correct", displayName: "Ali K" });
    expect(again).toEqual({ id: first.id, created: false });
    const mine = await reviewsForOrder(o.orderId);
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ rating: 5, comment: "Fast and correct", displayName: "Ali K", status: "published", productId: o.productId });
  });

  it("rejects a line that belongs to another order", async () => {
    const a = await completedOrder();
    const b = await completedOrder();
    await expectCode(submitReview(a.orderId, { orderItemId: b.itemId, rating: 5, comment: "", displayName: "Ali" }), "notFound");
  });

  it("feeds the product summary, lists and cards; hidden reviews disappear everywhere", async () => {
    const pubg = await productBySlug("pubg-mobile-uc");
    const before = await productRatingSummary(pubg.id);
    const o = await completedOrder();
    const { id } = await submitReview(o.orderId, { orderItemId: o.itemId, rating: 1, comment: "Late delivery", displayName: "Sara" });

    const after = await productRatingSummary(pubg.id);
    expect(after.count).toBe(before.count + 1);
    expect(after.distribution[0]).toBe(before.distribution[0] + 1);
    expect((await listProductReviews(pubg.id)).some((r) => r.id === id)).toBe(true);
    expect((await latestReviews(50)).some((r) => r.id === id)).toBe(true);
    const card = (await listProducts({ q: "PUBG", pageSize: 48 })).items.find((p) => p.id === pubg.id)!;
    expect(card.ratingCount).toBe(after.count);
    expect(card.ratingAvg).toBeCloseTo(after.average, 1);

    await expectCode(setReviewStatus(id, "hidden", "  ", o.staff), "reasonRequired");
    await setReviewStatus(id, "hidden", "Contains a phone number", o.staff);
    expect((await productRatingSummary(pubg.id)).count).toBe(before.count);
    expect((await listProductReviews(pubg.id)).some((r) => r.id === id)).toBe(false);
    expect((await listReviewsAdmin({ status: "hidden" })).rows.some((r) => r.id === id && r.hiddenReason === "Contains a phone number")).toBe(true);

    // Editing a hidden review does not republish it.
    await submitReview(o.orderId, { orderItemId: o.itemId, rating: 2, comment: "Edited", displayName: "Sara" });
    expect((await db.query.reviews.findFirst({ where: eq(reviews.id, id) }))!.status).toBe("hidden");

    await setReviewStatus(id, "published", "", o.staff);
    await replyToReview(id, "Sorry — we have refunded the delay fee.", o.staff);
    const shown = (await listProductReviews(pubg.id)).find((r) => r.id === id)!;
    expect(shown.staffReply).toBe("Sorry — we have refunded the delay fee.");
    const logs = await db.select().from(auditLogs).where(eq(auditLogs.entityId, String(id)));
    expect(logs.map((l) => l.action)).toEqual(expect.arrayContaining(["review.hide", "review.publish", "review.reply"]));
  });
});

describe.skipIf(!hasDb)("order push notifications", () => {
  let orderId = "";
  beforeAll(async () => {
    orderId = (await createOrder(await checkoutInput(), { userId: null })).orderId;
  });

  const sub = (n: number) => ({ endpoint: `https://fcm.googleapis.com/fcm/send/device-${n}`, keys: { p256dh: `p256dh-key-${n}`, auth: `auth-key-${n}` } });

  it("keeps one stable VAPID key pair", async () => {
    const a = await getVapidKeys();
    const b = await getVapidKeys();
    expect(a).toEqual(b);
    expect(a.publicKey.length).toBeGreaterThan(40);
  });

  it("stores allowed subscriptions, ignores others, and caps devices per order", async () => {
    expect(await saveSubscription(orderId, { endpoint: "https://evil.example/hook", keys: { p256dh: "x".repeat(10), auth: "y".repeat(10) } }, "ar")).toBe(false);
    for (let i = 0; i < 7; i++) expect(await saveSubscription(orderId, sub(i), "ar")).toBe(true);
    await saveSubscription(orderId, sub(6), "en"); // same device again: updated, not duplicated
    const rows = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.orderId, orderId));
    expect(rows).toHaveLength(5);
    expect(rows.every((r) => r.endpoint.startsWith("https://fcm.googleapis.com/"))).toBe(true);
  });

  it("sends the status message to every device and drops expired ones", async () => {
    const sent: { endpoint: string; payload: Record<string, string>; subject: string }[] = [];
    const send: PushSender = async (s, payload, options) => {
      if (s.endpoint.endsWith("device-6")) throw Object.assign(new Error("gone"), { statusCode: 410 });
      sent.push({ endpoint: s.endpoint, payload: JSON.parse(payload), subject: options.vapidDetails!.subject });
      return { statusCode: 201 };
    };
    const result = await notifyCustomer(orderId, "paid", "https://store.example", { send });
    expect(result.push).toBe(4);
    expect(sent[0]!.payload).toMatchObject({ title: "تم تأكيد الدفع ✅" });
    expect(sent[0]!.payload.body).toContain("HDS-");
    expect(sent[0]!.payload.url).toMatch(/^\/ar\/track\?ref=HDS-/);
    expect(sent[0]!.subject).toBe("https://store.example");
    const left = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.orderId, orderId));
    expect(left.map((r) => r.endpoint)).not.toContain(sub(6).endpoint);
  });

  it("counts transient failures and gives up on a device after repeated ones", async () => {
    const failing: PushSender = async () => {
      throw Object.assign(new Error("busy"), { statusCode: 503 });
    };
    for (let i = 0; i < 6; i++) await pushToOrder(orderId, { title: "t", body: "b", url: "/", tag: "x", ref: "x" }, "https://store.example", { send: failing });
    expect(await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.orderId, orderId))).toHaveLength(0);
  });
});
