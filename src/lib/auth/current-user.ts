import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Locale } from "@/lib/i18n/config";
import { hasPermission, isStaffRole, type Permission } from "./permissions";
import { createSession, invalidateSession, SESSION_COOKIE, validateSessionToken, type SessionUser } from "./session";
import { userAgent } from "@/lib/server/request";

export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return validateSessionToken(token);
});

export async function startSession(user: Pick<SessionUser, "id" | "role">) {
  const { token, expiresAt } = await createSession(user, await userAgent());
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function endSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await invalidateSession(token);
  jar.delete(SESSION_COOKIE);
}

export class AuthError extends Error {
  constructor(public readonly code: "unauthorized" | "forbidden") {
    super(code);
  }
}

/** For server actions / route handlers: throws instead of redirecting. */
export async function assertPermission(permission: Permission): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user || !isStaffRole(user.role)) throw new AuthError("unauthorized");
  if (!hasPermission(user.role, permission)) throw new AuthError("forbidden");
  return user;
}

/** For admin pages: redirects to the admin login, or renders 403 via redirect to dashboard. */
export async function requireStaffPage(locale: Locale, permission: Permission = "dashboard:view"): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user || !isStaffRole(user.role)) redirect(`/${locale}/admin/login`);
  if (!hasPermission(user.role, permission)) redirect(`/${locale}/admin?denied=1`);
  return user;
}

export async function requireCustomerPage(locale: Locale): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  return user;
}
