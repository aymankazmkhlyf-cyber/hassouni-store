<?php
/* Store settings: one JSON document in store_settings (key "store"), with safe defaults. */

declare(strict_types=1);

function settings_defaults(): array
{
    $p = data_file('content.json')['defaultPolicies'];
    return [
        'storeNameAr' => 'متجر حسوني لخدمات السوشل ميديا',
        'storeNameEn' => 'Hassouni Digital Services',
        'logoFileId' => null,
        'whatsapp' => '+9647757382822',
        'telegram' => 'h_gms',
        'instagram' => 'https://www.instagram.com/1q3v_',
        'supportEmail' => '',
        'hoursAr' => 'يومياً من 10 صباحاً حتى 12 منتصف الليل (بتوقيت بغداد)',
        'hoursEn' => 'Daily, 10 AM to midnight (Baghdad time)',
        'ordersEnabled' => true,
        'noticeAr' => '',
        'noticeEn' => '',
        'heroTitleAr' => '',
        'heroTitleEn' => '',
        'heroSubtitleAr' => '',
        'heroSubtitleEn' => '',
        'showOffers' => true,
        'retentionDays' => 365,
        'termsAr' => $p['termsAr'],
        'termsEn' => $p['termsEn'],
        'privacyAr' => $p['privacyAr'],
        'privacyEn' => $p['privacyEn'],
        'refundAr' => $p['refundAr'],
        'refundEn' => $p['refundEn'],
        'policiesUpdatedAt' => '',
        'telegramChatId' => '',
        'lastMaintenanceAt' => '',
    ];
}

const SETTINGS_MAX = [
    'storeNameAr' => 120, 'storeNameEn' => 120, 'whatsapp' => 30, 'telegram' => 40, 'instagram' => 300, 'supportEmail' => 200,
    'hoursAr' => 200, 'hoursEn' => 200, 'noticeAr' => 300, 'noticeEn' => 300, 'heroTitleAr' => 120, 'heroTitleEn' => 120,
    'heroSubtitleAr' => 400, 'heroSubtitleEn' => 400, 'termsAr' => 20000, 'termsEn' => 20000, 'privacyAr' => 20000,
    'privacyEn' => 20000, 'refundAr' => 20000, 'refundEn' => 20000, 'telegramChatId' => 40,
];

/** Like the original zod schema with .catch(): invalid values fall back to the default. */
function normalize_settings(array $raw): array
{
    $out = [];
    foreach (settings_defaults() as $k => $def) {
        $v = $raw[$k] ?? null;
        if ($k === 'logoFileId') $out[$k] = is_uuid($v) ? $v : null;
        elseif (is_bool($def)) $out[$k] = is_bool($v) ? $v : $def;
        elseif ($k === 'retentionDays') $out[$k] = is_int($v) && $v >= 30 && $v <= 3650 ? $v : $def;
        elseif (in_array($k, ['policiesUpdatedAt', 'lastMaintenanceAt'], true)) $out[$k] = is_string($v) ? $v : $def;
        else $out[$k] = is_string($v) && js_len($v) <= (SETTINGS_MAX[$k] ?? 1000) ? $v : $def;
    }
    return $out;
}

function load_settings(bool $fresh = false): array
{
    static $cache = null;
    if ($cache !== null && !$fresh) return $cache;
    $row = one('SELECT value FROM store_settings WHERE `key` = ?', ['store']);
    return $cache = normalize_settings($row ? json_col($row['value'], []) : []);
}

function save_settings(array $patch): array
{
    $next = normalize_settings(array_merge(load_settings(true), $patch));
    q('INSERT INTO store_settings (`key`, value, updated_at) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value), updated_at = VALUES(updated_at)', ['store', json_out($next), now_db()]);
    return load_settings(true);
}

function setting_l(array $s, string $base, string $locale): string
{
    return (string) $s[$base . ($locale === 'ar' ? 'Ar' : 'En')];
}
