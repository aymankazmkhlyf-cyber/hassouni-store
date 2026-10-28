<?php
/*
 * The admin product form edits packages, tiers and customer fields as
 * pipe-separated lines (works well on mobile). These parsers are strict and
 * report the first bad line.
 */

declare(strict_types=1);

function int_of(?string $s): ?int
{
    return $s !== null && preg_match('/^\d{1,10}$/', trim($s)) ? (int) trim($s) : null;
}

function parse_lines(string $text): array
{
    $out = [];
    foreach (preg_split('/\r?\n/', $text) as $i => $l) {
        $t = trim_js($l);
        if ($t !== '') $out[] = ['line' => $i + 1, 'text' => $t];
    }
    return $out;
}

function split_pipes(string $t): array
{
    return array_map('trim_js', explode('|', $t));
}

function parse_packages(string $text): array
{
    $out = [];
    foreach (parse_lines($text) as ['line' => $line, 'text' => $t]) {
        $p = split_pipes($t);
        [$ar, $en, $price, $compare] = $p + [null, null, null, null];
        $pr = int_of($price);
        if (!$ar || !$en || $pr === null) return ['ok' => false, 'line' => $line, 'reason' => 'format'];
        $c = $compare ? int_of($compare) : null;
        if ($compare && ($c === null || $c <= $pr)) return ['ok' => false, 'line' => $line, 'reason' => 'compare_price'];
        $out[] = ['labelAr' => js_slice($ar, 120), 'labelEn' => js_slice($en, 120), 'price' => $pr, 'compareAtPrice' => $c];
    }
    return ['ok' => true, 'value' => array_slice($out, 0, 50)];
}

function parse_tiers(string $text): array
{
    $out = [];
    foreach (parse_lines($text) as ['line' => $line, 'text' => $t]) {
        [$min, $price] = split_pipes($t) + [null, null];
        $m = int_of($min);
        $p = int_of($price);
        if ($m === null || $m < 1 || $p === null) return ['ok' => false, 'line' => $line, 'reason' => 'format'];
        foreach ($out as $x) if ($x['minQuantity'] === $m) return ['ok' => false, 'line' => $line, 'reason' => 'duplicate'];
        $out[] = ['minQuantity' => $m, 'unitPrice' => $p];
    }
    usort($out, fn($a, $b) => $a['minQuantity'] <=> $b['minQuantity']);
    return ['ok' => true, 'value' => array_slice($out, 0, 20)];
}

const FIELD_TYPES = ['text', 'textarea', 'url', 'number', 'select', 'phone'];

function parse_fields(string $text): array
{
    $out = [];
    foreach (parse_lines($text) as ['line' => $line, 'text' => $t]) {
        $p = split_pipes($t);
        $key = $p[0] ?? '';
        $ar = $p[1] ?? '';
        $en = $p[2] ?? '';
        // Like JavaScript destructuring defaults: only a missing part gets the default.
        $type = array_key_exists(3, $p) ? $p[3] : 'text';
        $req = array_key_exists(4, $p) ? $p[4] : 'required';
        $opts = array_key_exists(5, $p) ? $p[5] : '';
        if (!$key || !preg_match('/^[a-z][a-z0-9_]{0,39}$/', $key) || !$ar || !$en) return ['ok' => false, 'line' => $line, 'reason' => 'format'];
        if (is_forbidden_field_key($key) || preg_match('/كلمة\s*(ال)?سر|كلمة\s*المرور|password|otp/iu', "$ar $en")) return ['ok' => false, 'line' => $line, 'reason' => 'forbidden'];
        if (!in_array($type, FIELD_TYPES, true)) return ['ok' => false, 'line' => $line, 'reason' => 'type'];
        foreach ($out as $f) if ($f['key'] === $key) return ['ok' => false, 'line' => $line, 'reason' => 'duplicate'];
        $options = [];
        if ($type === 'select') {
            foreach (explode(',', $opts) as $o) {
                $o = trim_js($o);
                if ($o !== '') $options[] = ['value' => $o, 'labelAr' => $o, 'labelEn' => $o];
            }
            if (!$options) return ['ok' => false, 'line' => $line, 'reason' => 'options'];
        }
        $out[] = [
            'key' => $key,
            'labelAr' => js_slice($ar, 120),
            'labelEn' => js_slice($en, 120),
            'type' => $type,
            'required' => $req !== 'optional',
            'maxLength' => $type === 'textarea' ? 2000 : 200,
            'options' => $options,
        ];
    }
    return ['ok' => true, 'value' => array_slice($out, 0, 15)];
}

function serialize_packages(array $rows): string
{
    return implode("\n", array_map(fn($x) => preg_replace('/ \| $/', '', implode(' | ', [$x['label_ar'], $x['label_en'], $x['price'], $x['compare_at_price'] ?? ''])), $rows));
}

function serialize_tiers(array $rows): string
{
    return implode("\n", array_map(fn($x) => $x['min_quantity'] . ' | ' . $x['unit_price'], $rows));
}

function serialize_fields(array $defs): string
{
    return implode("\n", array_map(fn($x) => preg_replace('/ \| $/', '', implode(' | ', [
        $x['key'], $x['labelAr'], $x['labelEn'], $x['type'], $x['required'] ? 'required' : 'optional', implode(',', array_column($x['options'], 'value')),
    ])), $defs));
}
