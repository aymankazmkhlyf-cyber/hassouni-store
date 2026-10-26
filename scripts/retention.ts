import "dotenv/config";
import { pool } from "../src/lib/db";
import { runRetention } from "../src/lib/services/accounts";
import { loadSettings } from "../src/lib/services/settings";
import { purgeExpiredSessions } from "../src/lib/auth/session";
import { purgeOldRateLimits } from "../src/lib/services/rate-limit";

/** Periodic maintenance: data-retention scrubbing + cleanup of expired sessions and rate-limit rows. */
async function main() {
  const settings = await loadSettings();
  const result = await runRetention(settings.retentionDays);
  await purgeExpiredSessions();
  await purgeOldRateLimits();
  console.log(`Retention (${settings.retentionDays} days): scrubbed ${result.orders} orders, ${result.requests} requests.`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
