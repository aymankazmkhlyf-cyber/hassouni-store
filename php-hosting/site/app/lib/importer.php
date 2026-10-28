<?php
/*
 * Copies data from the original PostgreSQL database (Neon) into MySQL.
 * Column names are identical in both schemas; only value formats differ
 * (booleans, timestamps, JSON, binary). Used by the installer's "import old
 * data" step and by tools/make-seed.php to build the fresh-install catalog.
 */

declare(strict_types=1);

/** Tables in foreign-key order. Sessions, codes and rate limits are not copied (they are short-lived). */
const IMPORT_TABLES = [
    'users', 'files', 'categories', 'products', 'product_packages', 'price_tiers', 'product_fields',
    'payment_methods', 'orders', 'order_items', 'payments', 'order_status_history', 'custom_requests',
    'store_settings', 'audit_logs', 'support_threads', 'support_messages', 'reviews', 'push_subscriptions',
    'wallet_topups', 'wallet_transactions',
];

/** Catalog-only tables used for a fresh install. */
const SEED_TABLES = ['files', 'categories', 'products', 'product_packages', 'price_tiers', 'product_fields', 'payment_methods', 'store_settings'];

function pg_connect_url(string $url): PDO
{
    $u = parse_url($url);
    if (!$u || !in_array($u['scheme'] ?? '', ['postgres', 'postgresql'], true) || empty($u['host'])) {
        throw new InvalidArgumentException('bad_url');
    }
    parse_str($u['query'] ?? '', $q);
    $db = ltrim($u['path'] ?? '', '/') ?: 'postgres';
    $dsn = sprintf('pgsql:host=%s;port=%d;dbname=%s', $u['host'], (int) ($u['port'] ?? 5432), $db);
    $sslmode = $q['sslmode'] ?? (str_ends_with($u['host'], '.neon.tech') ? 'require' : null);
    if ($sslmode) $dsn .= ';sslmode=' . $sslmode;
    // Old libpq versions cannot send SNI; Neon then needs the endpoint id passed explicitly.
    if (str_ends_with($u['host'], '.neon.tech')) {
        $endpoint = explode('.', $u['host'])[0];
        $dsn .= ";options='endpoint=" . str_replace('-pooler', '', $endpoint) . "'";
    }
    $pdo = new PDO($dsn, urldecode($u['user'] ?? ''), urldecode($u['pass'] ?? ''), [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_TIMEOUT => 15,
    ]);
    $pdo->exec("SET TIME ZONE 'UTC'");
    return $pdo;
}

/** Column => kind map read from the Postgres catalog. */
function pg_columns(PDO $pg, string $table): array
{
    $st = $pg->prepare("SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = ? ORDER BY ordinal_position");
    $st->execute([$table]);
    $cols = [];
    foreach ($st->fetchAll() as $r) {
        $t = $r['data_type'];
        $cols[$r['column_name']] = match (true) {
            $t === 'boolean' => 'bool',
            str_starts_with($t, 'timestamp') => 'time',
            $t === 'jsonb' || $t === 'json' => 'json',
            $t === 'bytea' => 'binary',
            default => 'plain',
        };
    }
    return $cols;
}

function mysql_columns(PDO $my, string $table): array
{
    $st = $my->prepare('SELECT column_name AS c FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ?');
    $st->execute([$table]);
    return array_column($st->fetchAll(PDO::FETCH_ASSOC), 'c');
}

