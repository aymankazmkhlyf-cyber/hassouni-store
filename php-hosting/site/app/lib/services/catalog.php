<?php
/* Storefront catalog queries: categories, product cards, product detail, pricing data. */

declare(strict_types=1);

/** "From" price computed in SQL so listings can sort by it. */
const STARTING_PRICE_SQL = "(CASE p.pricing_mode
  WHEN 'unit' THEN p.min_quantity * COALESCE(
    (SELECT t.unit_price FROM price_tiers t WHERE t.product_id = p.id AND t.min_quantity <= p.min_quantity ORDER BY t.min_quantity DESC LIMIT 1), p.unit_price)
  ELSE (SELECT MIN(pp.price) FROM product_packages pp WHERE pp.product_id = p.id AND pp.is_active = 1)
END)";

/** A genuine configured discount: a compare-at price strictly above the current price. */
const HAS_OFFER_SQL = "(
  (p.pricing_mode = 'unit' AND p.compare_at_price IS NOT NULL AND p.compare_at_price > p.unit_price)
  OR EXISTS (SELECT 1 FROM product_packages pp WHERE pp.product_id = p.id AND pp.is_active = 1
             AND pp.compare_at_price IS NOT NULL AND pp.compare_at_price > pp.price)
)";

const CARD_COLUMNS = "p.id, p.slug, p.name_ar, p.name_en, p.summary_ar, p.summary_en, p.icon, p.image_file_id, p.is_sample, p.is_featured,
  " . STARTING_PRICE_SQL . " AS starting_price, p.compare_at_price, " . HAS_OFFER_SQL . " AS has_offer, p.pricing_mode,
  c.slug AS category_slug, c.name_ar AS category_name_ar, c.name_en AS category_name_en,
  (SELECT ROUND(AVG(r.rating), 1) FROM reviews r WHERE r.product_id = p.id AND r.status = 'published') AS rating_avg,
  (SELECT COUNT(*) FROM reviews r WHERE r.product_id = p.id AND r.status = 'published') AS rating_count";

function list_categories(bool $activeOnly = false): array
{
    $count = $activeOnly ? 'COUNT(CASE WHEN p.is_active = 1 THEN p.id END)' : 'COUNT(p.id)';
    return all(
        "SELECT c.id, c.slug, c.name_ar, c.name_en, c.description_ar, c.description_en, c.icon, c.sort_order, c.is_active, $count AS product_count
           FROM categories c LEFT JOIN products p ON p.category_id = c.id
          " . ($activeOnly ? 'WHERE c.is_active = 1' : '') . '
          GROUP BY c.id, c.slug, c.name_ar, c.name_en, c.description_ar, c.description_en, c.icon, c.sort_order, c.is_active
          ORDER BY c.sort_order ASC, c.id ASC',
    );
}

function get_active_category_by_slug(string $slug): ?array
{
    return one('SELECT * FROM categories WHERE slug = ? AND is_active = 1', [$slug]);
}

function card_row(array $r): array
{
    $r['starting_price'] = $r['starting_price'] === null ? null : (int) $r['starting_price'];
    $r['rating_avg'] = $r['rating_avg'] === null ? null : (float) $r['rating_avg'];
    $r['rating_count'] = (int) $r['rating_count'];
    $r['has_offer'] = (bool) $r['has_offer'];
    return $r;
}

/**
 * Options: category_id, q, featured_only, offers_only, sort (featured|price_asc|price_desc|newest), page, page_size, exclude_id.
 */
function list_products(array $o = []): array
{
    $pageSize = min(max((int) ($o['page_size'] ?? 12), 1), 48);
    $page = max((int) ($o['page'] ?? 1), 1);
    $where = ['p.is_active = 1', 'c.is_active = 1'];
    $params = [];
    if (!empty($o['category_id'])) { $where[] = 'p.category_id = ?'; $params[] = (int) $o['category_id']; }
    if (!empty($o['featured_only'])) $where[] = 'p.is_featured = 1';
    if (!empty($o['offers_only'])) $where[] = HAS_OFFER_SQL;
    if (!empty($o['exclude_id'])) { $where[] = 'p.id <> ?'; $params[] = (int) $o['exclude_id']; }
    $q = mb_substr(trim_js((string) ($o['q'] ?? '')), 0, 80);
    if ($q !== '') {
        $pattern = '%' . escape_like($q) . '%';
        $where[] = '(p.name_ar LIKE ? OR p.name_en LIKE ? OR p.summary_ar LIKE ? OR p.summary_en LIKE ? OR c.name_ar LIKE ? OR c.name_en LIKE ?)';
        array_push($params, $pattern, $pattern, $pattern, $pattern, $pattern, $pattern);
    }
    $cond = implode(' AND ', $where);
    $order = match ($o['sort'] ?? 'featured') {
        'price_asc' => '(starting_price IS NULL) ASC, starting_price ASC, p.id ASC',
        'price_desc' => '(starting_price IS NULL) ASC, starting_price DESC, p.id ASC',
        'newest' => 'p.created_at DESC, p.id DESC',
        default => 'p.is_featured DESC, c.sort_order ASC, p.sort_order ASC, p.id ASC',
    };
    $items = all(
        'SELECT ' . CARD_COLUMNS . " FROM products p INNER JOIN categories c ON c.id = p.category_id WHERE $cond ORDER BY $order LIMIT ? OFFSET ?",
        [...$params, $pageSize, ($page - 1) * $pageSize],
    );
    $total = (int) val("SELECT COUNT(*) FROM products p INNER JOIN categories c ON c.id = p.category_id WHERE $cond", $params);
    return [
        'items' => array_map('card_row', $items),
        'total' => $total,
        'page' => $page,
        'page_size' => $pageSize,
        'pages' => max(1, (int) ceil($total / $pageSize)),
    ];
}

