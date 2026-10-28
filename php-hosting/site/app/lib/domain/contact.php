<?php
declare(strict_types=1);

/** wa.me expects the international number with digits only. */
function whatsapp_link(string $phone, ?string $message = null): string
{
    $base = 'https://wa.me/' . preg_replace('/\D/', '', $phone);
    return $message ? $base . '?text=' . rawurlencode($message) : $base;
}

/** Telegram chat link. t.me cannot prefill a message for a user chat, so none is attached. */
function telegram_link(string $username): string
{
    $handle = preg_replace('#^https?://t\.me/#', '', preg_replace('/^@/', '', trim($username)));
    if (!preg_match('/^[A-Za-z0-9_]{3,32}$/', $handle)) return 'https://t.me/';
    return 'https://t.me/' . $handle;
}

function telegram_handle(string $username): string
{
    return '@' . preg_replace('#^https?://t\.me/#', '', preg_replace('/^@/', '', trim($username)));
}

function is_safe_http_url(string $value): bool
{
    if (preg_match('/\s/', $value)) return false;
    $p = parse_url($value);
    if (!$p || empty($p['scheme']) || empty($p['host'])) return false;
    return in_array(strtolower($p['scheme']), ['http', 'https'], true);
}

/**
 * Prepares a support message about an order. Contains only the public reference,
 * status and a short item summary — never access keys, payment details or contact data.
 */
function build_order_support_message(array $order, string $locale): string
{
    $items = implode("\n", array_map(fn($i) => '- ' . $i['name'] . ' × ' . $i['quantity'], array_slice($order['items'], 0, 5)));
    $more = count($order['items']) > 5 ? "\n- …" : '';
    if ($locale === 'ar') {
        return "مرحباً، أحتاج مساعدة بخصوص طلبي.\nرقم الطلب: {$order['reference']}\nالحالة: {$order['status']}\nالمجموع: {$order['total']}\nالخدمات:\n$items$more";
    }
    return "Hello, I need help with my order.\nOrder reference: {$order['reference']}\nStatus: {$order['status']}\nTotal: {$order['total']}\nServices:\n$items$more";
}
