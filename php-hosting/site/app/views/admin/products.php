<?php
declare(strict_types=1);

require_once __DIR__ . '/common.php';

function page_admin_products(array $params): array
{
    $l = loc();
    $t = T();
    $user = require_staff_page($l, 'products:write');
    $search = query('q') !== null ? js_slice(query('q'), 80) : null;
    $r = admin_list_products((string) $search, page_number(query('page')));
    $p = $t['admin']['productsPage'];
    $h = admin_title($t['admin']['products'], null, button_link(lp('/admin/products/new'), icon('plus', 'size-4') . ' ' . e($p['new']), 'primary', 'sm'));
    $h .= '<form method="get" class="mb-4 flex gap-2">' . input_tag(['name' => 'q', 'value' => $search, 'placeholder' => $t['common']['search'], 'maxlength' => '80', 'aria-label' => $t['common']['search']], 'max-w-xs')
        . '<button class="' . button_class('secondary', 'md') . '" type="submit">' . e($t['common']['search']) . '</button></form>';
    if (!$r['rows']) $h .= empty_state($p['empty']);
    else {
        $h .= card_open('overflow-x-auto') . '<table class="w-full min-w-[40rem] text-sm"><thead class="border-b border-line text-xs text-fg-subtle"><tr>';
        foreach ([$p['nameAr'], $p['category'], $p['price'], $p['status']] as $th) $h .= '<th class="px-4 py-3 text-start font-semibold">' . e($th) . '</th>';
        $h .= '</tr></thead><tbody class="divide-y divide-line">';
        foreach ($r['rows'] as $row) {
            $price = $row['pricing_mode'] === 'package' ? $row['package_count'] . ' ×' : ($row['unit_price'] !== null ? format_iqd((int) $row['unit_price'], $l) : '—');
            $h .= '<tr class="hover:bg-muted"><td class="px-4 py-3"><a href="' . e(lp('/admin/products/' . $row['id'])) . '" class="font-bold text-brand hover:underline">' . e(L($row, 'name', $l)) . '</a><span class="ltr-nums block text-xs text-fg-subtle" dir="ltr">/' . e($row['slug']) . '</span></td>'
                . '<td class="px-4 py-3">' . e(L($row, 'category_name', $l)) . '</td><td class="ltr-nums px-4 py-3" dir="ltr">' . e($price) . '</td><td class="px-4 py-3"><span class="flex flex-wrap gap-1">'
                . badge(e($row['is_active'] ? $t['common']['active'] : $t['common']['inactive']), $row['is_active'] ? 'success' : 'neutral')
                . ($row['is_featured'] ? badge(e($p['featured']), 'brand') : '') . ($row['is_sample'] ? badge(e($t['common']['sample']), 'warning') : '') . '</span></td></tr>';
        }
        $h .= '</tbody></table></div>';
    }
    $h .= pagination($r['page'], $r['pages'], lp('/admin/products'), ['q' => $search]);
    return admin_page($user, $t['admin']['products'], $h);
}

function page_admin_product_new(array $params): array
{
    $l = loc();
    $t = T();
    $user = require_staff_page($l, 'products:write');
    return admin_page($user, $t['admin']['productsPage']['newTitle'], admin_title($t['admin']['productsPage']['newTitle']) . product_form(list_categories()));
}

function page_admin_product(array $params): array
{
    $l = loc();
    $t = T();
    $user = require_staff_page($l, 'products:write');
    $id = int_or_null($params['id']);
    if ($id === null) not_found();
    $product = admin_get_product($id);
    if (!$product) not_found();
    $name = L($product, 'name', $l);
    $view = $product['is_active'] ? button_link(lp('/services/' . $product['slug']), icon('external', 'size-4') . ' ' . e($t['admin']['viewStore']), 'outline', 'sm', null, ' target="_blank"') : '';
    $h = admin_title($name, null, $view);
    if (query('saved') === '1') $h .= alert('success', $t['common']['saved'], null, 'mb-4');
    $h .= product_form(list_categories(), $product);
    $p = $t['admin']['productsPage'];
    $h .= card_open('mt-8 border-danger/40') . card_header($t['common']['delete'], $p['deleteConfirm'])
        . action_form('admin.deleteProduct', hidden('id', $product['id']) . submit_button(icon('trash', 'size-4') . ' ' . e($t['common']['delete']), ['variant' => 'danger', 'confirm' => $p['deleteConfirm']]), 'p-5') . '</div>';
    return admin_page($user, $name, $h);
}

