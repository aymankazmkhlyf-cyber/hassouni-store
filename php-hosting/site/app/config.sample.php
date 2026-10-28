<?php
/*
 * Site settings. The installer (install.php) writes app/config.php from this
 * template. Never share this file: it contains the database password and secrets.
 */
return [
    // MySQL / MariaDB connection (from cPanel → MySQL Databases).
    'db_host' => 'localhost',
    'db_port' => 3306,
    'db_name' => '',
    'db_user' => '',
    'db_pass' => '',

    // Random secret (64 hex characters). Keep the SAME value forever: changing it
    // invalidates password-reset codes and rate-limit counters.
    'app_secret' => '',

    // Public address of the site without a trailing slash, e.g. https://example.com
    'app_url' => '',

    // true when the site sits behind Cloudflare or a host proxy that sets X-Forwarded-For.
    'trust_proxy' => false,

    // Optional integrations (leave empty to disable).
    'telegram_bot_token' => '',
    'resend_api_key' => '',
    'email_from' => '',
];
