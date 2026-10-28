<?php
/* Customer and staff accounts: registration, login, admin customer management, erasure and retention. */

declare(strict_types=1);

/** Returns ['ok' => true, 'user' => [...]] or ['ok' => false, 'reason' => emailTaken|usernameTaken|usernameInvalid]. */
function register_customer(array $in): array
{
    $username = normalize_username($in['username']);
    if ($p = username_problem($username)) return ['ok' => false, 'reason' => $p === 'usernameTaken' ? 'usernameTaken' : 'usernameInvalid'];
    if (one('SELECT id FROM users WHERE username = ?', [$username])) return ['ok' => false, 'reason' => 'usernameTaken'];
    $email = strtolower($in['email']);
    if (one('SELECT id FROM users WHERE email = ?', [$email])) return ['ok' => false, 'reason' => 'emailTaken'];
    $id = uuid4();
    try {
        insert('users', [
            'id' => $id,
            'email' => $email,
            'name' => $in['name'],
            'phone' => $in['phone'],
            'username' => $username,
            'password_hash' => hash_password($in['password']),
            'role' => 'customer',
            'created_at' => now_db(),
            'updated_at' => now_db(),
        ]);
    } catch (PDOException $e) {
        if (!is_duplicate_key($e)) throw $e;
        // Lost a race: tell which unique value collided.
        return ['ok' => false, 'reason' => one('SELECT id FROM users WHERE email = ?', [$email]) ? 'emailTaken' : 'usernameTaken'];
    }
    return ['ok' => true, 'user' => ['id' => $id, 'role' => 'customer']];
}

/** Constant-ish time: a dummy hash is verified when the account does not exist. */
function authenticate(string $identifier, string $password): array
{
    $id = strtolower(trim_js($identifier));
    // Customers may sign in with their wallet username instead of the email.
    $user = str_contains($id, '@')
        ? one('SELECT * FROM users WHERE email = ?', [$id])
        : one("SELECT * FROM users WHERE username = ? AND role = 'customer'", [normalize_username($id)]);
    if (!$user || $user['anonymized_at']) {
        burn_password_check($password);
        return ['ok' => false, 'reason' => 'invalid'];
    }
    if (!verify_password($user['password_hash'], $password)) return ['ok' => false, 'reason' => 'invalid'];
    if ($user['status'] !== 'active') return ['ok' => false, 'reason' => 'suspended'];
    $set = ['last_login_at' => now_db()];
    // Upgrade older hashes to the best algorithm this server supports.
    if (defined('PASSWORD_ARGON2ID') && password_needs_rehash($user['password_hash'], PASSWORD_ARGON2ID, ['memory_cost' => 19456, 'time_cost' => 2, 'threads' => 1])) {
        $set['password_hash'] = hash_password($password);
    }
    update('users', $set, 'id = ?', [$user['id']]);
    return ['ok' => true, 'user' => ['id' => $user['id'], 'role' => $user['role'], 'email' => $user['email']]];
}

/** Creates or promotes a staff/admin account (installer / CLI only — there is no web endpoint for this). */
function upsert_staff_account(string $email, string $name, string $password, string $role): string
{
    $email = strtolower($email);
    $hash = hash_password($password);
    $existing = one('SELECT id FROM users WHERE email = ?', [$email]);
    if ($existing) {
        update('users', ['password_hash' => $hash, 'role' => $role, 'name' => $name, 'status' => 'active'], 'id = ?', [$existing['id']]);
        $id = $existing['id'];
    } else {
        $id = uuid4();
        insert('users', ['id' => $id, 'email' => $email, 'name' => $name, 'password_hash' => $hash, 'role' => $role, 'created_at' => now_db(), 'updated_at' => now_db()]);
    }
    invalidate_user_sessions($id);
    audit(null, 'staff.bootstrap', 'user', $id, ['role' => $role]);
    return $id;
}

/* ------------------------------ Customers (admin) ------------------------------ */

function list_customers(string $q, int $page): array
{
    $pageSize = 25;
    $page = max($page, 1);
    $q = mb_substr(trim_js($q), 0, 80);
    $where = 'u.anonymized_at IS NULL';
    $params = [];
    if ($q !== '') {
        $pattern = '%' . escape_like($q) . '%';
        $digits = preg_replace('/^0/', '', preg_replace('/\D/', '', $q));
        $conds = ['u.email LIKE ?', 'u.name LIKE ?', 'u.username LIKE ?'];
        array_push($params, $pattern, $pattern, '%' . escape_like(strtolower(preg_replace('/^@/', '', $q))) . '%');
        if (strlen($digits) >= 4) { $conds[] = 'u.phone LIKE ?'; $params[] = '%' . $digits . '%'; }
        $where .= ' AND (' . implode(' OR ', $conds) . ')';
    }
    $rows = all(
        "SELECT u.id, u.name, u.email, u.phone, u.role, u.status, u.created_at, (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id) AS order_count
           FROM users u WHERE $where ORDER BY u.created_at DESC LIMIT ? OFFSET ?",
        [...$params, $pageSize, ($page - 1) * $pageSize],
    );
    $total = (int) val("SELECT COUNT(*) FROM users u WHERE $where", $params);
    return ['rows' => $rows, 'page' => $page, 'pages' => max(1, (int) ceil($total / $pageSize))];
}

