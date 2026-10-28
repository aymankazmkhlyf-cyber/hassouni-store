<?php
/* Request / response helpers: routing params, cookies, redirects, JSON, security headers. */

declare(strict_types=1);

final class HttpRedirect extends Exception
{
    public function __construct(public readonly string $location, public readonly int $status = 303)
    {
        parent::__construct('redirect');
    }
}

final class HttpNotFound extends Exception {}

function redirect(string $location, int $status = 303): never
{
    throw new HttpRedirect($location, $status);
}

function not_found(): never
{
    throw new HttpNotFound('not found');
}

function method(): string
{
    return strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
}

function is_https(): bool
{
    if (!empty($_SERVER['HTTPS']) && strtolower((string) $_SERVER['HTTPS']) !== 'off') return true;
    if (($_SERVER['SERVER_PORT'] ?? '') === '443') return true;
    if (config('trust_proxy') && strtolower((string) ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '')) === 'https') return true;
    return false;
}

function is_production(): bool
{
    return is_https();
}

/** Client IP for rate limiting. Forwarded headers are only trusted when configured. */
function client_ip(): string
{
    if (config('trust_proxy')) {
        $cf = $_SERVER['HTTP_CF_CONNECTING_IP'] ?? '';
        if ($cf !== '') return $cf;
        $fwd = trim(explode(',', (string) ($_SERVER['HTTP_X_FORWARDED_FOR'] ?? ''))[0]);
        if ($fwd !== '') return $fwd;
        $real = $_SERVER['HTTP_X_REAL_IP'] ?? '';
        if ($real !== '') return $real;
    }
    return (string) ($_SERVER['REMOTE_ADDR'] ?? 'local');
}

function user_agent(): ?string
{
    $ua = $_SERVER['HTTP_USER_AGENT'] ?? null;
    return is_string($ua) ? $ua : null;
}

/** Public base URL without trailing slash: app_url if set, else the request host. */
function site_url(): string
{
    $configured = rtrim((string) config('app_url', ''), '/');
    if ($configured !== '') return $configured;
    $host = $_SERVER['HTTP_HOST'] ?? '';
    if ($host === '') return '';
    return (is_https() ? 'https' : 'http') . '://' . $host;
}

/** Base path when the site lives in a sub-folder (e.g. /store). Empty at the domain root. */
function base_path(): string
{
    static $base = null;
    if ($base !== null) return $base;
    $script = str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/'));
    $base = rtrim($script === '.' ? '' : $script, '/');
    return $base;
}

/** Absolute path for a link inside the site: url('/ar/services'). */
function url(string $path): string
{
    return base_path() . $path;
}

function asset(string $path): string
{
    static $version = null;
    $version ??= substr(md5((string) @filemtime(ROOT_DIR . '/assets/app.css') . (string) @filemtime(ROOT_DIR . '/assets/islands.js')), 0, 8);
    return url('/assets/' . $path) . '?v=' . $version;
}

/** Current request path relative to the site root, without query string. */
function request_path(): string
{
    $uri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
    $base = base_path();
    if ($base !== '' && str_starts_with($uri, $base)) $uri = substr($uri, strlen($base)) ?: '/';
    return '/' . ltrim(rawurldecode($uri), '/');
}

function query(string $key): ?string
{
    $v = $_GET[$key] ?? null;
    if (is_array($v)) $v = $v[0] ?? null;
    return is_string($v) ? $v : null;
}

function post(string $key): mixed
{
    return $_POST[$key] ?? null;
}

function page_number(?string $v): int
{
    return $v !== null && preg_match('/^\d{1,4}$/', $v) && (int) $v > 0 ? (int) $v : 1;
}

/* ------------------------------ Cookies ------------------------------ */

function cookie_name(string $base): string
{
    return is_https() ? '__Host-' . $base : $base;
}

function get_cookie(string $name): ?string
{
    $v = $_COOKIE[$name] ?? null;
    return is_string($v) ? $v : null;
}

function set_cookie(string $name, string $value, int $expires, bool $httpOnly = true): void
{
    setcookie($name, $value, [
        'expires' => $expires,
        'path' => '/',
        'secure' => is_https(),
        'httponly' => $httpOnly,
        'samesite' => 'Lax',
    ]);
    $_COOKIE[$name] = $value;
}

function delete_cookie(string $name): void
{
    setcookie($name, '', ['expires' => time() - 3600, 'path' => '/', 'secure' => is_https(), 'httponly' => true, 'samesite' => 'Lax']);
    unset($_COOKIE[$name]);
}

/* ------------------------------ Security ------------------------------ */

/** Browsers send Origin on cross-site POSTs; a request from another site is refused. */
function same_origin_request(): bool
{
    $origin = $_SERVER['HTTP_ORIGIN'] ?? null;
    $host = config('trust_proxy') ? ($_SERVER['HTTP_X_FORWARDED_HOST'] ?? $_SERVER['HTTP_HOST'] ?? '') : ($_SERVER['HTTP_HOST'] ?? '');
    if (!is_string($origin) || $origin === '' || $origin === 'null') {
        // Very old browsers omit Origin: fall back to the Referer host.
        $ref = $_SERVER['HTTP_REFERER'] ?? '';
        if (!is_string($ref) || $ref === '') return !is_production();
        return parse_url($ref, PHP_URL_HOST) . (parse_url($ref, PHP_URL_PORT) ? ':' . parse_url($ref, PHP_URL_PORT) : '') === $host;
    }
    $h = parse_url($origin, PHP_URL_HOST);
    $p = parse_url($origin, PHP_URL_PORT);
    return $h !== null && $h . ($p ? ':' . $p : '') === $host;
}

function csp_nonce(): string
{
    static $nonce = null;
    return $nonce ??= base64_encode(random_bytes(16));
}

function send_security_headers(bool $private = false): void
{
    $nonce = csp_nonce();
    $csp = implode('; ', array_filter([
        "default-src 'self'",
        "script-src 'self' 'nonce-$nonce' 'strict-dynamic'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob:",
        "font-src 'self' data:",
        "connect-src 'self'",
        "worker-src 'self'",
        "manifest-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
        is_production() ? 'upgrade-insecure-requests' : null,
    ]));
    header('Content-Security-Policy: ' . $csp);
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: DENY');
    header('Referrer-Policy: strict-origin-when-cross-origin');
    header('Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()');
    header('Cross-Origin-Opener-Policy: same-origin');
    if (is_production()) header('Strict-Transport-Security: max-age=63072000; includeSubDomains');
    if ($private) {
        header('Cache-Control: private, no-store');
        header('X-Robots-Tag: noindex, nofollow');
    }
}

function send_json(mixed $data, int $status = 200, array $headers = []): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: private, no-store');
    header('X-Content-Type-Options: nosniff');
    foreach ($headers as $h) header($h);
    echo json_out($data);
    exit;
}

function send_text(string $body, int $status, string $type = 'text/plain; charset=utf-8'): never
{
    http_response_code($status);
    header('Content-Type: ' . $type);
    header('X-Content-Type-Options: nosniff');
    echo $body;
    exit;
}

/** JSON request body (for island actions that send JSON). */
function json_body(): mixed
{
    static $body = null;
    if ($body !== null) return $body;
    $raw = file_get_contents('php://input') ?: '';
    if (strlen($raw) > 1_000_000) return $body = [];
    $body = json_decode($raw, true);
    return $body ??= [];
}
