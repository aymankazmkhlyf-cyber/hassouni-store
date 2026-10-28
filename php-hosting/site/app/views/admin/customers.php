<?php
declare(strict_types=1);

require_once __DIR__ . '/common.php';

function page_admin_customers(array $params): array
{
    $l = loc();
    $t = T();
    $user = require_staff_page($l, 'customers:read');
    $search = query('q') !== null ? js_slice(query('q'), 80) : null;
    $r = list_customers((string) $search, page_number(query('page')));
    $c = $t['admin']['customersPage'];
    $full = has_permission($user['role'], 'customers:write');
    $h = admin_title($c['registered'], $c['guestNote']);
    $h .= '<form method="get" class="mb-4 flex gap-2">' . input_tag(['name' => 'q', 'value' => $search, 'placeholder' => $c['searchPlaceholder'], 'maxlength' => '80', 'aria-label' => $t['common']['search']], 'max-w-xs')
        . '<button class="' . button_class('secondary', 'md') . '" type="submit">' . e($t['common']['search']) . '</button></form>';
    if (!$r['rows']) $h .= empty_state($t['common']['noResults'], null, '', 'users');
    else {
        $h .= card_open('overflow-x-auto') . '<table class="w-full min-w-[40rem] text-sm"><thead class="border-b border-line text-xs text-fg-subtle"><tr>';
        foreach ([$t['auth']['name'], $t['auth']['email'], $c['role'], $c['orders'], $c['joined']] as $th) $h .= '<th class="px-4 py-3 text-start font-semibold">' . e($th) . '</th>';
        $h .= '</tr></thead><tbody class="divide-y divide-line">';
        foreach ($r['rows'] as $row) {
            $h .= '<tr class="hover:bg-muted"><td class="px-4 py-3"><a href="' . e(lp('/admin/customers/' . $row['id'])) . '" class="font-bold text-brand hover:underline">' . e($row['name']) . '</a>'
                . ($row['phone'] ? '<span class="ltr-nums block text-xs text-fg-subtle" dir="ltr">' . e($full ? $row['phone'] : mask_phone($row['phone'])) . '</span>' : '') . '</td>'
                . '<td class="ltr-nums px-4 py-3" dir="ltr">' . e($row['email']) . '</td><td class="px-4 py-3">' . badge(e($row['role']), $row['role'] === 'customer' ? 'neutral' : 'brand') . ' '
                . ($row['status'] === 'suspended' ? badge(e($c['suspended']), 'danger') : '') . '</td><td class="ltr-nums px-4 py-3">' . (int) $row['order_count'] . '</td>'
                . '<td class="ltr-nums px-4 py-3 text-xs">' . e(format_date($row['created_at'], $l)) . '</td></tr>';
        }
        $h .= '</tbody></table></div>';
    }
    $h .= pagination($r['page'], $r['pages'], lp('/admin/customers'), ['q' => $search]);
    $h .= alert('info', $c['retention'], e($c['retentionBody']), 'mt-6');
    return admin_page($user, $c['registered'], $h);
}

function page_admin_customer(array $params): array
{
    $l = loc();
    $t = T();
    $viewer = require_staff_page($l, 'customers:read');
    if (!preg_match('/^[0-9a-f-]{36}$/i', $params['id'])) not_found();
    $data = get_customer(strtolower($params['id']));
    if (!$data) not_found();
    $user = $data['user'];
    $c = $t['admin']['customersPage'];
    $canWrite = has_permission($viewer['role'], 'customers:write') && $user['role'] === 'customer';
    $h = admin_title($user['name'], $user['email'], '<span class="flex gap-1">' . badge(e($user['role'])) . ($user['status'] === 'suspended' ? badge(e($c['suspended']), 'danger') : '') . '</span>');
    $h .= '<div class="grid gap-6 xl:grid-cols-[1.5fr_1fr]">' . card_open() . card_header($c['orders']) . '<ul class="divide-y divide-line">';
    if (!$data['orders']) $h .= '<li class="p-5 text-sm text-fg-muted">' . e($t['account']['noOrders']) . '</li>';
    foreach ($data['orders'] as $o) {
        $h .= '<li><a href="' . e(lp('/admin/orders/' . $o['id'])) . '" class="flex flex-wrap items-center justify-between gap-2 px-5 py-3 hover:bg-muted"><span class="ltr-nums font-bold" dir="ltr">' . e($o['reference']) . '</span>'
            . '<span class="flex items-center gap-2 text-sm">' . order_status_badge($o['status']) . '<span class="ltr-nums" dir="ltr">' . e(format_iqd((int) $o['total'], $l)) . '</span><span class="ltr-nums text-xs text-fg-subtle">' . e(format_date($o['created_at'], $l)) . '</span></span></a></li>';
    }
    $h .= '</ul></div><div class="space-y-4">' . card_open('space-y-2 p-5 text-sm')
        . '<p><span class="text-fg-subtle">' . e($t['checkout']['phone']) . ': </span><span class="ltr-nums" dir="ltr">' . e($user['phone'] ?? '—') . '</span></p>'
        . '<p><span class="text-fg-subtle">' . e($t['wallet']['walletId']) . ': </span><span class="ltr-nums" dir="ltr">' . e($user['username'] ? '@' . $user['username'] : '—') . '</span></p>'
        . '<p><span class="text-fg-subtle">' . e($t['wallet']['balance']) . ': </span><a href="' . e(lp('/admin/wallet') . '?find=' . rawurlencode($user['username'] ?? $user['email'])) . '" class="ltr-nums font-bold text-brand hover:underline" dir="ltr">' . e(format_iqd((int) $user['wallet_balance'], $l)) . '</a></p>'
        . '<p><span class="text-fg-subtle">' . e($c['joined']) . ': </span><span class="ltr-nums">' . e(format_date($user['created_at'], $l)) . '</span></p></div>';
    if ($canWrite) {
        $h .= card_open('space-y-4 p-5')
            . action_form('admin.setCustomerStatus', hidden('id', $user['id']) . hidden('status', $user['status'] === 'active' ? 'suspended' : 'active') . submit_button(e($user['status'] === 'active' ? $c['suspend'] : $c['unsuspend']), ['size' => 'sm', 'variant' => 'outline', 'confirm' => $t['common']['confirmAction']]))
            . action_form('admin.anonymizeCustomer', hidden('id', $user['id']) . '<p class="text-xs text-fg-muted">' . e($c['anonymizeConfirm']) . '</p>' . submit_button(e($c['anonymize']), ['size' => 'sm', 'variant' => 'danger', 'confirm' => $c['anonymizeConfirm']]), 'space-y-2')
            . '</div>';
    }
    return admin_page($viewer, $user['name'], $h . '</div></div>');
}

