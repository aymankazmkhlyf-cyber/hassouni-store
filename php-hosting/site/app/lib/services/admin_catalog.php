<?php
/* Admin: products (with packages, tiers, fields), categories and payment methods. */

declare(strict_types=1);

function admin_list_products(string $q, int $page): array
{
    $pageSize = 25;
    $page = max($page, 1);
    $q = mb_substr(trim_js($q), 0, 80);
    $where = '';
    $params = [];
    if ($q !== '') {
        $pattern = '%' . escape_like($q) . '%';
        $where = 'WHERE (p.name_ar LIKE ? OR p.name_en LIKE ? OR p.slug LIKE ?)';
        $params = [$pattern, $pattern, $pattern];
    }
    $rows = all(
        "SELECT p.id, p.slug, p.name_ar, p.name_en, p.pricing_mode, p.unit_price, p.is_active, p.is_featured, p.is_sample,
                c.name_ar AS category_name_ar, c.name_en AS category_name_en,
                (SELECT COUNT(*) FROM product_packages pp WHERE pp.product_id = p.id) AS package_count
           FROM products p INNER JOIN categories c ON c.id = p.category_id $where
          ORDER BY c.sort_order ASC, p.sort_order ASC, p.id ASC LIMIT ? OFFSET ?",
        [...$params, $pageSize, ($page - 1) * $pageSize],
    );
    $total = (int) val("SELECT COUNT(*) FROM products p $where", $params);
    return ['rows' => $rows, 'page' => $page, 'pages' => max(1, (int) ceil($total / $pageSize))];
}

function admin_get_product(int $id): ?array
{
    $p = one('SELECT * FROM products WHERE id = ?', [$id]);
    if (!$p) return null;
    $c = product_children([$id]);
    $p['packages'] = all('SELECT * FROM product_packages WHERE product_id = ? ORDER BY sort_order ASC, id ASC', [$id]);
    $p['tiers'] = $c[$id]['tiers'];
    $p['fields'] = $c[$id]['fields'];
    return $p;
}

/**
 * Creates or updates a product with its packages, tiers and fields in one transaction.
 * Packages are updated in place by position so existing order-item links survive edits.
 * Returns ['ok' => true, 'id'] or ['ok' => false, 'error' => ['field', 'line'?, 'reason']].
 */
