<?php
declare(strict_types=1);

function page_services(array $params): array
{
    $t = T();
    $categories = list_categories(true);
    $slug = query('category');
    $category = null;
    foreach ($categories as $c) if ($c['slug'] === $slug) $category = $c;
    $sort = parse_sort(query('sort'));
    $result = list_products(['category_id' => $category['id'] ?? null, 'sort' => $sort, 'page' => page_number(query('page'))]);
    $h = page_header($t['shop']['title'], $t['shop']['subtitle']) . '<div class="mx-auto max-w-6xl px-4 py-8">';
    $h .= catalog_filters(lp('/services'), $sort, $categories, $category['slug'] ?? null);
    $h .= $result['items'] ? product_grid($result['items']) : empty_state($t['shop']['empty']);
    $h .= pagination($result['page'], $result['pages'], lp('/services'), ['category' => $category['slug'] ?? null, 'sort' => $sort]);
    return ['title' => $t['shop']['title'], 'html' => $h . '</div>'];
}
