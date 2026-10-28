<?php
/* One-time email codes for staff password reset / change. Only an HMAC of the code is stored. */

declare(strict_types=1);

const CODE_TTL = 10 * 60;
const MAX_CODE_ATTEMPTS = 5;
const MIN_STAFF_PASSWORD = 12;

/** Keyed hash: a leaked database cannot be used to brute-force the 6-digit codes offline. */
function code_hash(string $userId, string $code): string
{
    return hmac_hex("auth-code:$userId:$code");
}

function generate_code(): string
{
    return str_pad((string) random_int(0, 999_999), 6, '0', STR_PAD_LEFT);
}

/** Creates a fresh code (older unused ones for the same purpose stop working) and emails it. */
function issue_code(array $user, string $purpose, ?callable $deliver = null): bool
{
    $code = generate_code();
    q('UPDATE auth_codes SET used_at = ? WHERE user_id = ? AND purpose = ? AND used_at IS NULL', [now_db(), $user['id'], $purpose]);
    insert('auth_codes', ['id' => uuid4(), 'user_id' => $user['id'], 'purpose' => $purpose, 'code_hash' => code_hash($user['id'], $code), 'expires_at' => now_db(CODE_TTL), 'created_at' => now_db()]);
    return ($deliver ?? 'email_code')($user['email'], $code);
}

function email_code(string $to, string $code): bool
{
    $subject = "رمز التحقق: $code — Hassouni Store";
    $text = "رمز التحقق لتغيير كلمة المرور في لوحة تحكم متجر حسوني: $code\nصالح لمدة 10 دقائق. إذا لم تطلبه، تجاهل هذه الرسالة ولا تشاركه مع أحد.\n\nYour verification code for changing the Hassouni Store dashboard password: $code\nValid for 10 minutes. If you did not request it, ignore this email and never share it.";
    $c = e($code);
    $html = "<div dir=\"rtl\" style=\"font-family:Tahoma,Arial,sans-serif;font-size:15px;line-height:1.7\">
<p>رمز التحقق لتغيير كلمة المرور في لوحة تحكم <b>متجر حسوني</b>:</p>
<p style=\"font-size:30px;font-weight:700;letter-spacing:6px;direction:ltr\">$c</p>
<p>صالح لمدة 10 دقائق. إذا لم تطلبه، تجاهل هذه الرسالة ولا تشاركه مع أي أحد.</p>
<hr><p dir=\"ltr\">Your Hassouni Store verification code is <b>$c</b>. It expires in 10 minutes. Never share it.</p></div>";
    return send_email($to, $subject, $text, $html);
}

/** Checks a code; every wrong guess counts, and the code dies after MAX_CODE_ATTEMPTS. */
function consume_code(string $userId, string $purpose, string $code): array
{
    $row = one('SELECT * FROM auth_codes WHERE user_id = ? AND purpose = ? AND used_at IS NULL ORDER BY created_at DESC LIMIT 1', [$userId, $purpose]);
    if (!$row) return ['ok' => false, 'reason' => 'invalid'];
    if (db_time($row['expires_at']) < microtime(true)) return ['ok' => false, 'reason' => 'expired'];
    if ((int) $row['attempts'] >= MAX_CODE_ATTEMPTS) return ['ok' => false, 'reason' => 'too_many'];
    $clean = preg_replace('/\D/', '', $code);
    if (strlen($clean) !== 6 || !safe_equal_hex($row['code_hash'], code_hash($userId, $clean))) {
        update('auth_codes', ['attempts' => (int) $row['attempts'] + 1], 'id = ?', [$row['id']]);
        return ['ok' => false, 'reason' => (int) $row['attempts'] + 1 >= MAX_CODE_ATTEMPTS ? 'too_many' : 'invalid'];
    }
    update('auth_codes', ['used_at' => now_db()], 'id = ?', [$row['id']]);
    return ['ok' => true];
}

/** Forgot password (staff only). Always "sent" for unknown emails so the form reveals nothing. */
function request_password_reset(string $email, ?callable $deliver = null): string
{
    if (!$deliver && !email_configured()) return 'not_configured';
    $user = one('SELECT * FROM users WHERE email = ?', [strtolower(trim_js($email))]);
    if (!$user || !is_staff_role($user['role']) || $user['status'] !== 'active') return 'sent';
    issue_code($user, 'password_reset', $deliver);
    return 'sent';
}

function reset_password_with_code(string $email, string $code, string $newPassword): array
{
    if (js_len($newPassword) < MIN_STAFF_PASSWORD || js_len($newPassword) > 200) return ['ok' => false, 'reason' => 'weak'];
    $user = one('SELECT * FROM users WHERE email = ?', [strtolower(trim_js($email))]);
    if (!$user || !is_staff_role($user['role']) || $user['status'] !== 'active') return ['ok' => false, 'reason' => 'invalid'];
    $r = consume_code($user['id'], 'password_reset', $code);
    if (!$r['ok']) return $r;
    update('users', ['password_hash' => hash_password($newPassword)], 'id = ?', [$user['id']]);
    invalidate_user_sessions($user['id']);
    audit(actor_of($user), 'auth.password_reset', 'user', $user['id']);
    return ['ok' => true];
}

/** Logged-in change: current password first, then the emailed code. */
function request_password_change(string $userId, string $currentPassword, ?callable $deliver = null): string
{
    if (!$deliver && !email_configured()) return 'not_configured';
    $user = one('SELECT * FROM users WHERE id = ?', [$userId]);
    if (!$user || !verify_password($user['password_hash'], $currentPassword)) return 'wrong_password';
    return issue_code($user, 'password_change', $deliver) ? 'sent' : 'send_failed';
}

function change_password_with_code(string $userId, string $code, string $newPassword): array
{
    if (js_len($newPassword) < MIN_STAFF_PASSWORD || js_len($newPassword) > 200) return ['ok' => false, 'reason' => 'weak'];
    $user = one('SELECT * FROM users WHERE id = ?', [$userId]);
    if (!$user) return ['ok' => false, 'reason' => 'invalid'];
    $r = consume_code($user['id'], 'password_change', $code);
    if (!$r['ok']) return $r;
    update('users', ['password_hash' => hash_password($newPassword)], 'id = ?', [$user['id']]);
    invalidate_user_sessions($user['id']);
    audit(actor_of($user), 'auth.password_change', 'user', $user['id']);
    return ['ok' => true];
}

function purge_old_codes(): void
{
    q('DELETE FROM auth_codes WHERE created_at < ?', [now_db(-86400)]);
}
