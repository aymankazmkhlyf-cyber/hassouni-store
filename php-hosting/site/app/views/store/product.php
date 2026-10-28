<?php
declare(strict_types=1);

function page_product(array $params): array
{
    $l = loc();
    $t = T();
    $product = get_product_detail($params['slug']);
    if (!$product) not_found();
    $name = L($product, 'name', $l);
    $categoryName = L($product, 'category_name', $l);
    $delivery = L($product, 'delivery_time', $l);
    $summary = L($product, 'summary', $l);
    $description = L($product, 'description', $l);
    $related = list_products(['category_id' => $product['category_id'], 'exclude_id' => $product['id'], 'page_size' => 4]);
    $rating = product_rating_summary((int) $product['id']);
    $reviewItems = list_product_reviews((int) $product['id'], 20);

    $forClient = [
        'id' => (int) $product['id'],
        'slug' => $product['slug'],
        'nameAr' => $product['name_ar'],
        'nameEn' => $product['name_en'],
        'pricingMode' => $product['pricing_mode'],
        'unitPrice' => $product['unit_price'] === null ? null : (int) $product['unit_price'],
        'minQuantity' => (int) $product['min_quantity'],
        'maxQuantity' => $product['max_quantity'] === null ? null : (int) $product['max_quantity'],
        'packages' => array_map(fn($p) => ['id' => (int) $p['id'], 'labelAr' => $p['label_ar'], 'labelEn' => $p['label_en'], 'price' => (int) $p['price'], 'compareAtPrice' => $p['compare_at_price'] === null ? null : (int) $p['compare_at_price']], $product['packages']),
        'tiers' => array_map(fn($x) => ['minQuantity' => (int) $x['min_quantity'], 'unitPrice' => (int) $x['unit_price']], $product['tiers']),
        'fields' => array_map('field_def', $product['fields']),
    ];
    $pr = $t['product'];
    $strings = [
        'addToCart' => $pr['addToCart'], 'added' => $pr['added'], 'goToCart' => $pr['goToCart'], 'continueShopping' => $pr['continueShopping'],
        'undo' => $pr['undo'], 'undone' => $pr['undone'], 'inCartNow' => $pr['inCartNow'], 'close' => $pr['close'],
        'quantity' => $product['pricing_mode'] === 'package' ? $pr['quantity'] . ' (' . $pr['package'] . ')' : $pr['quantity'],
        'choosePackage' => $pr['choosePackage'], 'minMax' => $pr['minMax'], 'unitPrice' => $pr['unitPrice'], 'estimatedTotal' => $pr['estimatedTotal'],
        'requiredInfo' => $pr['requiredInfo'], 'noPasswords' => $pr['noPasswords'], 'optional' => $t['common']['optional'],
        'limitReached' => $t['cart']['limitReached'], 'wasPrice' => $pr['wasPrice'], 'errors' => $t['errors'],
    ];

    $h = '<div class="mx-auto max-w-6xl px-4 py-6 sm:py-10">';
    $h .= breadcrumbs([[$t['nav']['home'], lp('')], [$categoryName, lp('/category/' . $product['category_slug'])], [$name, null]]);
    $h .= '<div class="grid gap-8 lg:grid-cols-[1fr_1.1fr]"><div class="space-y-5"><div class="relative aspect-[4/3] overflow-hidden rounded-(--radius-card) bg-muted shadow-soft">';
    $h .= $product['image_file_id']
        ? '<img src="' . e(file_url($product['image_file_id'])) . '" alt="' . e($name) . '" class="size-full object-cover">'
        : '<div class="art-hero size-full">' . product_art($product['slug'], $product['icon'], 'hero') . '</div>';
    $h .= '</div>';
    if ($product['tiers'] && $product['unit_price'] !== null) {
        $h .= '<div class="rounded-(--radius-card) border border-line bg-elevated p-4 shadow-soft"><h2 class="mb-2 text-sm font-bold">' . e($pr['tiers']) . '</h2><ul class="space-y-1 text-sm text-fg-muted">';
        foreach ($product['tiers'] as $tier) $h .= '<li>' . e(fmt($pr['tierRow'], ['min' => num((int) $tier['min_quantity']), 'price' => format_iqd((int) $tier['unit_price'], $l)])) . '</li>';
        $h .= '</ul></div>';
    }
    $h .= '</div><div class="space-y-5"><div><div class="mb-2 flex flex-wrap gap-2">' . badge(e($categoryName), 'brand');
    if ($product['is_sample']) $h .= badge(e($t['common']['sample']), 'warning');
    $h .= '</div><h1 class="text-2xl font-extrabold tracking-tight sm:text-3xl">' . e($name) . '</h1>';
    if ($rating['count']) {
        $avg = number_format($rating['average'], 1, '.', '');
        $h .= '<a href="#reviews" class="mt-2 inline-flex items-center gap-2 text-sm hover:underline">' . stars((float) $rating['average'], fmt($t['reviews']['outOf'], ['avg' => $avg]), 'text-base')
            . '<span class="ltr-nums font-bold">' . $avg . '</span><span class="text-fg-muted">(' . e(fmt($t['reviews']['count'], ['count' => $rating['count']])) . ')</span></a>';
    }
    if ($summary !== '') $h .= '<p class="mt-2 text-fg-muted">' . e($summary) . '</p>';
    $h .= '</div>';
    if ($product['is_sample']) $h .= alert('warning', null, e($t['common']['sampleNote']));
    if ($delivery !== '') $h .= '<p class="flex items-center gap-2 text-sm">' . icon('clock', 'size-5 text-accent') . '<span class="font-semibold">' . e($pr['delivery']) . ':</span> <span class="text-fg-muted">' . e($delivery) . '</span></p>';
    if ($guide = guide_for_product($product['slug'])) $h .= guide_help($guide, $t['guides']['whereToFind'], $t['guides']['readMore']);
    $h .= '<div class="rounded-(--radius-card) border border-line bg-elevated p-4 shadow-soft sm:p-5">'
        . island('AddToCart', ['product' => $forClient, 'locale' => $l, 's' => $strings], '<div class="flex justify-center py-10" role="status">' . spinner('size-6') . '</div>')
        . '</div>';
    if ($description !== '') $h .= '<section class="rounded-(--radius-card) border border-line bg-elevated p-5 shadow-soft"><h2 class="mb-2 font-bold">' . e($pr['description']) . '</h2>' . rich_text($description, 'prose-policy') . '</section>';
    $h .= '</div></div>';
    $h .= product_reviews($rating, $reviewItems);
    if ($related['items']) $h .= '<section class="mt-14"><h2 class="mb-5 text-xl font-extrabold">' . e($pr['related']) . '</h2>' . product_grid($related['items']) . '</section>';
    return ['title' => $name, 'description' => $summary, 'html' => $h . '</div>'];
}
