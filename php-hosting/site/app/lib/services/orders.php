<?php
/* Orders: creation, reading, status transitions and the manual payment workflow. */

declare(strict_types=1);

/** Customer access keys stay valid for a year; logged-in owners can always see their orders. */
const ACCESS_KEY_TTL = 365 * 86400;
/** A repeated submission with the same idempotency key within this window gets the same order back. */
const IDEMPOTENCY_WINDOW = 30 * 60;
/** Orders still being worked on, where a second identical order would overlap. */
const IN_PROGRESS_STATUSES = ['payment_review', 'paid', 'processing'];
/**
 * Fields that identify *which account* a service is for. Two orders conflict only
 * when they are for the same service AND the same account (same player ID, link,
 * username or email); notes, names and design briefs never count.
 */
const TARGET_KEYS = ['player_id', 'zone_id', 'profile_url', 'post_url', 'video_url', 'channel_url', 'account_url', 'telegram_username', 'account_email'];
const WALLET_METHOD = ['id' => null, 'code' => 'wallet', 'name_ar' => 'رصيد المحفظة', 'name_en' => 'Wallet balance'];

/**
 * Creates an order inside one transaction. Totals are computed from the
 * database (quote_cart); nothing price-related from the browser is used.
 * The idempotency key makes double-clicks / retries return the same order.
 */
