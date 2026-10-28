<?php
/*
 * Transactional email through Resend's HTTPS API (free tier: 3,000 emails/month).
 * Set resend_api_key in app/config.php. Without a verified domain, Resend delivers
 * only to the Resend account's own address, which is enough for the owner's admin account.
 */

declare(strict_types=1);

function email_configured(): bool
{
    return (string) config('resend_api_key', '') !== '';
}

/** POSTs JSON with cURL. Returns [status, decoded body] or null on network failure. */
function http_post_json(string $url, array $payload, array $headers = [], int $timeout = 8): ?array
{
    if (!function_exists('curl_init')) return null;
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_out($payload),
        CURLOPT_HTTPHEADER => array_merge(['Content-Type: application/json'], $headers),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => $timeout,
        CURLOPT_CONNECTTIMEOUT => 5,
    ]);
    $body = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);
    if ($body === false) return null;
    return [$status, json_decode((string) $body, true)];
}

function send_email(string $to, string $subject, string $text, string $html): bool
{
    $key = (string) config('resend_api_key', '');
    if ($key === '') return false;
    $r = http_post_json('https://api.resend.com/emails', [
        'from' => config('email_from') ?: 'Hassouni Store <onboarding@resend.dev>',
        'to' => [$to],
        'subject' => $subject,
        'text' => $text,
        'html' => $html,
    ], ['Authorization: Bearer ' . $key]);
    $ok = $r !== null && $r[0] >= 200 && $r[0] < 300;
    if (!$ok) log_error('email send failed ' . ($r[0] ?? 'network'));
    return $ok;
}