/** Yields rows of a Postgres table converted to MySQL-ready values. */
function pg_rows(PDO $pg, string $table, array $cols): Generator
{
    $select = [];
    foreach ($cols as $c => $kind) {
        $q = '"' . $c . '"';
        $select[] = match ($kind) {
            'time' => "to_char($q AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS.MS') AS $q",
            'json' => "$q::text AS $q",
            default => $q,
        };
    }
    $order = $table === 'store_settings' ? '"key"' : (array_key_exists('id', $cols) ? '"id"' : '1');
    $st = $pg->query('SELECT ' . implode(', ', $select) . " FROM \"$table\" ORDER BY $order");
    while ($row = $st->fetch(PDO::FETCH_ASSOC)) {
        foreach ($cols as $c => $kind) {
            $v = $row[$c];
            if ($v === null) continue;
            if ($kind === 'bool') $row[$c] = ($v === true || $v === 't' || $v === 1 || $v === '1') ? 1 : 0;
            elseif ($kind === 'binary' && is_resource($v)) $row[$c] = stream_get_contents($v);
        }
        yield $row;
    }
}

function prepare_row(string $table, array $row, array $targetCols): array
{
    if ($table === 'push_subscriptions' && isset($row['endpoint'])) $row['endpoint_hash'] = hash('sha256', $row['endpoint']);
    return array_intersect_key($row, array_flip($targetCols));
}

/**
 * Copies every table into an EMPTY MySQL database. Returns [table => rows].
 * $only limits the tables (e.g. SEED_TABLES).
 */
function import_from_pg(PDO $pg, PDO $my, array $only = IMPORT_TABLES, ?callable $log = null): array
{
    $counts = [];
    $my->exec('SET FOREIGN_KEY_CHECKS = 0');
    try {
        foreach (IMPORT_TABLES as $table) {
            if (!in_array($table, $only, true)) continue;
            $cols = pg_columns($pg, $table);
            if (!$cols) { $counts[$table] = 0; continue; }
            $target = mysql_columns($my, $table);
            $n = 0;
            $my->beginTransaction();
            foreach (pg_rows($pg, $table, $cols) as $row) {
                if ($table === 'store_settings' && !in_array($row['key'], ['store', 'vapid'], true)) continue;
                $row = prepare_row($table, $row, $target);
                $names = array_keys($row);
                $sql = 'INSERT INTO `' . $table . '` (`' . implode('`, `', $names) . '`) VALUES (' . implode(', ', array_fill(0, count($names), '?')) . ')';
                $st = $my->prepare($sql);
                $i = 1;
                foreach ($row as $c => $v) {
                    $st->bindValue($i++, $v, $v === null ? PDO::PARAM_NULL : ($c === 'data' ? PDO::PARAM_LOB : PDO::PARAM_STR));
                }
                $st->execute();
                $n++;
            }
            $my->commit();
            $counts[$table] = $n;
            if ($log) $log($table, $n);
        }
    } catch (Throwable $e) {
        if ($my->inTransaction()) $my->rollBack();
        throw $e;
    } finally {
        $my->exec('SET FOREIGN_KEY_CHECKS = 1');
    }
    return $counts;
}

/** Writes rows as portable INSERT statements (binary as hex literals) — used to build seed.sql. */
function sql_inserts(PDO $pg, array $tables, array $targetColumns): string
{
    $out = '';
    foreach (IMPORT_TABLES as $table) {
        if (!in_array($table, $tables, true)) continue;
        $cols = pg_columns($pg, $table);
        foreach (pg_rows($pg, $table, $cols) as $row) {
            if ($table === 'store_settings' && $row['key'] !== 'store') continue;
            $row = prepare_row($table, $row, $targetColumns[$table]);
            $vals = [];
            foreach ($row as $c => $v) {
                if ($v === null) $vals[] = 'NULL';
                elseif ($c === 'data') $vals[] = '0x' . bin2hex($v);
                elseif (is_int($v)) $vals[] = (string) $v;
                else $vals[] = "'" . str_replace(["\\", "'", "\0", "\n", "\r", "\x1a"], ["\\\\", "\\'", "\\0", "\\n", "\\r", "\\Z"], (string) $v) . "'";
            }
            $out .= 'INSERT INTO `' . $table . '` (`' . implode('`, `', array_keys($row)) . '`) VALUES (' . implode(', ', $vals) . ");\n";
        }
    }
    return $out;
}
