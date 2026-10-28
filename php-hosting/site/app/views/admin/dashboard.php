<?php
declare(strict_types=1);

require_once __DIR__ . '/common.php';

function page_admin_dashboard(array $params): array
{
    $l = loc();
    $t = T();
    $user = require_staff_page($l, 'dashboard:view');
    $s = dashboard_stats();
    after_response(fn() => maybe_run_maintenance());
    $a = lp('/admin');
    $st = $t['admin']['stats'];
    $tiles = [
        [$st['totalOrders'], num($s['totalOrders']), 'receipt', "$a/orders", false],
        [$st['pending'], num($s['pendingPayment']), 'clock', "$a/orders?status=pending_payment", false],
        [$st['review'], num($s['paymentReview']), 'alert', "$a/orders?status=payment_review", $s['paymentReview'] > 0],
        [$st['completed'], num($s['completed']), 'check', "$a/orders?status=completed", false],
    ];
    $h = admin_title($t['admin']['dashboard']);
    if (query('denied') === '1') $h .= alert('danger', $t['errors']['forbidden'], null, 'mb-4');
    $h .= '<ul class="grid grid-cols-2 gap-3 lg:grid-cols-4">';
    foreach ($tiles as [$label, $value, $ic, $href, $hl]) {
        $h .= '<li><a href="' . e($href) . '" class="block rounded-(--radius-card) border bg-elevated p-4 shadow-soft transition hover:border-brand ' . ($hl ? 'border-info' : 'border-line') . '"><span class="flex items-center justify-between text-xs font-semibold text-fg-muted">' . e($label) . ' ' . icon($ic, 'size-4') . '</span><span class="ltr-nums mt-2 block text-2xl font-black">' . $value . '</span></a></li>';
    }
    $h .= '</ul><div class="mt-3 grid gap-3 sm:grid-cols-2">';
    $h .= card_open('p-4') . '<p class="text-xs font-semibold text-fg-muted">' . e($st['revenue']) . '</p><p class="ltr-nums mt-1 text-2xl font-black text-success" dir="ltr">' . e(format_iqd($s['confirmedRevenue'], $l)) . '</p><p class="mt-1 text-xs text-fg-subtle">' . e($st['revenueHint']) . '</p></div>';
    $h .= card_open('p-4') . '<p class="text-xs font-semibold text-fg-muted">' . e($st['gross']) . '</p><p class="ltr-nums mt-1 text-2xl font-black" dir="ltr">' . e(format_iqd($s['grossValue'], $l)) . '</p><p class="mt-1 text-xs text-fg-subtle">' . e($st['grossHint']) . '</p></div>';
    $h .= '</div><div class="mt-6 grid gap-6 xl:grid-cols-[1.4fr_1fr]">';
    $h .= card_open() . card_header($st['recent'], null, '<a href="' . e("$a/orders") . '" class="text-sm font-semibold text-brand">' . e($t['common']['viewAll']) . '</a>');
    if (!$s['recent']) $h .= '<p class="p-5 text-sm text-fg-muted">' . e($st['noData']) . '</p>';
    else {
        $h .= '<ul class="divide-y divide-line">';
        foreach ($s['recent'] as $o) {
            $h .= '<li><a href="' . e("$a/orders/{$o['id']}") . '" class="flex flex-wrap items-center justify-between gap-2 px-5 py-3 hover:bg-muted"><span><span class="ltr-nums block text-sm font-bold" dir="ltr">' . e($o['reference']) . '</span><span class="text-xs text-fg-subtle">' . e($o['customer_name']) . ' · <span class="ltr-nums">' . e(format_datetime($o['created_at'], $l)) . '</span></span></span>'
                . '<span class="flex items-center gap-2">' . order_status_badge($o['status']) . '<span class="ltr-nums text-sm font-bold" dir="ltr">' . e(format_iqd((int) $o['total'], $l)) . '</span></span></a></li>';
        }
        $h .= '</ul>';
    }
    $h .= '</div>' . card_open() . card_header($st['bestSellers']);
    if (!$s['bestSellers']) $h .= '<p class="p-5 text-sm text-fg-muted">' . e($st['noData']) . '</p>';
    else {
        $h .= '<table class="w-full text-sm"><thead class="text-xs text-fg-subtle"><tr><th class="px-5 py-2 text-start font-semibold"></th><th class="px-3 py-2 text-end font-semibold">' . e($st['units']) . '</th><th class="px-5 py-2 text-end font-semibold">' . e($st['revenueCol']) . '</th></tr></thead><tbody class="divide-y divide-line">';
        foreach ($s['bestSellers'] as $b) {
            $h .= '<tr><td class="px-5 py-2.5 font-semibold">' . e($l === 'ar' ? $b['name_ar'] : $b['name_en']) . '</td><td class="ltr-nums px-3 py-2.5 text-end">' . num((int) $b['units']) . '</td><td class="ltr-nums px-5 py-2.5 text-end font-bold" dir="ltr">' . e(format_iqd((int) $b['revenue'], $l)) . '</td></tr>';
        }
        $h .= '</tbody></table>';
    }
    $h .= '</div></div>';
    return admin_page($user, $t['admin']['dashboard'], $h);
}
