<?php
declare(strict_types=1);

/**
 * Normalizes Iraqi mobile numbers to E.164 (+9647XXXXXXXXX).
 * Accepts 07XXXXXXXXX, 7XXXXXXXXX, 9647XXXXXXXXX, +9647XXXXXXXXX, 009647XXXXXXXXX,
 * Arabic-Indic digits, spaces and dashes. Other international numbers are
 * accepted in +<8–15 digits> form. Returns null when the input is not a phone number.
 */
function normalize_phone(string $input): ?string
{
    $ascii = strtr($input, [
        '٠' => '0', '١' => '1', '٢' => '2', '٣' => '3', '٤' => '4', '٥' => '5', '٦' => '6', '٧' => '7', '٨' => '8', '٩' => '9',
        '۰' => '0', '۱' => '1', '۲' => '2', '۳' => '3', '۴' => '4', '۵' => '5', '۶' => '6', '۷' => '7', '۸' => '8', '۹' => '9',
    ]);
    $digits = preg_replace('/[\s\x{00A0}\x{1680}\x{2000}-\x{200A}\x{2028}\x{2029}\x{202F}\x{205F}\x{3000}\x{FEFF}\-().]/u', '', $ascii) ?? '';
    $hadPlus = false;
    if (str_starts_with($digits, '+')) {
        $hadPlus = true;
        $digits = substr($digits, 1);
    } elseif (str_starts_with($digits, '00')) {
        $hadPlus = true;
        $digits = substr($digits, 2);
    }
    if (!preg_match('/^\d+$/', $digits)) return null;

    if (!$hadPlus) {
        if (preg_match('/^07\d{9}$/', $digits)) return '+964' . substr($digits, 1);
        if (preg_match('/^7\d{9}$/', $digits)) return '+964' . $digits;
        if (preg_match('/^9647\d{9}$/', $digits)) return '+' . $digits;
        return null;
    }
    if (str_starts_with($digits, '964')) return preg_match('/^9647\d{9}$/', $digits) ? '+' . $digits : null;
    return preg_match('/^\d{8,15}$/', $digits) ? '+' . $digits : null;
}

/** Masks a phone for low-privilege displays: +96477****2822 */
function mask_phone(string $phone): string
{
    if (strlen($phone) < 8) return '****';
    return substr($phone, 0, 6) . '****' . substr($phone, -4);
}
