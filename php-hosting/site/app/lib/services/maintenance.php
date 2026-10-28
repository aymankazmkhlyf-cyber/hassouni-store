<?php
declare(strict_types=1);

/**
 * Daily housekeeping without a cron job: runs after the admin dashboard is
 * shown, at most once every 24 h. (A cPanel cron calling cron.php works too.)
 */
function maybe_run_maintenance(): bool
{
    $settings = load_settings(true);
    $last = $settings['lastMaintenanceAt'] !== '' ? strtotime($settings['lastMaintenanceAt']) : false;
    if ($last !== false && time() - $last < 86400) return false;
    // Claim the run first so concurrent dashboard loads don't repeat it.
    save_settings(['lastMaintenanceAt' => gmdate('Y-m-d\TH:i:s.000\Z')]);
    try {
        run_retention($settings['retentionDays']);
        purge_old_threads($settings['retentionDays']);
        purge_expired_sessions();
        purge_old_rate_limits();
        purge_old_codes();
    } catch (Throwable $e) {
        log_error('maintenance failed: ' . $e->getMessage());
    }
    return true;
}