/** Packages, tiers and fields for a set of product ids, grouped by product id. */
function product_children(array $ids, bool $activePackagesOnly = false): array
{
    $out = [];
    foreach ($ids as $id) $out[(int) $id] = ['packages' => [], 'tiers' => [], 'fields' => []];
    if (!$ids) return $out;
    $in = placeholders($ids);
    $pk = all("SELECT * FROM product_packages WHERE product_id IN ($in)" . ($activePackagesOnly ? ' AND is_active = 1' : '') . ' ORDER BY sort_order ASC, price ASC, id ASC', $ids);
    foreach ($pk as $r) $out[(int) $r['product_id']]['packages'][] = $r;
    foreach (all("SELECT * FROM price_tiers WHERE product_id IN ($in) ORDER BY min_quantity ASC", $ids) as $r) $out[(int) $r['product_id']]['tiers'][] = $r;
    foreach (all("SELECT * FROM product_fields WHERE product_id IN ($in) ORDER BY sort_order ASC, id ASC", $ids) as $r) {
        $r['options'] = json_col($r['options'], []);
        $out[(int) $r['product_id']]['fields'][] = $r;
    }
    return $out;
}

/** Storefront product detail; null when the product or its category is inactive. */
function get_product_detail(string $slug): ?array
{
    $p = one(
        'SELECT p.*, c.slug AS category_slug, c.name_ar AS category_name_ar, c.name_en AS category_name_en, c.is_active AS category_active
           FROM products p INNER JOIN categories c ON c.id = p.category_id WHERE p.slug = ? AND p.is_active = 1',
        [$slug],
    );
    if (!$p || !$p['category_active']) return null;
    return $p + product_children([$p['id']], true)[(int) $p['id']];
}

/** Everything needed to price a set of products (all packages, tiers, fields). */
function load_pricing_data(array $productIds): array
{
    $ids = array_values(array_unique(array_map('intval', $productIds)));
    if (!$ids) return [];
    $rows = all('SELECT p.*, c.is_active AS category_active FROM products p INNER JOIN categories c ON c.id = p.category_id WHERE p.id IN (' . placeholders($ids) . ')', $ids);
    $children = product_children(array_column($rows, 'id'));
    $out = [];
    foreach ($rows as $r) $out[(int) $r['id']] = $r + $children[(int) $r['id']];
    return $out;
}

/** Product art theme for a slug (original, code-drawn artwork). */
function art_theme(string $slug, ?string $icon = null): array
{
    foreach (data_file('product-art.json') as $t) {
        if (preg_match('/' . str_replace('/', '\/', $t['match']) . '/', $slug)) return $t['theme'];
    }
    return ['bg' => 'linear-gradient(135deg,var(--hero-from),var(--hero-to))', 'label' => '', 'chip' => '', 'icon' => $icon ?: 'spark', 'glow' => '#ffffff'];
}

function product_art(string $slug, ?string $icon = null, string $size = 'card', ?string $class = null): string
{
    $t = art_theme($slug, $icon);
    $hero = $size === 'hero';
    $h = '<div class="' . cn('product-art relative size-full overflow-hidden', $class) . '" style="background:' . e($t['bg']) . '" aria-hidden="true">';
    $h .= '<span class="art-float absolute -top-6 -end-6 size-28 rounded-full opacity-30 blur-md" style="background:' . e($t['glow']) . '"></span>';
    $h .= '<span class="art-float-slow absolute -bottom-8 -start-4 size-32 rounded-full opacity-20 blur-lg" style="background:' . e($t['glow']) . '"></span>';
    $h .= '<span class="absolute inset-0 opacity-[0.12]" style="background-image:radial-gradient(#fff 1px, transparent 1px);background-size:18px 18px"></span>';
    if ($t['label'] !== '') {
        $h .= '<span class="' . cn('absolute start-3 rounded-full bg-black/25 px-2.5 py-1 font-bold tracking-wide text-white ring-1 ring-white/25 backdrop-blur-sm', $hero ? 'top-3 text-sm' : 'bottom-3 text-[0.68rem]') . '"><span dir="ltr">' . e($t['label']) . '</span></span>';
    }
    $h .= '<span class="absolute inset-0 grid place-items-center"><span class="' . cn('art-pop relative grid place-items-center rounded-[1.6rem] bg-white/15 text-white shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)] ring-1 ring-white/30 backdrop-blur-md', $hero ? 'size-32' : 'size-20') . '">';
    $h .= icon($t['icon'], $hero ? 'size-16' : 'size-10');
    if ($t['chip'] !== '') {
        $h .= '<span class="' . cn('absolute -bottom-3 -end-4 rounded-full bg-white px-2.5 py-0.5 font-black text-[#1b1035] shadow-lg', $hero ? 'text-base' : 'text-xs') . '"><span dir="ltr">' . e($t['chip']) . '</span></span>';
    }
    $h .= '</span></span>';
    $h .= '<span class="art-shine pointer-events-none absolute inset-y-0 -start-full w-1/2 skew-x-[-20deg] bg-gradient-to-r from-transparent via-white/35 to-transparent"></span>';
    return $h . '</div>';
}
