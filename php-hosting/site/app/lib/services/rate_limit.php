<?php
declare(strict_types=1);

const RATE_LIMITS = [
    'login' => [8, 15 * 60],
    'loginAccount' => [10, 60 * 60],
    'register' => [5, 60 * 60],
    'checkout' => [10, 60 * 60],
    'orderLookup' => [20, 15 * 60],
    'paymentProof' => [10, 60 * 60],
    'customRequest' => [5, 60 * 60],
    'supportStart' => [5, 60 * 60],
    'codeRequestIp' => [5, 60 * 60],
    'codeRequestAccount' => [3, 60 * 60],
    'codeVerify' => [10, 15 * 60],
    'supportMessage' => [20, 10 * 60],
    'review' => [15, 60 * 60],
    'pushSubscribe' => [10, 60 * 60],
    'walletTopup' => [6, 60 * 60],
];

/**
 * Atomic fixed-window counter stored in MySQL. Identifiers are HMAC'd — raw IPs
 * are never stored. Returns true when the request is allowed.
 */
function consume_rate_limit(string $bucket, string $identifier): bool
{
    [$limit, $window] = RATE_LIMITS[$bucket];
    $key = hmac_hex("$bucket:$identifier");
    $now = now_db();
    $cutoff = now_db(-$window);
    // count is assigned before window_start, so both conditions see the old window_start.
    $st = q(
        'INSERT INTO rate_limits (bucket, `key`, window_start, `count`) VALUES (?, ?, ?, 1)
         ON DUPLICATE KEY UPDATE
           `count` = LAST_INSERT_ID(IF(window_start < ?, 1, `count` + 1)),
           window_start = IF(window_start < ?, ?, window_start)',
        [$bucket, $key, $now, $cutoff, $cutoff, $now],
    );
    $count = $st->rowCount() === 1 ? 1 : (int) val('SELECT LAST_INSERT_ID()');
    return $count <= $limit;
}

function reset_rate_limit(string $bucket, string $identifier): void
{
    q('DELETE FROM rate_limits WHERE bucket = ? AND `key` = ?', [$bucket, hmac_hex("$bucket:$identifier")]);
}

function purge_old_rate_limits(): void
{
    q('DELETE FROM rate_limits WHERE window_start < ?', [now_db(-86400)]);
}
