<?php
declare(strict_types=1);

function admin_auth_shell(string $inner): string
{
    $l = loc();
    return '<div class="flex min-h-dvh items-center justify-center bg-bg px-4 py-12"><div class="w-full max-w-sm space-y-6"><div class="flex justify-center">' . logo_html($l, T()['meta']['storeName']) . '</div>'
        . card_open('p-6') . $inner . '</div></div></div>';
}

function page_admin_login(array $params): array
{
    $l = loc();
    $t = T();
    $notice = query('reset') === '1' ? $t['password']['resetDone'] : (query('changed') === '1' ? $t['password']['changeDone'] : null);
    $user = current_user();
    if ($user && is_staff_role($user['role'])) redirect(lp('/admin'));
    $inner = '<h1 class="mb-1 flex items-center gap-2 text-xl font-extrabold">' . icon('lock', 'size-5 text-brand') . ' ' . e($t['auth']['adminTitle']) . '</h1><p class="mb-5 text-sm text-fg-muted">' . e($t['auth']['adminOnly']) . '</p>';
    if ($notice) $inner .= alert('success', $notice, null, 'mb-4');
    $inner .= island('LoginForm', ['locale' => $l, 'mode' => 'staff', 's' => ['email' => $t['auth']['email'], 'password' => $t['auth']['password'], 'submit' => $t['auth']['submitLogin']], 'errors' => array_merge($t['errors'], $t['auth'])], '<div class="h-52"></div>');
    $inner .= '<p class="mt-4 text-center text-sm"><a href="' . e(lp('/admin/forgot-password')) . '" class="font-semibold text-brand hover:underline">' . e($t['password']['forgotLink']) . '</a></p>';
    return ['title' => $t['auth']['adminTitle'], 'layout' => 'bare', 'private' => true, 'html' => admin_auth_shell($inner)];
}

function page_admin_forgot(array $params): array
{
    $l = loc();
    $t = T();
    $s = array_merge($t['password'], ['errors' => array_merge($t['password']['errors'], ['rateLimited' => $t['errors']['rateLimited']])]);
    $inner = '<h1 class="mb-4 flex items-center gap-2 text-xl font-extrabold">' . icon('lock', 'size-5 text-brand') . ' ' . e($t['password']['forgotTitle']) . '</h1>'
        . island('ForgotPasswordForm', ['locale' => $l, 's' => $s], '<div class="h-40"></div>');
    return ['title' => $t['password']['forgotTitle'], 'layout' => 'bare', 'private' => true, 'html' => admin_auth_shell($inner)];
}
