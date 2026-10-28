<?php
/* /api/... endpoints (same paths and answers as the original site). */

declare(strict_types=1);

function run_api(string $path): void
{
    if ($path === 'health') {
        try {
            val('SELECT 1');
            send_json(['ok' => true]);
        } catch (Throwable) {
            send_json(['ok' => false], 503);
        }
    }
    if (preg_match('#^files/([0-9a-fA-F-]{36})$#', $path, $m)) api_file($m[1]);
    if ($path === 'support/messages') api_support_messages();
    if ($path === 'admin/support/unread') {
        try {
            assert_permission('support:manage');
        } catch (AuthError) {
            send_text('Not found', 404);
        }
        send_json(['unread' => staff_unread_count()]);
    }
    if (preg_match('#^admin/support/([0-9a-fA-F-]{36})/messages$#', $path, $m)) {
        try {
            assert_permission('support:manage');
        } catch (AuthError) {
            send_text('Not found', 404);
        }
        $thread = get_thread($m[1]);
        if (!$thread) send_text('Not found', 404);
        $after = max(0, (int) (query('after') ?? 0));
        $messages = list_messages($thread['id'], $after);
        if ($messages) mark_read_by_staff($thread['id']);
        send_json(['messages' => $messages]);
    }
    if ($path === 'admin/orders/export') api_orders_export();
    send_text('Not found', 404);
}

/**
 * Serves DB-stored files.
 * - product images / logo / payment QR: public, long-lived cache (ids are immutable).
 * - receipts: staff with payments:review only, never cached, sandboxed.
 */
function api_file(string $id): never
{
    $file = read_file_row($id);
    if (!$file) send_text('Not found', 404);
    header('Content-Type: ' . $file['mime_type']);
    header('Content-Length: ' . $file['size']);
    header('X-Content-Type-Options: nosniff');
    header("Content-Security-Policy: default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox");
    if ($file['kind'] === 'receipt') {
        $user = current_user();
        if (!$user || !is_staff_role($user['role']) || !has_permission($user['role'], 'payments:review')) {
            // 404 rather than 403 so receipt ids cannot be probed.
            header_remove('Content-Length');
            send_text('Not found', 404);
        }
        header('Cache-Control: private, no-store');
        header('Content-Disposition: ' . ($file['mime_type'] === 'application/pdf' ? 'attachment' : 'inline') . '; filename="receipt-' . substr($file['id'], 0, 8) . '"');
    } else {
        header('Cache-Control: public, max-age=31536000, immutable');
    }
    echo $file['data'];
    exit;
}

/** Customer poll: only the conversation bound to the visitor's own httpOnly cookie is readable. */
function api_support_messages(): never
{
    $thread = get_thread_by_token(get_cookie(support_cookie()));
    if (!$thread) send_json(['thread' => false]);
    $after = max(0, (int) (query('after') ?? 0));
    $read = query('read') === '1';
    $messages = $read || $after > 0 ? list_messages($thread['id'], $after) : [];
    if ($read) mark_read_by_customer($thread['id']);
    send_json(['thread' => true, 'name' => $thread['name'], 'unread' => $read ? 0 : (int) $thread['unread_for_customer'], 'messages' => $read ? $messages : []]);
}

/** CSV export of orders (admin only). Contains customer contact data, so it is audited and never cached. */
function api_orders_export(): never
{
    try {
        $user = assert_permission('orders:export');
    } catch (AuthError) {
        send_text('Not found', 404);
    }
    $filters = parse_order_filters($_GET);
    $rows = export_orders($filters);
    $logged = $filters;
    unset($logged['page']);
    $logged = array_filter($logged, fn($v) => $v !== null);
    if (isset($logged['q'])) $logged['q'] = '[redacted]';
    audit(actor_of($user), 'orders.export', 'order', null, ['count' => count($rows), 'filters' => $logged ?: new stdClass()]);
    $csv = to_csv(
        ['reference', 'created_at_utc', 'status', 'payment_status', 'payment_method', 'total_iqd', 'items', 'customer_name', 'customer_phone', 'customer_email'],
        array_map(fn($r) => [$r['reference'], iso_time($r['created_at']), $r['status'], $r['payment_status'] ?? '', $r['payment_method'], (int) $r['total'], (int) $r['items'], $r['customer_name'], $r['customer_phone'], $r['customer_email'] ?? ''], $rows),
    );
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="orders-' . gmdate('Y-m-d') . '.csv"');
    header('Cache-Control: private, no-store');
    echo $csv;
    exit;
}
