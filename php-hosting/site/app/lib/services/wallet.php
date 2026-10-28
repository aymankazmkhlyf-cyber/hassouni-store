<?php
/*
 * Customer wallet. The balance lives on users.wallet_balance and is only ever
 * changed inside a transaction that locks the user row and appends one
 * wallet_transactions row, so the ledger always explains the balance.
 * Money comes in two ways: staff approve a top-up request (the customer paid
 * through a manual method and sent proof), or an admin credits it directly.
 */

declare(strict_types=1);

const WALLET_MIN_TOPUP = 1000;
const WALLET_MAX_TOPUP = 5_000_000;
/** Open (unreviewed) top-up requests a customer may have at once. */
const MAX_OPEN_TOPUPS = 3;
const USERNAME_RE = '/^[a-z][a-z0-9_.]{2,19}$/';
const RESERVED_USERNAMES = ['admin', 'administrator', 'root', 'support', 'staff', 'hassouni', 'hsony', 'store', 'wallet', 'system', 'help', 'info', 'owner'];

final class ServiceError extends Exception
{
    public function __construct(public readonly string $codeKey, public readonly mixed $extra = null)
    {
        parent::__construct($codeKey);
    }
}

function normalize_username(string $input): string
{
    return strtolower(preg_replace('/^@/', '', trim_js($input)));
}

/** null when valid, otherwise an error key. */
function username_problem(string $username): ?string
{
    if (!preg_match(USERNAME_RE, $username) || str_contains($username, '..')) return 'usernameInvalid';
    if (in_array($username, RESERVED_USERNAMES, true)) return 'usernameTaken';
    return null;
}

/** Sets the wallet ID once; it cannot be changed afterwards (staff top up by it). */
function set_username(string $userId, string $raw): string
{
    $username = normalize_username($raw);
    if ($p = username_problem($username)) throw new ServiceError($p);
    try {
        $n = q('UPDATE users SET username = ? WHERE id = ? AND username IS NULL', [$username, $userId])->rowCount();
    } catch (PDOException $e) {
        if (is_duplicate_key($e)) throw new ServiceError('usernameTaken');
        throw $e;
    }
    if ($n === 0) {
        $me = one('SELECT username FROM users WHERE id = ?', [$userId]);
        throw new ServiceError(!empty($me['username']) ? 'usernameLocked' : 'usernameTaken');
    }
    return $username;
}

/** Applies one balance change inside the caller's transaction. Throws insufficientBalance on overdraft. */
function apply_wallet_change(array $c): int
{
    $amount = $c['amount'];
    if (!is_int($amount) || $amount === 0) throw new ServiceError('validation');
    $user = one('SELECT wallet_balance, role, anonymized_at FROM users WHERE id = ? FOR UPDATE', [$c['userId']]);
    if (!$user || $user['role'] !== 'customer' || $user['anonymized_at']) throw new ServiceError('notFound');
    $next = (int) $user['wallet_balance'] + $amount;
    if ($next < 0) throw new ServiceError('insufficientBalance');
    update('users', ['wallet_balance' => $next], 'id = ?', [$c['userId']]);
    insert('wallet_transactions', [
        'user_id' => $c['userId'],
        'type' => $c['type'],
        'amount' => $amount,
        'balance_after' => $next,
        'order_id' => $c['orderId'] ?? null,
        'topup_id' => $c['topupId'] ?? null,
        'staff_id' => $c['staffId'] ?? null,
        'note' => $c['note'] ?? '',
        'created_at' => now_db(),
    ]);
    return $next;
}

function get_wallet(string $userId): ?array
{
    $user = one('SELECT wallet_balance, username FROM users WHERE id = ?', [$userId]);
    if (!$user) return null;
    return [
        'balance' => (int) $user['wallet_balance'],
        'username' => $user['username'],
        'transactions' => all('SELECT * FROM wallet_transactions WHERE user_id = ? ORDER BY id DESC LIMIT 50', [$userId]),
        'topups' => all('SELECT id, amount, status, method_name_ar, method_name_en, review_note, created_at FROM wallet_topups WHERE user_id = ? ORDER BY created_at DESC LIMIT 20', [$userId]),
    ];
}

function create_topup(string $userId, int $amount, int $methodId, ?string $customerReference, ?array $receipt): array
{
    if ($amount < WALLET_MIN_TOPUP || $amount > WALLET_MAX_TOPUP) throw new ServiceError('topupAmount');
    if (!$customerReference && !$receipt) throw new ServiceError('proofNeedOne');
    return tx(function () use ($userId, $amount, $methodId, $customerReference, $receipt) {
        $user = one('SELECT role FROM users WHERE id = ? FOR UPDATE', [$userId]);
        if (!$user || $user['role'] !== 'customer') throw new ServiceError('forbidden');
        $open = (int) val("SELECT COUNT(*) FROM wallet_topups WHERE user_id = ? AND status = 'submitted'", [$userId]);
        if ($open >= MAX_OPEN_TOPUPS) throw new ServiceError('topupTooMany');
        $method = one('SELECT * FROM payment_methods WHERE id = ? AND is_enabled = 1', [$methodId]);
        if (!$method) throw new ServiceError('paymentMethod');
        if ($receipt && !$method['allows_receipt']) throw new ServiceError('file_type');
        $receiptId = $receipt ? store_file('receipt', $receipt['mime'], $receipt['bytes'], null) : null;
        $id = uuid4();
        insert('wallet_topups', [
            'id' => $id,
            'user_id' => $userId,
            'amount' => $amount,
            'method_code' => $method['code'],
            'method_name_ar' => $method['name_ar'],
            'method_name_en' => $method['name_en'],
            'customer_reference' => $customerReference,
            'receipt_file_id' => $receiptId,
            'created_at' => now_db(),
            'updated_at' => now_db(),
        ]);
        return ['id' => $id, 'methodNameAr' => $method['name_ar']];
    });
}

