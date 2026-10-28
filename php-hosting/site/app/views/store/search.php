<?php
declare(strict_types=1);

function page_search(array $params): array
{
    $t = T();
    $q = mb_substr(trim_js((string) query('q')), 0, 80);
    $result = $q !== '' ? list_products(['q' => $q, 'page' => page_number(query('page'))]) : null;
    $h = page_header($q !== '' ? fmt($t['shop']['searchFor'], ['q' => $q]) : $t['shop']['searchTitle'], $result ? fmt($t['shop']['resultsCount'], ['count' => $result['total']]) : $t['shop']['searchHint']);
    $h .= '<div class="mx-auto max-w-6xl px-4 py-8"><form action="' . e(lp('/search')) . '" method="get" role="search" class="mb-8 flex gap-2"><label for="q" class="sr-only">' . e($t['nav']['search']) . '</label>';
    $h .= input_tag(['id' => 'q', 'name' => 'q', 'type' => 'search', 'value' => $q, 'maxlength' => '80', 'placeholder' => $t['nav']['searchPlaceholder'], 'autofocus' => $q === ''], 'flex-1');
    $h .= '<button type="submit" class="' . button_class('primary', 'md') . '">' . e($t['common']['search']) . '</button></form>';
    if ($result) {
        $h .= $result['items'] ? product_grid($result['items']) : empty_state($t['common']['noResults'], $t['shop']['searchEmpty'], '', 'search');
        $h .= pagination($result['page'], $result['pages'], lp('/search'), ['q' => $q]);
    }
    return ['title' => $t['shop']['searchTitle'], 'noindex' => true, 'html' => $h . '</div>'];
}
