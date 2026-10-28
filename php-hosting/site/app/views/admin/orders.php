<?php
declare(strict_types=1);

require_once __DIR__ . '/common.php';

function page_admin_orders(array $params): array
{
    $l = loc();
    $t = T();
    $user = require_staff_page($l, 'orders:read');
    $f = parse_order_filters($_GET);
    $result = list_orders_admin($f);
    $methods = list_payment_methods();
    $p = filters_to_params($f);
    $qs = http_build_query(array_filter($p, fn($v) => $v !== null && $v !== ''), '', '&', PHP_QUERY_RFC3986);
    $fullPhone = has_permission($user['role'], 'customers:write');
    $o = $t['admin']['ordersPage'];

    $export = has_permission($user['role'], 'orders:export')
        ? '<a href="' . e(url('/api/admin/orders/export') . ($qs ? "?$qs" : '')) . '" class="' . button_class('outline', 'sm') . '">' . icon('download', 'size-4') . ' ' . e($o['export']) . '</a>' : '';
    $h = admin_title($t['admin']['orders'], null, $export);
    $statusOpts = ['' => $t['common']['all']];
    foreach (ORDER_STATUSES as $s) $statusOpts[$s] = $t['orderStatus'][$s];
    $payOpts = ['' => $t['common']['all']];
    foreach (PAYMENT_STATUSES as $s) $payOpts[$s] = $t['paymentStatus'][$s];
    $methodOpts = ['' => $t['common']['all']];
    foreach ($methods as $m) $methodOpts[$m['code']] = L($m, 'name', $l);
    $h .= '<form method="get" class="mb-4 grid gap-3 rounded-(--radius-card) border border-line bg-elevated p-3 shadow-soft sm:grid-cols-2 lg:grid-cols-6">'
        . '<label class="text-xs font-semibold sm:col-span-2"><span class="mb-1 block">' . e($t['common']['search']) . '</span>' . input_tag(['name' => 'q', 'value' => $f['q'], 'placeholder' => $o['searchPlaceholder'], 'maxlength' => '80']) . '</label>'
        . '<label class="text-xs font-semibold"><span class="mb-1 block">' . e($o['status']) . '</span>' . select_tag(['name' => 'status'], $statusOpts, $f['status'] ?? '') . '</label>'
        . '<label class="text-xs font-semibold"><span class="mb-1 block">' . e($o['paymentStatus']) . '</span>' . select_tag(['name' => 'paymentStatus'], $payOpts, $f['paymentStatus'] ?? '') . '</label>'
        . '<label class="text-xs font-semibold"><span class="mb-1 block">' . e($o['method']) . '</span>' . select_tag(['name' => 'method'], $methodOpts, $f['method'] ?? '') . '</label>'
        . '<div class="grid grid-cols-2 gap-2 sm:col-span-2 lg:col-span-1 lg:grid-cols-1"><label class="text-xs font-semibold"><span class="mb-1 block">' . e($o['from']) . '</span>' . input_tag(['type' => 'date', 'name' => 'from', 'value' => $f['from']]) . '</label>'
        . '<label class="text-xs font-semibold"><span class="mb-1 block">' . e($o['to']) . '</span>' . input_tag(['type' => 'date', 'name' => 'to', 'value' => $f['to']]) . '</label></div>'
        . '<div class="flex gap-2 sm:col-span-2 lg:col-span-6"><button type="submit" class="' . button_class('primary', 'sm') . '">' . e($t['common']['filter']) . '</button><a href="' . e(lp('/admin/orders')) . '" class="' . button_class('ghost', 'sm') . '">' . e($t['common']['reset']) . '</a></div></form>';

    if (!$result['rows']) {
        $h .= empty_state($o['empty'], null, '', 'inbox');
    } else {
        $th = fn($label, $end = false) => '<th class="px-4 py-3 text-' . ($end ? 'end' : 'start') . ' font-semibold">' . e($label) . '</th>';
        $h .= card_open('overflow-x-auto') . '<table class="w-full min-w-[44rem] text-sm"><thead class="border-b border-line text-xs text-fg-subtle"><tr>'
            . $th($t['order']['reference']) . $th($o['customer']) . $th($o['status']) . $th($o['paymentStatus']) . $th($o['total'], true) . $th($o['date']) . '</tr></thead><tbody class="divide-y divide-line">';
        foreach ($result['rows'] as $r) {
            $h .= '<tr class="hover:bg-muted"><td class="px-4 py-3"><a href="' . e(lp('/admin/orders/' . $r['id'])) . '" class="ltr-nums font-bold text-brand hover:underline" dir="ltr">' . e($r['reference']) . '</a><span class="block text-xs text-fg-subtle">' . e(L($r, 'payment_method_name', $l)) . '</span></td>'
                . '<td class="px-4 py-3">' . e($r['customer_name']) . '<span class="ltr-nums block text-xs text-fg-subtle" dir="ltr">' . e($fullPhone ? $r['customer_phone'] : mask_phone($r['customer_phone'])) . '</span></td>'
                . '<td class="px-4 py-3">' . order_status_badge($r['status']) . '</td><td class="px-4 py-3">' . ($r['payment_status'] ? payment_status_badge($r['payment_status']) : '—') . '</td>'
                . '<td class="ltr-nums px-4 py-3 text-end font-bold" dir="ltr">' . e(format_iqd((int) $r['total'], $l)) . '</td><td class="ltr-nums px-4 py-3 text-xs text-fg-muted">' . e(format_datetime($r['created_at'], $l)) . '</td></tr>';
        }
        $h .= '</tbody></table></div>';
    }
    $h .= pagination($result['page'], $result['pages'], lp('/admin/orders'), $p);
    return admin_page($user, $t['admin']['orders'], $h);
}

