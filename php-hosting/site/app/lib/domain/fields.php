<?php
declare(strict_types=1);

/** Keys that must never be collected (credentials / card data). Enforced on admin save AND on checkout. */
const FORBIDDEN_FIELD_KEY = '/(pass|pwd|otp|cvv|cvc|pin|card|secret|token|code_?verif|2fa)/i';

function is_forbidden_field_key(string $key): bool
{
    return (bool) preg_match(FORBIDDEN_FIELD_KEY, $key);
}

/** A product_fields row (snake_case) → field definition used by validation and the UI. */
function field_def(array $row): array
{
    return [
        'key' => $row['key'],
        'labelAr' => $row['label_ar'],
        'labelEn' => $row['label_en'],
        'helpAr' => $row['help_ar'] ?? '',
        'helpEn' => $row['help_en'] ?? '',
        'type' => $row['type'],
        'required' => (bool) $row['required'],
        'maxLength' => (int) $row['max_length'],
        'options' => is_array($row['options']) ? $row['options'] : json_col($row['options'] ?? null, []),
    ];
}

/**
 * Validates customer-provided values against the product's field definitions.
 * Unknown keys are dropped so customers cannot attach arbitrary data.
 * Returns ['ok' => true, 'values' => [...]] or ['ok' => false, 'errors' => [...]].
 */
function validate_field_values(array $defs, array $raw): array
{
    $errors = [];
    $values = [];
    foreach ($defs as $def) {
        if (is_forbidden_field_key($def['key'])) continue;
        $input = $raw[$def['key']] ?? null;
        $value = is_string($input) ? trim_js($input) : '';
        if ($value === '') {
            if ($def['required']) $errors[] = ['key' => $def['key'], 'code' => 'fieldRequired'];
            continue;
        }
        if (js_len($value) > min($def['maxLength'], 2000)) {
            $errors[] = ['key' => $def['key'], 'code' => 'tooLong'];
            continue;
        }
        switch ($def['type']) {
            case 'url':
                if (!is_safe_http_url($value)) $errors[] = ['key' => $def['key'], 'code' => 'fieldInvalid'];
                break;
            case 'number':
                if (!preg_match('/^\d{1,30}$/', $value)) $errors[] = ['key' => $def['key'], 'code' => 'fieldInvalid'];
                break;
            case 'phone':
                $p = normalize_phone($value);
                if (!$p) $errors[] = ['key' => $def['key'], 'code' => 'fieldInvalid'];
                else $value = $p;
                break;
            case 'select':
                $found = false;
                foreach ($def['options'] as $o) if (($o['value'] ?? null) === $value) $found = true;
                if (!$found) $errors[] = ['key' => $def['key'], 'code' => 'fieldInvalid'];
                break;
        }
        $values[] = ['key' => $def['key'], 'labelAr' => $def['labelAr'], 'labelEn' => $def['labelEn'], 'value' => $value];
    }
    return $errors ? ['ok' => false, 'errors' => $errors] : ['ok' => true, 'values' => $values];
}

/** String.prototype.trim(): strips Unicode whitespace and line terminators like JavaScript. */
function trim_js(string $s): string
{
    return preg_replace('/^[\s\x{00A0}\x{1680}\x{2000}-\x{200A}\x{2028}\x{2029}\x{202F}\x{205F}\x{3000}\x{FEFF}]+|[\s\x{00A0}\x{1680}\x{2000}-\x{200A}\x{2028}\x{2029}\x{202F}\x{205F}\x{3000}\x{FEFF}]+$/u', '', $s) ?? trim($s);
}
