<?php
/*
 * Loads configuration and every library file. Pages and actions are plain
 * PHP functions; there is no framework and nothing to install with Composer.
 */

declare(strict_types=1);

define('APP_DIR', __DIR__);
define('ROOT_DIR', dirname(__DIR__));

date_default_timezone_set('UTC');
// Errors go to the host's error log, never to visitors.
ini_set('display_errors', '0');
ini_set('log_errors', '1');
error_reporting(E_ALL);
mb_internal_encoding('UTF-8');

$configFile = APP_DIR . '/config.php';
$GLOBALS['CONFIG'] = is_file($configFile) ? require $configFile : null;

function config(string $key, mixed $default = null): mixed
{
    return $GLOBALS['CONFIG'][$key] ?? $default;
}

function is_installed(): bool
{
    return is_array($GLOBALS['CONFIG']) && config('db_name') !== '' && config('app_secret') !== '';
}

foreach ([
    'util', 'db', 'http', 'i18n', 'ui', 'auth',
    'domain/phone', 'domain/money', 'domain/tokens', 'domain/fields', 'domain/pricing', 'domain/order_status',
    'domain/admin_parse', 'domain/files', 'domain/validate', 'domain/contact',
    'services/settings', 'services/audit', 'services/rate_limit', 'services/catalog', 'services/quote',
    'services/wallet', 'services/orders', 'services/accounts', 'services/auth_codes', 'services/email',
    'services/notify', 'services/push', 'services/order_notify', 'services/reviews', 'services/support',
    'services/admin_catalog', 'services/admin_orders', 'services/custom_requests', 'services/maintenance',
] as $lib) {
    require APP_DIR . '/lib/' . $lib . '.php';
}
