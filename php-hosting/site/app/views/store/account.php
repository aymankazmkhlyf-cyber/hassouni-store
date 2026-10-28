<?php
declare(strict_types=1);

function logout_form(string $variant, string $label): string
{
    return '<form action="' . e(url('/_action/auth.logout')) . '" method="post"><input type="hidden" name="locale" value="' . loc() . '"><button type="submit" class="' . button_class($variant) . '">' . icon('logout', 'size-4') . ' ' . e($label) . '</button></form>';
}

function page_account(array $params): array
{
    $l = loc();
    $t = T();
    $user = require_customer_page($l);
    $orders = list_orders_for_user($user['id']);
    $isCustomer = $user['role'] === 'customer';
    $h = page_header($t['account']['title'], $user['name'] . ' · ' . $user['email'] . ($user['username'] ? ' · @' . $user['username'] : ''));
    $h .= '<div class="mx-auto max-w-4xl space-y-6 px-4 py-8"><div class="flex flex-wrap gap-2">';
    if (!$isCustomer) $h .= button_link(lp('/admin'), icon('grid', 'size-4') . ' ' . e($t['admin']['panel']), 'secondary');
    $h .= logout_form('outline', $t['nav']['logout']) . '</div>';
    if ($isCustomer) {
        $h .= '<a href="' . e(lp('/account/wallet')) . '" class="flex flex-wrap items-center justify-between gap-3 rounded-(--radius-card) bg-[linear-gradient(135deg,var(--hero-from),var(--hero-to))] p-5 text-white shadow-lift" data-testid="account-wallet">'
            . '<span class="flex items-center gap-3">' . icon('wallet', 'size-7') . '<span><span class="block text-sm text-white/80">' . e($t['wallet']['balance']) . '</span><span class="ltr-nums block text-2xl font-black" dir="ltr">' . e(format_iqd((int) $user['wallet_balance'], $l)) . '</span></span></span>'
            . '<span class="text-end text-sm">' . ($user['username'] ? '<span class="ltr-nums block font-bold" dir="ltr">@' . e($user['username']) . '</span>' : '') . '<span class="font-semibold underline">' . e($t['wallet']['openWallet']) . '</span></span></a>';
    }
    $h .= card_open() . card_header($t['account']['orders']);
    if (!$orders) {
        $h .= '<div class="p-5">' . empty_state($t['account']['noOrders'], null, button_link(lp('/services'), e($t['cart']['continue'])), 'inbox') . '</div>';
    } else {
        $h .= '<ul class="divide-y divide-line">';
        foreach ($orders as $o) {
            $names = implode($l === 'ar' ? '، ' : ', ', array_map(fn($i) => $l === 'ar' ? $i['product_name_ar'] : $i['product_name_en'], $o['items']));
            $h .= '<li><a href="' . e(lp('/orders/' . $o['reference'])) . '" class="flex flex-wrap items-center justify-between gap-3 px-5 py-4 hover:bg-muted"><span class="min-w-0"><span class="ltr-nums block font-bold" dir="ltr">' . e($o['reference']) . '</span>'
                . '<span class="block truncate text-xs text-fg-subtle"><span class="ltr-nums">' . e(format_date($o['created_at'], $l)) . '</span> · ' . e($names) . '</span></span>'
                . '<span class="flex items-center gap-3">' . order_status_badge($o['status']) . '<span class="ltr-nums font-bold" dir="ltr">' . e(format_iqd((int) $o['total'], $l)) . '</span></span></a></li>';
        }
        $h .= '</ul>';
    }
    $h .= '</div>';
    if ($isCustomer) {
        $h .= card_open() . card_header($t['account']['deleteAccount'], $t['account']['deleteAccountBody']) . '<div class="p-5">'
            . island('DeleteAccountForm', ['locale' => $l, 's' => ['label' => $t['account']['deleteConfirm'], 'submit' => $t['account']['deleteAccount'], 'confirm' => $t['account']['deleteAccountBody']], 'errors' => $t['errors']])
            . '</div></div>';
    }
    return ['title' => $t['account']['title'], 'private' => true, 'html' => $h . '</div>'];
}

const TOPUP_TONE = ['submitted' => 'warning', 'approved' => 'success', 'rejected' => 'danger'];

