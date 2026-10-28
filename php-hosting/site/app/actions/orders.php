<?php
declare(strict_types=1);

function action_orders_track(): array
{
    $locale = action_locale();
    $ref = trim_js(form_str('reference'));
    $key = trim_js(form_str('key'));
    if (js_len($ref) < 5 || js_len($ref) > 40 || js_len($key) < 10 || js_len($key) > 60) return ['error' => 'notFoundOrder'];
    if (!consume_rate_limit('orderLookup', client_ip())) return ['error' => 'rateLimited'];
    $order = get_order_by_access_key($ref, $key);
    // Same response for unknown reference and wrong key.
    if (!$order) return ['error' => 'notFoundOrder'];
    action_redirect("/$locale/orders/{$order['reference']}?key=" . normalize_access_key($key));
}

/** The order the visitor may act on: by reference + access key, or as its logged-in owner. */
function order_for_request(string $reference, string $key): ?array
{
    $user = current_user();
    return $key !== '' ? get_order_by_access_key($reference, $key) : ($user ? get_order_for_user($reference, $user['id']) : null);
}

/** Customer sends a transaction reference and/or receipt. Never marks the order as paid. */
function action_orders_submit_proof(): array
{
    $reference = normalize_reference(form_str('reference'));
    $key = form_str('key');
    if (!consume_rate_limit('paymentProof', client_ip())) return ['error' => 'rateLimited'];
    $order = order_for_request($reference, $key);
    if (!$order) return ['error' => 'notFoundOrder'];

    $customerRef = trim_js(form_str('customerReference'));
    if (js_len($customerRef) > 100) return ['error' => 'validation'];
    $receipt = check_upload('receipt', RECEIPT_TYPES);
    if ($receipt && !$receipt['ok']) return ['error' => $receipt['error']];

    $user = current_user();
    try {
        submit_payment_proof($order['id'], $customerRef !== '' ? $customerRef : null, $receipt, $user['id'] ?? null);
    } catch (ServiceError $e) {
        return ['error' => $e->codeKey];
    } catch (Throwable $e) {
        log_error('payment proof failed: ' . $e->getMessage());
        return ['error' => 'generic'];
    }
    $base = site_url();
    $hasReceipt = (bool) $receipt;
    after_response(fn() => notify_staff(
        "🧾 إثبات دفع جديد للطلب {$order['reference']}\n💰 " . format_iqd((int) $order['total'], 'ar') . " — {$order['payment_method_name_ar']}"
        . ($customerRef !== '' ? "\n🔢 رقم العملية: $customerRef" : '') . ($hasReceipt ? "\n📎 مع صورة إيصال" : '')
        . "\n\n✅ راجع وأكّد: $base/ar/admin/orders/{$order['id']}",
    ));
    // The order page shows the new status (like revalidatePath on the original).
    action_refresh(1500);
    return ['ok' => true];
}

/**
 * Orders of this customer still in progress for the SAME service and the SAME
 * account as something in the cart. Guests send the reference + key pairs this
 * browser saved; logged-in customers' own orders are included.
 */
function action_orders_open(mixed $input = null): array
{
    if (!is_array($input)) return ['inProgress' => []];
    $recent = $input['recent'] ?? null;
    $lines = $input['lines'] ?? null;
    if (!is_array($recent) || !array_is_list($recent) || count($recent) > 5 || !is_array($lines) || !array_is_list($lines) || count($lines) > 20 || !$lines) return ['inProgress' => []];
    foreach ($recent as $r) {
        $ref = is_array($r) && is_string($r['ref'] ?? null) ? trim_js($r['ref']) : null;
        $key = is_array($r) && is_string($r['key'] ?? null) ? trim_js($r['key']) : null;
        if ($ref === null || $key === null || js_len($ref) < 5 || js_len($ref) > 40 || js_len($key) < 10 || js_len($key) > 60) return ['inProgress' => []];
    }
    $parsedLines = [];
    foreach ($lines as $l) {
        $pid = is_array($l) ? json_int($l['productId'] ?? null) : null;
        $inputs = is_array($l) ? ($l['inputs'] ?? null) : null;
        if ($pid === null || $pid < 1 || !is_array($inputs)) return ['inProgress' => []];
        $kv = [];
        foreach ($inputs as $k => $v) {
            if (!is_string($v) || js_len((string) $k) > 40 || js_len($v) > 2000) return ['inProgress' => []];
            $kv[] = ['key' => (string) $k, 'value' => $v];
        }
        $parsedLines[] = ['productId' => $pid, 'inputs' => $kv];
    }
    $refs = [];
    $user = current_user();
    if ($user) foreach (list_orders_for_user($user['id']) as $o) $refs[$o['reference']] = true;
    if ($recent && consume_rate_limit('orderLookup', client_ip())) {
        foreach ($recent as $r) {
            $o = get_order_by_access_key(trim_js($r['ref']), trim_js($r['key']));
            if ($o) $refs[$o['reference']] = true;
        }
    }
    return ['inProgress' => array_slice(conflicting_order_refs(array_keys($refs), $parsedLines), 0, 3)];
}
