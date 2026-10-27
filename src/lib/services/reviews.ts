import { and, count, desc, eq, sql, type SQL } from "drizzle-orm";
import { db, type DbOrTx } from "@/lib/db";
import { orderItems, orders, products, reviews, type ReviewStatus } from "@/lib/db/schema";
import type { ReviewInput } from "@/lib/validation/schemas";
import { audit, type Actor } from "./audit";
import { ServiceError } from "./orders";

/*
 * Reviews can only be written for a line of a COMPLETED order, through the
 * same access check as the order page (reference + key, or the logged-in
 * owner). That is what makes every review a "verified buyer" review. They are
 * published immediately; staff can hide abusive ones (with a reason) and reply,
 * but cannot edit what the customer wrote.
 */

/** A customer's first name, used as the default public display name. */
export function defaultDisplayName(customerName: string): string {
  const first = customerName.trim().split(/\s+/)[0] ?? "";
  return first.slice(0, 40);
}

export async function submitReview(orderId: string, input: ReviewInput, conn: DbOrTx = db) {
  return conn.transaction(async (tx) => {
    const [order] = await tx.select({ status: orders.status }).from(orders).where(eq(orders.id, orderId));
    if (!order) throw new ServiceError("notFound");
    if (order.status !== "completed") throw new ServiceError("reviewNotAllowed");
    const [item] = await tx
      .select({ id: orderItems.id, productId: orderItems.productId })
      .from(orderItems)
      .where(and(eq(orderItems.id, input.orderItemId), eq(orderItems.orderId, orderId)));
    if (!item) throw new ServiceError("notFound");

    const existing = await tx.query.reviews.findFirst({ where: eq(reviews.orderItemId, item.id), columns: { id: true } });
    const values = { rating: input.rating, comment: input.comment, displayName: input.displayName };
    if (existing) {
      // Editing keeps the moderation status: a hidden review is not republished by editing it.
      await tx.update(reviews).set(values).where(eq(reviews.id, existing.id));
      return { id: existing.id, created: false };
    }
    const [row] = await tx
      .insert(reviews)
      .values({ ...values, orderItemId: item.id, orderId, productId: item.productId })
      .returning({ id: reviews.id });
    return { id: row!.id, created: true };
  });
}

export async function reviewsForOrder(orderId: string, conn: DbOrTx = db) {
  return conn.query.reviews.findMany({ where: eq(reviews.orderId, orderId) });
}

export type RatingSummary = { average: number; count: number; distribution: [number, number, number, number, number] };

export async function productRatingSummary(productId: number, conn: DbOrTx = db): Promise<RatingSummary> {
  const rows = await conn
    .select({ rating: reviews.rating, n: count() })
    .from(reviews)
    .where(and(eq(reviews.productId, productId), eq(reviews.status, "published")))
    .groupBy(reviews.rating);
  const distribution: RatingSummary["distribution"] = [0, 0, 0, 0, 0];
  let total = 0;
  let sum = 0;
  for (const r of rows) {
    distribution[r.rating - 1] = r.n;
    total += r.n;
    sum += r.rating * r.n;
  }
  return { average: total ? Math.round((sum / total) * 10) / 10 : 0, count: total, distribution };
}

const publicColumns = {
  id: reviews.id,
  rating: reviews.rating,
  comment: reviews.comment,
  displayName: reviews.displayName,
  staffReply: reviews.staffReply,
  createdAt: reviews.createdAt,
  packageLabelAr: orderItems.packageLabelAr,
  packageLabelEn: orderItems.packageLabelEn,
};

export async function listProductReviews(productId: number, opts: { limit?: number } = {}, conn: DbOrTx = db) {
  return conn
    .select(publicColumns)
    .from(reviews)
    .innerJoin(orderItems, eq(orderItems.id, reviews.orderItemId))
    .where(and(eq(reviews.productId, productId), eq(reviews.status, "published")))
    .orderBy(desc(reviews.createdAt))
    .limit(Math.min(opts.limit ?? 20, 50));
}
export type PublicReview = Awaited<ReturnType<typeof listProductReviews>>[number];

