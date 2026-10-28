<?php
declare(strict_types=1);

function wallet_customer(): ?array
{
    $user = current_user();
    return $user && $user['role'] === 'customer' ? $user : null;
}

/** Older accounts choose their wallet username once. */
function action_wallet_set_username(): array
{
    $user = wallet_customer();
    if (!$user) return ['error' => 'unauthorized'];
    try {
        set_username($user['id'], form_str('username'));
    } catch (ServiceError $e) {
        return ['error' => $e->codeKey, 'fieldErrors' => ['username' => $e->codeKey]];
    }
    action_refresh();
    return ['ok' => true];
}

/** Customer paid through a manual method and asks for the amount to be added to the wallet. */
function action_wallet_request_topup(): array
{
    $user = wallet_customer();
    if (!$user) return ['error' => 'unauthorized'];
    if (!consume_rate_limit('walletTopup', client_ip())) return ['error' => 'rateLimited'];
    $amount = coerce_int($_POST['amount'] ?? null);
    if ($amount === null || $amount < WALLET_MIN_TOPUP || $amount > WALLET_MAX_TOPUP) return ['error' => 'topupAmount'];
    $methodId = coerce_int($_POST['methodId'] ?? null);
    if ($methodId === null || $methodId < 1) return ['error' => 'paymentMethod'];
    $ref = trim_js(form_str('customerReference'));
    if (js_len($ref) > 100) return ['error' => 'validation'];
    $receipt = check_upload('receipt', RECEIPT_TYPES);
    if ($receipt && !$receipt['ok']) return ['error' => $receipt['error']];
    try {
        $created = create_topup($user['id'], $amount, $methodId, $ref !== '' ? $ref : null, $receipt);
    } catch (ServiceError $e) {
        return ['error' => $e->codeKey];
    } catch (Throwable $e) {
        log_error('topup failed: ' . $e->getMessage());
        return ['error' => 'generic'];
    }
    $base = site_url();
    $hasReceipt = (bool) $receipt;
    after_response(fn() => notify_staff(
        "👛 طلب شحن محفظة\n👤 {$user['name']}" . ($user['username'] ? " (@{$user['username']})" : '') . "\n💰 " . format_iqd($amount, 'ar') . " — {$created['methodNameAr']}"
        . ($ref !== '' ? "\n🔢 رقم العملية: $ref" : '') . ($hasReceipt ? "\n📎 مع صورة إيصال" : '') . "\n\n✅ راجع: $base/ar/admin/wallet",
    ));
    action_refresh(1500);
    return ['ok' => true];
}