function save_product(?int $id, array $in, ?string $imageFileId, bool $removeImage, array $actor): array
{
    $pk = parse_packages($in['packages']);
    if (!$pk['ok']) return ['ok' => false, 'error' => ['field' => 'packages', 'line' => $pk['line'], 'reason' => $pk['reason']]];
    $tiers = parse_tiers($in['tiers']);
    if (!$tiers['ok']) return ['ok' => false, 'error' => ['field' => 'tiers', 'line' => $tiers['line'], 'reason' => $tiers['reason']]];
    $fields = parse_fields($in['fields']);
    if (!$fields['ok']) return ['ok' => false, 'error' => ['field' => 'fields', 'line' => $fields['line'], 'reason' => $fields['reason']]];
    if ($in['pricingMode'] === 'package' && !$pk['value']) return ['ok' => false, 'error' => ['field' => 'packages', 'reason' => 'required']];

    return tx(function () use ($id, $in, $imageFileId, $removeImage, $actor, $pk, $tiers, $fields) {
        if (!one('SELECT id FROM categories WHERE id = ?', [$in['categoryId']])) return ['ok' => false, 'error' => ['field' => 'categoryId', 'reason' => 'missing']];
        $clash = one('SELECT id FROM products WHERE slug = ?', [$in['slug']]);
        if ($clash && (int) $clash['id'] !== $id) return ['ok' => false, 'error' => ['field' => 'slug', 'reason' => 'taken']];

        $unit = $in['pricingMode'] === 'unit';
        $values = [
            'category_id' => $in['categoryId'],
            'slug' => $in['slug'],
            'name_ar' => $in['nameAr'],
            'name_en' => $in['nameEn'],
            'summary_ar' => $in['summaryAr'],
            'summary_en' => $in['summaryEn'],
            'description_ar' => $in['descriptionAr'],
            'description_en' => $in['descriptionEn'],
            'icon' => $in['icon'],
            'pricing_mode' => $in['pricingMode'],
            'unit_price' => $in['unitPrice'],
            'compare_at_price' => $unit ? $in['compareAtPrice'] : null,
            'min_quantity' => $unit ? $in['minQuantity'] : 1,
            'max_quantity' => $in['maxQuantity'],
            'delivery_time_ar' => $in['deliveryTimeAr'],
            'delivery_time_en' => $in['deliveryTimeEn'],
            'is_active' => $in['isActive'],
            'is_featured' => $in['isFeatured'],
            'is_sample' => $in['isSample'],
            'sort_order' => $in['sortOrder'],
        ];
        if ($imageFileId) $values['image_file_id'] = $imageFileId;
        elseif ($removeImage) $values['image_file_id'] = null;

        if ($id === null) {
            $productId = insert('products', $values + ['created_at' => now_db(), 'updated_at' => now_db()]);
        } else {
            if (!one('SELECT id FROM products WHERE id = ?', [$id])) throw new ServiceError('notFound');
            update('products', $values, 'id = ?', [$id]);
            $productId = $id;
        }

        // Packages: update by position, insert extras, delete leftovers (order items keep snapshots).
        $existing = array_column(all('SELECT id FROM product_packages WHERE product_id = ? ORDER BY sort_order ASC, id ASC', [$productId]), 'id');
        foreach ($pk['value'] as $i => $p) {
            $row = ['label_ar' => $p['labelAr'], 'label_en' => $p['labelEn'], 'price' => $p['price'], 'compare_at_price' => $p['compareAtPrice'], 'sort_order' => $i, 'is_active' => true];
            if (isset($existing[$i])) update('product_packages', $row, 'id = ?', [$existing[$i]]);
            else insert('product_packages', $row + ['product_id' => $productId]);
        }
        foreach (array_slice($existing, count($pk['value'])) as $leftover) q('DELETE FROM product_packages WHERE id = ?', [$leftover]);

        q('DELETE FROM price_tiers WHERE product_id = ?', [$productId]);
        if ($unit) foreach ($tiers['value'] as $t) insert('price_tiers', ['product_id' => $productId, 'min_quantity' => $t['minQuantity'], 'unit_price' => $t['unitPrice']]);

        q('DELETE FROM product_fields WHERE product_id = ?', [$productId]);
        foreach ($fields['value'] as $i => $f) {
            insert('product_fields', [
                'product_id' => $productId, 'key' => $f['key'], 'label_ar' => $f['labelAr'], 'label_en' => $f['labelEn'], 'help_ar' => '', 'help_en' => '',
                'type' => $f['type'], 'required' => $f['required'], 'max_length' => $f['maxLength'], 'options' => json_out($f['options']), 'sort_order' => $i,
            ]);
        }
        audit($actor, $id === null ? 'product.create' : 'product.update', 'product', $productId, ['slug' => $in['slug']]);
        return ['ok' => true, 'id' => $productId];
    });
}

/** Deletes a product, or deactivates it when historical orders reference it. */
function delete_product(int $id, array $actor): string
{
    return tx(function () use ($id, $actor) {
        if ((int) val('SELECT COUNT(*) FROM order_items WHERE product_id = ?', [$id]) > 0) {
            update('products', ['is_active' => false, 'is_featured' => false], 'id = ?', [$id]);
            audit($actor, 'product.deactivate', 'product', $id);
            return 'deactivated';
        }
        // Reviews reference products with ON DELETE SET NULL; packages/tiers/fields cascade.
        q('DELETE FROM products WHERE id = ?', [$id]);
        audit($actor, 'product.delete', 'product', $id);
        return 'deleted';
    });
}