function page_wallet(array $params): array
{
    $l = loc();
    $t = T();
    $w = $t['wallet'];
    $user = require_customer_page($l);
    if ($user['role'] !== 'customer') {
        return ['title' => $w['title'], 'private' => true, 'html' => '<div class="mx-auto max-w-xl px-4 py-16 text-center"><a href="' . e(lp('/account')) . '" class="font-semibold text-brand">' . e($t['account']['title']) . '</a></div>'];
    }
    $wallet = get_wallet($user['id']);
    $methods = list_payment_methods(true);
    $h = page_header($w['title'], $user['name']) . '<div class="mx-auto max-w-4xl space-y-6 px-4 py-8">';
    $h .= '<p class="text-sm"><a href="' . e(lp('/account')) . '" class="font-semibold text-brand hover:underline">← ' . e($t['account']['title']) . '</a></p>';
    $h .= '<section class="grid gap-4 rounded-(--radius-card) bg-[linear-gradient(135deg,var(--hero-from),var(--hero-to))] p-6 text-white shadow-lift sm:grid-cols-2" data-testid="wallet-summary"><div><p class="text-sm text-white/80">' . e($w['balance']) . '</p>'
        . '<p class="ltr-nums mt-1 text-4xl font-black" dir="ltr" data-testid="wallet-balance">' . e(format_iqd($wallet['balance'], $l)) . '</p></div><div class="space-y-1"><p class="text-sm text-white/80">' . e($w['walletId']) . '</p>';
    $h .= $wallet['username']
        ? '<p class="flex items-center gap-2"><span class="ltr-nums text-xl font-bold" dir="ltr">@' . e($wallet['username']) . '</span>' . copy_button($wallet['username']) . '</p>'
        : '<p class="text-sm">' . e($w['setUsernameBody']) . '</p>';
    $h .= '<p class="text-xs text-white/75">' . e($w['walletIdHint']) . '</p></div></section>';
    if (!$wallet['username']) {
        $h .= card_open('p-5') . '<h2 class="mb-3 font-bold">' . e($w['setUsernameTitle']) . '</h2>'
            . island('SetUsernameForm', ['s' => ['username' => $t['auth']['username'], 'usernameHint' => $t['auth']['usernameHint'], 'save' => $w['save']], 'errors' => $t['errors']]) . '</div>';
    }
    $h .= card_open('p-5') . '<h2 class="mb-2 font-bold">' . e($w['howTitle']) . '</h2><ul class="space-y-1.5 text-sm text-fg-muted">';
    foreach ($w['how'] as $line) $h .= '<li class="flex gap-2">' . icon('check', 'mt-0.5 size-4 shrink-0 text-success') . ' ' . e($line) . '</li>';
    $h .= '</ul></div>';
    $h .= card_open('p-5', ' id="topup"') . '<h2 class="mb-1 flex items-center gap-2 font-bold">' . icon('wallet', 'size-5 text-brand') . ' ' . e($w['topupTitle']) . '</h2><ol class="mb-4 list-decimal space-y-0.5 ps-5 text-sm text-fg-muted">';
    foreach ($w['topupSteps'] as $step) $h .= '<li>' . e($step) . '</li>';
    $h .= '</ol>';
    if (!$methods) {
        $h .= '<p class="text-sm text-warning">' . e($w['noMethods']) . '</p>';
    } else {
        $o = $t['order'];
        $h .= island('TopupForm', [
            'locale' => $l,
            'methods' => array_map(fn($m) => [
                'id' => (int) $m['id'], 'nameAr' => $m['name_ar'], 'nameEn' => $m['name_en'], 'accountDetails' => $m['account_details'],
                'instructionsAr' => $m['instructions_ar'], 'instructionsEn' => $m['instructions_en'], 'qrFileId' => $m['qr_file_id'], 'allowsReceipt' => (bool) $m['allows_receipt'],
            ], $methods),
            's' => $w,
            'pay' => ['amountDue' => $o['amountDue'], 'payTo' => $o['payTo'], 'payToMissing' => $o['payToMissing'], 'scanQr' => $o['scanQr'], 'scanQrHint' => $o['scanQrHint'], 'saveQr' => $o['saveQr'], 'qrAlt' => $o['qrAlt'], 'copy' => $t['common']['copy'], 'copied' => $t['common']['copied']],
            'errors' => $t['errors'],
        ]);
    }
    $h .= '</div>';
    if ($wallet['topups']) {
        $h .= card_open() . card_header($w['requests']) . '<ul class="divide-y divide-line">';
        foreach ($wallet['topups'] as $r) {
            $h .= '<li class="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm"><span><span class="ltr-nums font-bold" dir="ltr">' . e(format_iqd((int) $r['amount'], $l)) . '</span><span class="text-fg-muted"> · ' . e(L($r, 'method_name', $l)) . ' · </span>'
                . '<span class="ltr-nums text-xs text-fg-subtle">' . e(format_datetime($r['created_at'], $l)) . '</span>'
                . ($r['status'] === 'rejected' && $r['review_note'] ? '<span class="block text-xs text-danger">' . e($r['review_note']) . '</span>' : '') . '</span>' . badge(e($w['status'][$r['status']]), TOPUP_TONE[$r['status']]) . '</li>';
        }
        $h .= '</ul></div>';
    }
    $h .= card_open() . card_header($w['history']);
    if (!$wallet['transactions']) {
        $h .= '<p class="px-5 py-6 text-center text-sm text-fg-muted">' . e($w['empty']) . '</p>';
    } else {
        $h .= '<ul class="divide-y divide-line" data-testid="wallet-history">';
        foreach ($wallet['transactions'] as $tx) {
            $amount = (int) $tx['amount'];
            $h .= '<li class="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm"><span><span class="font-semibold">' . e($w['types'][$tx['type']]) . '</span>'
                . ($tx['note'] !== '' ? '<span class="ltr-nums text-fg-muted" dir="auto"> · ' . e($tx['note']) . '</span>' : '')
                . '<span class="ltr-nums block text-xs text-fg-subtle">' . e(format_datetime($tx['created_at'], $l)) . '</span></span><span class="text-end">'
                . '<span class="ltr-nums block font-bold ' . ($amount > 0 ? 'text-success' : 'text-danger') . '" dir="ltr">' . ($amount > 0 ? '+' : '−') . e(format_iqd(abs($amount), $l)) . '</span>'
                . '<span class="ltr-nums text-xs text-fg-subtle" dir="ltr">' . e(format_iqd((int) $tx['balance_after'], $l)) . '</span></span></li>';
        }
        $h .= '</ul>';
    }
    return ['title' => $w['title'], 'private' => true, 'html' => $h . '</div></div>'];
}
