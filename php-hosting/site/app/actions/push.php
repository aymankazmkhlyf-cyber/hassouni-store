<?php
declare(strict_types=1);

function b64url_ok(mixed $v, int $max): bool
{
    return is_string($v) && strlen($v) >= 8 && strlen($v) <= $max && preg_match('/^[A-Za-z0-9_-]+=*$/', $v);
}

/** Stores this device's push subscription for one order (same access rule as the order page). */
function action_push_subscribe(mixed $input = null): array
{
    if (!is_array($input)) return ['ok' => false, 'error' => 'validation'];
    $ref = is_string($input['reference'] ?? null) ? trim_js($input['reference']) : '';
    $key = is_string($input['key'] ?? null) ? $input['key'] : (($input['key'] ?? null) === null ? '' : false);
    $locale = $input['locale'] ?? null;
    $sub = $input['subscription'] ?? null;
    $endpoint = is_array($sub) ? ($sub['endpoint'] ?? null) : null;
    if (js_len($ref) < 5 || js_len($ref) > 40 || $key === false || strlen($key) > 60 || !is_string($locale) || strlen($locale) > 5
        || !is_string($endpoint) || strlen($endpoint) > 1000 || !filter_var($endpoint, FILTER_VALIDATE_URL)
        || !b64url_ok($sub['keys']['p256dh'] ?? null, 200) || !b64url_ok($sub['keys']['auth'] ?? null, 64)) {
        return ['ok' => false, 'error' => 'validation'];
    }
    if (!consume_rate_limit('pushSubscribe', client_ip())) return ['ok' => false, 'error' => 'rateLimited'];
    $order = order_for_request_push($ref, $key);
    if (!$order) return ['ok' => false, 'error' => 'notFoundOrder'];
    $saved = save_subscription($order['id'], ['endpoint' => $endpoint, 'keys' => ['p256dh' => $sub['keys']['p256dh'], 'auth' => $sub['keys']['auth']]], is_locale($locale) ? $locale : $order['locale']);
    return $saved ? ['ok' => true] : ['ok' => false, 'error' => 'validation'];
}

function action_push_unsubscribe(mixed $input = null): array
{
    if (!is_array($input)) return ['ok' => false];
    $ref = is_string($input['reference'] ?? null) ? trim_js($input['reference']) : '';
    $key = is_string($input['key'] ?? null) ? $input['key'] : '';
    $endpoint = $input['endpoint'] ?? null;
    if (js_len($ref) < 5 || js_len($ref) > 40 || strlen($key) > 60 || !is_string($endpoint) || strlen($endpoint) > 1000 || !filter_var($endpoint, FILTER_VALIDATE_URL)) return ['ok' => false];
    $order = order_for_request_push($ref, $key);
    if (!$order) return ['ok' => false];
    remove_subscription($order['id'], $endpoint);
    return ['ok' => true];
}

function order_for_request_push(string $reference, string $key): ?array
{
    $user = current_user();
    return $key !== '' ? get_order_by_access_key($reference, $key) : ($user ? get_order_for_user($reference, $user['id']) : null);
}
