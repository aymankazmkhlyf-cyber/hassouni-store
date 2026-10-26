import type { OrderStatus } from "@/lib/db/schema";

export const ORDER_STATUSES: readonly OrderStatus[] = [
  "pending_payment",
  "payment_review",
  "paid",
  "processing",
  "completed",
  "cancelled",
  "rejected",
  "refunded",
];

/**
 * Allowed transitions. Anything not listed is rejected server-side.
 * - Once money is confirmed (paid and later) the order can only end as completed or refunded.
 * - cancelled / rejected / refunded are terminal.
 */
const TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  pending_payment: ["payment_review", "paid", "cancelled", "rejected"],
  payment_review: ["paid", "pending_payment", "cancelled", "rejected"],
  paid: ["processing", "completed", "refunded"],
  processing: ["completed", "refunded"],
  completed: ["refunded"],
  cancelled: [],
  rejected: [],
  refunded: [],
};

export function allowedTransitions(from: OrderStatus): readonly OrderStatus[] {
  return TRANSITIONS[from];
}

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/** Statuses in which the store has actually received the money. */
export const CONFIRMED_REVENUE_STATUSES: readonly OrderStatus[] = ["paid", "processing", "completed"];

/** A customer may upload / replace payment proof only before payment is confirmed. */
export function customerCanSubmitPayment(status: OrderStatus): boolean {
  return status === "pending_payment" || status === "payment_review";
}

export function isTerminal(status: OrderStatus): boolean {
  return TRANSITIONS[status].length === 0;
}