function get_customer(string $id): ?array
{
    if (!is_uuid($id)) return null;
    $user = one('SELECT id, email, name, phone, username, wallet_balance, role, status, last_login_at, anonymized_at, created_at, updated_at FROM users WHERE id = ?', [$id]);
    if (!$user) return null;
    return ['user' => $user, 'orders' => all('SELECT id, reference, status, total, created_at FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 100', [$id])];
}

function set_customer_status(string $id, string $status, array $actor): void
{
    tx(function () use ($id, $status, $actor) {
        $target = one('SELECT role FROM users WHERE id = ?', [$id]);
        // Staff/admin accounts are never suspended from the web UI.
        if (!$target || $target['role'] !== 'customer') return;
        update('users', ['status' => $status], 'id = ?', [$id]);
        if ($status === 'suspended') invalidate_user_sessions($id);
        audit($actor, 'customer.' . ($status === 'suspended' ? 'suspend' : 'reactivate'), 'user', $id);
    });
}

const ERASED = '[deleted]';
const REVIEW_ANON = 'Customer · زبون';

/** Removes personal data from orders. Financial data (amounts, items, statuses) is kept. */
function scrub_orders(array $orderIds): void
{
    if (!$orderIds) return;
    $in = placeholders($orderIds);
    $receiptIds = array_values(array_filter(array_column(all("SELECT receipt_file_id FROM payments WHERE order_id IN ($in)", $orderIds), 'receipt_file_id')));
    q("UPDATE orders SET customer_name = ?, customer_phone = '', customer_email = NULL, customer_notes = '', delivery_note = '', user_id = NULL, anonymized_at = ? WHERE id IN ($in)", [ERASED, now_db(), ...$orderIds]);
    q("UPDATE order_items SET inputs = '[]' WHERE order_id IN ($in)", $orderIds);
    q("UPDATE payments SET customer_reference = NULL, receipt_file_id = NULL WHERE order_id IN ($in)", $orderIds);
    if ($receiptIds) q('DELETE FROM files WHERE id IN (' . placeholders($receiptIds) . ')', $receiptIds);
    q("DELETE FROM push_subscriptions WHERE order_id IN ($in)", $orderIds);
    // Reviews stay published (they are about the service), but no longer carry the customer's chosen name.
    q("UPDATE reviews SET display_name = ? WHERE order_id IN ($in)", [REVIEW_ANON, ...$orderIds]);
}

/** Account deletion (by the customer or an admin): scrub linked orders, then delete the user row. */
function anonymize_customer(string $id, ?array $actor): void
{
    tx(function () use ($id, $actor) {
        $target = one('SELECT * FROM users WHERE id = ? FOR UPDATE', [$id]);
        if (!$target || $target['role'] !== 'customer') return;
        // Money must be returned (and debited by an admin) before the account can be erased.
        if ((int) $target['wallet_balance'] > 0) throw new ServiceError('walletNotEmpty');
        $linked = array_column(all('SELECT id FROM orders WHERE user_id = ?', [$id]), 'id');
        scrub_orders($linked);
        q("UPDATE custom_requests SET user_id = NULL, name = ?, phone = '', email = NULL, anonymized_at = ? WHERE user_id = ?", [ERASED, now_db(), $id]);
        q('DELETE FROM users WHERE id = ?', [$id]);
        audit($actor, 'customer.erase', 'user', $id, ['orders' => count($linked)]);
    });
}

/** Retention job: scrub personal data from finished orders older than $days. */
function run_retention(int $days): array
{
    $cutoff = now_db(-$days * 86400);
    return tx(function () use ($cutoff, $days) {
        $old = array_column(all(
            "SELECT id FROM orders WHERE status IN ('completed', 'cancelled', 'rejected', 'refunded') AND updated_at < ? AND anonymized_at IS NULL LIMIT 5000",
            [$cutoff],
        ), 'id');
        scrub_orders($old);
        $reqs = q(
            "UPDATE custom_requests SET name = ?, phone = '', email = NULL, anonymized_at = ? WHERE status = 'closed' AND updated_at < ? AND anonymized_at IS NULL",
            [ERASED, now_db(), $cutoff],
        )->rowCount();
        audit(null, 'retention.run', 'system', null, ['orders' => count($old), 'requests' => $reqs, 'days' => $days]);
        return ['orders' => count($old), 'requests' => $reqs];
    });
}
