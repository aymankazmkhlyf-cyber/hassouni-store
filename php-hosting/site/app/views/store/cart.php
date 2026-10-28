<?php
declare(strict_types=1);

function page_cart(array $params): array
{
    $l = loc();
    $t = T();
    $s = [
        'title' => $t['cart']['title'], 'empty' => $t['cart']['empty'], 'emptyBody' => $t['cart']['emptyBody'], 'continue' => $t['cart']['continue'],
        'checkout' => $t['cart']['checkout'], 'remove' => $t['cart']['remove'], 'total' => $t['cart']['total'], 'unitPrice' => $t['cart']['unitPrice'],
        'quantity' => $t['product']['quantity'], 'updating' => $t['cart']['updating'], 'fixErrors' => $t['cart']['fixErrors'],
        'serverPrices' => $t['cart']['serverPrices'], 'sample' => $t['common']['sample'], 'generic' => $t['errors']['generic'], 'errors' => $t['errors'],
    ];
    $h = page_header($t['cart']['title']) . '<div class="mx-auto max-w-6xl px-4 py-8">'
        . island('CartView', ['locale' => $l, 's' => $s], '<div class="flex justify-center py-20" role="status">' . spinner('size-6') . '</div>') . '</div>';
    return ['title' => $t['cart']['title'], 'noindex' => true, 'html' => $h];
}

function page_checkout(array $params): array
{
    $l = loc();
    $t = T();
    $user = current_user();
    $methods = list_payment_methods(true);
    $settings = load_settings();
    $s = array_merge($t['checkout'], [
        'terms' => $t['legal']['terms'], 'refund' => $t['legal']['refund'], 'login' => $t['nav']['login'], 'total' => $t['cart']['total'],
        'empty' => $t['cart']['empty'], 'continue' => $t['cart']['continue'], 'optional' => $t['common']['optional'], 'fixErrors' => $t['cart']['fixErrors'],
        'backToCart' => $t['nav']['cart'], 'walletName' => $t['wallet']['payWithWallet'], 'walletAvailable' => $t['wallet']['available'],
        'walletInsufficient' => $t['wallet']['insufficient'], 'walletTopup' => $t['wallet']['topupLink'], 'walletInstant' => $t['wallet']['walletInstant'],
        'walletLogin' => $t['wallet']['loginForWallet'], 'errors' => $t['errors'],
    ]);
    $props = [
        'locale' => $l,
        'loggedIn' => (bool) $user,
        'wallet' => $user && $user['role'] === 'customer' ? ['balance' => (int) $user['wallet_balance']] : null,
        'ordersEnabled' => $settings['ordersEnabled'],
        'defaults' => ['name' => $user['name'] ?? '', 'phone' => $user['phone'] ?? '', 'email' => $user['email'] ?? ''],
        'methods' => array_map(fn($m) => ['id' => (int) $m['id'], 'name' => L($m, 'name', $l), 'instructions' => L($m, 'instructions', $l)], $methods),
        's' => $s,
    ];
    $h = page_header($t['checkout']['title']) . '<div class="mx-auto max-w-6xl px-4 py-8">';
    if (!$settings['ordersEnabled']) $h .= alert('warning', $t['errors']['product_unavailable'], null, 'mb-6');
    $h .= island('CheckoutForm', $props, '<div class="flex justify-center py-20" role="status">' . spinner('size-6') . '</div>') . '</div>';
    return ['title' => $t['checkout']['title'], 'private' => true, 'html' => $h];
}

function page_track(array $params): array
{
    $l = loc();
    $t = T();
    $raw = normalize_reference((string) query('ref'));
    $ref = preg_match('/^[A-Z0-9-]{5,40}$/', $raw) ? $raw : '';
    $h = page_header($t['track']['title'], $t['track']['body']) . '<div class="mx-auto max-w-md px-4 py-8">' . card_open('p-5')
        . island('TrackForm', ['locale' => $l, 's' => $t['track'], 'errors' => $t['errors'], 'defaultReference' => $ref !== '' ? $ref : null], '<div class="h-56"></div>')
        . '</div><p class="mt-4 text-center text-sm text-fg-muted">' . e($t['track']['accountHint']) . '</p></div>';
    return ['title' => $t['track']['title'], 'html' => $h];
}
