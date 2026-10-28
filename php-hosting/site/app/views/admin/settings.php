<?php
declare(strict_types=1);

require_once __DIR__ . '/common.php';

function page_admin_settings(array $params): array
{
    $l = loc();
    $t = T();
    $user = require_staff_page($l, 'settings:write');
    $s = load_settings(true);
    $p = $t['admin']['settingsPage'];
    $f = fn(string $label, string $el, string $cls = '') => '<label class="block text-sm font-semibold ' . $cls . '"><span class="mb-1 block">' . e($label) . '</span>' . $el . '</label>';
    $in = fn(string $name, int $max, string $dir, string $type = 'text', bool $required = false) => input_tag(['name' => $name, 'type' => $type === 'text' ? null : $type, 'value' => (string) $s[$name], 'required' => $required, 'maxlength' => (string) $max, 'dir' => $dir]);
    $ta = fn(string $name, int $max, string $dir, int $rows) => textarea_tag(['name' => $name, 'rows' => (string) $rows, 'maxlength' => (string) $max, 'dir' => $dir], (string) $s[$name]);

    $h = card_open() . card_header($p['general']) . '<div class="grid gap-4 p-5 sm:grid-cols-2">'
        . $f($p['storeNameAr'], $in('storeNameAr', 120, 'rtl', 'text', true)) . $f($p['storeNameEn'], $in('storeNameEn', 120, 'ltr', 'text', true))
        . $f($p['logo'], '<input name="logo" type="file" accept="image/jpeg,image/png,image/webp" class="block w-full text-sm file:me-3 file:rounded-lg file:border-0 file:bg-brand-soft file:px-3 file:py-2 file:font-semibold file:text-brand-soft-fg">')
        . ($s['logoFileId'] ? '<div class="flex items-center gap-3"><img src="' . e(file_url($s['logoFileId'])) . '" alt="" class="size-12 rounded-xl object-cover">' . checkbox_tag(['name' => 'removeLogo'], e($p['removeLogo'])) . '</div>' : '')
        . '<div class="sm:col-span-2"><p class="text-sm font-semibold">' . e($p['languages']) . '</p><p class="text-sm text-fg-muted">' . e($p['languagesBody']) . '</p></div></div></div>';
    $h .= card_open() . card_header($p['contact']) . '<div class="grid gap-4 p-5 sm:grid-cols-2">'
        . $f($p['whatsapp'], $in('whatsapp', 30, 'ltr')) . $f($p['telegram'], $in('telegram', 40, 'ltr')) . $f($p['instagram'], $in('instagram', 300, 'ltr', 'url'))
        . $f($p['email'], $in('supportEmail', 200, 'ltr', 'email')) . $f($p['hoursAr'], $in('hoursAr', 200, 'rtl')) . $f($p['hoursEn'], $in('hoursEn', 200, 'ltr')) . '</div></div>';
    $h .= card_open() . card_header($p['store']) . '<div class="grid gap-4 p-5 sm:grid-cols-2"><div class="flex flex-wrap gap-5 sm:col-span-2">'
        . checkbox_tag(['name' => 'ordersEnabled', 'checked' => $s['ordersEnabled']], e($p['ordersEnabled'])) . checkbox_tag(['name' => 'showOffers', 'checked' => $s['showOffers']], e($p['showOffers'])) . '</div>'
        . $f($p['noticeAr'], $in('noticeAr', 300, 'rtl')) . $f($p['noticeEn'], $in('noticeEn', 300, 'ltr')) . $f($p['heroTitleAr'], $in('heroTitleAr', 120, 'rtl')) . $f($p['heroTitleEn'], $in('heroTitleEn', 120, 'ltr'))
        . $f($p['heroSubtitleAr'], $ta('heroSubtitleAr', 400, 'rtl', 2)) . $f($p['heroSubtitleEn'], $ta('heroSubtitleEn', 400, 'ltr', 2))
        . $f($p['retentionDays'], input_tag(['name' => 'retentionDays', 'type' => 'number', 'min' => '30', 'max' => '3650', 'value' => (string) $s['retentionDays'], 'dir' => 'ltr'])) . '</div></div>';
    $h .= card_open() . card_header($p['policies'], $p['policyHint']) . '<div class="grid gap-4 p-5 lg:grid-cols-2">';
    foreach (['termsAr' => 'rtl', 'termsEn' => 'ltr', 'privacyAr' => 'rtl', 'privacyEn' => 'ltr', 'refundAr' => 'rtl', 'refundEn' => 'ltr'] as $k => $dir) $h .= $f($p[$k], $ta($k, 20000, $dir, 10));
    $h .= '</div></div>' . submit_button(e($t['common']['save']), ['size' => 'lg', 'pending' => $t['common']['saving']]);
    $form = action_form('admin.saveSettings', $h, 'space-y-6', ['whatsapp' => $p['whatsapp'], 'instagram' => $p['instagram'], 'telegram' => $p['telegram'], 'supportEmail' => $p['email'], 'logo' => $p['logo']]);
    return admin_page($user, $t['admin']['settings'], admin_title($t['admin']['settings']) . $form);
}

