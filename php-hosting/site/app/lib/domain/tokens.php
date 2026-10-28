<?php
declare(strict_types=1);

// Crockford base32 without I, L, O, U — unambiguous when read aloud or typed.
const BASE32_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

function random_base32(int $length): string
{
    // 32 divides 256 evenly, so `byte % 32` has no modulo bias.
    $bytes = random_bytes($length);
    $out = '';
    for ($i = 0; $i < $length; $i++) $out .= BASE32_ALPHABET[ord($bytes[$i]) % 32];
    return $out;
}

/** Public order reference, e.g. HDS-7K2M-Q9XD-4T (50 bits of randomness). */
function generate_order_reference(string $prefix = 'HDS'): string
{
    $r = random_base32(10);
    return $prefix . '-' . substr($r, 0, 4) . '-' . substr($r, 4, 4) . '-' . substr($r, 8);
}

/** Customer access key for an order (120 bits). Shown once; only the hash is stored. */
function generate_access_key(): string
{
    return random_base32(24);
}

function normalize_access_key(string $input): string
{
    return preg_replace('/[^0-9A-Z]/', '', strtoupper($input));
}

function normalize_reference(string $input): string
{
    return preg_replace('/\s+/', '', strtoupper(trim($input)));
}

function sha256(string $value): string
{
    return hash('sha256', $value);
}

function hmac_hex(string $value): string
{
    return hash_hmac('sha256', $value, (string) config('app_secret', ''));
}

function safe_equal_hex(string $a, string $b): bool
{
    return $a !== '' && strlen($a) === strlen($b) && hash_equals($a, $b);
}

function base64url(string $bin): string
{
    return rtrim(strtr(base64_encode($bin), '+/', '-_'), '=');
}

function base64url_decode(string $s): string
{
    return (string) base64_decode(strtr($s, '-_', '+/') . str_repeat('=', (4 - strlen($s) % 4) % 4), true);
}

function generate_session_token(): string
{
    return base64url(random_bytes(32));
}
