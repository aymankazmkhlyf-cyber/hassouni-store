import { randomInt } from "node:crypto";
import { and, desc, eq, isNull, lt } from "drizzle-orm";
import { db, type DbOrTx } from "@/lib/db";
import { authCodes, users } from "@/lib/db/schema";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { invalidateUserSessions } from "@/lib/auth/session";
import { isStaffRole } from "@/lib/auth/permissions";
import { hmac, safeEqualHex } from "@/lib/domain/tokens";
import { audit } from "./audit";
import { emailConfigured, escapeHtml, sendEmail } from "./email";

export const CODE_TTL_MS = 10 * 60 * 1000;
export const MAX_CODE_ATTEMPTS = 5;
export const MIN_STAFF_PASSWORD = 12;

type Purpose = "password_reset" | "password_change";

/** Keyed hash: a leaked database cannot be used to brute-force the 6-digit codes offline. */
const codeHash = (userId: string, code: string) => hmac(`auth-code:${userId}:${code}`);

export function generateCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/** Creates a fresh code (older unused ones for the same purpose stop working) and emails it. */
export async function issueCode(
  user: { id: string; email: string; name: string },
  purpose: Purpose,
  conn: DbOrTx = db,
  deliver: (to: string, code: string) => Promise<boolean> = emailCode,
): Promise<boolean> {
  const code = generateCode();
  await conn
    .update(authCodes)
    .set({ usedAt: new Date() })
    .where(and(eq(authCodes.userId, user.id), eq(authCodes.purpose, purpose), isNull(authCodes.usedAt)));
  await conn.insert(authCodes).values({ userId: user.id, purpose, codeHash: codeHash(user.id, code), expiresAt: new Date(Date.now() + CODE_TTL_MS) });
  return deliver(user.email, code);
}

async function emailCode(to: string, code: string) {
  const subject = `رمز التحقق: ${code} — Hassouni Store`;
  const text = `رمز التحقق لتغيير كلمة المرور في لوحة تحكم متجر حسوني: ${code}\nصالح لمدة 10 دقائق. إذا لم تطلبه، تجاهل هذه الرسالة ولا تشاركه مع أحد.\n\nYour verification code for changing the Hassouni Store dashboard password: ${code}\nValid for 10 minutes. If you did not request it, ignore this email and never share it.`;
  const html = `<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;font-size:15px;line-height:1.7">
<p>رمز التحقق لتغيير كلمة المرور في لوحة تحكم <b>متجر حسوني</b>:</p>
<p style="font-size:30px;font-weight:700;letter-spacing:6px;direction:ltr">${escapeHtml(code)}</p>
<p>صالح لمدة 10 دقائق. إذا لم تطلبه، تجاهل هذه الرسالة ولا تشاركه مع أي أحد.</p>
<hr><p dir="ltr">Your Hassouni Store verification code is <b>${escapeHtml(code)}</b>. It expires in 10 minutes. Never share it.</p></div>`;
  return sendEmail(to, subject, text, html);
}

export type VerifyResult = { ok: true } | { ok: false; reason: "invalid" | "expired" | "too_many" };

/** Checks a code; every wrong guess counts, and the code dies after MAX_CODE_ATTEMPTS. */
export async function consumeCode(userId: string, purpose: Purpose, code: string, conn: DbOrTx = db): Promise<VerifyResult> {
  const [row] = await conn
    .select()
    .from(authCodes)
    .where(and(eq(authCodes.userId, userId), eq(authCodes.purpose, purpose), isNull(authCodes.usedAt)))
    .orderBy(desc(authCodes.createdAt))
    .limit(1);
  if (!row) return { ok: false, reason: "invalid" };
  if (row.expiresAt.getTime() < Date.now()) return { ok: false, reason: "expired" };
  if (row.attempts >= MAX_CODE_ATTEMPTS) return { ok: false, reason: "too_many" };
  const clean = code.replace(/\D/g, "");
  if (clean.length !== 6 || !safeEqualHex(row.codeHash, codeHash(userId, clean))) {
    await conn.update(authCodes).set({ attempts: row.attempts + 1 }).where(eq(authCodes.id, row.id));
    return { ok: false, reason: row.attempts + 1 >= MAX_CODE_ATTEMPTS ? "too_many" : "invalid" };
  }
  await conn.update(authCodes).set({ usedAt: new Date() }).where(eq(authCodes.id, row.id));
  return { ok: true };
}

/* ------------------------------- Flows -------------------------------- */

export type RequestResetResult = "sent" | "not_configured";

/**
 * Forgot password (staff only). Always reports "sent" for unknown emails so the
 * form cannot be used to discover which addresses have accounts.
 */
export async function requestPasswordReset(email: string, conn: DbOrTx = db, deliver?: (to: string, code: string) => Promise<boolean>): Promise<RequestResetResult> {
  if (!deliver && !emailConfigured()) return "not_configured";
  const user = await conn.query.users.findFirst({ where: eq(users.email, email.trim().toLowerCase()) });
  if (!user || !isStaffRole(user.role) || user.status !== "active") return "sent";
  await issueCode(user, "password_reset", conn, deliver);
  return "sent";
}

export async function resetPasswordWithCode(email: string, code: string, newPassword: string, conn: DbOrTx = db): Promise<VerifyResult | { ok: false; reason: "weak" }> {
  if (newPassword.length < MIN_STAFF_PASSWORD || newPassword.length > 200) return { ok: false, reason: "weak" };
  const user = await conn.query.users.findFirst({ where: eq(users.email, email.trim().toLowerCase()) });
  if (!user || !isStaffRole(user.role) || user.status !== "active") return { ok: false, reason: "invalid" };
  const r = await consumeCode(user.id, "password_reset", code, conn);
  if (!r.ok) return r;
  await conn.update(users).set({ passwordHash: await hashPassword(newPassword) }).where(eq(users.id, user.id));
  await invalidateUserSessions(user.id, conn);
  await audit({ id: user.id, email: user.email, role: user.role }, "auth.password_reset", "user", user.id, {}, conn);
  return { ok: true };
}

/** Logged-in change: current password first, then the emailed code. */
export async function requestPasswordChange(userId: string, currentPassword: string, conn: DbOrTx = db, deliver?: (to: string, code: string) => Promise<boolean>) {
  if (!deliver && !emailConfigured()) return "not_configured" as const;
  const user = await conn.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user || !(await verifyPassword(user.passwordHash, currentPassword))) return "wrong_password" as const;
  const sent = await issueCode(user, "password_change", conn, deliver);
  return sent ? ("sent" as const) : ("send_failed" as const);
}

export async function changePasswordWithCode(userId: string, code: string, newPassword: string, conn: DbOrTx = db): Promise<VerifyResult | { ok: false; reason: "weak" }> {
  if (newPassword.length < MIN_STAFF_PASSWORD || newPassword.length > 200) return { ok: false, reason: "weak" };
  const user = await conn.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) return { ok: false, reason: "invalid" };
  const r = await consumeCode(user.id, "password_change", code, conn);
  if (!r.ok) return r;
  await conn.update(users).set({ passwordHash: await hashPassword(newPassword) }).where(eq(users.id, user.id));
  await invalidateUserSessions(user.id, conn);
  await audit({ id: user.id, email: user.email, role: user.role }, "auth.password_change", "user", user.id, {}, conn);
  return { ok: true };
}

/** Housekeeping for retention: drop codes older than a day. */
export async function purgeOldCodes(conn: DbOrTx = db) {
  await conn.delete(authCodes).where(lt(authCodes.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000)));
}