function page_admin_audit(array $params): array
{
    $l = loc();
    $t = T();
    $user = require_staff_page($l, 'audit:read');
    $page = page_number(query('page'));
    $pageSize = 50;
    $rows = all('SELECT * FROM audit_logs ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?', [$pageSize, ($page - 1) * $pageSize]);
    $total = (int) val('SELECT COUNT(*) FROM audit_logs');
    $a = $t['admin']['auditPage'];
    $h = admin_title($t['admin']['audit']);
    if (!$rows) $h .= empty_state($a['empty'], null, '', 'list');
    else {
        $h .= card_open('overflow-x-auto') . '<table class="w-full min-w-[42rem] text-sm"><thead class="border-b border-line text-xs text-fg-subtle"><tr>';
        foreach ([$a['date'], $a['actor'], $a['action'], $a['entity']] as $th) $h .= '<th class="px-4 py-3 text-start font-semibold">' . e($th) . '</th>';
        $h .= '</tr></thead><tbody class="divide-y divide-line">';
        foreach ($rows as $r) {
            $details = json_col($r['details'], []);
            $h .= '<tr><td class="ltr-nums px-4 py-2.5 text-xs whitespace-nowrap">' . e(format_datetime($r['created_at'], $l)) . '</td><td class="ltr-nums px-4 py-2.5" dir="ltr">' . e($r['actor_email'] ?? 'system') . '</td>'
                . '<td class="px-4 py-2.5 font-mono text-xs">' . e($r['action']) . '</td><td class="px-4 py-2.5 font-mono text-xs" dir="ltr">' . e($r['entity_type'] . ($r['entity_id'] ? ':' . substr($r['entity_id'], 0, 12) : ''))
                . ($details ? '<span class="block text-fg-subtle">' . e(js_slice(json_out($details), 160)) . '</span>' : '') . '</td></tr>';
        }
        $h .= '</tbody></table></div>';
    }
    $h .= pagination($page, max(1, (int) ceil($total / $pageSize)), lp('/admin/audit'), []);
    return admin_page($user, $t['admin']['audit'], $h);
}

function page_admin_password(array $params): array
{
    $l = loc();
    $t = T();
    $user = require_staff_page($l);
    $s = array_merge($t['password'], ['errors' => array_merge($t['password']['errors'], ['rateLimited' => $t['errors']['rateLimited'], 'unauthorized' => $t['errors']['unauthorized']])]);
    $h = admin_title($t['password']['changeTitle']) . card_open('max-w-md p-6') . island('ChangePasswordForm', ['locale' => $l, 'email' => $user['email'], 's' => $s], '<div class="h-48"></div>') . '</div>';
    return admin_page($user, $t['password']['changeTitle'], $h);
}
