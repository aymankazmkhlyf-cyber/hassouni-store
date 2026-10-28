<?php
declare(strict_types=1);

/** Status changes the customer is told about (the customer's own actions are not echoed back). */
const STATUS_EVENTS = ['paid', 'processing', 'completed', 'cancelled', 'rejected', 'refunded'];

function event_for_status(string $to): ?string
{
    return in_array($to, STATUS_EVENTS, true) ? $to : null;
}

/**
 * Tells the customer about an order update by browser push (devices that opted
 * in on the order page) and by email (when they left an email and email is
 * configured). Links go to the track page with the reference filled in; the
 * access key is never stored in plain text, so it is not sent. Never throws.
 */
function notify_customer(string $orderId, string $event, string $baseUrl): array
{
    try {
        $order = one('SELECT reference, locale, customer_email, anonymized_at FROM orders WHERE id = ?', [$orderId]);
        if (!$order || $order['anonymized_at']) return ['push' => 0, 'email' => false];
        $locale = is_locale($order['locale']) ? $order['locale'] : 'ar';
        $t = dict($locale);
        $msg = $t['notify']['status'][$event];
        $title = $msg['title'];
        $body = fmt($msg['body'], ['ref' => $order['reference']]);
        $path = "/$locale/track?ref=" . rawurlencode($order['reference']) . ($event === 'completed' ? '#review' : '');
        $settings = load_settings(true);
        $contact = str_starts_with($baseUrl, 'https://') ? $baseUrl : ($settings['supportEmail'] ? 'mailto:' . $settings['supportEmail'] : 'mailto:support@example.com');

        $push = push_to_order($orderId, ['title' => $title, 'body' => $body, 'url' => $path, 'tag' => $order['reference'], 'ref' => $order['reference']], $contact);

        $email = false;
        if ($order['customer_email'] && email_configured()) {
            $storeName = $locale === 'ar' ? $settings['storeNameAr'] : $settings['storeNameEn'];
            $link = $baseUrl . $path;
            $dir = $locale === 'ar' ? 'rtl' : 'ltr';
            $email = send_email(
                $order['customer_email'],
                "$title — {$order['reference']}",
                "$body\n\n{$t['notify']['openOrder']}: $link\n\n$storeName",
                '<div dir="' . $dir . '" style="font-family:Tahoma,Arial,sans-serif;font-size:15px;line-height:1.7;color:#1c1b29">
<h2 style="margin:0 0 8px">' . e($title) . '</h2>
<p style="margin:0 0 16px">' . e($body) . '</p>
<p><a href="' . e($link) . '" style="display:inline-block;background:#5a3ff0;color:#fff;padding:10px 18px;border-radius:10px;text-decoration:none;font-weight:bold">' . e($t['notify']['openOrder']) . '</a></p>
<p style="color:#77748c;font-size:13px">' . e($storeName) . '</p></div>',
            );
        }
        return ['push' => $push, 'email' => $email];
    } catch (Throwable) {
        log_error('customer notification failed');
        return ['push' => 0, 'email' => false];
    }
}
