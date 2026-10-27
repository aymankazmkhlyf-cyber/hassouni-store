"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { normalizeReference } from "@/lib/domain/tokens";
import { clientIp, siteUrl } from "@/lib/server/request";
import { notifyStaff } from "@/lib/services/notify";
import { getOrderByAccessKey, getOrderForUser, ServiceError } from "@/lib/services/orders";
import { consumeRateLimit } from "@/lib/services/rate-limit";
import { submitReview } from "@/lib/services/reviews";
import { fieldErrors, reviewSchema } from "@/lib/validation/schemas";
import type { ActionState } from "./types";

/** Verified-buyer review: same access rule as the order page (reference + key, or the logged-in owner). */
export async function submitReviewAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const reference = normalizeReference(String(formData.get("reference") ?? ""));
  const key = String(formData.get("key") ?? "");
  if (!(await consumeRateLimit("review", await clientIp()))) return { error: "rateLimited" };

  const user = await getCurrentUser();
  const order = key ? await getOrderByAccessKey(reference, key) : user ? await getOrderForUser(reference, user.id) : null;
  if (!order) return { error: "notFoundOrder" };

  const parsed = reviewSchema.safeParse({
    orderItemId: formData.get("orderItemId"),
    rating: formData.get("rating") ?? 0,
    comment: formData.get("comment") ?? "",
    displayName: formData.get("displayName") ?? "",
  });
  if (!parsed.success) {
    const fe = fieldErrors(parsed.error);
    return { error: Object.values(fe)[0] ?? "validation", fieldErrors: fe };
  }

  let result: { id: number; created: boolean };
  try {
    result = await submitReview(order.id, parsed.data);
  } catch (e) {
    if (e instanceof ServiceError) return { error: e.code };
    console.error("review failed", e instanceof Error ? e.message : "unknown");
    return { error: "generic" };
  }

  if (result.created) {
    const item = order.items.find((i) => i.id === parsed.data.orderItemId);
    const base = await siteUrl();
    after(() =>
      notifyStaff(
        `⭐ تقييم جديد ${"★".repeat(parsed.data.rating)}${"☆".repeat(5 - parsed.data.rating)}\n🛍️ ${item?.productNameAr ?? ""} — ${order.reference}${parsed.data.comment ? `\n💬 ${parsed.data.comment.slice(0, 300)}` : ""}\n\n${base}/ar/admin/reviews`,
      ),
    );
  }
  revalidatePath("/[locale]/services/[slug]", "page");
  revalidatePath("/[locale]", "page");
  return { ok: true, message: result.created ? "created" : "updated" };
}
