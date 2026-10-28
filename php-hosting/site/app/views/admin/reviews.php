<?php
declare(strict_types=1);

require_once __DIR__ . '/common.php';

function page_admin_reviews(array $params): array
{
    $l = loc();
    $t = T();
    $user = require_staff_page($l, 'reviews:manage');
    $status = in_array(query('status'), ['published', 'hidden'], true) ? query('status') : null;
    $rr = query('rating');
    $rating = $rr !== null && preg_match('/^[1-5]$/', $rr) ? (int) $rr : null;
    $res = list_reviews_admin($status, $rating, page_number(query('page')));
    $r = $t['admin']['reviewsPage'];
    $ar = $l === 'ar';
    $h = admin_title($t['admin']['reviews']) . '<p class="mb-4 max-w-3xl text-sm text-fg-muted">' . e($r['intro']) . '</p>';
    $ratingOpts = ['' => $r['allRatings']];
    foreach ([5, 4, 3, 2, 1] as $n) $ratingOpts[(string) $n] = str_repeat('★', $n);
    $h .= '<form method="get" class="mb-4 flex flex-wrap gap-2">' . select_tag(['name' => 'status', 'aria-label' => $t['order']['status']], ['' => $r['all'], 'published' => $r['published'], 'hidden' => $r['hidden']], $status ?? '', 'max-w-[12rem]')
        . select_tag(['name' => 'rating', 'aria-label' => $t['reviews']['rating']], $ratingOpts, $rating ? (string) $rating : '', 'max-w-[12rem]')
        . '<button class="' . button_class('secondary', 'md') . '" type="submit">' . e($t['common']['filter']) . '</button><span class="ms-auto self-center text-sm text-fg-muted">' . e($r['total']) . ': <span class="ltr-nums font-bold">' . $res['total'] . '</span></span></form>';
    if (!$res['rows']) $h .= empty_state($r['empty'], null, '', 'star');
    $h .= '<div class="space-y-4">';
    foreach ($res['rows'] as $rev) {
        $pkg = $ar ? $rev['package_label_ar'] : $rev['package_label_en'];
        $h .= card_open('p-5', ' data-testid="admin-review-' . (int) $rev['id'] . '"') . '<div class="mb-2 flex flex-wrap items-center justify-between gap-2"><span class="flex flex-wrap items-center gap-2">'
            . stars((float) $rev['rating'], fmt($t['reviews']['starsLabel'], ['n' => $rev['rating']]), 'text-lg') . badge(e($r[$rev['status']]), $rev['status'] === 'published' ? 'success' : 'neutral')
            . '<span class="font-bold" dir="auto">' . e($rev['display_name']) . '</span></span><span class="ltr-nums text-xs text-fg-subtle">' . e(format_datetime($rev['created_at'], $l)) . '</span></div>'
            . '<p class="text-sm text-fg-muted">' . e($ar ? $rev['product_name_ar'] : $rev['product_name_en']) . ($pkg ? ' · ' . e($pkg) : '') . ' · ' . e($r['order']) . ' <a href="' . e(lp('/admin/orders/' . $rev['order_id'])) . '" class="ltr-nums font-semibold text-brand hover:underline" dir="ltr">' . e($rev['order_reference']) . '</a></p>';
        if ($rev['comment'] !== '') $h .= '<p class="mt-3 rounded-xl bg-muted p-3 text-sm whitespace-pre-line" dir="auto">' . e($rev['comment']) . '</p>';
        if ($rev['status'] === 'hidden' && $rev['hidden_reason']) $h .= '<p class="mt-2 text-sm text-warning">' . e($r['reasonLabel']) . ': ' . e($rev['hidden_reason']) . '</p>';
        $h .= '<div class="mt-4 grid gap-3 lg:grid-cols-2">'
            . action_form('admin.replyReview', hidden('reviewId', $rev['id']) . '<label class="block text-xs font-semibold">' . e($r['reply']) . textarea_tag(['name' => 'reply', 'rows' => '2', 'maxlength' => '1000'], (string) ($rev['staff_reply'] ?? ''), 'mt-1') . '</label>' . submit_button(e($r['saveReply']), ['size' => 'sm', 'variant' => 'secondary']), 'space-y-2');
        $h .= $rev['status'] === 'published'
            ? action_form('admin.moderateReview', hidden('reviewId', $rev['id']) . hidden('status', 'hidden') . '<label class="block text-xs font-semibold">' . e($r['hideReason']) . input_tag(['name' => 'reason', 'required' => true, 'maxlength' => '300'], 'mt-1') . '</label>' . submit_button(e($r['hide']), ['size' => 'sm', 'variant' => 'danger']), 'space-y-2')
            : action_form('admin.moderateReview', hidden('reviewId', $rev['id']) . hidden('status', 'published') . submit_button(e($r['publish']), ['size' => 'sm']), 'flex items-end');
        $h .= '</div></div>';
    }
    $h .= '</div>' . pagination($res['page'], $res['pages'], lp('/admin/reviews'), ['status' => $status, 'rating' => $rating ? (string) $rating : null]);
    return admin_page($user, $t['admin']['reviews'], $h);
}

