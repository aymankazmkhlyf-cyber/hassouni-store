<?php
declare(strict_types=1);

/** Verified-buyer review: same access rule as the order page (reference + key, or the logged-in owner). */
function action_reviews_submit(): array
{
    $reference = normalize_reference(form_str('reference'));
    $key = form_str('key');
    if (!consume_rate_limit('review', client_ip())) return ['error' => 'rateLimited'];
    $user = current_user();
    $order = $key !== '' ? get_order_by_access_key($reference, $key) : ($user ? get_order_for_user($reference, $user['id']) : null);
    if (!$order) return ['error' => 'notFoundOrder'];

    [$data, $errors] = v_review([
        'orderItemId' => $_POST['orderItemId'] ?? null,
        'rating' => $_POST['rating'] ?? 0,
        'comment' => form_str('comment'),
        'displayName' => form_str('displayName'),
    ]);
    if ($data === null) return ['error' => array_values($errors)[0] ?? 'validation', 'fieldErrors' => $errors];

    try {
        $result = submit_review($order['id'], $data);
    } catch (ServiceError $e) {
        return ['error' => $e->codeKey];
    } catch (Throwable $e) {
        log_error('review failed: ' . $e->getMessage());
        return ['error' => 'generic'];
    }
    if ($result['created']) {
        $item = null;
        foreach ($order['items'] as $i) if ((int) $i['id'] === $data['orderItemId']) $item = $i;
        $base = site_url();
        $rating = $data['rating'];
        $comment = $data['comment'];
        after_response(fn() => notify_staff(
            '⭐ تقييم جديد ' . str_repeat('★', $rating) . str_repeat('☆', 5 - $rating) . "\n🛍️ " . ($item['product_name_ar'] ?? '') . " — {$order['reference']}"
            . ($comment !== '' ? "\n💬 " . js_slice($comment, 300) : '') . "\n\n$base/ar/admin/reviews",
        ));
    }
    return ['ok' => true, 'message' => $result['created'] ? 'created' : 'updated'];
}
