<?php
/*
 * Reviews can only be written for a line of a COMPLETED order, through the
 * same access check as the order page (reference + key, or the logged-in
 * owner). That is what makes every review a "verified buyer" review. They are
 * published immediately; staff can hide abusive ones (with a reason) and reply,
 * but cannot edit what the customer wrote.
 */

declare(strict_types=1);

/** A customer's first name, used as the default public display name. */
function default_display_name(string $customerName): string
{
    $first = preg_split('/\s+/u', trim_js($customerName))[0] ?? '';
    return js_slice($first, 40);
}

function submit_review(string $orderId, array $in): array
{
    return tx(function () use ($orderId, $in) {
        $order = one('SELECT status FROM orders WHERE id = ?', [$orderId]);
        if (!$order) throw new ServiceError('notFound');
        if ($order['status'] !== 'completed') throw new ServiceError('reviewNotAllowed');
        $item = one('SELECT id, product_id FROM order_items WHERE id = ? AND order_id = ?', [$in['orderItemId'], $orderId]);
        if (!$item) throw new ServiceError('notFound');
        $existing = one('SELECT id FROM reviews WHERE order_item_id = ?', [$item['id']]);
        $values = ['rating' => $in['rating'], 'comment' => $in['comment'], 'display_name' => $in['displayName']];
        if ($existing) {
            // Editing keeps the moderation status: a hidden review is not republished by editing it.
            update('reviews', $values, 'id = ?', [$existing['id']]);
            return ['id' => (int) $existing['id'], 'created' => false];
        }
        $id = insert('reviews', $values + ['order_item_id' => $item['id'], 'order_id' => $orderId, 'product_id' => $item['product_id'], 'created_at' => now_db(), 'updated_at' => now_db()]);
        return ['id' => $id, 'created' => true];
    });
}

function reviews_for_order(string $orderId): array
{
    return all('SELECT * FROM reviews WHERE order_id = ?', [$orderId]);
}

function product_rating_summary(int $productId): array
{
    $rows = all("SELECT rating, COUNT(*) AS n FROM reviews WHERE product_id = ? AND status = 'published' GROUP BY rating", [$productId]);
    $dist = [0, 0, 0, 0, 0];
    $total = 0;
    $sum = 0;
    foreach ($rows as $r) {
        $dist[(int) $r['rating'] - 1] = (int) $r['n'];
        $total += (int) $r['n'];
        $sum += (int) $r['rating'] * (int) $r['n'];
    }
    return ['average' => $total ? round($sum / $total * 10) / 10 : 0, 'count' => $total, 'distribution' => $dist];
}

const PUBLIC_REVIEW_COLUMNS = 'r.id, r.rating, r.comment, r.display_name, r.staff_reply, r.created_at, i.package_label_ar, i.package_label_en';

function list_product_reviews(int $productId, int $limit = 20): array
{
    return all(
        'SELECT ' . PUBLIC_REVIEW_COLUMNS . " FROM reviews r INNER JOIN order_items i ON i.id = r.order_item_id
          WHERE r.product_id = ? AND r.status = 'published' ORDER BY r.created_at DESC LIMIT ?",
        [$productId, min($limit, 50)],
    );
}

/** Newest published reviews that have a written comment, across all active products. */
function latest_reviews(int $limit = 6): array
{
    return all(
        'SELECT ' . PUBLIC_REVIEW_COLUMNS . ", p.slug AS product_slug, p.name_ar AS product_name_ar, p.name_en AS product_name_en
           FROM reviews r INNER JOIN order_items i ON i.id = r.order_item_id INNER JOIN products p ON p.id = r.product_id
          WHERE r.status = 'published' AND p.is_active = 1 AND r.comment <> '' ORDER BY r.created_at DESC LIMIT ?",
        [$limit],
    );
}

function list_reviews_admin(?string $status, ?int $rating, int $page): array
{
    $pageSize = 25;
    $page = max($page, 1);
    $where = [];
    $params = [];
    if ($status) { $where[] = 'r.status = ?'; $params[] = $status; }
    if ($rating && $rating >= 1 && $rating <= 5) { $where[] = 'r.rating = ?'; $params[] = $rating; }
    $cond = $where ? 'WHERE ' . implode(' AND ', $where) : '';
    $rows = all(
        "SELECT r.id, r.rating, r.comment, r.display_name, r.status, r.hidden_reason, r.staff_reply, r.created_at, r.updated_at, r.order_id,
                o.reference AS order_reference, i.product_name_ar, i.product_name_en, i.package_label_ar, i.package_label_en
           FROM reviews r INNER JOIN order_items i ON i.id = r.order_item_id INNER JOIN orders o ON o.id = r.order_id
          $cond ORDER BY r.created_at DESC LIMIT ? OFFSET ?",
        [...$params, $pageSize, ($page - 1) * $pageSize],
    );
    $total = (int) val("SELECT COUNT(*) FROM reviews r $cond", $params);
    return ['rows' => $rows, 'total' => $total, 'page' => $page, 'pages' => max(1, (int) ceil($total / $pageSize))];
}

function set_review_status(int $id, string $status, string $reason, array $actor): void
{
    if ($status === 'hidden' && trim_js($reason) === '') throw new ServiceError('reasonRequired');
    $row = one('SELECT id, rating FROM reviews WHERE id = ?', [$id]);
    if (!$row) throw new ServiceError('notFound');
    update('reviews', ['status' => $status, 'hidden_reason' => $status === 'hidden' ? trim_js($reason) : null], 'id = ?', [$id]);
    audit($actor, $status === 'hidden' ? 'review.hide' : 'review.publish', 'review', $id, ['rating' => (int) $row['rating'], 'reason' => trim_js($reason) ?: null]);
}

function reply_to_review(int $id, string $reply, array $actor): void
{
    $text = trim_js($reply);
    if (!one('SELECT id FROM reviews WHERE id = ?', [$id])) throw new ServiceError('notFound');
    update('reviews', ['staff_reply' => $text ?: null, 'staff_reply_at' => $text ? now_db() : null], 'id = ?', [$id]);
    audit($actor, 'review.reply', 'review', $id, ['removed' => $text === '' ? true : null]);
}

/** Real numbers for the home page: completed orders and the overall published rating. */
function store_stats(): array
{
    $row = one("SELECT (SELECT COUNT(*) FROM orders WHERE status = 'completed') AS completed,
                       (SELECT ROUND(AVG(rating), 1) FROM reviews WHERE status = 'published') AS rating,
                       (SELECT COUNT(*) FROM reviews WHERE status = 'published') AS reviews");
    return ['completed' => (int) $row['completed'], 'rating' => $row['rating'] !== null ? (float) $row['rating'] : null, 'reviews' => (int) $row['reviews']];
}