function product_form(array $categories, ?array $product = null): string
{
    $l = loc();
    $t = T();
    $p = $t['admin']['productsPage'];
    $v = fn(string $k, $d = '') => $product[$k] ?? $d;
    $lbl = fn(string $label, string $control, ?string $hint = null, ?string $class = null) => '<label class="block text-sm font-semibold ' . ($class ?? '') . '"><span class="mb-1 block">' . e($label) . '</span>' . $control . ($hint ? '<span class="mt-1 block text-xs font-normal text-fg-subtle">' . e($hint) . '</span>' : '') . '</label>';
    $labels = [
        'categoryId' => $p['category'], 'slug' => $p['slug'], 'nameAr' => $p['nameAr'], 'nameEn' => $p['nameEn'], 'unitPrice' => $p['unitPrice'],
        'compareAtPrice' => $p['compareAtPrice'], 'minQuantity' => $p['minQuantity'], 'maxQuantity' => $p['maxQuantity'],
        'packages' => $p['packages'], 'tiers' => $p['tiers'], 'fields' => $p['fields'], 'image' => $p['image'],
    ];
    $catOpts = [];
    foreach ($categories as $c) $catOpts[$c['id']] = L($c, 'name', $l);
    $icons = array_combine(data_file('icons.json')['catalog'], data_file('icons.json')['catalog']);
    $check = fn(string $name, bool $on, string $label) => checkbox_tag(['name' => $name, 'checked' => $on], e($label));

    $h = ($product ? hidden('id', $product['id']) : '');
    $h .= card_open() . card_header($product ? $p['editTitle'] : $p['newTitle']) . '<div class="grid gap-4 p-5 sm:grid-cols-2">';
    $h .= $lbl($p['nameAr'], input_tag(['name' => 'nameAr', 'value' => $v('name_ar'), 'required' => true, 'maxlength' => '120', 'dir' => 'rtl']));
    $h .= $lbl($p['nameEn'], input_tag(['name' => 'nameEn', 'value' => $v('name_en'), 'required' => true, 'maxlength' => '120', 'dir' => 'ltr']));
    $h .= $lbl($p['slug'], input_tag(['name' => 'slug', 'value' => $v('slug'), 'required' => true, 'pattern' => '[a-z0-9]+(-[a-z0-9]+)*', 'maxlength' => '80', 'dir' => 'ltr']), $p['slugHint']);
    $h .= $lbl($p['category'], select_tag(['name' => 'categoryId', 'required' => true], $catOpts, $product ? (string) $product['category_id'] : null));
    $h .= $lbl($p['summaryAr'], input_tag(['name' => 'summaryAr', 'value' => $v('summary_ar'), 'maxlength' => '300', 'dir' => 'rtl']));
    $h .= $lbl($p['summaryEn'], input_tag(['name' => 'summaryEn', 'value' => $v('summary_en'), 'maxlength' => '300', 'dir' => 'ltr']));
    $h .= $lbl($p['descriptionAr'], textarea_tag(['name' => 'descriptionAr', 'maxlength' => '5000', 'rows' => '5', 'dir' => 'rtl'], (string) $v('description_ar')));
    $h .= $lbl($p['descriptionEn'], textarea_tag(['name' => 'descriptionEn', 'maxlength' => '5000', 'rows' => '5', 'dir' => 'ltr'], (string) $v('description_en')));
    $h .= $lbl($p['deliveryAr'], input_tag(['name' => 'deliveryTimeAr', 'value' => $v('delivery_time_ar'), 'maxlength' => '120', 'dir' => 'rtl']));
    $h .= $lbl($p['deliveryEn'], input_tag(['name' => 'deliveryTimeEn', 'value' => $v('delivery_time_en'), 'maxlength' => '120', 'dir' => 'ltr']));
    $h .= $lbl($p['icon'], select_tag(['name' => 'icon'], $icons, (string) $v('icon', 'spark')));
    $h .= $lbl($p['sortOrder'], input_tag(['name' => 'sortOrder', 'type' => 'number', 'value' => (string) $v('sort_order', 0), 'dir' => 'ltr']));
    $h .= $lbl($p['image'], '<input name="image" type="file" accept="image/jpeg,image/png,image/webp" class="block w-full text-sm file:me-3 file:rounded-lg file:border-0 file:bg-brand-soft file:px-3 file:py-2 file:font-semibold file:text-brand-soft-fg">', null, 'sm:col-span-2');
    if ($product && $product['image_file_id']) {
        $h .= '<div class="flex items-center gap-3 sm:col-span-2"><img src="' . e(file_url($product['image_file_id'])) . '" alt="" class="size-16 rounded-xl object-cover">' . $check('removeImage', false, $p['removeImage']) . '</div>';
    }
    $h .= '<div class="flex flex-wrap gap-5 sm:col-span-2">' . $check('isActive', $product ? (bool) $product['is_active'] : true, $p['active'])
        . $check('isFeatured', $product ? (bool) $product['is_featured'] : false, $p['featured']) . $check('isSample', $product ? (bool) $product['is_sample'] : false, $p['sample']) . '</div></div></div>';

    $h .= card_open() . card_header($p['pricingMode']) . '<div class="grid gap-4 p-5 sm:grid-cols-2">';
    $h .= $lbl($p['pricingMode'], select_tag(['name' => 'pricingMode'], ['unit' => $p['modeUnit'], 'package' => $p['modePackage']], (string) $v('pricing_mode', 'unit')), null, 'sm:col-span-2');
    $num = fn(string $name, $value, int $min) => input_tag(['name' => $name, 'type' => 'number', 'min' => (string) $min, 'value' => $value === null ? '' : (string) $value, 'dir' => 'ltr']);
    $h .= $lbl($p['unitPrice'], $num('unitPrice', $product['unit_price'] ?? null, 0));
    $h .= $lbl($p['compareAtPrice'], $num('compareAtPrice', $product['compare_at_price'] ?? null, 0));
    $h .= $lbl($p['minQuantity'], $num('minQuantity', $product['min_quantity'] ?? 1, 1));
    $h .= $lbl($p['maxQuantity'], $num('maxQuantity', $product['max_quantity'] ?? null, 1));
    $h .= $lbl($p['packages'], textarea_tag(['name' => 'packages', 'rows' => '4', 'dir' => 'auto', 'placeholder' => '60 شدة | 60 UC | 1500'], $product ? serialize_packages($product['packages']) : '', 'font-mono text-sm'), $p['packagesHint'], 'sm:col-span-2');
    $h .= $lbl($p['tiers'], textarea_tag(['name' => 'tiers', 'rows' => '3', 'dir' => 'ltr', 'placeholder' => '1000 | 8'], $product ? serialize_tiers($product['tiers']) : '', 'font-mono text-sm'), $p['tiersHint'], 'sm:col-span-2');
    $h .= '</div></div>';

    $h .= card_open() . card_header($p['fields']) . '<div class="space-y-3 p-5">' . alert('warning', null, e($p['fieldsWarning']))
        . $lbl($p['fields'], textarea_tag(['name' => 'fields', 'rows' => '5', 'dir' => 'auto', 'placeholder' => 'player_id | رقم اللاعب | Player ID | number | required'], $product ? serialize_fields(array_map('field_def', $product['fields'])) : '', 'font-mono text-sm'), $p['fieldsHint'])
        . '</div></div>';
    $h .= submit_button(e($t['common']['save']), ['size' => 'lg', 'pending' => $t['common']['saving']]);
    return action_form('admin.saveProduct', $h, 'space-y-6', $labels);
}
