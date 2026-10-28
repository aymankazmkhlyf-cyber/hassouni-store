<?php
declare(strict_types=1);

function page_login(array $params): array
{
    $l = loc();
    $t = T();
    if (current_user()) redirect(lp('/account'));
    $next = query('next');
    $h = '<div class="mx-auto max-w-md px-4 py-12"><h1 class="mb-6 text-center text-2xl font-extrabold">' . e($t['auth']['loginTitle']) . '</h1>' . card_open('p-5')
        . island('LoginForm', ['locale' => $l, 'next' => $next, 'mode' => 'customer', 's' => ['email' => $t['auth']['loginIdentifier'], 'password' => $t['auth']['password'], 'submit' => $t['auth']['submitLogin']], 'errors' => array_merge($t['errors'], $t['auth'])], '<div class="h-64"></div>')
        . '</div><p class="mt-4 text-center text-sm text-fg-muted">' . e($t['auth']['noAccount']) . ' <a href="' . e(lp('/register') . ($next ? '?next=' . rawurlencode($next) : '')) . '" class="font-semibold text-brand hover:underline">' . e($t['auth']['registerTitle']) . '</a></p></div>';
    return ['title' => $t['auth']['loginTitle'], 'noindex' => true, 'html' => $h];
}

function page_register(array $params): array
{
    $l = loc();
    $t = T();
    if (current_user()) redirect(lp('/account'));
    $next = query('next');
    $a = $t['auth'];
    $h = '<div class="mx-auto max-w-md px-4 py-12"><h1 class="mb-6 text-center text-2xl font-extrabold">' . e($a['registerTitle']) . '</h1>' . card_open('p-5')
        . island('RegisterForm', ['locale' => $l, 'next' => $next, 's' => ['name' => $a['name'], 'username' => $a['username'], 'usernameHint' => $a['usernameHint'], 'email' => $a['email'], 'phone' => $a['phone'], 'password' => $a['password'], 'passwordHint' => $a['passwordHint'], 'submit' => $a['submitRegister']], 'errors' => $t['errors']], '<div class="h-96"></div>')
        . '</div><p class="mt-4 text-center text-sm text-fg-muted">' . e($a['haveAccount']) . ' <a href="' . e(lp('/login')) . '" class="font-semibold text-brand hover:underline">' . e($a['loginTitle']) . '</a></p></div>';
    return ['title' => $a['registerTitle'], 'noindex' => true, 'html' => $h];
}
