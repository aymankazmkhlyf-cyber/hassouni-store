<?php
/* PDO MySQL connection and small query helpers. All times are UTC. */

declare(strict_types=1);

final class Db
{
    private static ?PDO $pdo = null;

    public static function pdo(): PDO
    {
        if (self::$pdo) return self::$pdo;
        $dsn = sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', config('db_host', 'localhost'), (int) config('db_port', 3306), config('db_name'));
        self::$pdo = new PDO($dsn, (string) config('db_user'), (string) config('db_pass'), [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
            PDO::ATTR_STRINGIFY_FETCHES => false,
            PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci, time_zone = '+00:00', sql_mode = 'STRICT_ALL_TABLES,NO_ZERO_DATE,NO_ZERO_IN_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION'",
        ]);
        return self::$pdo;
    }

    public static function set(PDO $pdo): void
    {
        self::$pdo = $pdo;
    }
}

function db(): PDO
{
    return Db::pdo();
}

/** Runs a statement. Booleans become 0/1, everything else is bound as given. */
function q(string $sql, array $params = []): PDOStatement
{
    $st = db()->prepare($sql);
    $i = 0;
    foreach ($params as $k => $v) {
        $name = is_int($k) ? ++$i : (str_starts_with($k, ':') ? $k : ':' . $k);
        if (is_bool($v)) $st->bindValue($name, $v ? 1 : 0, PDO::PARAM_INT);
        elseif (is_int($v)) $st->bindValue($name, $v, PDO::PARAM_INT);
        elseif ($v === null) $st->bindValue($name, null, PDO::PARAM_NULL);
        else $st->bindValue($name, (string) $v, PDO::PARAM_STR);
    }
    $st->execute();
    return $st;
}

function one(string $sql, array $params = []): ?array
{
    $row = q($sql, $params)->fetch();
    return $row === false ? null : $row;
}

function all(string $sql, array $params = []): array
{
    return q($sql, $params)->fetchAll();
}

function val(string $sql, array $params = []): mixed
{
    $v = q($sql, $params)->fetchColumn();
    return $v === false ? null : $v;
}

/** "?, ?, ?" for an IN (...) list. */
function placeholders(array $values): string
{
    return implode(', ', array_fill(0, max(1, count($values)), '?'));
}

/** Runs $fn inside a transaction; nested calls join the outer transaction. */
function tx(callable $fn): mixed
{
    $pdo = db();
    if ($pdo->inTransaction()) return $fn();
    $pdo->beginTransaction();
    try {
        $result = $fn();
        $pdo->commit();
        return $result;
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }
}

/** Inserts a row and returns the auto-increment id (0 when the table has none). */
function insert(string $table, array $row): int
{
    $cols = array_keys($row);
    q('INSERT INTO `' . $table . '` (`' . implode('`, `', $cols) . '`) VALUES (' . placeholders($cols) . ')', array_values($row));
    return (int) db()->lastInsertId();
}

/** UPDATE helper: update('orders', ['status' => 'paid'], 'id = ?', [$id]). Returns affected rows. */
function update(string $table, array $set, string $where, array $params = []): int
{
    $parts = [];
    foreach (array_keys($set) as $c) $parts[] = '`' . $c . '` = ?';
    return q('UPDATE `' . $table . '` SET ' . implode(', ', $parts) . ' WHERE ' . $where, [...array_values($set), ...$params])->rowCount();
}

function json_col(?string $v, mixed $default = []): mixed
{
    if ($v === null || $v === '') return $default;
    $d = json_decode($v, true);
    return $d === null && $v !== 'null' ? $default : $d;
}

/** Escapes LIKE wildcards. */
function escape_like(string $q): string
{
    return preg_replace('/[\\\\%_]/', '\\\\$0', $q);
}

function is_duplicate_key(Throwable $e): bool
{
    return $e instanceof PDOException && ($e->errorInfo[1] ?? null) === 1062;
}
