import { purgeExpiredSessions } from "@/lib/auth/session";
import { runRetention } from "./accounts";
import { purgeOldCodes } from "./auth-codes";
import { purgeOldRateLimits } from "./rate-limit";
import { loadSettings, saveSettings } from "./settings";
import { purgeOldThreads } from "./support";

const DAY = 24 * 60 * 60 * 1000;

/**
 * Daily housekeeping without a cron service: called after the admin dashboard
 * renders, and skipped unless 24 h have passed since the last run.
 * `npm run retention:run` remains available for scheduled runs.
 */
export async function maybeRunMaintenance(now = Date.now()): Promise<boolean> {
  const settings = await loadSettings();
  const last = Date.parse(settings.lastMaintenanceAt);
  if (Number.isFinite(last) && now - last < DAY) return false;
  // Claim the run first so concurrent dashboard loads don't repeat it.
  await saveSettings({ lastMaintenanceAt: new Date(now).toISOString() });
  try {
    await runRetention(settings.retentionDays);
    await purgeOldThreads(settings.retentionDays);
    await purgeExpiredSessions();
    await purgeOldRateLimits();
    await purgeOldCodes();
  } catch (e) {
    console.error("maintenance failed", e instanceof Error ? e.message : "unknown");
  }
  return true;
}
