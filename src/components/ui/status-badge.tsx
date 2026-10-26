import type { OrderStatus, PaymentStatus } from "@/lib/db/schema";
import type { Dictionary } from "@/lib/i18n";
import { Badge, type Tone } from "./badge";

const orderTone: Record<OrderStatus, Tone> = {
  pending_payment: "warning",
  payment_review: "info",
  paid: "brand",
  processing: "accent",
  completed: "success",
  cancelled: "neutral",
  rejected: "danger",
  refunded: "neutral",
};
const paymentTone: Record<PaymentStatus, Tone> = {
  awaiting: "warning",
  submitted: "info",
  confirmed: "success",
  rejected: "danger",
  refunded: "neutral",
};

export function OrderStatusBadge({ status, t }: { status: OrderStatus; t: Dictionary }) {
  return <Badge tone={orderTone[status]}>{t.orderStatus[status]}</Badge>;
}

export function PaymentStatusBadge({ status, t }: { status: PaymentStatus; t: Dictionary }) {
  return <Badge tone={paymentTone[status]}>{t.paymentStatus[status]}</Badge>;
}
