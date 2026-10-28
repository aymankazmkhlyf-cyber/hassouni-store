<?php
declare(strict_types=1);

function page_order(array $params): array
{
    $l = loc();
    $t = T();
    $ar = $l === 'ar';
    $key = query('key');
    if ($key === '') $key = null;
    $isNew = query('new') === '1';
    $private = ['private' => true, 'referrer' => 'no-referrer', 'title' => $t['order']['details']];

    // Access requires the secret key OR being the logged-in owner. Knowing the reference alone is not enough.
    $user = current_user();
    $order = $key !== null ? get_order_by_access_key($params['reference'], $key) : ($user ? get_order_for_user($params['reference'], $user['id']) : null);
    if (!$order) {
        return $private + ['html' => '<div class="mx-auto max-w-xl px-4 py-16">' . empty_state($t['order']['notFound'], null, button_link(lp('/track'), e($t['nav']['track'])), 'lock') . '</div>'];
    }

    $settings = load_settings();
    $method = $order['payment_method_id'] ? one('SELECT * FROM payment_methods WHERE id = ?', [$order['payment_method_id']]) : null;
    $payment = latest_payment($order['payments']);
    $canPay = customer_can_submit_payment($order['status']);
    $canReview = $order['status'] === 'completed';
    $myReviews = $canReview ? reviews_for_order($order['id']) : [];
    // "Order again": same services, packages, quantities and details, if the services are still offered.
    $productIds = array_values(array_filter(array_map(fn($i) => $i['product_id'], $order['items']), fn($x) => $x !== null));
    $activeProducts = $canReview && $productIds ? all('SELECT id, slug FROM products WHERE id IN (' . placeholders($productIds) . ') AND is_active = 1', $productIds) : [];
    $reorder = [];
    foreach ($order['items'] as $i) {
        $p = null;
        foreach ($activeProducts as $x) if ((int) $x['id'] === (int) $i['product_id']) $p = $x;
        if (!$p || !$i['product_id']) continue;
        $inputs = [];
        foreach ($i['inputs'] as $x) $inputs[$x['key']] = $x['value'];
        $reorder[] = [
            'productId' => (int) $i['product_id'], 'slug' => $p['slug'], 'packageId' => $i['package_id'] === null ? null : (int) $i['package_id'],
            'quantity' => (int) $i['quantity'], 'inputs' => (object) $inputs, 'nameAr' => $i['product_name_ar'], 'nameEn' => $i['product_name_en'],
            'packageLabelAr' => $i['package_label_ar'], 'packageLabelEn' => $i['package_label_en'], 'unitPrice' => (int) $i['unit_price'],
        ];
    }
    // Updates still to come: offer notifications until the order is delivered or closed.
    $canNotify = !is_terminal_status($order['status']) && $order['status'] !== 'completed';
    $vapid = $canNotify ? (get_vapid_keys()['publicKey'] ?? '') : '';
    $supportMessage = build_order_support_message([
        'reference' => $order['reference'],
        'status' => $t['orderStatus'][$order['status']],
        'total' => format_iqd((int) $order['total'], $l),
        'items' => array_map(fn($i) => ['name' => $ar ? $i['product_name_ar'] : $i['product_name_en'], 'quantity' => (int) $i['quantity']], $order['items']),
    ], $l);

    $o = $t['order'];
    $h = '<div class="mx-auto max-w-4xl space-y-6 px-4 py-8">';
    if ($key !== null) $h .= island('RememberOrder', ['reference' => $order['reference'], 'accessKey' => $key]);
    if ($isNew) {
        $h .= '<div class="animate-in rounded-(--radius-card) border border-success/30 bg-success-soft p-5 sm:p-6"><div class="flex items-start gap-3"><span class="grid size-11 shrink-0 place-items-center rounded-full bg-success text-white dark:text-black">' . icon('check', 'size-6') . '</span>'
            . '<div><h1 class="text-xl font-extrabold">' . e($o['confirmationTitle']) . '</h1><p class="mt-1 text-fg-muted">' . e($o['confirmationBody']) . '</p></div></div></div>';
    } else {
        $h .= '<h1 class="text-2xl font-extrabold">' . e($o['details']) . '</h1>';
    }

    $h .= '<section class="grid gap-4 rounded-(--radius-card) border border-line bg-elevated p-5 shadow-soft sm:grid-cols-2"><div><p class="text-xs text-fg-subtle">' . e($o['reference']) . '</p>'
        . '<p class="flex items-center gap-2"><span class="ltr-nums text-lg font-black tracking-wide" dir="ltr">' . e($order['reference']) . '</span>' . copy_button($order['reference']) . '</p></div>';
    if ($key !== null) {
        $h .= '<div><p class="text-xs text-fg-subtle">' . e($o['accessKey']) . '</p><p class="flex items-center gap-2"><span class="ltr-nums font-mono text-sm font-bold break-all" dir="ltr">' . e($key) . '</span>' . copy_button($key) . '</p></div>';
        if ($isNew) $h .= alert('warning', null, e($o['accessKeyWarning'] . ' ' . $o['bookmark']), 'sm:col-span-2');
    }
    $h .= '<dl class="grid grid-cols-2 gap-3 text-sm sm:col-span-2 sm:grid-cols-4">'
        . '<div><dt class="text-xs text-fg-subtle">' . e($o['status']) . '</dt><dd class="mt-1">' . order_status_badge($order['status']) . '</dd></div>'
        . '<div><dt class="text-xs text-fg-subtle">' . e($o['paymentStatus']) . '</dt><dd class="mt-1">' . ($payment ? payment_status_badge($payment['status']) : '—') . '</dd></div>'
        . '<div><dt class="text-xs text-fg-subtle">' . e($o['paymentMethod']) . '</dt><dd class="mt-1 font-semibold">' . e($ar ? $order['payment_method_name_ar'] : $order['payment_method_name_en']) . '</dd></div>'
        . '<div><dt class="text-xs text-fg-subtle">' . e($o['createdAt']) . '</dt><dd class="ltr-nums mt-1 font-semibold">' . e(format_datetime($order['created_at'], $l)) . '</dd></div></dl></section>';

    if ($order['delivery_note'] !== '') {
        $h .= '<section class="space-y-2 rounded-(--radius-card) border border-success/40 bg-success-soft p-5" data-testid="delivery-note"><h2 class="flex items-center gap-2 font-bold text-success">' . icon('gift', 'size-5') . ' ' . e($o['deliveryNote']) . '</h2>'
            . '<p class="ltr-nums text-sm font-semibold whitespace-pre-line break-words select-all" dir="auto">' . e($order['delivery_note']) . '</p>' . copy_button($order['delivery_note']) . '</section>';
    }
    if ($canNotify) {
        $h .= island('OrderNotify', ['reference' => $order['reference'], 'accessKey' => $key, 'locale' => $l, 'vapidPublicKey' => $vapid, 'emailOn' => $order['customer_email'] && email_configured(), 's' => $t['notify']]);
    }
    if ($canPay) {
        $h .= '<section class="space-y-4 rounded-(--radius-card) border border-brand/30 bg-elevated p-5 shadow-soft"><h2 class="flex items-center gap-2 font-bold">' . icon('receipt', 'size-5 text-brand') . ' ' . e($o['payTitle']) . '</h2>'
            . '<ol class="list-decimal space-y-1 ps-5 text-sm text-fg-muted"><li>' . e($o['stepPay']) . '</li><li>' . e($o['stepProof']) . '</li><li>' . e($o['stepWait']) . '</li></ol>';
        $h .= payment_details($method, (int) $order['total']);
        if ($method && ($g = payment_guide($method['code']))) $h .= guide_help($g, $t['guides']['howToPay'], $t['guides']['readMore']);
        if ($payment && $payment['status'] === 'rejected' && $payment['review_note']) $h .= alert('danger', $o['rejectedReason'], e($payment['review_note']));
        if ($payment && $payment['status'] === 'submitted') $h .= alert('info', $o['proofSubmitted']);
        $h .= '<h3 class="pt-2 text-sm font-bold">' . e($o['submitProof']) . '</h3>';
        $h .= island('PaymentProofForm', [
            'reference' => $order['reference'], 'accessKey' => $key, 'requiresReference' => $method ? (bool) $method['requires_reference'] : false,
            'allowsReceipt' => $method ? (bool) $method['allows_receipt'] : true,
            's' => ['title' => $o['submitProof'], 'ref' => $o['proofReference'], 'receipt' => $o['proofReceipt'], 'submit' => $o['proofSubmit'], 'submitting' => $o['proofSubmitting'], 'submitted' => $o['proofSubmitted'], 'note' => $o['proofNote'], 'errors' => $t['errors']],
        ]) . '</section>';
    }

    $h .= '<section class="rounded-(--radius-card) border border-line bg-elevated shadow-soft"><h2 class="border-b border-line px-5 py-4 font-bold">' . e($o['items']) . '</h2><ul class="divide-y divide-line">';
    foreach ($order['items'] as $i) {
        $pkg = $ar ? $i['package_label_ar'] : $i['package_label_en'];
        $h .= '<li class="flex flex-wrap justify-between gap-3 px-5 py-4"><div class="min-w-0"><p class="font-semibold">' . e($ar ? $i['product_name_ar'] : $i['product_name_en']) . '</p>';
        if ($pkg) $h .= '<p class="text-sm text-fg-muted">' . e($pkg) . '</p>';
        $h .= '<p class="text-xs text-fg-subtle"><span class="ltr-nums">' . e(format_iqd((int) $i['unit_price'], $l)) . '</span> × <span class="ltr-nums">' . (int) $i['quantity'] . '</span></p>';
        if ($i['inputs']) {
            $h .= '<dl class="mt-1 space-y-0.5 text-xs text-fg-subtle">';
            foreach ($i['inputs'] as $inp) $h .= '<div class="flex gap-1"><dt class="font-semibold">' . e($ar ? $inp['labelAr'] : $inp['labelEn']) . ':</dt><dd dir="auto" class="break-all">' . e($inp['value']) . '</dd></div>';
            $h .= '</dl>';
        }
        $h .= '</div><p class="ltr-nums font-bold" dir="ltr">' . e(format_iqd((int) $i['line_total'], $l)) . '</p></li>';
    }
    $h .= '</ul><div class="flex justify-between border-t border-line px-5 py-4"><span class="font-bold">' . e($o['total']) . '</span><span class="ltr-nums text-xl font-black" dir="ltr">' . e(format_iqd((int) $order['total'], $l)) . '</span></div></section>';

    if ($canReview && $reorder) {
        $h .= '<div class="flex flex-wrap items-center justify-between gap-3 rounded-(--radius-card) border border-line bg-elevated p-4 shadow-soft"><p class="text-sm text-fg-muted">' . e($o['reorderHint']) . '</p>'
            . island('ReorderButton', ['items' => $reorder, 'locale' => $l, 'label' => $o['reorder']], '', 'div', 'contents') . '</div>';
    }
    if ($canReview) {
        $r = $t['reviews'];
        $h .= '<section id="review" class="space-y-3 rounded-(--radius-card) border border-amber-400/40 bg-elevated p-5 shadow-soft"><h2 class="flex items-center gap-2 font-bold">' . icon('star', 'size-5 text-amber-500') . ' ' . e($r['rateTitle']) . '</h2><p class="text-sm text-fg-muted">' . e($r['rateBody']) . '</p>';
        foreach ($order['items'] as $i) {
            if ($i['product_id'] === null) continue;
            $mine = null;
            foreach ($myReviews as $mr) if ((int) $mr['order_item_id'] === (int) $i['id']) $mine = $mr;
            $h .= island('ReviewForm', [
                'reference' => $order['reference'], 'accessKey' => $key,
                'item' => ['id' => (int) $i['id'], 'name' => $ar ? $i['product_name_ar'] : $i['product_name_en'], 'packageLabel' => $ar ? $i['package_label_ar'] : $i['package_label_en']],
                'existing' => $mine ? ['rating' => (int) $mine['rating'], 'comment' => $mine['comment'], 'displayName' => $mine['display_name'], 'hidden' => $mine['status'] === 'hidden'] : null,
                'defaultName' => default_display_name($order['customer_name']),
                's' => [
                    'rating' => $r['rating'], 'ratingLabels' => $r['ratingLabels'], 'starsLabel' => $r['starsLabel'], 'comment' => $r['comment'], 'commentHint' => $r['commentHint'],
                    'displayName' => $r['displayName'], 'displayNameHint' => $r['displayNameHint'], 'submit' => $r['submit'], 'update' => $r['update'], 'submitting' => $r['submitting'],
                    'thanks' => $r['thanks'], 'updated' => $r['updated'], 'hiddenNote' => $r['hiddenNote'], 'errors' => $t['errors'],
                ],
            ]);
        }
        $h .= '</section>';
    }

    $h .= '<section class="rounded-(--radius-card) border border-line bg-elevated p-5 shadow-soft"><h2 class="mb-4 font-bold">' . e($o['history']) . '</h2><ol class="relative space-y-4 border-s-2 border-line ps-5">';
    foreach ($order['history'] as $hist) {
        $h .= '<li class="relative"><span class="absolute -start-[1.72rem] top-1.5 size-3 rounded-full border-2 border-elevated bg-brand" aria-hidden="true"></span><p class="font-semibold">' . e($t['orderStatus'][$hist['to_status']]) . '</p><p class="ltr-nums text-xs text-fg-subtle">' . e(format_datetime($hist['created_at'], $l)) . '</p></li>';
    }
    $h .= '</ol></section>';
    if ($order['customer_notes'] !== '') {
        $h .= '<section class="rounded-(--radius-card) border border-line bg-elevated p-5 shadow-soft"><h2 class="mb-1 font-bold">' . e($o['yourNotes']) . '</h2><p class="text-sm whitespace-pre-line text-fg-muted">' . e($order['customer_notes']) . '</p></section>';
    }
    $h .= '<section class="space-y-3"><h2 class="font-bold">' . e($o['contactSupport']) . '</h2><p class="text-sm text-fg-muted">' . e($o['contactSupportHint']) . '</p>'
        . contact_links($settings, $supportMessage) . '<p class="text-xs text-fg-subtle">' . e($t['contact']['noApp']) . '</p></section>';
    $h .= '<p class="text-center text-sm"><a href="' . e(lp('/services')) . '" class="font-semibold text-brand hover:underline">' . e($t['cart']['continue']) . '</a></p></div>';
    return $private + ['html' => $h];
}