function save_category(?int $id, array $in, array $actor): array
{
    return tx(function () use ($id, $in, $actor) {
        $clash = one('SELECT id FROM categories WHERE slug = ?', [$in['slug']]);
        if ($clash && (int) $clash['id'] !== $id) return ['ok' => false, 'error' => 'slug'];
        $row = [
            'slug' => $in['slug'], 'name_ar' => $in['nameAr'], 'name_en' => $in['nameEn'], 'description_ar' => $in['descriptionAr'],
            'description_en' => $in['descriptionEn'], 'icon' => $in['icon'], 'sort_order' => $in['sortOrder'], 'is_active' => $in['isActive'],
        ];
        if ($id === null) {
            $newId = insert('categories', $row + ['created_at' => now_db(), 'updated_at' => now_db()]);
            audit($actor, 'category.create', 'category', $newId, ['slug' => $in['slug']]);
            return ['ok' => true, 'id' => $newId];
        }
        if (!one('SELECT id FROM categories WHERE id = ?', [$id])) throw new ServiceError('notFound');
        update('categories', $row, 'id = ?', [$id]);
        audit($actor, 'category.update', 'category', $id, ['slug' => $in['slug'], 'isActive' => $in['isActive']]);
        return ['ok' => true, 'id' => $id];
    });
}

/** Swaps sort order with the neighbouring category. */
function move_category(int $id, string $direction, array $actor): void
{
    tx(function () use ($id, $direction, $actor) {
        $order = array_map('intval', array_column(all('SELECT id FROM categories ORDER BY sort_order ASC, id ASC'), 'id'));
        $idx = array_search($id, $order, true);
        if ($idx === false) return;
        $swap = $direction === 'up' ? $idx - 1 : $idx + 1;
        if ($swap < 0 || $swap >= count($order)) return;
        [$order[$idx], $order[$swap]] = [$order[$swap], $order[$idx]];
        foreach ($order as $i => $cid) update('categories', ['sort_order' => $i * 10], 'id = ?', [$cid]);
        audit($actor, 'category.reorder', 'category', $id, ['direction' => $direction]);
    });
}

function delete_category(int $id, array $actor): string
{
    return tx(function () use ($id, $actor) {
        if ((int) val('SELECT COUNT(*) FROM products WHERE category_id = ?', [$id]) > 0) return 'has_products';
        q('DELETE FROM categories WHERE id = ?', [$id]);
        audit($actor, 'category.delete', 'category', $id);
        return 'deleted';
    });
}

function list_payment_methods(bool $enabledOnly = false): array
{
    return all('SELECT * FROM payment_methods' . ($enabledOnly ? ' WHERE is_enabled = 1' : '') . ' ORDER BY sort_order ASC, id ASC');
}

function update_payment_method(int $id, array $in, array $actor, ?string $qrFileId, bool $removeQr): void
{
    $current = one('SELECT qr_file_id FROM payment_methods WHERE id = ?', [$id]);
    if (!$current) throw new ServiceError('notFound');
    $qr = $qrFileId ?? ($removeQr ? null : $current['qr_file_id']);
    update('payment_methods', [
        'name_ar' => $in['nameAr'], 'name_en' => $in['nameEn'], 'instructions_ar' => $in['instructionsAr'], 'instructions_en' => $in['instructionsEn'],
        'account_details' => $in['accountDetails'], 'requires_reference' => $in['requiresReference'], 'allows_receipt' => $in['allowsReceipt'],
        'is_enabled' => $in['isEnabled'], 'sort_order' => $in['sortOrder'], 'qr_file_id' => $qr,
    ], 'id = ?', [$id]);
    if ($current['qr_file_id'] && $current['qr_file_id'] !== $qr) delete_file($current['qr_file_id']);
    $code = val('SELECT code FROM payment_methods WHERE id = ?', [$id]);
    audit($actor, 'payment_method.update', 'payment_method', $id, ['code' => $code, 'enabled' => $in['isEnabled']]);
}
