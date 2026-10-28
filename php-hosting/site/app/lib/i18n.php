<?php
/* Languages, dictionaries and locale-aware formatting (Arabic RTL / English). */

declare(strict_types=1);

const LOCALES = ['ar', 'en'];
const LOCALE_COOKIE = 'hds_locale';

function is_locale(mixed $v): bool
{
    return is_string($v) && in_array($v, LOCALES, true);
}

function data_file(string $name): array
{
    static $cache = [];
    return $cache[$name] ??= json_decode((string) file_get_contents(APP_DIR . '/data/' . $name), true) ?? [];
}

/** The full dictionary for a locale (same keys as the original TypeScript dictionaries). */
function dict(string $locale): array
{
    return data_file('i18n-' . ($locale === 'en' ? 'en' : 'ar') . '.json');
}

function dir_for(string $locale): string
{
    return $locale === 'ar' ? 'rtl' : 'ltr';
}

function other_locale(string $locale): string
{
    return $locale === 'ar' ? 'en' : 'ar';
}

/** Replaces {name} placeholders. */
function fmt(string $template, array $vars): string
{
    return preg_replace_callback('/\{(\w+)\}/', fn($m) => array_key_exists($m[1], $vars) ? (string) $vars[$m[1]] : $m[0], $template);
}

/** Picks a bilingual column: L($row, 'name', 'en') -> $row['name_en']. */
function L(array $row, string $field, string $locale): string
{
    $v = $row[$field . '_' . ($locale === 'ar' ? 'ar' : 'en')] ?? '';
    return is_string($v) ? $v : '';
}

function switch_locale_path(string $path, string $query, string $to): string
{
    $parts = explode('/', $path);
    if (isset($parts[1]) && is_locale($parts[1])) $parts[1] = $to;
    else array_splice($parts, 1, 0, $to);
    $p = implode('/', $parts) ?: '/' . $to;
    return $query !== '' ? $p . '?' . $query : $p;
}

/* ------------------------------ Numbers ------------------------------ */

function num(int|float $n): string
{
    return number_format((float) round($n), 0, '.', ',');
}

/** Whole-dinar amount with western digits in both languages. */
function format_iqd(int|float $amount, string $locale): string
{
    $n = num($amount);
    return $locale === 'ar' ? "$n د.ع" : "$n IQD";
}

/* ------------------------------ Dates (Baghdad, UTC+3) ------------------------------ */

const MONTHS_AR = ['كانون الثاني', 'شباط', 'آذار', 'نيسان', 'أيار', 'حزيران', 'تموز', 'آب', 'أيلول', 'تشرين الأول', 'تشرين الثاني', 'كانون الأول'];
const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];

function baghdad(string|float|int $value): DateTimeImmutable
{
    $ts = is_string($value) ? (db_time($value) ?? (strtotime($value) ?: 0)) : (float) $value;
    return (new DateTimeImmutable('@' . (int) floor($ts)))->setTimezone(new DateTimeZone('Asia/Baghdad'));
}

function format_date(string|float|int $value, string $locale): string
{
    $d = baghdad($value);
    $m = (int) $d->format('n') - 1;
    return $d->format('j') . ' ' . ($locale === 'ar' ? MONTHS_AR[$m] : MONTHS_EN[$m]) . ' ' . $d->format('Y');
}

/** Matches Intl.DateTimeFormat output of the original site (12-hour in Arabic, 24-hour in English). */
function format_datetime(string|float|int $value, string $locale): string
{
    $d = baghdad($value);
    if ($locale === 'ar') {
        $h = (int) $d->format('G');
        $suffix = $h < 12 ? 'ص' : 'م';
        $h12 = $h % 12 === 0 ? 12 : $h % 12;
        return format_date($value, $locale) . '، ' . sprintf('%02d', $h12) . ':' . $d->format('i') . ' ' . $suffix;
    }
    return format_date($value, $locale) . ', ' . $d->format('H:i');
}
