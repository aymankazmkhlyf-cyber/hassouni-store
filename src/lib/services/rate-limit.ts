import { sql } from "drizzle-orm";
import { db, type DbOrTx } from "@/lib/db";
import { hmac } from "@/lib/domain/tokens";

export type RateLimitRule = { limit: number; windowSeconds: number };

export const RATE_LIMITS = {
  login: { limit: 8, windowSeconds: 15 * 60 },
  loginAccount: { limit: 10, windowSeconds: 60 * 60 },
  register: { limit: 5, windowSeconds: 60 * 60 },
  checkout: { limit: 10, windowSeconds: 60 * 60 },
  orderLookup: { limit: 20, windowSeconds: 15 * 60 },
  paymentProof: { limit: 10, windowSeconds: 60 * 60 },
  customRequest: { limit: 5, windowSeconds: 60 * 60 },
} as const satisfies Record<string, RateLimitRule>;

export type RateLimitBucket = keyof typeof RATE_LIMITS;

/**
 * Atomic fixed-window counter stored in Postgres, so limits hold across
 * serverless instances. Identifiers are HMAC'd — raw IPs are never stored.
 * Returns true when the request is allowed.
 */
export async function consumeRateLimit(bucket: RateLimitBucket, identifier: string, conn: DbOrTx = db): Promise<boolean> {
  const rule = RATE_LIMITS[bucket];
  const key = hmac(`${bucket}:${identifier}`);
  const result = await conn.execute<{ count: number }>(sql`
    INSERT INTO rate_limits (bucket, key, window_start, count)
    VALUES (${bucket}, ${key}, now(), 1)
    ON CONFLICT (bucket, key) DO UPDATE SET
      count = CASE WHEN rate_limits.window_start < now() - make_interval(secs => ${rule.windowSeconds})
                   THEN 1 ELSE rate_limits.count + 1 END,
      window_start = CASE WHEN rate_limits.window_start < now() - make_interval(secs => ${rule.windowSeconds})
                   THEN now() ELSE rate_limits.window_start END
    RETURNING count
  `);
  const count = Number(result.rows[0]?.count ?? 0);
  return count <= rule.limit;
}

export async function resetRateLimit(bucket: RateLimitBucket, identifier: string, conn: DbOrTx = db) {
  await conn.execute(sql`DELETE FROM rate_limits WHERE bucket = ${bucket} AND key = ${hmac(`${bucket}:${identifier}`)}`);
}

export async function purgeOldRateLimits(conn: DbOrTx = db) {
  await conn.execute(sql`DELETE FROM rate_limits WHERE window_start < now() - interval '1 day'`);
}
