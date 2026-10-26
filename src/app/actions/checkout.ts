"use server";

import { getCurrentUser } from "@/lib/auth/current-user";
import { clientIp } from "@/lib/server/request";
import { consumeRateLimit } from "@/lib/services/rate-limit";
import { createOrder, ServiceError } from "@/lib/services/orders";
import { checkoutSchema, fieldErrors } from "@/lib/validation/schemas";
import type { ActionState } from "./types";

/**
 * Places an order. The browser sends only product IDs, package IDs, quantities
 * and field values — the total is computed on the server from the database.
 */
export async function placeOrderAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let items: unknown;
  try {
    items = JSON.parse(String(formData.get("items") ?? "[]"));
  } catch {
    return { error: "cartInvalid" };
  }
  const parsed = checkoutSchema.safeParse({
    idempotencyKey: formData.get("idempotencyKey"),
    customerName: formData.get("customerName") ?? "",
    customerPhone: formData.get("customerPhone") ?? "",
    customerEmail: formData.get("customerEmail") ?? "",
    paymentMethodId: formData.get("paymentMethodId") ?? "",
    customerNotes: formData.get("customerNotes") ?? "",
    acceptTerms: formData.get("acceptTerms") ?? undefined,
    locale: formData.get("locale") ?? "ar",
    items,
  });
  if (!parsed.success) {
    const fe = fieldErrors(parsed.error);
    const itemError = Object.keys(fe).some((k) => k.startsWith("items"));
    return { error: itemError ? "cartInvalid" : "validation", fieldErrors: fe };
  }

  if (!(await consumeRateLimit("checkout", await clientIp()))) return { error: "rateLimited" };

  const user = await getCurrentUser();
  try {
    const order = await createOrder(parsed.data, { userId: user?.id ?? null });
    const locale = parsed.data.locale;
    return {
      ok: true,
      data: { redirectTo: `/${locale}/orders/${order.reference}?key=${order.accessKey}&new=1` },
    };
  } catch (e) {
    if (e instanceof ServiceError) return { error: e.code };
    console.error("checkout failed", e instanceof Error ? e.message : "unknown");
    return { error: "generic" };
  }
}