/** Staff approve (credits the wallet) or reject a submitted top-up. */
function review_topup(string $id, string $decision, string $note, array $actor): array
{
    return tx(function () use ($id, $decision, $note, $actor) {
        $topup = one('SELECT * FROM wallet_topups WHERE id = ? FOR UPDATE', [$id]);
        if (!$topup) throw new ServiceError('notFound');
        if ($topup['status'] !== 'submitted') throw new ServiceError('invalidTransition');
        if ($decision === 'reject' && trim_js($note) === '') throw new ServiceError('reasonRequired');
        if (!$topup['user_id']) throw new ServiceError('notFound');
        update('wallet_topups', [
            'status' => $decision === 'approve' ? 'approved' : 'rejected',
            'reviewed_by_id' => $actor['id'],
            'reviewed_at' => now_db(),
            'review_note' => trim_js($note) ?: null,
        ], 'id = ?', [$id]);
        $balance = null;
        if ($decision === 'approve') {
            $balance = apply_wallet_change(['userId' => $topup['user_id'], 'amount' => (int) $topup['amount'], 'type' => 'topup', 'topupId' => $id, 'staffId' => $actor['id'], 'note' => trim_js($note)]);
        }
        audit($actor, "wallet.topup_$decision", 'wallet_topup', $id, ['amount' => (int) $topup['amount'], 'method' => $topup['method_code']]);
        return ['userId' => $topup['user_id'], 'amount' => (int) $topup['amount'], 'balance' => $balance];
    });
}

/** Finds a customer by wallet ID (username), email or phone number. An ambiguous match is refused. */
function find_customer(string $identifier): ?array
{
    $q = trim_js($identifier);
    if ($q === '') return null;
    $conds = ['u.username = ?', 'u.email = ?'];
    $params = [normalize_username($q), strtolower($q)];
    if ($phone = normalize_phone($q)) { $conds[] = 'u.phone = ?'; $params[] = $phone; }
    $rows = all(
        "SELECT u.id, u.name, u.email, u.phone, u.username, u.wallet_balance, u.status FROM users u
          WHERE u.role = 'customer' AND u.anonymized_at IS NULL AND (" . implode(' OR ', $conds) . ') LIMIT 2',
        $params,
    );
    return count($rows) === 1 ? $rows[0] : null;
}

/** Direct credit (positive) or debit (negative) by an admin, e.g. cash received in person. */
function admin_adjust_wallet(string $userId, int $amount, string $note, array $actor): int
{
    if (trim_js($note) === '') throw new ServiceError('reasonRequired');
    return tx(function () use ($userId, $amount, $note, $actor) {
        $balance = apply_wallet_change(['userId' => $userId, 'amount' => $amount, 'type' => $amount > 0 ? 'admin_credit' : 'admin_debit', 'staffId' => $actor['id'], 'note' => trim_js($note)]);
        audit($actor, $amount > 0 ? 'wallet.credit' : 'wallet.debit', 'user', $userId, ['amount' => $amount, 'balance' => $balance]);
        return $balance;
    });
}

function list_topups_admin(?string $status, int $page): array
{
    $pageSize = 25;
    $page = max($page, 1);
    $where = $status ? 'WHERE t.status = ?' : '';
    $params = $status ? [$status] : [];
    $rows = all(
        "SELECT t.id, t.amount, t.status, t.method_name_ar, t.method_name_en, t.customer_reference, t.receipt_file_id, t.review_note, t.created_at,
                u.id AS user_id, u.name AS user_name, u.username, u.email, u.wallet_balance AS balance
           FROM wallet_topups t LEFT JOIN users u ON u.id = t.user_id $where
          ORDER BY (t.status = 'submitted') DESC, t.created_at DESC LIMIT ? OFFSET ?",
        [...$params, $pageSize, ($page - 1) * $pageSize],
    );
    $total = (int) val("SELECT COUNT(*) FROM wallet_topups t $where", $params);
    return ['rows' => $rows, 'page' => $page, 'pages' => max(1, (int) ceil($total / $pageSize))];
}

function open_topup_count(): int
{
    return (int) val("SELECT COUNT(*) FROM wallet_topups WHERE status = 'submitted'");
}

function recent_wallet_transactions(string $userId): array
{
    return all('SELECT * FROM wallet_transactions WHERE user_id = ? ORDER BY id DESC LIMIT 20', [$userId]);
}
