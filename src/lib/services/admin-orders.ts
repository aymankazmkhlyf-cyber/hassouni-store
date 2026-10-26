import { and, count, desc, eq, gte, ilike, inArray, lt, notInArray, or, sql, sum, type SQL } from "drizzle-orm";
import { db, type DbOrTx } from "@/lib/db";
import { orderItems, orders, payments, type OrderStatus, type PaymentStatus } from "@/lib/db/schema";
import { CONFIRMED_REVENUE_STATUSES } from "@/lib/domain/order-status";
import { escapeLike } from "./catalog";

export type OrderFilters = {
  q?: string;
  status?: OrderStatus;
  method?: string;
  paymentStatus?: PaymentStatus;
  /** YYYY-MM-DD, interpreted in Baghdad time (UTC+3, no DST). */
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
};

/** Status of the most recent payment record for each order. */
const latestPaymentStatus = sql<PaymentStatus | null>`(SELECT p.status FROM payments p WHERE p.order_id = "orders"."id" ORDER BY p.created_at DESC LIMIT 1)`;

function baghdadDayStart(date: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const d = new Date(`${date}T00:00:00+03:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function buildOrderWhere(f: OrderFilters): SQL | undefined {
  const where: SQL[] = [];
  const q = f.q?.trim().slice(0, 80);
  if (q) {
    const pattern = `%${escapeLike(q)}%`;
    const phoneDigits = q.replace(/\D/g, "");
    const conds = [ilike(orders.reference, pattern), ilike(orders.customerName, pattern)];
    if (phoneDigits.length >= 4) conds.push(ilike(orders.customerPhone, `%${phoneDigits.replace(/^0/, "")}%`));
    where.push(or(...conds)!);
  }
  if (f.status) where.push(eq(orders.status, f.status));
  if (f.method) where.push(eq(orders.paymentMethodCode, f.method));
  if (f.paymentStatus) where.push(sql`${latestPaymentStatus} = ${f.paymentStatus}`);
  const from = f.from ? baghdadDayStart(f.from) : null;
  if (from) where.push(gte(orders.createdAt, from));
  const to = f.to ? baghdadDayStart(f.to) : null;
  if (to) where.push(lt(orders.createdAt, new Date(to.getTime() + 24 * 60 * 60 * 1000)));
  return where.length ? and(...where) : undefined;
}

export async function listOrders(f: OrderFilters, conn: DbOrTx = db) {
  const pageSize = Math.min(Math.max(f.pageSize ?? 20, 1), 100);
  const page = Math.max(f.page ?? 1, 1);
  const where = buildOrderWhere(f);
  const [rows, totalRow] = await Promise.all([
    conn
      .select({
        id: orders.id,
        reference: orders.reference,
        customerName: orders.customerName,
        customerPhone: orders.customerPhone,
        status: orders.status,
        paymentMethodCode: orders.paymentMethodCode,
        paymentMethodNameAr: orders.paymentMethodNameAr,
        paymentMethodNameEn: orders.paymentMethodNameEn,
        total: orders.total,
        createdAt: orders.createdAt,
        paymentStatus: latestPaymentStatus,
      })
      .from(orders)
      .where(where)
      .orderBy(desc(orders.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    conn.select({ n: count() }).from(orders).where(where),
  ]);
  const total = totalRow[0]?.n ?? 0;
  return { rows, total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function exportOrders(f: OrderFilters, conn: DbOrTx = db) {
  return conn
    .select({
      reference: orders.reference,
      createdAt: orders.createdAt,
      status: orders.status,
      paymentStatus: latestPaymentStatus,
      paymentMethod: orders.paymentMethodCode,
      total: orders.total,
      items: sql<number>`(SELECT count(*) FROM order_items i WHERE i.order_id = "orders"."id")`.mapWith(Number),
      customerName: orders.customerName,
      customerPhone: orders.customerPhone,
      customerEmail: orders.customerEmail,
    })
    .from(orders)
    .where(buildOrderWhere(f))
    .orderBy(desc(orders.createdAt))
    .limit(10_000);
}

export async function dashboardStats(conn: DbOrTx = db) {
  const [byStatus, revenueRow, grossRow, recent, best] = await Promise.all([
    conn.select({ status: orders.status, n: count() }).from(orders).groupBy(orders.status),
    conn
      .select({ v: sum(orders.total).mapWith(Number) })
      .from(orders)
      .where(inArray(orders.status, [...CONFIRMED_REVENUE_STATUSES])),
    conn
      .select({ v: sum(orders.total).mapWith(Number) })
      .from(orders)
      .where(notInArray(orders.status, ["cancelled", "rejected"])),
    conn
      .select({
        id: orders.id,
        reference: orders.reference,
        customerName: orders.customerName,
        status: orders.status,
        total: orders.total,
        createdAt: orders.createdAt,
      })
      .from(orders)
      .orderBy(desc(orders.createdAt))
      .limit(8),
    // Best sellers come only from orders where payment was confirmed.
    conn
      .select({
        productId: orderItems.productId,
        nameAr: sql<string>`max(${orderItems.productNameAr})`,
        nameEn: sql<string>`max(${orderItems.productNameEn})`,
        units: sum(orderItems.quantity).mapWith(Number),
        revenue: sum(orderItems.lineTotal).mapWith(Number),
      })
      .from(orderItems)
      .innerJoin(orders, eq(orders.id, orderItems.orderId))
      .where(inArray(orders.status, [...CONFIRMED_REVENUE_STATUSES]))
      .groupBy(orderItems.productId)
      .orderBy(desc(sum(orderItems.lineTotal)))
      .limit(5),
  ]);
  const countOf = (s: OrderStatus) => byStatus.find((r) => r.status === s)?.n ?? 0;
  return {
    totalOrders: byStatus.reduce((a, r) => a + r.n, 0),
    pendingPayment: countOf("pending_payment"),
    paymentReview: countOf("payment_review"),
    completed: countOf("completed"),
    confirmedRevenue: revenueRow[0]?.v ?? 0,
    grossValue: grossRow[0]?.v ?? 0,
    recent,
    bestSellers: best,
  };
}

/** Payment methods that appear in existing orders (for the filter dropdown). */
export async function orderPaymentMethodCodes(conn: DbOrTx = db) {
  const rows = await conn.selectDistinct({ code: payments.methodCode }).from(payments);
  return rows.map((r) => r.code);
}
