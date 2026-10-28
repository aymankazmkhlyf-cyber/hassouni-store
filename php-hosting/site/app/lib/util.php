<?php
/* Small helpers shared by every file. */

declare(strict_types=1);

/** HTML-escapes text for output. */
function e(mixed $value): string
{
    return htmlspecialchars((string) $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

/** JSON for embedding in HTML attributes or <script type="application/json">. */
function json_attr(mixed $value): string
{
    return e(json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT));
}

function json_out(mixed $value): string
{
    return json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}

/** Joins class names, skipping empty ones (like clsx). */
function cn(string|false|null ...$parts): string
{
    return implode(' ', array_filter($parts, fn($p) => is_string($p) && $p !== ''));
}

function uuid4(): string
{
    $b = random_bytes(16);
    $b[6] = chr((ord($b[6]) & 0x0f) | 0x40);
    $b[8] = chr((ord($b[8]) & 0x3f) | 0x80);
    $h = bin2hex($b);
    return substr($h, 0, 8) . '-' . substr($h, 8, 4) . '-' . substr($h, 12, 4) . '-' . substr($h, 16, 4) . '-' . substr($h, 20);
}

function is_uuid(mixed $v): bool
{
    return is_string($v) && (bool) preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i', $v);
}

/** Current UTC time as a MySQL DATETIME(3) string. */
function now_db(int $offsetSeconds = 0): string
{
    $t = microtime(true) + $offsetSeconds;
    return gmdate('Y-m-d H:i:s', (int) $t) . sprintf('.%03d', (int) (($t - floor($t)) * 1000));
}

/** Parses a DB UTC datetime to a Unix timestamp (float, with milliseconds). */
function db_time(?string $v): ?float
{
    if ($v === null || $v === '') return null;
    $dt = DateTimeImmutable::createFromFormat('Y-m-d H:i:s.v', $v, new DateTimeZone('UTC'))
        ?: DateTimeImmutable::createFromFormat('Y-m-d H:i:s', $v, new DateTimeZone('UTC'));
    return $dt ? (float) $dt->format('U.v') : null;
}

/** ISO-8601 (UTC) like JavaScript's toISOString(). */
function iso_time(?string $v): ?string
{
    $t = db_time($v);
    return $t === null ? null : gmdate('Y-m-d\TH:i:s', (int) $t) . sprintf('.%03dZ', (int) round(($t - floor($t)) * 1000));
}

/** Trimmed string from user input (arrays and non-strings become ''). */
function str_in(mixed $v): string
{
    return is_string($v) ? trim($v) : (is_int($v) || is_float($v) ? trim((string) $v) : '');
}

function mb_len(string $s): int
{
    return mb_strlen($s, 'UTF-8');
}

/** JavaScript-like String.length (UTF-16 code units), used where the original checked .length. */
function js_len(string $s): int
{
    return intdiv(strlen(mb_convert_encoding($s, 'UTF-16LE', 'UTF-8')), 2);
}

function js_slice(string $s, int $len): string
{
    if (js_len($s) <= $len) return $s;
    $u = mb_convert_encoding($s, 'UTF-16LE', 'UTF-8');
    $cut = substr($u, 0, $len * 2);
    // Do not leave half of a surrogate pair at the end.
    $last = ord($cut[strlen($cut) - 1] ?? "\0");
    if ($last >= 0xD8 && $last <= 0xDB) $cut = substr($cut, 0, -2);
    return mb_convert_encoding($cut, 'UTF-8', 'UTF-16LE');
}

function int_or_null(mixed $v): ?int
{
    if (is_int($v)) return $v;
    if (is_string($v) && preg_match('/^-?\d{1,10}$/', trim($v))) return (int) trim($v);
    return null;
}

/** Strict positive int from JSON-ish values (numbers only, like zod's z.number().int()). */
function json_int(mixed $v): ?int
{
    if (is_int($v)) return $v;
    if (is_float($v) && floor($v) === $v && abs($v) < 9007199254740991) return (int) $v;
    return null;
}

function array_get(array $a, string $k, mixed $d = null): mixed
{
    return array_key_exists($k, $a) ? $a[$k] : $d;
}

function log_error(string $message): void
{
    error_log('[hassouni] ' . $message);
}
