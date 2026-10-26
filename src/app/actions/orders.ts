"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { formatIQD } from "@/lib/domain/money";
import { notifyStaff } from "@/lib/services/notify";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/current-user";
import { checkUpload } from "@/lib/domain/file-signature";
import { isLocale } from "@/lib/i18n/config";
import { clientIp, siteUrl } from "@/lib/server/request";
import { getOrderByAccessKey, getOrderForUser, ServiceError, submitPaymentProof } from "@/lib/services/orders";
import { consumeRateLimit } from "@/lib/services/rate-limit";
import { paymentProofSchema, trackSchema } from "@/lib/validation/schemas";
import { normalizeAccessKey, normalizeReference } from "@/lib/domain/tokens";
import type { ActionState } from "./types";

export async function trackOrderAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const locale = isLocale(formData.get("locale")) ? (formData.get("locale") as "ar" | "en") : "ar";
  const parsed = trackSchema.safeParse({ reference: formData.get("reference"), key: formData.get("key") });
  if (!parsed.success) return { error: "notFoundOrder" };
  if (!(await consumeRateLimit("orderLookup", await clientIp()))) return { error: "rateLimited" };

  const order = await getOrderByAccessKey(parsed.data.reference, parsed.data.key);
  // Same response for unknown reference and wrong key.
  if (!order) return { error: "notFoundOrder" };
  redirect(`/${locale}/orders/${order.reference}?key=${normalizeAccessKey(parsed.data.key)}`);
}

/** Customer sends a transaction reference and/or receipt. Never marks the order as paid. */
export async function submitProofAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const reference = normalizeReference(String(formData.get("reference") ?? ""));
  const key = String(formData.get("key") ?? "");
  if (!(await consumeRateLimit("paymentProof", await clientIp()))) return { error: "rateLimited" };

  const user = await getCurrentUser();
  const order = key ? await getOrderByAccessKey(reference, key) : user ? await getOrderForUser(reference, user.id) : null;
  if (!order) return { error: "notFoundOrder" };

  const parsed = paymentProofSchema.safeParse({ customerReference: formData.get("customerReference") ?? "" });
  if (!parsed.success) return { error: "validation" };

  const file = formData.get("receipt");
  let receipt: { mime: string; bytes: Buffer } | null = null;
  if (file instanceof File && file.size > 0) {
    const checked = await checkUpload(file, ["image/jpeg", "image/png", "image/webp", "application/pdf"]);
    if (!checked.ok) return { error: checked.error };
    receipt = { mime: checked.mime, bytes: checked.bytes };
  }

  try {
    await submitPaymentProof(order.id, { customerReference: parsed.data.customerReference || null, receipt }, { userId: user?.id ?? null });
  } catch (e) {
    if (e instanceof ServiceError) return { error: e.code };
    console.error("payment proof failed", e instanceof Error ? e.message : "unknown");
    return { error: "generic" };
  }
  const base = await siteUrl();
  after(() =>
    notifyStaff(
      `🧾 إثبات دفع جديد للطلب ${order.reference}\n💰 ${formatIQD(order.total, "ar")} — ${order.paymentMethodNameAr}${parsed.data.customerReference ? `\n🔢 رقم العملية: ${parsed.data.customerReference}` : ""}${receipt ? "\n📎 مع صورة إيصال" : ""}\n\n✅ راجع وأكّد: ${base}/ar/admin/orders/${order.id}`,
    ),
  );
  revalidatePath(`/[locale]/orders/[reference]`, "page");
  return { ok: true };
}