function page_admin_wallet(array $params): array
{
    $l = loc();
    $t = T();
    $me = require_staff_page($l, 'payments:review');
    $raw = query('status') ?? 'submitted';
    $status = in_array($raw, ['submitted', 'approved', 'rejected'], true) ? $raw : ($raw === 'all' ? null : 'submitted');
    $r = list_topups_admin($status, page_number(query('page')));
    $w = $t['admin']['walletPage'];
    $ws = $t['wallet'];
    $canAdjust = has_permission($me['role'], 'wallet:adjust');
    $lookup = js_slice(trim_js((string) query('find')), 200);
    $customer = $canAdjust && $lookup !== '' ? find_customer($lookup) : null;
    $history = $customer ? recent_wallet_transactions($customer['id']) : [];

    $h = admin_title($t['admin']['wallet']) . alert('info', null, e($w['intro']), 'mb-4');
    if ($canAdjust) {
        $h .= card_open('mb-6 p-5') . '<h2 class="mb-3 font-bold">' . e($w['findTitle']) . '</h2><form method="get" class="flex flex-wrap gap-2">'
            . input_tag(['name' => 'find', 'value' => $lookup, 'placeholder' => $w['findPlaceholder'], 'dir' => 'ltr', 'aria-label' => $w['findPlaceholder']], 'max-w-sm')
            . '<button type="submit" class="' . button_class('secondary', 'md') . '">' . e($w['find']) . '</button></form>';
        if ($lookup !== '' && !$customer) $h .= '<p class="mt-3 text-sm text-warning">' . e($w['notFound']) . '</p>';
        if ($customer) {
            $h .= '<div class="mt-4 space-y-4" data-testid="wallet-customer"><div class="flex flex-wrap items-center gap-3 rounded-xl bg-muted p-3 text-sm"><span class="font-bold">' . e($customer['name']) . '</span>'
                . ($customer['username'] ? '<span class="ltr-nums" dir="ltr">@' . e($customer['username']) . '</span>' : '') . '<span class="ltr-nums text-fg-muted" dir="ltr">' . e($customer['email']) . '</span>'
                . '<span class="ms-auto">' . e($w['balance']) . ': <span class="ltr-nums font-black" dir="ltr">' . e(format_iqd((int) $customer['wallet_balance'], $l)) . '</span></span></div>';
            $h .= action_form('admin.adjustWallet', hidden('userId', $customer['id'])
                . '<label class="text-xs font-semibold">&nbsp;' . select_tag(['name' => 'direction'], ['credit' => $w['credit'], 'debit' => $w['debit']], 'credit', 'mt-1') . '</label>'
                . '<label class="text-xs font-semibold">' . e($w['amount']) . input_tag(['name' => 'amount', 'type' => 'number', 'min' => '250', 'step' => '250', 'required' => true, 'dir' => 'ltr'], 'mt-1') . '</label>'
                . '<label class="text-xs font-semibold">' . e($w['adjustNote']) . input_tag(['name' => 'note', 'required' => true, 'maxlength' => '300'], 'mt-1') . '</label>'
                . submit_button(e($w['apply']), ['size' => 'sm']), 'grid gap-3 sm:grid-cols-[10rem_10rem_1fr_auto] sm:items-end');
            if ($history) {
                $h .= '<div><h3 class="mb-2 text-sm font-bold">' . e($w['recent']) . '</h3><ul class="divide-y divide-line rounded-xl border border-line text-sm">';
                foreach ($history as $tx) {
                    $amt = (int) $tx['amount'];
                    $h .= '<li class="flex flex-wrap justify-between gap-2 px-3 py-2"><span>' . e($ws['types'][$tx['type']]) . ($tx['note'] !== '' ? '<span class="text-fg-muted" dir="auto"> · ' . e($tx['note']) . '</span>' : '') . ' <span class="ltr-nums text-xs text-fg-subtle">' . e(format_datetime($tx['created_at'], $l)) . '</span></span>'
                        . '<span class="ltr-nums font-bold ' . ($amt > 0 ? 'text-success' : 'text-danger') . '" dir="ltr">' . ($amt > 0 ? '+' : '−') . e(format_iqd(abs($amt), $l)) . ' → ' . e(format_iqd((int) $tx['balance_after'], $l)) . '</span></li>';
                }
                $h .= '</ul></div>';
            }
            $h .= '</div>';
        }
        $h .= '</div>';
    }
    $h .= '<form method="get" class="mb-4 flex gap-2">' . select_tag(['name' => 'status', 'aria-label' => $t['order']['status']], ['submitted' => $w['pending'], 'approved' => $ws['status']['approved'], 'rejected' => $ws['status']['rejected'], 'all' => $w['all']], $status ?? 'all', 'max-w-xs')
        . '<button class="' . button_class('secondary', 'md') . '" type="submit">' . e($t['common']['filter']) . '</button></form>';
    if (!$r['rows']) $h .= empty_state($w['empty'], null, '', 'wallet');
    $h .= '<div class="space-y-4">';
    foreach ($r['rows'] as $row) {
        $amount = format_iqd((int) $row['amount'], $l);
        $h .= card_open('p-5', ' data-testid="topup-' . e($row['id']) . '"') . '<div class="mb-3 flex flex-wrap items-center justify-between gap-2"><span class="flex flex-wrap items-center gap-2"><span class="ltr-nums text-xl font-black" dir="ltr">' . e($amount) . '</span>'
            . badge(e(L($row, 'method_name', $l))) . badge(e($ws['status'][$row['status']]), TOPUP_TONE_ADMIN[$row['status']]) . '</span><span class="ltr-nums text-xs text-fg-subtle">' . e(format_datetime($row['created_at'], $l)) . '</span></div>'
            . '<dl class="grid gap-1 text-sm sm:grid-cols-2"><div><dt class="inline font-semibold">' . e($w['customer']) . ': </dt><dd class="inline">' . e($row['user_name'] ?? '—') . ' ' . ($row['username'] ? '<span class="ltr-nums" dir="ltr">(@' . e($row['username']) . ')</span>' : '') . '</dd></div>'
            . '<div><dt class="inline font-semibold">' . e($w['balance']) . ': </dt><dd class="ltr-nums inline" dir="ltr">' . ($row['balance'] !== null ? e(format_iqd((int) $row['balance'], $l)) : '—') . '</dd></div>'
            . ($row['customer_reference'] ? '<div><dt class="inline font-semibold">' . e($w['reference']) . ': </dt><dd class="ltr-nums inline font-bold" dir="ltr">' . e($row['customer_reference']) . '</dd></div>' : '')
            . ($row['receipt_file_id'] ? '<div><a href="' . e(file_url($row['receipt_file_id'])) . '" target="_blank" rel="noopener noreferrer" class="font-semibold text-brand underline">' . e($w['receipt']) . '</a></div>' : '')
            . ($row['review_note'] ? '<div class="sm:col-span-2 text-fg-muted">' . e($row['review_note']) . '</div>' : '') . '</dl>';
        if ($row['status'] === 'submitted') {
            $h .= '<div class="mt-4 grid gap-3 sm:grid-cols-2">'
                . action_form('admin.reviewTopup', hidden('topupId', $row['id']) . hidden('decision', 'approve') . '<label class="block text-xs font-semibold">' . e($w['note']) . input_tag(['name' => 'note', 'maxlength' => '300'], 'mt-1') . '</label>' . submit_button(e($w['approve']), ['size' => 'sm', 'confirm' => $w['approve'] . ': ' . $amount]), 'space-y-2')
                . action_form('admin.reviewTopup', hidden('topupId', $row['id']) . hidden('decision', 'reject') . '<label class="block text-xs font-semibold">' . e($w['rejectReason']) . input_tag(['name' => 'note', 'required' => true, 'maxlength' => '300'], 'mt-1') . '</label>' . submit_button(e($w['reject']), ['size' => 'sm', 'variant' => 'danger']), 'space-y-2')
                . '</div>';
        }
        $h .= '</div>';
    }
    $h .= '</div>' . pagination($r['page'], $r['pages'], lp('/admin/wallet'), ['status' => $status ?? 'all']);
    return admin_page($me, $t['admin']['wallet'], $h);
}

const TOPUP_TONE_ADMIN = ['submitted' => 'warning', 'approved' => 'success', 'rejected' => 'danger'];
