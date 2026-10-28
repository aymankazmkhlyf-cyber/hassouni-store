<?php
declare(strict_types=1);

function page_category(array $params): array
{
    $l = loc();
    $t = T();
    $category = get_active_category_by_slug($params['slug']);
    if (!$category) not_found();
    $sort = parse_sort(query('sort'));
    $result = list_products(['category_id' => $category['id'], 'sort' => $sort, 'page' => page_number(query('page'))]);
    $name = L($category, 'name', $l);
    $desc = L($category, 'description', $l);
    $isCustom = $category['slug'] === 'custom';
    // Categories handled on request (no fixed-price products yet) link straight to a prefilled request.
    $requestType = ['balance-exchange' => 'exchange', 'accounts-numbers' => 'accounts', 'subscriptions' => 'subscription', 'gaming' => 'gaming', 'design' => 'design', 'social-media' => 'social'];
    $requestHref = lp('/custom-request') . (isset($requestType[$category['slug']]) ? '?type=' . $requestType[$category['slug']] : '');

    $h = page_header($name, $desc, breadcrumbs([[$t['nav']['home'], lp('')], [$t['nav']['services'], lp('/services')], [$name, null]]));
    $h .= '<div class="mx-auto max-w-6xl px-4 py-8">';
    if ($isCustom) $h .= '<div class="mb-8">' . empty_state($t['custom']['title'], $t['custom']['body'], button_link($requestHref, e($t['nav']['customRequest'])), 'wand') . '</div>';
    if ($result['items']) {
        $h .= catalog_filters(lp('/category/' . $category['slug']), $sort) . product_grid($result['items']);
    } elseif (!$isCustom) {
        $h .= empty_state($name, $desc, button_link($requestHref, e($t['nav']['customRequest'])), $category['icon']);
    }
    $h .= pagination($result['page'], $result['pages'], lp('/category/' . $category['slug']), ['sort' => $sort]);
    return ['title' => $name, 'description' => $desc, 'html' => $h . '</div>'];
}
