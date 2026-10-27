"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/current-user";
import { checkUpload } from "@/lib/domain/file-signature";
import { formatIQD } from "@/lib/domain/money";
import { clientIp, siteUrl } from "@/lib/server/request";
import { notifyStaff } from "@/lib/services/notify";
import { ServiceError } from "@/lib/services/orders";
import { consumeRateLimit } from "@/lib/services/rate-limit";
import { createTopup, setUsername } from "@/lib/services/wallet";
import type { ActionState } from "./types";

const topupSchema = z.object({
  amount: z.coerce.number().int("topupAmount").min(1000, "topupAmount").max(5_000_000, "topupAmount"),
  methodId: z.coerce.number().int().positive("paymentMethod"),
  customerReference: z.string().trim().max(100).default(""),
});

async function customer() {
  const user = await getCurrentUser();
  return user && user.role === "customer" ? user : null;
}

/** Older accounts choose their wallet username once. */
export async function setUsernameAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await customer();
  if (!user) return { error: "unauthorized" };
  try {
    await setUsername(user.id, String(fd.get("username") ?? ""));
  } catch (e) {
    if (e instanceof ServiceError) return { error: e.code, fieldErrors: { username: e.code } };
    throw e;
  }
  revalidatePath("/[locale]/account", "layout");
  return { ok: true };
}

/** Customer paid through a manual method and asks for the amount to be added to the wallet. */
export async function requestTopupAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await customer();
  if (!user) return { error: "unauthorized" };
  if (!(await consumeRateLimit("walletTopup", await clientIp()))) return { error: "rateLimited" };
  const parsed = topupSchema.safeParse({ amount: fd.get("amount"), methodId: fd.get("methodId"), customerReference: fd.get("customerReference") ?? "" });
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message;
    return { error: first === "paymentMethod" ? "paymentMethod" : first === "topupAmount" ? "topupAmount" : "validation" };
  }
  const file = fd.get("receipt");
  let receipt: { mime: string; bytes: Buffer } | null = null;
  if (file instanceof File && file.size > 0) {
    const checked = await checkUpload(file, ["image/jpeg", "image/png", "image/webp", "application/pdf"]);
    if (!checked.ok) return { error: checked.error };
    receipt = { mime: checked.mime, bytes: checked.bytes };
  }
  let created: { id: string; methodNameAr: string };
  try {
    created = await createTopup(user.id, { amount: parsed.data.amount, methodId: parsed.data.methodId, customerReference: parsed.data.customerReference || null, receipt });
  } catch (e) {
    if (e instanceof ServiceError) return { error: e.code };
    console.error("topup failed", e instanceof Error ? e.message : "unknown");
    return { error: "generic" };
  }
  const base = await siteUrl();
  after(() =>
    notifyStaff(
      `👛 طلب شحن محفظة\n👤 ${user.name}${user.username ? ` (@${user.username})` : ""}\n💰 ${formatIQD(parsed.data.amount, "ar")} — ${created.methodNameAr}${parsed.data.customerReference ? `\n🔢 رقم العملية: ${parsed.data.customerReference}` : ""}${receipt ? "\n📎 مع صورة إيصال" : ""}\n\n✅ راجع: ${base}/ar/admin/wallet`,
    ),
  );
  revalidatePath("/[locale]/account/wallet", "page");
  return { ok: true };
}
