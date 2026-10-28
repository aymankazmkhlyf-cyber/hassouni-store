<?php
declare(strict_types=1);

/**
 * Places an order. The browser sends only product IDs, package IDs, quantities
 * and field values — the total is computed on the server from the database.
 */
function action_checkout_place_order(): array
{
    $items = json_decode(form_str('items') ?: '[]', true);
    if (!is_array($items)) return ['error' => 'cartInvalid'];
    $in = [];
    foreach (['idempotencyKey', 'customerName', 'customerPhone', 'customerEmail', 'paymentMethodId', 'customerNotes', 'acceptTerms', 'locale'] as $k) {
        if (array_key_exists($k, $_POST) && is_string($_POST[$k])) $in[$k] = $_POST[$k];
    }
    foreach (['customerName', 'customerPhone', 'customerEmail', 'paymentMethodId', 'customerNotes'] as $k) $in[$k] ??= '';
    [$data, $errors] = v_checkout($in, $items);
    if ($data === null) {
        $itemError = false;
        foreach (array_keys($errors) as $k) if (str_starts_with($k, 'items')) $itemError = true;
        return ['error' => $itemError ? 'cartInvalid' : 'validation', 'fieldErrors' => $errors];
    }
    if (!consume_rate_limit('checkout', client_ip())) return ['error' => 'rateLimited'];

    $user = current_user();
    try {
        $order = create_order($data, $user['id'] ?? null);
    } catch (ServiceError $e) {
        $extra = $e->extra;
        return ['error' => $e->codeKey] + (is_array($extra) && isset($extra['reference']) ? ['data' => ['reference' => $extra['reference']]] : []);
    } catch (Throwable $e) {
        log_error('checkout failed: ' . $e->getMessage());
        return ['error' => 'generic'];
    }
    if (!$order['duplicate']) {
        $base = site_url();
        $orderId = $order['orderId'];
        // Sent after the response so the customer never waits for Telegram.
        after_response(function () use ($orderId, $base) {
            $full = load_order_full($orderId);
            if (!$full) return;
            $items = implode("\n", array_map(fn($i) => '• ' . $i['product_name_ar'] . ($i['package_label_ar'] ? ' (' . $i['package_label_ar'] . ')' : '') . ' × ' . $i['quantity'], $full['items']));
            notify_staff("🛒 طلب جديد {$full['reference']}\n👤 {$full['customer_name']}\n💰 " . format_iqd((int) $full['total'], 'ar') . " — {$full['payment_method_name_ar']}\n$items\n\n↩️ $base/ar/admin/orders/{$full['id']}");
        });
    }
    return ['ok' => true, 'data' => ['redirectTo' => url("/{$data['locale']}/orders/{$order['reference']}?key={$order['accessKey']}&new=1")]];
}
