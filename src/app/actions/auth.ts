"use server";

import { redirect } from "next/navigation";
import { endSession, getCurrentUser, startSession } from "@/lib/auth/current-user";
import { isStaffRole } from "@/lib/auth/permissions";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { clientIp } from "@/lib/server/request";
import { anonymizeCustomer, authenticate, registerCustomer } from "@/lib/services/accounts";
import { consumeRateLimit, resetRateLimit } from "@/lib/services/rate-limit";
import { fieldErrors, loginSchema, registerSchema } from "@/lib/validation/schemas";
import type { ActionState } from "./types";

function localeOf(fd: FormData): Locale {
  const l = fd.get("locale");
  return isLocale(l) ? l : "ar";
}

/** Only same-site relative paths are allowed as post-login destinations (no open redirects). */
function safeNext(value: FormDataEntryValue | null, locale: Locale, fallback: string): string {
  const v = typeof value === "string" ? value : "";
  return /^\/(ar|en)(\/[\w\-/]*)?$/.test(v) && !v.startsWith("//") ? v : `/${locale}${fallback}`;
}

async function login(fd: FormData, mode: "customer" | "staff"): Promise<ActionState> {
  const locale = localeOf(fd);
  const parsed = loginSchema.safeParse({ email: fd.get("email") ?? "", password: fd.get("password") ?? "" });
  if (!parsed.success) return { error: "invalidCredentials" };

  const ip = await clientIp();
  // Per-IP and per-account limits: slows both spraying and targeted guessing.
  const allowed = (await consumeRateLimit("login", ip)) && (await consumeRateLimit("loginAccount", parsed.data.email));
  if (!allowed) return { error: "rateLimited" };

  const result = await authenticate(parsed.data.email, parsed.data.password);
  if (!result.ok) return { error: result.reason === "suspended" ? "suspended" : "invalidCredentials" };
  // The admin login only accepts staff; reveal nothing about customer accounts there.
  if (mode === "staff" && !isStaffRole(result.user.role)) return { error: "invalidCredentials" };

  await resetRateLimit("loginAccount", parsed.data.email);
  await startSession(result.user);
  redirect(mode === "staff" ? `/${locale}/admin` : safeNext(fd.get("next"), locale, isStaffRole(result.user.role) ? "/admin" : "/account"));
}

export async function loginAction(_p: ActionState, fd: FormData) {
  return login(fd, "customer");
}

export async function adminLoginAction(_p: ActionState, fd: FormData) {
  return login(fd, "staff");
}

export async function registerAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const locale = localeOf(fd);
  const parsed = registerSchema.safeParse({
    name: fd.get("name") ?? "",
    email: fd.get("email") ?? "",
    phone: fd.get("phone") ?? "",
    password: fd.get("password") ?? "",
  });
  if (!parsed.success) return { error: "validation", fieldErrors: fieldErrors(parsed.error) };
  if (!(await consumeRateLimit("register", await clientIp()))) return { error: "rateLimited" };

  const user = await registerCustomer(parsed.data);
  // Generic message so the form cannot be used to enumerate registered emails.
  if (!user) return { error: "emailTaken" };
  await startSession(user);
  redirect(safeNext(fd.get("next"), locale, "/account"));
}

export async function logoutAction(fd: FormData) {
  await endSession();
  redirect(`/${localeOf(fd)}`);
}

export async function deleteOwnAccountAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "unauthorized" };
  if (isStaffRole(user.role)) return { error: "forbidden" };
  if (fd.get("confirm") !== "DELETE") return { error: "validation" };
  await anonymizeCustomer(user.id, { id: user.id, email: user.email, role: user.role });
  await endSession();
  redirect(`/${localeOf(fd)}`);
}
