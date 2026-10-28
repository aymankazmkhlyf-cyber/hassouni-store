<?php
declare(strict_types=1);

function check_new_password(): ?string
{
    $pw = form_str('password');
    if (js_len($pw) < 12 || js_len($pw) > 200) return 'weak';
    if ($pw !== form_str('confirm')) return 'mismatch';
    return null;
}

/* ---------------------------- Forgot password --------------------------- */

function action_password_request_reset(): array
{
    $email = strtolower(trim_js(form_str('email')));
    // Same answer for malformed and unknown emails.
    if (js_len($email) > 200 || !is_email($email)) return ['ok' => true, 'data' => ['email' => form_str('email')]];
    if (!consume_rate_limit('codeRequestIp', client_ip()) || !consume_rate_limit('codeRequestAccount', $email)) return ['error' => 'rateLimited'];
    if (request_password_reset($email) === 'not_configured') return ['error' => 'not_configured'];
    return ['ok' => true, 'data' => ['email' => $email]];
}

function action_password_reset_with_code(): array
{
    $email = form_str('email');
    if ($bad = check_new_password()) return ['error' => $bad, 'data' => ['email' => $email]];
    if (!consume_rate_limit('codeVerify', client_ip())) return ['error' => 'rateLimited', 'data' => ['email' => $email]];
    $r = reset_password_with_code($email, form_str('code'), form_str('password'));
    if (!$r['ok']) return ['error' => $r['reason'], 'data' => ['email' => $email]];
    action_redirect('/' . action_locale() . '/admin/login?reset=1');
}

/* ----------------------- Change password (logged in) -------------------- */

function action_password_request_change(): array
{
    $user = current_user();
    if (!$user || !is_staff_role($user['role'])) return ['error' => 'unauthorized'];
    if (!consume_rate_limit('codeRequestAccount', $user['email'])) return ['error' => 'rateLimited'];
    $r = request_password_change($user['id'], form_str('current'));
    return $r === 'sent' ? ['ok' => true, 'data' => ['step' => 'code']] : ['error' => $r];
}

function action_password_change_with_code(): array
{
    $user = current_user();
    if (!$user || !is_staff_role($user['role'])) return ['error' => 'unauthorized'];
    if ($bad = check_new_password()) return ['error' => $bad, 'data' => ['step' => 'code']];
    if (!consume_rate_limit('codeVerify', client_ip())) return ['error' => 'rateLimited', 'data' => ['step' => 'code']];
    $r = change_password_with_code($user['id'], form_str('code'), form_str('password'));
    if (!$r['ok']) return ['error' => $r['reason'], 'data' => ['step' => 'code']];
    // All sessions were revoked, including this one; log in again with the new password.
    end_session();
    action_redirect('/' . action_locale() . '/admin/login?changed=1');
}
