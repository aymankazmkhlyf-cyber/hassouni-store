<?php
/* Sessions (DB-backed, hashed tokens), passwords (Argon2id) and staff permissions. */

declare(strict_types=1);

const PERMS_STAFF = ['dashboard:view', 'orders:read', 'orders:update', 'payments:review', 'customers:read', 'requests:manage', 'support:manage', 'reviews:manage'];
const PERMS_ADMIN = [...PERMS_STAFF, 'orders:export', 'products:write', 'categories:write', 'payment_methods:write', 'settings:write', 'customers:write', 'audit:read', 'wallet:adjust'];

function has_permission(string $role, string $permission): bool
{
    return in_array($permission, match ($role) { 'admin' => PERMS_ADMIN, 'staff' => PERMS_STAFF, default => [] }, true);
}

function is_staff_role(string $role): bool
{
    return $role === 'staff' || $role === 'admin';
}

final class AuthError extends Exception
{
    public function __construct(public readonly string $codeKey)
    {
        parent::__construct($codeKey);
    }
}

/* ------------------------------ Passwords ------------------------------ */

function hash_password(string $password): string
{
    // Argon2id with OWASP minimum parameters (19 MiB, t=2, p=1) — same as the original store.
    if (defined('PASSWORD_ARGON2ID')) {
        return password_hash($password, PASSWORD_ARGON2ID, ['memory_cost' => 19456, 'time_cost' => 2, 'threads' => 1]);
    }
    if (function_exists('sodium_crypto_pwhash_str')) {
        return sodium_crypto_pwhash_str($password, 2, 19456 * 1024);
    }
    return password_hash($password, PASSWORD_BCRYPT, ['cost' => 11]);
}

function verify_password(string $hash, string $password): bool
{
    if ($hash === '') return false;
    if (str_starts_with($hash, '$argon2') && !defined('PASSWORD_ARGON2ID') && function_exists('sodium_crypto_pwhash_str_verify')) {
        try {
            return sodium_crypto_pwhash_str_verify($hash, $password);
        } catch (Throwable) {
            return false;
        }
    }
    return password_verify($password, $hash);
}

/** Used to equalize timing when the account does not exist. */
function burn_password_check(string $password): void
{
    static $dummy = null;
    $dummy ??= hash_password('timing-equalizer-not-a-real-password');
    verify_password($dummy, $password);
}

/* ------------------------------ Sessions ------------------------------ */

function session_cookie(): string
{
    return cookie_name('hds_session');
}

function session_lifetime(string $role): int
{
    return $role === 'customer' ? 30 * 86400 : 12 * 3600;
}

function create_session(array $user): array
{
    $token = generate_session_token();
    $expires = time() + session_lifetime($user['role']);
    insert('sessions', [
        'id' => sha256($token),
        'user_id' => $user['id'],
        'expires_at' => gmdate('Y-m-d H:i:s', $expires) . '.000',
        'user_agent' => ($ua = user_agent()) !== null ? mb_substr($ua, 0, 200) : null,
    ]);
    return ['token' => $token, 'expires' => $expires];
}

function validate_session_token(?string $token): ?array
{
    if (!$token || strlen($token) > 100) return null;
    $user = one(
        'SELECT u.id, u.email, u.name, u.phone, u.role, u.status, u.username, u.wallet_balance
           FROM sessions s INNER JOIN users u ON u.id = s.user_id
          WHERE s.id = ? AND s.expires_at > ? LIMIT 1',
        [sha256($token), now_db()],
    );
    if (!$user || $user['status'] !== 'active') return null;
    return $user;
}

function invalidate_user_sessions(string $userId): void
{
    q('DELETE FROM sessions WHERE user_id = ?', [$userId]);
}

function purge_expired_sessions(): void
{
    q('DELETE FROM sessions WHERE expires_at < ?', [now_db()]);
}

/** The logged-in user for this request (cached), or null. */
function current_user(bool $refresh = false): ?array
{
    static $loaded = false, $user = null;
    if ($refresh) $loaded = false;
    if (!$loaded) {
        $loaded = true;
        $user = validate_session_token(get_cookie(session_cookie()));
    }
    return $user;
}

function start_session(array $user): void
{
    $s = create_session($user);
    set_cookie(session_cookie(), $s['token'], $s['expires']);
    current_user(true);
}

function end_session(): void
{
    $token = get_cookie(session_cookie());
    if ($token) q('DELETE FROM sessions WHERE id = ?', [sha256($token)]);
    delete_cookie(session_cookie());
    current_user(true);
}

function actor_of(array $u): array
{
    return ['id' => $u['id'], 'email' => $u['email'], 'role' => $u['role']];
}

/** For actions and API endpoints: throws instead of redirecting. */
function assert_permission(string $permission): array
{
    $user = current_user();
    if (!$user || !is_staff_role($user['role'])) throw new AuthError('unauthorized');
    if (!has_permission($user['role'], $permission)) throw new AuthError('forbidden');
    return $user;
}

/** For admin pages: redirects to the admin login, or back to the dashboard when not allowed. */
function require_staff_page(string $locale, string $permission = 'dashboard:view'): array
{
    $user = current_user();
    if (!$user || !is_staff_role($user['role'])) redirect(url("/$locale/admin/login"));
    if (!has_permission($user['role'], $permission)) redirect(url("/$locale/admin?denied=1"));
    return $user;
}

function require_customer_page(string $locale): array
{
    $user = current_user();
    if (!$user) redirect(url("/$locale/login"));
    return $user;
}
