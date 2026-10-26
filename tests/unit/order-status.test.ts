import { describe, expect, it } from "vitest";
import { allowedTransitions, canTransition, CONFIRMED_REVENUE_STATUSES, customerCanSubmitPayment, isTerminal, ORDER_STATUSES } from "@/lib/domain/order-status";

describe("order status machine", () => {
  it("allows the normal happy path", () => {
    expect(canTransition("pending_payment", "payment_review")).toBe(true);
    expect(canTransition("payment_review", "paid")).toBe(true);
    expect(canTransition("paid", "processing")).toBe(true);
    expect(canTransition("processing", "completed")).toBe(true);
  });
  it("lets a rejected proof go back to pending payment", () => {
    expect(canTransition("payment_review", "pending_payment")).toBe(true);
  });
  it("never cancels or rejects money that was confirmed — it must be refunded", () => {
    for (const s of ["paid", "processing", "completed"] as const) {
      expect(canTransition(s, "cancelled")).toBe(false);
      expect(canTransition(s, "rejected")).toBe(false);
      expect(canTransition(s, "pending_payment")).toBe(false);
      expect(canTransition(s, "refunded")).toBe(true);
    }
  });
  it("cannot skip payment to completion", () => {
    expect(canTransition("pending_payment", "completed")).toBe(false);
    expect(canTransition("payment_review", "processing")).toBe(false);
  });
  it("treats cancelled/rejected/refunded as terminal", () => {
    for (const s of ["cancelled", "rejected", "refunded"] as const) {
      expect(isTerminal(s)).toBe(true);
      for (const to of ORDER_STATUSES) expect(canTransition(s, to)).toBe(false);
    }
  });
  it("has no self-transitions", () => {
    for (const s of ORDER_STATUSES) expect(allowedTransitions(s)).not.toContain(s);
  });
  it("only counts confirmed statuses as revenue", () => {
    expect([...CONFIRMED_REVENUE_STATUSES].sort()).toEqual(["completed", "paid", "processing"]);
  });
  it("allows payment proof only before confirmation", () => {
    expect(customerCanSubmitPayment("pending_payment")).toBe(true);
    expect(customerCanSubmitPayment("payment_review")).toBe(true);
    expect(customerCanSubmitPayment("paid")).toBe(false);
    expect(customerCanSubmitPayment("cancelled")).toBe(false);
  });
});