const REQUEST_STATUSES = ['new', 'in_review', 'quoted', 'closed'];

function page_admin_requests(array $params): array
{
    $l = loc();
    $t = T();
    $user = require_staff_page($l, 'requests:manage');
    $status = in_array(query('status'), REQUEST_STATUSES, true) ? query('status') : null;
    $res = list_custom_requests($status, page_number(query('page')));
    $r = $t['admin']['requestsPage'];
    $statusOpts = [];
    foreach (REQUEST_STATUSES as $s) $statusOpts[$s] = $r['statuses'][$s];
    $h = admin_title($t['admin']['requests']) . '<form method="get" class="mb-4 flex gap-2">' . select_tag(['name' => 'status', 'aria-label' => $r['status']], ['' => $t['common']['all']] + $statusOpts, $status ?? '', 'max-w-xs')
        . '<button class="' . button_class('secondary', 'md') . '" type="submit">' . e($t['common']['filter']) . '</button></form>';
    if (!$res['rows']) $h .= empty_state($r['empty'], null, '', 'wand');
    $h .= '<div class="space-y-4">';
    foreach ($res['rows'] as $req) {
        $tone = $req['status'] === 'new' ? 'warning' : ($req['status'] === 'closed' ? 'neutral' : 'info');
        $h .= card_open('p-5') . '<div class="mb-3 flex flex-wrap items-center justify-between gap-2"><span class="flex items-center gap-2"><span class="ltr-nums font-bold" dir="ltr">' . e($req['reference']) . '</span>'
            . badge(e($t['custom']['types'][$req['service_type']] ?? $req['service_type']), 'brand') . badge(e($r['statuses'][$req['status']]), $tone) . '</span><span class="ltr-nums text-xs text-fg-subtle">' . e(format_datetime($req['created_at'], $l)) . '</span></div>'
            . '<dl class="grid gap-1 text-sm sm:grid-cols-2"><div><dt class="inline font-semibold">' . e($t['checkout']['name']) . ': </dt><dd class="inline">' . e($req['name']) . '</dd></div>'
            . '<div><dt class="inline font-semibold">' . e($t['checkout']['phone']) . ': </dt><dd class="ltr-nums inline" dir="ltr">' . e($req['phone']) . '</dd></div>'
            . ($req['email'] ? '<div><dt class="inline font-semibold">' . e($t['checkout']['email']) . ': </dt><dd class="ltr-nums inline" dir="ltr">' . e($req['email']) . '</dd></div>' : '')
            . ($req['quantity'] ? '<div><dt class="inline font-semibold">' . e($t['custom']['quantity']) . ': </dt><dd class="ltr-nums inline">' . (int) $req['quantity'] . '</dd></div>' : '')
            . ($req['budget'] !== null ? '<div><dt class="inline font-semibold">' . e($t['custom']['budget']) . ': </dt><dd class="ltr-nums inline" dir="ltr">' . e(format_iqd((int) $req['budget'], $l)) . '</dd></div>' : '')
            . ($req['reference_url'] ? '<div class="sm:col-span-2"><dt class="inline font-semibold">' . e($t['custom']['referenceUrl']) . ': </dt><dd class="inline break-all"><a href="' . e($req['reference_url']) . '" target="_blank" rel="noopener noreferrer nofollow" class="text-brand underline" dir="ltr">' . e($req['reference_url']) . '</a></dd></div>' : '')
            . '</dl><p class="mt-3 rounded-xl bg-muted p-3 text-sm whitespace-pre-line">' . e($req['description']) . '</p>'
            . ($req['notes'] !== '' ? '<p class="mt-2 text-sm whitespace-pre-line text-fg-muted">' . e($req['notes']) . '</p>' : '')
            . action_form('admin.updateRequest', hidden('id', $req['id'])
                . '<label class="text-xs font-semibold">' . e($r['status']) . select_tag(['name' => 'status'], $statusOpts, $req['status'], 'mt-1') . '</label>'
                . '<label class="text-xs font-semibold">' . e($t['admin']['orderDetail']['adminNotes']) . textarea_tag(['name' => 'adminNotes', 'rows' => '1', 'maxlength' => '3000'], $req['admin_notes'], 'mt-1 min-h-11') . '</label>'
                . submit_button(e($r['update']), ['size' => 'sm', 'variant' => 'secondary']), 'mt-4 grid gap-3 sm:grid-cols-[12rem_1fr_auto] sm:items-end')
            . '</div>';
    }
    $h .= '</div>' . pagination($res['page'], $res['pages'], lp('/admin/requests'), ['status' => $status]);
    return admin_page($user, $t['admin']['requests'], $h);
}
