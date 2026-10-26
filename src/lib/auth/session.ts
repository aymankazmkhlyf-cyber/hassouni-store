import { and, eq, gt, lt } from "drizzle-orm";
import { db, type DbOrTx } from "@/lib/db";
import { sessions, users, type User } from "@/lib/db/schema";
import { generateSessionToken, sha256 } from "@/lib/domain/tokens";

export const SESSION_COOKIE = process.env.NODE_ENV === "production" ? "__Host-hds_session" : "hds_session";

const DAY = 24 * 60 * 60 * 1000;
/** Staff sessions are short-lived; customer sessions last longer. */
export function sessionLifetimeMs(role: User["role"]): number {
  return role === "customer" ? 30 * DAY : 12 * 60 * 60 * 1000;
}

export type SessionUser = Pick<User, "id" | "email" | "name" | "phone" | "role" | "status">;

export async function createSession(user: Pick<User, "id" | "role">, userAgent: string | null, conn: DbOrTx = db) {
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + sessionLifetimeMs(user.role));
  await conn.insert(sessions).values({
    id: sha256(token),
    userId: user.id,
    expiresAt,
    userAgent: userAgent?.slice(0, 200) ?? null,
  });
  return { token, expiresAt };
}

/** Looks up a session by raw token; returns null for missing, expired or suspended. */
export async function validateSessionToken(token: string, conn: DbOrTx = db): Promise<SessionUser | null> {
  if (!token || token.length > 100) return null;
  const rows = await conn
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      phone: users.phone,
      role: users.role,
      status: users.status,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, sha256(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);
  const user = rows[0];
  if (!user || user.status !== "active") return null;
  return user;
}

export async function invalidateSession(token: string, conn: DbOrTx = db) {
  await conn.delete(sessions).where(eq(sessions.id, sha256(token)));
}

export async function invalidateUserSessions(userId: string, conn: DbOrTx = db) {
  await conn.delete(sessions).where(eq(sessions.userId, userId));
}

export async function purgeExpiredSessions(conn: DbOrTx = db) {
  await conn.delete(sessions).where(lt(sessions.expiresAt, new Date()));
}