/** Newest published reviews that have a written comment, across all active products. */
export async function latestReviews(limit = 6, conn: DbOrTx = db) {
  return conn
    .select({ ...publicColumns, productSlug: products.slug, productNameAr: products.nameAr, productNameEn: products.nameEn })
    .from(reviews)
    .innerJoin(orderItems, eq(orderItems.id, reviews.orderItemId))
    .innerJoin(products, eq(products.id, reviews.productId))
    .where(and(eq(reviews.status, "published"), eq(products.isActive, true), sql`${reviews.comment} <> ''`))
    .orderBy(desc(reviews.createdAt))
    .limit(limit);
}

/* ------------------------------------------------------------------ */
/* Admin                                                               */
/* ------------------------------------------------------------------ */

export type ReviewFilters = { status?: ReviewStatus; rating?: number; page?: number };

export async function listReviewsAdmin(f: ReviewFilters, conn: DbOrTx = db) {
  const pageSize = 25;
  const page = Math.max(f.page ?? 1, 1);
  const where: SQL[] = [];
  if (f.status) where.push(eq(reviews.status, f.status));
  if (f.rating && f.rating >= 1 && f.rating <= 5) where.push(eq(reviews.rating, f.rating));
  const condition = where.length ? and(...where) : undefined;
  const [rows, totalRow] = await Promise.all([
    conn
      .select({
        id: reviews.id,
        rating: reviews.rating,
        comment: reviews.comment,
        displayName: reviews.displayName,
        status: reviews.status,
        hiddenReason: reviews.hiddenReason,
        staffReply: reviews.staffReply,
        createdAt: reviews.createdAt,
        updatedAt: reviews.updatedAt,
        orderId: reviews.orderId,
        orderReference: orders.reference,
        productNameAr: orderItems.productNameAr,
        productNameEn: orderItems.productNameEn,
        packageLabelAr: orderItems.packageLabelAr,
        packageLabelEn: orderItems.packageLabelEn,
      })
      .from(reviews)
      .innerJoin(orderItems, eq(orderItems.id, reviews.orderItemId))
      .innerJoin(orders, eq(orders.id, reviews.orderId))
      .where(condition)
      .orderBy(desc(reviews.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    conn.select({ n: count() }).from(reviews).where(condition),
  ]);
  const total = totalRow[0]?.n ?? 0;
  return { rows, total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function setReviewStatus(id: number, status: ReviewStatus, reason: string, actor: Actor, conn: DbOrTx = db) {
  if (status === "hidden" && !reason.trim()) throw new ServiceError("reasonRequired");
  const [row] = await conn
    .update(reviews)
    .set({ status, hiddenReason: status === "hidden" ? reason.trim() : null })
    .where(eq(reviews.id, id))
    .returning({ id: reviews.id, rating: reviews.rating });
  if (!row) throw new ServiceError("notFound");
  await audit(actor, status === "hidden" ? "review.hide" : "review.publish", "review", id, { rating: row.rating, reason: reason.trim() || undefined }, conn);
}

export async function replyToReview(id: number, reply: string, actor: Actor, conn: DbOrTx = db) {
  const text = reply.trim();
  const [row] = await conn
    .update(reviews)
    .set({ staffReply: text || null, staffReplyAt: text ? new Date() : null })
    .where(eq(reviews.id, id))
    .returning({ id: reviews.id });
  if (!row) throw new ServiceError("notFound");
  await audit(actor, "review.reply", "review", id, { removed: !text || undefined }, conn);
}

/** Real numbers for the home page: completed orders and the overall published rating. */
export async function storeStats(conn: DbOrTx = db) {
  const [row] = await conn.execute<{ completed: number; rating: string | null; reviews: number }>(sql`
    SELECT (SELECT count(*) FROM orders WHERE status = 'completed')::int AS completed,
           (SELECT round(avg(rating)::numeric, 1) FROM reviews WHERE status = 'published')::text AS rating,
           (SELECT count(*) FROM reviews WHERE status = 'published')::int AS reviews`).then((r) => r.rows);
  return { completed: Number(row?.completed ?? 0), rating: row?.rating ? Number(row.rating) : null, reviews: Number(row?.reviews ?? 0) };
}
