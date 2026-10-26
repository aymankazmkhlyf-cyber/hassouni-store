"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertPermission, AuthError, getCurrentUser } from "@/lib/auth/current-user";
import { normalizePhone } from "@/lib/domain/phone";
import { isLocale } from "@/lib/i18n/config";
import { clientIp, siteUrl } from "@/lib/server/request";
import { consumeRateLimit } from "@/lib/services/rate-limit";
import { findLatestPrivateChat, sendTelegram, telegramConfigured } from "@/lib/services/notify";
import { loadSettings, saveSettings } from "@/lib/services/settings";
import { audit } from "@/lib/services/audit";
import { addCustomerMessage, addStaffMessage, getThreadByToken, MAX_MESSAGE_LENGTH, setThreadStatus, startThread, SUPPORT_COOKIE } from "@/lib/services/support";

export type SupportSendResult = { ok: true } | { ok: false; error: "validation" | "rateLimited" | "invalidPhone" | "generic" };

const startSchema = z.object({
  name: z.string().trim().min(2).max(60),
  phone: z.string().trim().max(30),
  message: z.string().trim().min(1).max(MAX_MESSAGE_LENGTH),
  locale: z.string(),
});

/** Customer sends a chat message. The first message opens a conversation tied to an httpOnly cookie. */
export async function sendSupportMessageAction(input: { name?: string; phone?: string; message: string; locale: string }): Promise<SupportSendResult> {
  const ip = await clientIp();
  if (!(await consumeRateLimit("supportMessage", ip))) return { ok: false, error: "rateLimited" };
  const jar = await cookies();
  const existing = await getThreadByToken(jar.get(SUPPORT_COOKIE)?.value);
  try {
    if (existing) {
      const msg = z.string().trim().min(1).max(MAX_MESSAGE_LENGTH).safeParse(input.message);
      if (!msg.success) return { ok: false, error: "validation" };
      await addCustomerMessage(existing, msg.data, undefined, { baseUrl: await siteUrl() });
      return { ok: true };
    }
    const parsed = startSchema.safeParse({ ...input, name: input.name ?? "", phone: input.phone ?? "" });
    if (!parsed.success) return { ok: false, error: "validation" };
    const phone = parsed.data.phone ? normalizePhone(parsed.data.phone) : null;
    if (parsed.data.phone && !phone) return { ok: false, error: "invalidPhone" };
    if (!(await consumeRateLimit("supportStart", ip))) return { ok: false, error: "rateLimited" };
    const user = await getCurrentUser();
    const { token } = await startThread({
      name: parsed.data.name,
      phone,
      locale: isLocale(parsed.data.locale) ? parsed.data.locale : "ar",
      userId: user?.id ?? null,
      firstMessage: parsed.data.message,
      baseUrl: await siteUrl(),
    });
    jar.set(SUPPORT_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 90 * 24 * 60 * 60,
    });
    return { ok: true };
  } catch (e) {
    console.error("support send failed", e instanceof Error ? e.message : "unknown");
    return { ok: false, error: "generic" };
  }
}

/* --------------------------------- Staff --------------------------------- */

export async function staffReplyAction(threadId: string, body: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const user = await assertPermission("support:manage");
    const ok = await addStaffMessage(threadId, body, { id: user.id, email: user.email, role: user.role });
    return ok ? { ok: true } : { ok: false, error: "validation" };
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: e.code };
    return { ok: false, error: "generic" };
  }
}

export async function setThreadStatusAction(fd: FormData) {
  const user = await assertPermission("support:manage");
  const id = z.uuid().safeParse(fd.get("id"));
  if (!id.success) return;
  await setThreadStatus(id.data, fd.get("status") === "closed" ? "closed" : "open", { id: user.id, email: user.email, role: user.role });
  revalidatePath("/[locale]/admin/support", "layout");
}

export type LinkTelegramResult = { ok: true; name: string } | { ok: false; error: "notConfigured" | "noChat" | "sendFailed" | "forbidden" };

/** Links the Telegram chat of whoever last pressed Start on the bot, then sends a test alert. */
export async function linkTelegramAction(): Promise<LinkTelegramResult> {
  let user;
  try {
    user = await assertPermission("settings:write");
  } catch {
    return { ok: false, error: "forbidden" };
  }
  if (!telegramConfigured()) return { ok: false, error: "notConfigured" };
  const chat = await findLatestPrivateChat();
  if (!chat) return { ok: false, error: "noChat" };
  const sent = await sendTelegram(chat.id, "✅ تم ربط إشعارات متجر حسوني. راح توصلك هنا الطلبات الجديدة، وإثباتات الدفع، ورسائل الدعم من الزبائن.");
  if (!sent) return { ok: false, error: "sendFailed" };
  await saveSettings({ ...(await loadSettings()), telegramChatId: chat.id });
  await audit({ id: user.id, email: user.email, role: user.role }, "support.telegram_link", "settings", "store", {});
  revalidatePath("/[locale]/admin/support", "layout");
  return { ok: true, name: chat.name };
}
