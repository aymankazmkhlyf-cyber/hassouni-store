<?php
declare(strict_types=1);

require_once __DIR__ . '/common.php';

function category_fields(?array $c = null): string
{
    $t = T();
    $p = $t['admin']['categoriesPage'];
    $f = fn(string $label, string $el) => '<label class="block text-xs font-semibold"><span class="mb-1 block">' . e($label) . '</span>' . $el . '</label>';
    $icons = data_file('icons.json')['catalog'];
    return '<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">'
        . $f($p['nameAr'], input_tag(['name' => 'nameAr', 'value' => $c['name_ar'] ?? null, 'required' => true, 'maxlength' => '80', 'dir' => 'rtl']))
        . $f($p['nameEn'], input_tag(['name' => 'nameEn', 'value' => $c['name_en'] ?? null, 'required' => true, 'maxlength' => '80', 'dir' => 'ltr']))
        . $f($p['slug'], input_tag(['name' => 'slug', 'value' => $c['slug'] ?? null, 'required' => true, 'pattern' => '[a-z0-9]+(-[a-z0-9]+)*', 'maxlength' => '80', 'dir' => 'ltr']))
        . $f($p['descriptionAr'], input_tag(['name' => 'descriptionAr', 'value' => $c['description_ar'] ?? null, 'maxlength' => '500', 'dir' => 'rtl']))
        . $f($p['descriptionEn'], input_tag(['name' => 'descriptionEn', 'value' => $c['description_en'] ?? null, 'maxlength' => '500', 'dir' => 'ltr']))
        . '<div class="grid grid-cols-2 gap-3">' . $f($p['icon'], select_tag(['name' => 'icon'], array_combine($icons, $icons), $c['icon'] ?? 'spark'))
        . $f($p['sortOrder'], input_tag(['name' => 'sortOrder', 'type' => 'number', 'value' => (string) ($c['sort_order'] ?? 0), 'dir' => 'ltr'])) . '</div>'
        . checkbox_tag(['name' => 'isActive', 'checked' => $c ? (bool) $c['is_active'] : true], e($t['common']['active'])) . '</div>';
}

function page_admin_categories(array $params): array
{
    $l = loc();
    $t = T();
    $user = require_staff_page($l, 'categories:write');
    $categories = list_categories();
    $p = $t['admin']['categoriesPage'];
    $h = admin_title($t['admin']['categories']) . '<div class="space-y-4">';
    $move = fn(array $c, string $dir, bool $disabled, string $label, string $iconClass) => '<form method="post" action="' . e(url('/_action/admin.moveCategory')) . '">' . hidden('locale', $l) . hidden('id', $c['id']) . hidden('direction', $dir)
        . '<button type="submit" class="' . button_class('ghost', 'sm') . '"' . ($disabled ? ' disabled' : '') . ' aria-label="' . e($label) . '">' . icon('chevron-down', $iconClass) . '</button></form>';
    foreach ($categories as $i => $c) {
        $h .= card_open() . '<div class="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3"><span class="flex items-center gap-2 font-bold">' . icon($c['icon'], 'size-5 text-brand') . ' ' . e(L($c, 'name', $l))
            . badge(e($c['is_active'] ? $t['common']['active'] : $t['common']['inactive']), $c['is_active'] ? 'success' : 'neutral') . badge(e($p['products'] . ': ' . $c['product_count'])) . '</span>'
            . '<span class="flex gap-1">' . $move($c, 'up', $i === 0, $p['moveUp'], 'size-4 rotate-180') . $move($c, 'down', $i === count($categories) - 1, $p['moveDown'], 'size-4') . '</span></div>';
        $h .= '<div class="space-y-3 p-5">' . action_form('admin.saveCategory', hidden('id', $c['id']) . category_fields($c) . submit_button(e($t['common']['save']), ['size' => 'sm', 'variant' => 'secondary']), 'space-y-3', ['slug' => $p['slug']])
            . action_form('admin.deleteCategory', hidden('id', $c['id']) . submit_button(icon('trash', 'size-4') . ' ' . e($t['common']['delete']), ['size' => 'sm', 'variant' => 'ghost', 'class' => 'text-danger', 'confirm' => $p['deleteConfirm']]))
            . '</div></div>';
    }
    $h .= card_open() . card_header($p['new']) . action_form('admin.saveCategory', category_fields() . submit_button(icon('plus', 'size-4') . ' ' . e($t['common']['create']), ['size' => 'sm']), 'space-y-3 p-5', ['slug' => $p['slug']]) . '</div></div>';
    return admin_page($user, $t['admin']['categories'], $h);
}