function page_admin_order(array $params): array
{
    $l = loc();
    $t = T();
    $ar = $l === 'ar';
    $user = require_staff_page($l, 'orders:read');
    if (!preg_match('/^[0-9a-f-]{36}$/i', $params['id'])) not_found();
    $order = load_order_full(strtolower($params['id']));
    if (!$order) not_found();
    $d = $t['admin']['orderDetail'];
    $canUpdate = has_permission($user['role'], 'orders:update');
    $canReview = has_permission($user['role'], 'payments:review');
    $transitions = allowed_transitions($order['status']);
    $actorIds = array_values(array_unique(array_filter([...array_column($order['history'], 'actor_id'), ...array_column($order['payments'], 'reviewed_by_id')])));
    $actors = $actorIds ? array_column(all('SELECT id, name FROM users WHERE id IN (' . placeholders($actorIds) . ')', $actorIds), 'name', 'id') : [];
    $actorName = fn(?string $id) => $id ? ($actors[$id] ?? null) : null;
    // Message for the customer: reference and status only.
    $status = $t['orderStatus'][$order['status']];
    $customerMsg = $ar
        ? "مرحباً {$order['customer_name']}، بخصوص طلبك {$order['reference']} من {$t['meta']['storeName']}: الحالة الحالية «{$status}»."
        : "Hello {$order['customer_name']}, regarding your order {$order['reference']} at {$t['meta']['storeName']}: current status “{$status}”.";

    $h = admin_title(fmt($d['title'], ['ref' => $order['reference']]), format_datetime($order['created_at'], $l), order_status_badge($order['status']));
    $h .= '<div class="grid gap-6 xl:grid-cols-[1.5fr_1fr]"><div class="space-y-6">';
    $h .= card_open() . card_header($d['items']) . '<ul class="divide-y divide-line">';
    foreach ($order['items'] as $i) {
        $pkg = $ar ? $i['package_label_ar'] : $i['package_label_en'];
        $h .= '<li class="space-y-2 px-5 py-4"><div class="flex flex-wrap justify-between gap-2"><div><p class="font-bold">' . e($ar ? $i['product_name_ar'] : $i['product_name_en']) . '</p>'
            . ($pkg ? '<p class="text-sm text-fg-muted">' . e($pkg) . '</p>' : '')
            . '<p class="text-xs text-fg-subtle"><span class="ltr-nums">' . e(format_iqd((int) $i['unit_price'], $l)) . '</span> × <span class="ltr-nums">' . num((int) $i['quantity']) . '</span></p></div>'
            . '<p class="ltr-nums font-bold" dir="ltr">' . e(format_iqd((int) $i['line_total'], $l)) . '</p></div>';
        if ($i['inputs']) {
            $h .= '<dl class="grid gap-1 rounded-xl bg-muted p-3 text-sm"><p class="text-xs font-semibold text-fg-subtle">' . e($d['inputs']) . '</p>';
            foreach ($i['inputs'] as $inp) $h .= '<div class="flex flex-wrap gap-x-2"><dt class="font-semibold">' . e($ar ? $inp['labelAr'] : $inp['labelEn']) . ':</dt><dd dir="auto" class="break-all">' . e($inp['value']) . '</dd></div>';
            $h .= '</dl>';
        }
        $h .= '</li>';
    }
    $h .= '</ul><div class="flex justify-between border-t border-line px-5 py-4"><span class="font-bold">' . e($t['order']['total']) . '</span><span class="ltr-nums text-xl font-black" dir="ltr">' . e(format_iqd((int) $order['total'], $l)) . '</span></div></div>';

    $h .= card_open() . card_header($d['payments'], $t['order']['paymentMethod'] . ': ' . ($ar ? $order['payment_method_name_ar'] : $order['payment_method_name_en']));
    $allAwaiting = true;
    foreach ($order['payments'] as $p) if ($p['status'] !== 'awaiting') $allAwaiting = false;
    if ($allAwaiting) $h .= '<p class="px-5 pt-4 text-sm text-fg-muted">' . e($d['noPayments']) . '</p>';
    $h .= '<ul class="divide-y divide-line">';
    foreach ($order['payments'] as $p) {
        $h .= '<li class="space-y-3 px-5 py-4"><div class="flex flex-wrap items-center justify-between gap-2">' . payment_status_badge($p['status']) . '<span class="ltr-nums text-xs text-fg-subtle">' . e(format_datetime($p['submitted_at'] ?? $p['created_at'], $l)) . '</span></div>'
            . '<dl class="grid gap-1 text-sm"><div class="flex gap-2"><dt class="font-semibold">' . e($d['reference']) . ':</dt><dd class="ltr-nums" dir="ltr">' . e($p['customer_reference'] ?? '—') . '</dd></div>'
            . '<div class="flex gap-2"><dt class="font-semibold">' . e($t['order']['amountDue']) . ':</dt><dd class="ltr-nums" dir="ltr">' . e(format_iqd((int) $p['amount'], $l)) . '</dd></div>';
        if ($p['reviewed_by_id']) $h .= '<div class="flex gap-2"><dt class="font-semibold">' . e($d['reviewedBy']) . ':</dt><dd>' . e($actorName($p['reviewed_by_id']) ?? '—') . '</dd></div>';
        if ($p['review_note']) $h .= '<div class="flex gap-2"><dt class="font-semibold">' . e($d['reviewNote']) . ':</dt><dd>' . e($p['review_note']) . '</dd></div>';
        $h .= '</dl>';
        if ($p['receipt_file_id']) $h .= '<a href="' . e(file_url($p['receipt_file_id'])) . '" target="_blank" rel="noopener noreferrer" class="' . button_class('outline', 'sm') . '">' . icon('file', 'size-4') . ' ' . e($d['receipt']) . '</a>';
        if ($canReview && $p['status'] === 'submitted') {
            $h .= action_form('admin.reviewPayment', hidden('paymentId', $p['id'])
                . '<label class="block text-xs font-semibold">' . e($d['reviewNote']) . input_tag(['name' => 'note', 'maxlength' => '500'], 'mt-1') . '</label><div class="flex flex-wrap gap-2">'
                . submit_button(icon('check', 'size-4') . ' ' . e($d['confirmPayment']), ['name' => 'decision', 'value' => 'confirm', 'size' => 'sm', 'confirm' => $d['confirmPrompt']])
                . submit_button(e($d['rejectPayment']), ['name' => 'decision', 'value' => 'reject', 'size' => 'sm', 'variant' => 'danger', 'confirm' => $d['rejectPrompt']])
                . '</div>', 'space-y-2 rounded-xl border border-line p-3');
        }
        $h .= '</li>';
    }
    $h .= '</ul></div>';

    $h .= card_open() . card_header($d['history']) . '<ol class="space-y-3 px-5 py-4">';
    foreach ($order['history'] as $hst) {
        $who = $hst['actor_type'] === 'customer' ? $d['actorCustomer'] : ($hst['actor_type'] === 'staff' ? $d['actorStaff'] . ($actorName($hst['actor_id']) ? ' (' . $actorName($hst['actor_id']) . ')' : '') : $d['actorSystem']);
        $h .= '<li class="flex flex-wrap items-start justify-between gap-2 text-sm"><span><span class="font-semibold">' . e(($hst['from_status'] ? $t['orderStatus'][$hst['from_status']] . ' ← ' : '') . $t['orderStatus'][$hst['to_status']]) . '</span>'
            . '<span class="block text-xs text-fg-subtle">' . e($who . ($hst['note'] ? ' — ' . $hst['note'] : '')) . '</span></span><span class="ltr-nums text-xs text-fg-subtle">' . e(format_datetime($hst['created_at'], $l)) . '</span></li>';
    }
    $h .= '</ol></div></div><div class="space-y-6">';

    $h .= card_open() . card_header($d['customer']) . '<dl class="space-y-2 px-5 py-4 text-sm">'
        . '<div><dt class="text-xs text-fg-subtle">' . e($t['checkout']['name']) . '</dt><dd class="font-semibold">' . e($order['customer_name']) . '</dd></div>'
        . '<div><dt class="text-xs text-fg-subtle">' . e($t['checkout']['phone']) . '</dt><dd class="ltr-nums font-semibold" dir="ltr">' . e($order['customer_phone'] ?: '—') . '</dd></div>'
        . '<div><dt class="text-xs text-fg-subtle">' . e($t['checkout']['email']) . '</dt><dd class="ltr-nums" dir="ltr">' . e($order['customer_email'] ?? '—') . '</dd></div>';
    if ($order['user_id'] && has_permission($user['role'], 'customers:read')) $h .= '<div><a href="' . e(lp('/admin/customers/' . $order['user_id'])) . '" class="text-sm font-semibold text-brand hover:underline">' . e($t['admin']['customers']) . ' →</a></div>';
    if ($order['customer_notes'] !== '') $h .= '<div><dt class="text-xs text-fg-subtle">' . e($t['order']['yourNotes']) . '</dt><dd class="whitespace-pre-line">' . e($order['customer_notes']) . '</dd></div>';
    if ($order['anonymized_at']) $h .= badge('anonymized', 'neutral');
    $h .= '</dl>';
    if ($order['customer_phone'] !== '') $h .= '<div class="border-t border-line px-5 py-3"><a href="' . e(whatsapp_link($order['customer_phone'], $customerMsg)) . '" target="_blank" rel="noopener noreferrer" class="' . button_class('secondary', 'sm') . '">' . icon('whatsapp', 'size-4') . ' ' . e($d['messageCustomer']) . '</a></div>';
    $h .= '</div>';

    if ($canUpdate) {
        $h .= card_open() . card_header($d['changeStatus']) . '<div class="px-5 py-4">';
        if (!$transitions) $h .= '<p class="text-sm text-fg-muted">' . e($d['noTransitions']) . '</p>';
        else {
            $opts = [];
            foreach ($transitions as $s) $opts[$s] = $t['orderStatus'][$s];
            $h .= action_form('admin.changeOrderStatus', hidden('orderId', $order['id'])
                . '<label class="block text-xs font-semibold">' . e($d['newStatus']) . select_tag(['name' => 'toStatus', 'required' => true], $opts, null, 'mt-1') . '</label>'
                . '<label class="block text-xs font-semibold">' . e($d['statusNote']) . input_tag(['name' => 'note', 'maxlength' => '500'], 'mt-1') . '</label>'
                . submit_button(e($d['apply']), ['size' => 'sm', 'confirm' => $d['statusPrompt']]), 'space-y-3');
        }
        $h .= '</div></div>';
        $h .= card_open() . card_header($d['deliveryNote'], $d['deliveryNoteHint'])
            . action_form('admin.saveDeliveryNote', hidden('orderId', $order['id']) . textarea_tag(['name' => 'deliveryNote', 'maxlength' => '3000', 'rows' => '4', 'aria-label' => $d['deliveryNote'], 'dir' => 'auto'], $order['delivery_note']) . submit_button(e($t['common']['save']), ['size' => 'sm']), 'space-y-3 px-5 py-4')
            . '</div>';
        $h .= card_open() . card_header($d['adminNotes'])
            . action_form('admin.saveAdminNotes', hidden('orderId', $order['id']) . textarea_tag(['name' => 'adminNotes', 'maxlength' => '5000', 'rows' => '5', 'aria-label' => $d['adminNotes']], $order['admin_notes']) . submit_button(e($t['common']['save']), ['size' => 'sm', 'variant' => 'secondary']), 'space-y-3 px-5 py-4')
            . '</div>';
    }
    $h .= '</div></div>';
    return admin_page($user, fmt($d['title'], ['ref' => $order['reference']]), $h);
}