function create_order(array $input, ?string $userId): array
{
    return tx(function () use ($input, $userId) {
        // Fast path for retries: same browser attempt -> same order.
        $existing = one('SELECT id, reference, created_at FROM orders WHERE idempotency_key = ?', [$input['idempotencyKey']]);
        if ($existing) return rotate_duplicate($existing);

        $settings = load_settings();
        if (!$settings['ordersEnabled']) throw new ServiceError('product_unavailable');

        $viaWallet = $input['paymentMethodId'] === 'wallet';
        if ($viaWallet && !$userId) throw new ServiceError('walletLoginRequired');
        $method = $viaWallet ? WALLET_METHOD : one('SELECT * FROM payment_methods WHERE id = ? AND is_enabled = 1', [$input['paymentMethodId']]);
        if (!$method) throw new ServiceError('paymentMethod');

        $quote = quote_cart($input['items']);
        if (!$quote['valid']) throw new ServiceError('cartInvalid', array_values(array_filter($quote['lines'], fn($l) => !$l['ok'])));
        $lines = array_values(array_filter($quote['lines'], fn($l) => $l['ok']));
        $active = active_duplicate($lines, $input['customerPhone'], $userId);
        if ($active) throw new ServiceError('activeOrderExists', ['reference' => $active]);

        $accessKey = generate_access_key();
        $now = now_db();
        $orderId = uuid4();
        try {
            insert('orders', [
                'id' => $orderId,
                'reference' => generate_order_reference(),
                'access_key_hash' => sha256($accessKey),
                'access_key_expires_at' => now_db(ACCESS_KEY_TTL),
                'idempotency_key' => $input['idempotencyKey'],
                'user_id' => $userId,
                'customer_name' => $input['customerName'],
                'customer_phone' => $input['customerPhone'],
                'customer_email' => $input['customerEmail'],
                'customer_notes' => $input['customerNotes'],
                'admin_notes' => '',
                'delivery_note' => '',
                'status' => $viaWallet ? 'paid' : 'pending_payment',
                'paid_at' => $viaWallet ? $now : null,
                'payment_method_id' => $method['id'],
                'payment_method_code' => $method['code'],
                'payment_method_name_ar' => $method['name_ar'],
                'payment_method_name_en' => $method['name_en'],
                'subtotal' => $quote['total'],
                'total' => $quote['total'],
                'terms_accepted_at' => $now,
                'locale' => $input['locale'],
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        } catch (PDOException $e) {
            // Two identical submissions raced past the check above: return the winner.
            if (!is_duplicate_key($e)) throw $e;
            $winner = one('SELECT id, reference, created_at FROM orders WHERE idempotency_key = ?', [$input['idempotencyKey']]);
            if (!$winner) throw new ServiceError('generic');
            return rotate_duplicate($winner);
        }
        $reference = val('SELECT reference FROM orders WHERE id = ?', [$orderId]);

        foreach ($lines as $l) {
            insert('order_items', [
                'order_id' => $orderId,
                'product_id' => $l['productId'],
                'package_id' => $l['packageId'],
                'product_name_ar' => $l['nameAr'],
                'product_name_en' => $l['nameEn'],
                'package_label_ar' => $l['packageLabelAr'],
                'package_label_en' => $l['packageLabelEn'],
                'unit_price' => $l['unitPrice'],
                'quantity' => $l['quantity'],
                'line_total' => $l['lineTotal'],
                'inputs' => json_out($l['inputs']),
            ]);
        }
        if ($viaWallet) {
            // Debits the balance (throws insufficientBalance and rolls the whole order back).
            apply_wallet_change(['userId' => $userId, 'amount' => -$quote['total'], 'type' => 'order_payment', 'orderId' => $orderId, 'note' => $reference]);
        }
        insert('payments', [
            'id' => uuid4(),
            'order_id' => $orderId,
            'method_code' => $method['code'],
            'amount' => $quote['total'],
            'status' => $viaWallet ? 'confirmed' : 'awaiting',
            'submitted_at' => $viaWallet ? $now : null,
            'reviewed_at' => $viaWallet ? $now : null,
            'created_at' => $now,
            'updated_at' => $now,
        ]);
        insert('order_status_history', [
            'order_id' => $orderId,
            'from_status' => null,
            'to_status' => $viaWallet ? 'paid' : 'pending_payment',
            'actor_type' => 'customer',
            'actor_id' => $userId,
            'created_at' => $now,
        ]);
        return ['orderId' => $orderId, 'reference' => $reference, 'accessKey' => $accessKey, 'duplicate' => false];
    });
}

function target_signature(array $inputs): string
{
    $parts = [];
    foreach ($inputs as $i) {
        if (in_array($i['key'], TARGET_KEYS, true) && trim_js($i['value']) !== '') {
            $parts[] = $i['key'] . '=' . preg_replace('#/+$#', '', mb_strtolower(trim_js($i['value'])));
        }
    }
    sort($parts, SORT_STRING);
    return implode('&', $parts);
}

/** References of in-progress orders (among $where) that have the same service + same account as one of $lines. */
function conflicting_orders(array $lines, string $where, array $whereParams): array
{
    $targeted = array_values(array_filter($lines, fn($l) => $l['productId'] !== null && target_signature($l['inputs']) !== ''));
    if (!$targeted) return [];
    $pids = array_values(array_unique(array_map(fn($l) => (int) $l['productId'], $targeted)));
    $rows = all(
        "SELECT o.reference, i.product_id, i.inputs FROM order_items i INNER JOIN orders o ON o.id = i.order_id
          WHERE ($where) AND o.status IN (" . placeholders(IN_PROGRESS_STATUSES) . ') AND o.created_at > ? AND i.product_id IN (' . placeholders($pids) . ')
          LIMIT 100',
        [...$whereParams, ...IN_PROGRESS_STATUSES, now_db(-7 * 86400), ...$pids],
    );
    $refs = [];
    foreach ($targeted as $l) {
        $sig = target_signature($l['inputs']);
        foreach ($rows as $r) {
            if ((int) $r['product_id'] === (int) $l['productId'] && target_signature(json_col($r['inputs'], [])) === $sig) $refs[$r['reference']] = true;
        }
    }
    return array_keys($refs);
}

/** Same customer (phone or account) already has this service in progress for the same account → its reference. */
function active_duplicate(array $lines, string $phone, ?string $userId): ?string
{
    $refs = $userId
        ? conflicting_orders($lines, 'o.customer_phone = ? OR o.user_id = ?', [$phone, $userId])
        : conflicting_orders($lines, 'o.customer_phone = ?', [$phone]);
    return $refs[0] ?? null;
}

/** For the checkout warning: which of these orders (by reference) overlap with the cart. */
function conflicting_order_refs(array $references, array $lines): array
{
    if (!$references) return [];
    return conflicting_orders($lines, 'o.reference IN (' . placeholders($references) . ')', array_values($references));
}

function rotate_duplicate(array $existing): array
{
    if (microtime(true) - db_time($existing['created_at']) > IDEMPOTENCY_WINDOW) throw new ServiceError('cartInvalid');
    // Only the hash is stored, so the original key cannot be re-sent. Possession of the
    // (secret, per-attempt) idempotency key proves it is the same browser, so issue a fresh key.
    $accessKey = generate_access_key();
    update('orders', ['access_key_hash' => sha256($accessKey)], 'id = ?', [$existing['id']]);
    return ['orderId' => $existing['id'], 'reference' => $existing['reference'], 'accessKey' => $accessKey, 'duplicate' => true];
}

/* ------------------------------ Reading orders ------------------------------ */

function with_order_children(?array $order): ?array
{
    if (!$order) return null;
    $order['items'] = array_map(function ($i) {
        $i['inputs'] = json_col($i['inputs'], []);
        return $i;
    }, all('SELECT * FROM order_items WHERE order_id = ? ORDER BY id ASC', [$order['id']]));
    $order['payments'] = all('SELECT * FROM payments WHERE order_id = ? ORDER BY created_at DESC, id DESC', [$order['id']]);
    $order['history'] = all('SELECT * FROM order_status_history WHERE order_id = ? ORDER BY created_at ASC, id ASC', [$order['id']]);
    return $order;
}

function load_order_full(string $orderId): ?array
{
    return with_order_children(one('SELECT * FROM orders WHERE id = ?', [$orderId]));
}

/** Customer access by reference + access key. Wrong key, unknown reference and expiry all return null. */
function get_order_by_access_key(string $reference, string $accessKey): ?array
{
    $ref = normalize_reference($reference);
    $key = normalize_access_key($accessKey);
    if ($ref === '' || strlen($key) < 20) return null;
    $order = one('SELECT * FROM orders WHERE reference = ? AND access_key_expires_at > ?', [$ref, now_db()]);
    if (!$order || !safe_equal_hex($order['access_key_hash'], sha256($key))) return null;
    return with_order_children($order);
}

function get_order_for_user(string $reference, string $userId): ?array
{
    return with_order_children(one('SELECT * FROM orders WHERE reference = ? AND user_id = ?', [normalize_reference($reference), $userId]));
}

function list_orders_for_user(string $userId): array
{
    $orders = all('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 100', [$userId]);
    if (!$orders) return [];
    $ids = array_column($orders, 'id');
    $items = all('SELECT order_id, product_name_ar, product_name_en, quantity FROM order_items WHERE order_id IN (' . placeholders($ids) . ') ORDER BY id ASC', $ids);
    $by = [];
    foreach ($items as $i) $by[$i['order_id']][] = $i;
    foreach ($orders as &$o) $o['items'] = $by[$o['id']] ?? [];
    return $orders;
}

/** Latest payment record determines the customer-facing payment status. */
function latest_payment(array $payments): ?array
{
    usort($payments, fn($a, $b) => strcmp($b['created_at'], $a['created_at']));
    return $payments[0] ?? null;
}

/* ------------------------------ Status transitions ------------------------------ */

/**
 * Applies a validated status change with its side effects, inside the caller's transaction.
 * $actor: ['type' => 'customer', 'userId' => ?] | ['type' => 'staff', 'user' => actor] | ['type' => 'system'].
 */
function apply_transition(string $orderId, string $to, array $actor, ?string $note): array
{
    $order = one('SELECT * FROM orders WHERE id = ? FOR UPDATE', [$orderId]);
    if (!$order) throw new ServiceError('notFound');
    if (!can_transition($order['status'], $to)) throw new ServiceError('invalidTransition');

    $now = now_db();
    $set = ['status' => $to];
    if ($to === 'paid' && !$order['paid_at']) $set['paid_at'] = $now;
    if ($to === 'completed') $set['completed_at'] = $now;
    update('orders', $set, 'id = ?', [$orderId]);

    $staffId = $actor['type'] === 'staff' ? $actor['user']['id'] : null;
    if ($to === 'paid') {
        // Marking paid directly (e.g. verified by phone) confirms the latest open payment record.
        $open = one("SELECT id FROM payments WHERE order_id = ? AND status IN ('awaiting', 'submitted') ORDER BY created_at DESC LIMIT 1", [$orderId]);
        if ($open) update('payments', ['status' => 'confirmed', 'reviewed_by_id' => $staffId, 'reviewed_at' => $now], 'id = ?', [$open['id']]);
    }
    if ($to === 'refunded') {
        q("UPDATE payments SET status = 'refunded' WHERE order_id = ? AND status = 'confirmed'", [$orderId]);
        // Wallet payments go straight back to the wallet.
        if ($order['payment_method_code'] === 'wallet' && $order['user_id']) {
            apply_wallet_change(['userId' => $order['user_id'], 'amount' => (int) $order['total'], 'type' => 'order_refund', 'orderId' => $orderId, 'staffId' => $staffId, 'note' => $order['reference']]);
        }
    }

    insert('order_status_history', [
        'order_id' => $orderId,
        'from_status' => $order['status'],
        'to_status' => $to,
        'actor_type' => $actor['type'],
        'actor_id' => $actor['type'] === 'staff' ? $actor['user']['id'] : ($actor['type'] === 'customer' ? $actor['userId'] : null),
        'note' => $note ?: null,
        'created_at' => $now,
    ]);
    if ($actor['type'] === 'staff') {
        audit($actor['user'], 'order.status', 'order', $orderId, ['reference' => $order['reference'], 'from' => $order['status'], 'to' => $to, 'note' => $note ?: null]);
    }
    return ['from' => $order['status'], 'to' => $to, 'reference' => $order['reference']];
}

function transition_order(string $orderId, string $to, array $actor, ?string $note = null): array
{
    return tx(fn() => apply_transition($orderId, $to, $actor, $note));
}

/* ------------------------------ Manual payment workflow ------------------------------ */

/**
 * Customer submits a transaction reference and/or receipt. This NEVER marks the
 * order as paid — it only moves it to "payment under review".
 */
function submit_payment_proof(string $orderId, ?string $customerReference, ?array $receipt, ?string $userId): void
{
    tx(function () use ($orderId, $customerReference, $receipt, $userId) {
        $order = one('SELECT * FROM orders WHERE id = ? FOR UPDATE', [$orderId]);
        if (!$order) throw new ServiceError('notFound');
        if (!customer_can_submit_payment($order['status'])) throw new ServiceError('orderLocked');
        if (!$customerReference && !$receipt) throw new ServiceError('proofNeedOne');

        $method = $order['payment_method_id'] ? one('SELECT * FROM payment_methods WHERE id = ?', [$order['payment_method_id']]) : null;
        if ($method && $method['requires_reference'] && !$customerReference) throw new ServiceError('proofNeedOne');
        if ($receipt && $method && !$method['allows_receipt']) throw new ServiceError('file_type');

        $receiptFileId = $receipt ? store_file('receipt', $receipt['mime'], $receipt['bytes'], null) : null;
        $latest = one('SELECT * FROM payments WHERE order_id = ? ORDER BY created_at DESC LIMIT 1', [$orderId]);
        $now = now_db();
        if ($latest && ($latest['status'] === 'awaiting' || $latest['status'] === 'submitted')) {
            // Replacing an unreviewed proof: drop the previous receipt file.
            if ($latest['receipt_file_id'] && $receiptFileId) delete_file($latest['receipt_file_id']);
            update('payments', [
                'status' => 'submitted',
                'customer_reference' => $customerReference ?? $latest['customer_reference'],
                'receipt_file_id' => $receiptFileId ?? $latest['receipt_file_id'],
                'submitted_at' => $now,
                'amount' => (int) $order['total'],
            ], 'id = ?', [$latest['id']]);
        } else {
            insert('payments', [
                'id' => uuid4(),
                'order_id' => $orderId,
                'method_code' => $order['payment_method_code'],
                'amount' => (int) $order['total'],
                'status' => 'submitted',
                'customer_reference' => $customerReference,
                'receipt_file_id' => $receiptFileId,
                'submitted_at' => $now,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
        if ($order['status'] === 'pending_payment') {
            apply_transition($orderId, 'payment_review', ['type' => 'customer', 'userId' => $userId], null);
        }
    });
}

/** Staff confirms or rejects a submitted payment proof. */
function review_payment(string $paymentId, string $decision, string $note, array $actor): array
{
    return tx(function () use ($paymentId, $decision, $note, $actor) {
        $payment = one('SELECT * FROM payments WHERE id = ? FOR UPDATE', [$paymentId]);
        if (!$payment) throw new ServiceError('notFound');
        if ($payment['status'] !== 'submitted') throw new ServiceError('invalidTransition');
        $order = one('SELECT * FROM orders WHERE id = ?', [$payment['order_id']]);
        if (!$order) throw new ServiceError('notFound');
        $now = now_db();
        if ($decision === 'confirm') {
            if (!can_transition($order['status'], 'paid')) throw new ServiceError('invalidTransition');
            update('payments', ['status' => 'confirmed', 'reviewed_by_id' => $actor['id'], 'reviewed_at' => $now, 'review_note' => $note ?: null], 'id = ?', [$paymentId]);
            apply_transition($order['id'], 'paid', ['type' => 'staff', 'user' => $actor], $note ?: null);
        } else {
            update('payments', ['status' => 'rejected', 'reviewed_by_id' => $actor['id'], 'reviewed_at' => $now, 'review_note' => $note ?: null], 'id = ?', [$paymentId]);
            if ($order['status'] === 'payment_review') apply_transition($order['id'], 'pending_payment', ['type' => 'staff', 'user' => $actor], $note ?: null);
        }
        audit($actor, "payment.$decision", 'payment', $paymentId, ['reference' => $order['reference'], 'amount' => (int) $payment['amount']]);
        return ['orderId' => $order['id']];
    });
}

function update_admin_notes(string $orderId, string $notes, array $actor): void
{
    $ref = val('SELECT reference FROM orders WHERE id = ?', [$orderId]);
    if ($ref === null) throw new ServiceError('notFound');
    update('orders', ['admin_notes' => $notes], 'id = ?', [$orderId]);
    audit($actor, 'order.notes', 'order', $orderId, ['reference' => $ref]);
}

/** Message shown to the customer on the order page (codes, delivery details). Its content is not written to the audit log. */
function update_delivery_note(string $orderId, string $note, array $actor): void
{
    $ref = val('SELECT reference FROM orders WHERE id = ?', [$orderId]);
    if ($ref === null) throw new ServiceError('notFound');
    update('orders', ['delivery_note' => $note], 'id = ?', [$orderId]);
    audit($actor, 'order.delivery_note', 'order', $orderId, ['reference' => $ref, 'length' => js_len($note)]);
}