function page_admin_payment_methods(array $params): array
{
    $l = loc();
    $t = T();
    $user = require_staff_page($l, 'payment_methods:write');
    $p = $t['admin']['paymentsPage'];
    $f = fn(string $label, string $el, string $cls = '') => '<label class="block text-xs font-semibold ' . $cls . '"><span class="mb-1 block">' . e($label) . '</span>' . $el . '</label>';
    $h = admin_title($t['admin']['paymentMethods']) . alert('info', null, e($p['intro']), 'mb-4') . '<div class="space-y-4">';
    foreach (list_payment_methods() as $m) {
        $h .= card_open('p-5') . '<div class="mb-4 flex flex-wrap items-center gap-2"><h2 class="font-bold">' . e(L($m, 'name', $l)) . '</h2>' . badge(e($m['code']), 'neutral', 'ltr-nums')
            . badge(e($m['is_enabled'] ? $t['common']['active'] : $t['common']['inactive']), $m['is_enabled'] ? 'success' : 'neutral') . '</div>';
        if ($m['code'] === 'mastercard') $h .= alert('warning', null, e($p['cardWarning']), 'mb-4');
        $inner = hidden('id', $m['id'])
            . $f($p['nameAr'], input_tag(['name' => 'nameAr', 'value' => $m['name_ar'], 'required' => true, 'maxlength' => '80', 'dir' => 'rtl']))
            . $f($p['nameEn'], input_tag(['name' => 'nameEn', 'value' => $m['name_en'], 'required' => true, 'maxlength' => '80', 'dir' => 'ltr']))
            . $f($p['instructionsAr'], textarea_tag(['name' => 'instructionsAr', 'maxlength' => '3000', 'rows' => '3', 'dir' => 'rtl'], $m['instructions_ar']))
            . $f($p['instructionsEn'], textarea_tag(['name' => 'instructionsEn', 'maxlength' => '3000', 'rows' => '3', 'dir' => 'ltr'], $m['instructions_en']))
            . $f($p['accountDetails'], input_tag(['name' => 'accountDetails', 'value' => $m['account_details'], 'maxlength' => '300', 'dir' => 'ltr']), 'sm:col-span-2')
            . $f($t['admin']['categoriesPage']['sortOrder'], input_tag(['name' => 'sortOrder', 'type' => 'number', 'value' => (string) $m['sort_order'], 'dir' => 'ltr']))
            . '<div class="space-y-2 sm:col-span-2"><span class="block text-xs font-semibold">' . e($p['qr']) . '</span><div class="flex flex-wrap items-center gap-3">'
            . ($m['qr_file_id'] ? '<img src="' . e(file_url($m['qr_file_id'])) . '" alt="" class="size-24 rounded-lg border border-line object-contain">' : '')
            . '<input name="qr" type="file" accept="image/jpeg,image/png,image/webp" class="text-sm file:me-3 file:rounded-lg file:border-0 file:bg-brand-soft file:px-3 file:py-2 file:font-semibold file:text-brand-soft-fg">'
            . ($m['qr_file_id'] ? checkbox_tag(['name' => 'removeQr'], e($p['removeQr'])) : '') . '</div><p class="text-xs text-fg-muted">' . e($p['qrHint']) . '</p></div>'
            . '<div class="flex flex-wrap items-end gap-4 sm:col-span-2">' . checkbox_tag(['name' => 'isEnabled', 'checked' => (bool) $m['is_enabled']], e($p['enabled']))
            . checkbox_tag(['name' => 'requiresReference', 'checked' => (bool) $m['requires_reference']], e($p['requiresReference']))
            . checkbox_tag(['name' => 'allowsReceipt', 'checked' => (bool) $m['allows_receipt']], e($p['allowsReceipt'])) . '</div>'
            . '<div class="sm:col-span-2">' . submit_button(e($t['common']['save']), ['size' => 'sm']) . '</div>';
        $h .= action_form('admin.savePaymentMethod', $inner, 'grid gap-3 sm:grid-cols-2') . '</div>';
    }
    return admin_page($user, $t['admin']['paymentMethods'], $h . '</div>');
}
