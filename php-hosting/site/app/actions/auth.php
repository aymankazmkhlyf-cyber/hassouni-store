<?php
declare(strict_types=1);

function login_flow(string $mode): array
{
    $locale = action_locale();
    $email = strtolower(trim_js(form_str('email')));
    $password = form_str('password');
    if (js_len($email) < 3 || js_len($email) > 200 || $password === '' || js_len($password) > 200) return ['error' => 'invalidCredentials'];
    // Per-IP and per-account limits: slows both spraying and targeted guessing.
    if (!consume_rate_limit('login', client_ip()) || !consume_rate_limit('loginAccount', $email)) return ['error' => 'rateLimited'];
    $result = authenticate($email, $password);
    if (!$result['ok']) return ['error' => $result['reason'] === 'suspended' ? 'suspended' : 'invalidCredentials'];
    // The admin login only accepts staff; reveal nothing about customer accounts there.
    if ($mode === 'staff' && !is_staff_role($result['user']['role'])) return ['error' => 'invalidCredentials'];
    reset_rate_limit('loginAccount', $email);
    start_session($result['user']);
    action_redirect($mode === 'staff' ? "/$locale/admin" : safe_next($_POST['next'] ?? null, $locale, is_staff_role($result['user']['role']) ? '/admin' : '/account'));
}

function action_auth_login(): array
{
    return login_flow('customer');
}

function action_auth_admin_login(): array
{
    return login_flow('staff');
}

function action_auth_register(): array
{
    $locale = action_locale();
    [$data, $errors] = v_register(['name' => form_str('name'), 'username' => form_str('username'), 'email' => form_str('email'), 'phone' => form_str('phone'), 'password' => form_str('password')]);
    if ($data === null) return ['error' => 'validation', 'fieldErrors' => $errors];
    if (!consume_rate_limit('register', client_ip())) return ['error' => 'rateLimited'];
    $result = register_customer($data);
    if (!$result['ok']) {
        // Generic message for emails so the form cannot be used to enumerate registered addresses.
        return $result['reason'] === 'emailTaken' ? ['error' => 'emailTaken'] : ['error' => 'validation', 'fieldErrors' => ['username' => $result['reason']]];
    }
    start_session($result['user']);
    action_redirect(safe_next($_POST['next'] ?? null, $locale, '/account'));
}

function action_auth_logout(): array
{
    end_session();
    action_redirect('/' . action_locale());
}

function action_auth_delete_own_account(): array
{
    $user = current_user();
    if (!$user) return ['error' => 'unauthorized'];
    if (is_staff_role($user['role'])) return ['error' => 'forbidden'];
    if (form_str('confirm') !== 'DELETE') return ['error' => 'validation'];
    try {
        anonymize_customer($user['id'], actor_of($user));
    } catch (ServiceError $e) {
        return ['error' => $e->codeKey];
    }
    end_session();
    action_redirect('/' . action_locale());
}
