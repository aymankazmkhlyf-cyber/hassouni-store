"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { endSession, getCurrentUser } from "@/lib/auth/current-user";
import { isStaffRole } from "@/lib/auth/permissions";
import { isLocale } from "@/lib/i18n/config";
import { clientIp } from "@/lib/server/request";
import { changePasswordWithCode, requestPasswordChange, requestPasswordReset, resetPasswordWithCode } from "@/lib/services/auth-codes";
import { consumeRateLimit } from "@/lib/services/rate-limit";
import type { ActionState } from "./types";

const localeOf = (fd: FormData) => (isLocale(fd.get("locale")) ? (fd.get("locale") as "ar" | "en") : "ar");
const email = z.string().trim().toLowerCase().max(200).pipe(z.email());
const str = (fd: FormData, k: string) => String(fd.get(k) ?? "");

function checkNew(fd: FormData): string | null {
  const pw = str(fd, "password");
  if (pw.length < 12 || pw.length > 200) return "weak";
  if (pw !== str(fd, "confirm")) return "mismatch";
  return null;
}

/* ---------------------------- Forgot password --------------------------- */

export async function requestResetAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = email.safeParse(fd.get("email"));
  // Same answer for malformed and unknown emails.
  if (!parsed.success) return { ok: true, data: { email: str(fd, "email") } };
  const ip = await clientIp();
  if (!(await consumeRateLimit("codeRequestIp", ip)) || !(await consumeRateLimit("codeRequestAccount", parsed.data))) return { error: "rateLimited" };
  const r = await requestPasswordReset(parsed.data);
  if (r === "not_configured") return { error: "not_configured" };
  return { ok: true, data: { email: parsed.data } };
}

export async function resetWithCodeAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const bad = checkNew(fd);
  if (bad) return { error: bad, data: { email: str(fd, "email") } };
  if (!(await consumeRateLimit("codeVerify", await clientIp()))) return { error: "rateLimited", data: { email: str(fd, "email") } };
  const r = await resetPasswordWithCode(str(fd, "email"), str(fd, "code"), str(fd, "password"));
  if (!r.ok) return { error: r.reason, data: { email: str(fd, "email") } };
  redirect(`/${localeOf(fd)}/admin/login?reset=1`);
}

/* ----------------------- Change password (logged in) -------------------- */

export async function requestChangeAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user || !isStaffRole(user.role)) return { error: "unauthorized" };
  if (!(await consumeRateLimit("codeRequestAccount", user.email))) return { error: "rateLimited" };
  const r = await requestPasswordChange(user.id, str(fd, "current"));
  return r === "sent" ? { ok: true, data: { step: "code" } } : { error: r };
}

export async function changeWithCodeAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user || !isStaffRole(user.role)) return { error: "unauthorized" };
  const bad = checkNew(fd);
  if (bad) return { error: bad, data: { step: "code" } };
  if (!(await consumeRateLimit("codeVerify", await clientIp()))) return { error: "rateLimited", data: { step: "code" } };
  const r = await changePasswordWithCode(user.id, str(fd, "code"), str(fd, "password"));
  if (!r.ok) return { error: r.reason, data: { step: "code" } };
  // All sessions were revoked, including this one; log in again with the new password.
  await endSession();
  redirect(`/${localeOf(fd)}/admin/login?changed=1`);
}
