<?php
/* Admin order list, filters, CSV export and dashboard numbers. */

declare(strict_types=1);

/** Status of the most recent payment record for each order. */
const LATEST_PAYMENT_STATUS_SQL = '(SELECT p.status FROM payments p WHERE p.order_id = o.id ORDER BY p.created_at DESC LIMIT 1)';

/** Parses and whitelists order filters from a query string (shared by the list page and CSV export). */
function parse_order_filters(array $get): array
{
    $g = function (string $k) use ($get): ?string {
        $v = $get[$k] ?? null;
        if (is_array($v)) $v = $v[0] ?? null;
        return is_string($v) ? $v : null;
    };
    $date = fn(?string $v) => $v && preg_match('/^\d{4}-\d{2}-\d{2}$/', $v) ? $v : null;
    $status = $g('status');
    $pay = $g('paymentStatus');
    $method = substr(preg_replace('/[^a-z0-9_]/', '', (string) $g('method')), 0, 40);
    $q = js_slice((string) $g('q'), 80);
    return [
        'q' => $q !== '' ? $q : null,
        'status' => in_array($status, ORDER_STATUSES, true) ? $status : null,
        'paymentStatus' => in_array($pay, PAYMENT_STATUSES, true) ? $pay : null,
        'method' => $method !== '' ? $method : null,
        'from' => $date($g('from')),
        'to' => $date($g('to')),
        'page' => page_number($g('page')),
    ];
}

function filters_to_params(array $f): array
{
    return ['q' => $f['q'], 'status' => $f['status'], 'paymentStatus' => $f['paymentStatus'], 'method' => $f['method'], 'from' => $f['from'], 'to' => $f['to']];
}

/** YYYY-MM-DD in Baghdad time (UTC+3, no DST) → UTC DB time. */
function baghdad_day_start(string $date): ?string
{
    $d = DateTimeImmutable::createFromFormat('!Y-m-d', $date, new DateTimeZone('+03:00'));
    return $d ? $d->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s') . '.000' : null;
}

function build_order_where(array $f): array
{
    $where = [];
    $params = [];
    $q = trim_js((string) ($f['q'] ?? ''));
    if ($q !== '') {
        $q = mb_substr($q, 0, 80);
        $pattern = '%' . escape_like($q) . '%';
        $digits = preg_replace('/\D/', '', $q);
        $conds = ['o.reference LIKE ?', 'o.customer_name LIKE ?'];
        array_push($params, $pattern, $pattern);
        if (strlen($digits) >= 4) { $conds[] = 'o.customer_phone LIKE ?'; $params[] = '%' . preg_replace('/^0/', '', $digits) . '%'; }
        $where[] = '(' . implode(' OR ', $conds) . ')';
    }
    if (!empty($f['status'])) { $where[] = 'o.status = ?'; $params[] = $f['status']; }
    if (!empty($f['method'])) { $where[] = 'o.payment_method_code = ?'; $params[] = $f['method']; }
    if (!empty($f['paymentStatus'])) { $where[] = LATEST_PAYMENT_STATUS_SQL . ' = ?'; $params[] = $f['paymentStatus']; }
    if (!empty($f['from']) && ($from = baghdad_day_start($f['from']))) { $where[] = 'o.created_at >= ?'; $params[] = $from; }
    if (!empty($f['to']) && ($to = baghdad_day_start($f['to']))) {
        $where[] = 'o.created_at < ?';
        $params[] = gmdate('Y-m-d H:i:s', (int) db_time($to) + 86400) . '.000';
    }
    return [$where ? 'WHERE ' . implode(' AND ', $where) : '', $params];
}

function list_orders_admin(array $f, int $pageSize = 20): array
{
    $page = max((int) ($f['page'] ?? 1), 1);
    [$where, $params] = build_order_where($f);
    $rows = all(
        "SELECT o.id, o.reference, o.customer_name, o.customer_phone, o.status, o.payment_method_code, o.payment_method_name_ar, o.payment_method_name_en,
                o.total, o.created_at, " . LATEST_PAYMENT_STATUS_SQL . " AS payment_status
           FROM orders o $where ORDER BY o.created_at DESC LIMIT ? OFFSET ?",
        [...$params, $pageSize, ($page - 1) * $pageSize],
    );
    $total = (int) val("SELECT COUNT(*) FROM orders o $where", $params);
    return ['rows' => $rows, 'total' => $total, 'page' => $page, 'pages' => max(1, (int) ceil($total / $pageSize))];
}

function export_orders(array $f): array
{
    [$where, $params] = build_order_where($f);
    return all(
        "SELECT o.reference, o.created_at, o.status, " . LATEST_PAYMENT_STATUS_SQL . " AS payment_status, o.payment_method_code AS payment_method, o.total,
                (SELECT COUNT(*) FROM order_items i WHERE i.order_id = o.id) AS items, o.customer_name, o.customer_phone, o.customer_email
           FROM orders o $where ORDER BY o.created_at DESC LIMIT 10000",
        $params,
    );
}

function dashboard_stats(): array
{
    $by = [];
    foreach (all('SELECT status, COUNT(*) AS n FROM orders GROUP BY status') as $r) $by[$r['status']] = (int) $r['n'];
    $rev = placeholders(CONFIRMED_REVENUE_STATUSES);
    return [
        'totalOrders' => array_sum($by),
        'pendingPayment' => $by['pending_payment'] ?? 0,
        'paymentReview' => $by['payment_review'] ?? 0,
        'completed' => $by['completed'] ?? 0,
        'confirmedRevenue' => (int) val("SELECT COALESCE(SUM(total), 0) FROM orders WHERE status IN ($rev)", CONFIRMED_REVENUE_STATUSES),
        'grossValue' => (int) val("SELECT COALESCE(SUM(total), 0) FROM orders WHERE status NOT IN ('cancelled', 'rejected')"),
        'recent' => all('SELECT id, reference, customer_name, status, total, created_at FROM orders ORDER BY created_at DESC LIMIT 8'),
        // Best sellers come only from orders where payment was confirmed.
        'bestSellers' => all(
            "SELECT i.product_id, MAX(i.product_name_ar) AS name_ar, MAX(i.product_name_en) AS name_en, SUM(i.quantity) AS units, SUM(i.line_total) AS revenue
               FROM order_items i INNER JOIN orders o ON o.id = i.order_id WHERE o.status IN ($rev)
              GROUP BY i.product_id ORDER BY SUM(i.line_total) DESC LIMIT 5",
            CONFIRMED_REVENUE_STATUSES,
        ),
    ];
}

/** Payment methods that appear in existing orders (for the filter dropdown). */
function order_payment_method_codes(): array
{
    return array_column(all('SELECT DISTINCT method_code FROM payments'), 'method_code');
}

/** CSV with spreadsheet formula-injection protection and a BOM for Excel. */
function csv_cell(mixed $v): string
{
    if ($v === null) return '';
    $s = (string) $v;
    if (!is_int($v) && !is_float($v) && preg_match('/^[=+\-@\t\r]/', $s)) $s = "'" . $s;
    if (preg_match('/[",\r\n]/', $s)) $s = '"' . str_replace('"', '""', $s) . '"';
    return $s;
}

function to_csv(array $headers, array $rows): string
{
    $lines = [implode(',', array_map('csv_cell', $headers))];
    foreach ($rows as $r) $lines[] = implode(',', array_map('csv_cell', $r));
    return "\u{FEFF}" . implode("\r\n", $lines) . "\r\n";
}
