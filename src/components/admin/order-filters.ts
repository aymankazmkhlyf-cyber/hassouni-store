import { ORDER_STATUSES } from "@/lib/domain/order-status";
import type { OrderFilters } from "@/lib/services/admin-orders";
import type { OrderStatus, PaymentStatus } from "@/lib/db/schema";

const PAYMENT_STATUSES: PaymentStatus[] = ["awaiting", "submitted", "confirmed", "rejected", "refunded"];

type Query = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Parses and whitelists order filters from a query string (shared by the list page and CSV export). */
export function parseOrderFilters(q: Query | URLSearchParams): OrderFilters {
  const get = (k: string) => (q instanceof URLSearchParams ? (q.get(k) ?? undefined) : one(q[k]));
  const status = get("status");
  const paymentStatus = get("paymentStatus");
  const page = Number(get("page"));
  const date = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);
  return {
    q: get("q")?.slice(0, 80) || undefined,
    status: ORDER_STATUSES.includes(status as OrderStatus) ? (status as OrderStatus) : undefined,
    paymentStatus: PAYMENT_STATUSES.includes(paymentStatus as PaymentStatus) ? (paymentStatus as PaymentStatus) : undefined,
    method: get("method")?.replace(/[^a-z0-9_]/g, "").slice(0, 40) || undefined,
    from: date(get("from")),
    to: date(get("to")),
    page: Number.isSafeInteger(page) && page > 0 ? page : 1,
  };
}

export function filtersToParams(f: OrderFilters): Record<string, string | undefined> {
  return { q: f.q, status: f.status, paymentStatus: f.paymentStatus, method: f.method, from: f.from, to: f.to };
}

export { PAYMENT_STATUSES };
