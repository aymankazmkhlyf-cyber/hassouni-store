import "dotenv/config";
import { pool } from "../src/lib/db";
import { runRetention } from "../src/lib/services/accounts";
import { loadSettings } from "../src/lib/services/settings";
import { purgeExpiredSessions } from "../src/lib/auth/session";
import { purgeOldRateLimits } from "../src/lib/services/rate-limit";
import { purgeOldThreads } from "../src/lib/services/support";
import { purgeOldCodes } from "../src/lib/services/auth-codes";

/** Periodic maintenance: data-retention scrubbing + cleanup of expired sessions and rate-limit rows. */
async function main() {
  const settings = await loadSettings();
  const result = await runRetention(settings.retentionDays);
  const chats = await purgeOldThreads(settings.retentionDays);
  await purgeExpiredSessions();
  await purgeOldCodes();
  await purgeOldRateLimits();
  console.log(`Retention (${settings.retentionDays} days): scrubbed ${result.orders} orders, ${result.requests} requests; deleted ${chats} old support chats.`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
