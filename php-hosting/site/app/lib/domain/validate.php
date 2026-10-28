<?php
/*
 * Input validation (the PHP equivalent of the original zod schemas). Error
 * values are keys of dictionary.errors; anything else falls back to the
 * generic "validation" message in the UI, exactly like before.
 * Each function returns [data|null, fieldErrors].
 */

declare(strict_types=1);

final class V
{
    public array $errors = [];
    public array $data = [];

    public function __construct(private array $in) {}

    public function err(string $field, string $code): void
    {
        if (!isset($this->errors[$field])) $this->errors[$field] = $code;
    }

    public function raw(string $k): mixed
    {
        return $this->in[$k] ?? null;
    }

    /** z.string().trim().max(max, "tooLong") [.min(min, minMsg)] — missing values count as "". */
    public function str(string $k, int $max, int $min = 0, string $minMsg = 'validation', string $maxMsg = 'tooLong'): string
    {
        $v = $this->raw($k);
        if ($v !== null && !is_string($v)) { $this->err($k, 'validation'); return ''; }
        $s = trim_js((string) $v);
        if (js_len($s) > $max) $this->err($k, $maxMsg);
        elseif (js_len($s) < $min) $this->err($k, $minMsg);
        return $this->data[$k] = $s;
    }

    /** Untrimmed z.string().max(max). */
    public function text(string $k, int $max): string
    {
        $v = $this->raw($k);
        $s = is_string($v) ? $v : '';
        if (js_len($s) > $max) $this->err($k, 'validation');
        return $this->data[$k] = $s;
    }

    /** z.coerce.number().int().min().max() with an optional default when the field is missing. */
    public function int(string $k, int $min, int $max, ?int $default = null, string $msg = 'validation'): ?int
    {
        $v = $this->raw($k);
        if ($v === null && $default !== null) return $this->data[$k] = $default;
        $n = coerce_int($v);
        if ($n === null || $n < $min || $n > $max) { $this->err($k, $msg); return $this->data[$k] = null; }
        return $this->data[$k] = $n;
    }

    /** "" / missing → null, otherwise an integer within bounds. */
    public function optInt(string $k, int $min, int $max = 1_000_000_000): ?int
    {
        $v = $this->raw($k);
        if ($v === null || $v === '') return $this->data[$k] = null;
        $n = coerce_int($v);
        if ($n === null || $n < $min || $n > $max) { $this->err($k, 'validation'); return $this->data[$k] = null; }
        return $this->data[$k] = $n;
    }

    public function bool(string $k): bool
    {
        $v = $this->raw($k);
        return $this->data[$k] = ($v === 'on' || $v === 'true');
    }

    public function enum(string $k, array $allowed): ?string
    {
        $v = $this->raw($k);
        if (!is_string($v) || !in_array($v, $allowed, true)) { $this->err($k, 'validation'); return $this->data[$k] = null; }
        return $this->data[$k] = $v;
    }

    public function phone(string $k): ?string
    {
        $v = $this->raw($k);
        $s = trim_js(is_string($v) ? $v : '');
        if (js_len($s) > 30) { $this->err($k, 'invalidPhone'); return $this->data[$k] = null; }
        $p = normalize_phone($s);
        if (!$p) $this->err($k, 'invalidPhone');
        return $this->data[$k] = $p;
    }

    /** Optional phone: "" → null. */
    public function optPhone(string $k): ?string
    {
        $v = $this->raw($k);
        $s = trim_js(is_string($v) ? $v : '');
        if (js_len($s) > 30) { $this->err($k, 'validation'); return $this->data[$k] = null; }
        if ($s === '') return $this->data[$k] = null;
        $p = normalize_phone($s);
        if (!$p) $this->err($k, 'invalidPhone');
        return $this->data[$k] = $p;
    }

    public function optEmail(string $k): ?string
    {
        $v = $this->raw($k);
        $s = strtolower(trim_js(is_string($v) ? $v : ''));
        if (js_len($s) > 200) { $this->err($k, 'invalidEmail'); return $this->data[$k] = null; }
        if ($s === '') return $this->data[$k] = null;
        if (!is_email($s)) $this->err($k, 'invalidEmail');
        return $this->data[$k] = $s;
    }

    public function email(string $k): string
    {
        $v = $this->raw($k);
        $s = strtolower(trim_js(is_string($v) ? $v : ''));
        if (js_len($s) > 200 || !is_email($s)) $this->err($k, 'invalidEmail');
        return $this->data[$k] = $s;
    }

    public function optUrl(string $k): ?string
    {
        $v = $this->raw($k);
        $s = trim_js(is_string($v) ? $v : '');
        if (js_len($s) > 500) { $this->err($k, 'tooLong'); return $this->data[$k] = null; }
        if ($s === '') return $this->data[$k] = null;
        if (!is_safe_http_url($s)) $this->err($k, 'invalidUrl');
        return $this->data[$k] = $s;
    }

    public function ok(): bool
    {
        return !$this->errors;
    }
}

/** z.coerce.number().int(): numeric strings/numbers that are whole numbers. */
function coerce_int(mixed $v): ?int
{
    if (is_int($v)) return $v;
    if (is_float($v)) return floor($v) === $v && abs($v) <= 9007199254740991 ? (int) $v : null;
    if (!is_string($v)) return $v === null ? 0 : null;
    $s = trim($v);
    if ($s === '') return 0;
    if (!is_numeric($s)) return null;
    $f = (float) $s;
    return floor($f) === $f && abs($f) <= 9007199254740991 ? (int) $f : null;
}

/** Same rule as zod's z.email() (practical, ASCII-only). */
function is_email(string $s): bool
{
    return (bool) preg_match("/^(?!\.)(?!.*\.\.)([A-Za-z0-9_'+\-\.]*)[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9\-]*\.)+[A-Za-z]{2,}$/", $s);
}

/* ------------------------------ Storefront ------------------------------ */

const MAX_CART_LINES = 20;

/** Cart items from the browser: [{productId, packageId, quantity, inputs}] — strict types like the original. */
function parse_cart_items(mixed $items, int $min = 1): ?array
{
    if (!is_array($items) || !array_is_list($items)) return null;
    if (count($items) < $min || count($items) > MAX_CART_LINES) return null;
    $out = [];
    foreach ($items as $it) {
        if (!is_array($it)) return null;
        $pid = json_int($it['productId'] ?? null);
        $pkg = array_key_exists('packageId', $it) ? $it['packageId'] : 'missing';
        $qty = json_int($it['quantity'] ?? null);
        $inputs = $it['inputs'] ?? null;
        if ($pid === null || $pid < 1) return null;
        if ($pkg === 'missing') return null;
        if ($pkg !== null) {
            $pkg = json_int($pkg);
            if ($pkg === null || $pkg < 1) return null;
        }
        if ($qty === null || $qty < 1 || $qty > 1_000_000) return null;
        if (!is_array($inputs) || (array_is_list($inputs) && $inputs !== [])) return null;
        if (count($inputs) > 20) return null;
        foreach ($inputs as $k => $v) {
            if (!is_string($v) || js_len((string) $k) > 40 || js_len($v) > 2000) return null;
        }
        $out[] = ['productId' => $pid, 'packageId' => $pkg, 'quantity' => $qty, 'inputs' => array_map('strval', $inputs)];
    }
    return $out;
}

function v_checkout(array $in, mixed $items): array
{
    $v = new V($in);
    $key = $v->raw('idempotencyKey');
    if (!is_string($key) || !preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i', $key)) $v->err('idempotencyKey', 'validation');
    $v->str('customerName', 80, 2);
    $v->phone('customerPhone');
    $v->optEmail('customerEmail');
    $pm = $v->raw('paymentMethodId');
    if ($pm === 'wallet') $v->data['paymentMethodId'] = 'wallet';
    else {
        $n = coerce_int($pm);
        if ($n === null) $v->err('paymentMethodId', 'validation');
        elseif ($n < 1) $v->err('paymentMethodId', 'paymentMethod');
        else $v->data['paymentMethodId'] = $n;
    }
    $v->str('customerNotes', 1000);
    if ($v->raw('acceptTerms') !== 'on') $v->err('acceptTerms', 'termsRequired');
    $loc = $v->raw('locale') ?? 'ar';
    if (!is_locale($loc)) $v->err('locale', 'validation');
    $v->data['locale'] = is_locale($loc) ? $loc : 'ar';
    if (is_array($items) && array_is_list($items) && count($items) === 0) $v->err('items', 'cartEmpty');
    else {
        $parsed = parse_cart_items($items);
        if ($parsed === null) $v->err('items.0', 'cartInvalid');
        else $v->data['items'] = $parsed;
    }
    $v->data['idempotencyKey'] = is_string($key) ? strtolower($key) : '';
    return [$v->ok() ? $v->data : null, $v->errors];
}

function v_register(array $in): array
{
    $v = new V($in);
    $v->str('name', 80, 2);
    $u = strtolower(preg_replace('/^@/', '', trim_js(str_in($v->raw('username')))));
    if (!preg_match('/^[a-z][a-z0-9_.]{2,19}$/', $u) || str_contains($u, '..')) $v->err('username', 'usernameInvalid');
    $v->data['username'] = $u;
    $v->email('email');
    $phone = trim_js(str_in($v->raw('phone')));
    if (js_len($phone) > 30) $v->err('phone', 'validation');
    elseif ($phone === '') $v->data['phone'] = null;
    else {
        $p = normalize_phone($phone);
        if (!$p) $v->err('phone', 'invalidPhone');
        $v->data['phone'] = $p;
    }
    $pw = $v->raw('password');
    $pw = is_string($pw) ? $pw : '';
    if (js_len($pw) < 10) $v->err('password', 'passwordShort');
    elseif (js_len($pw) > 200) $v->err('password', 'tooLong');
    $v->data['password'] = $pw;
    return [$v->ok() ? $v->data : null, $v->errors];
}

const SERVICE_TYPES = ['social', 'promotion', 'accounts', 'numbers', 'gaming', 'subscription', 'design', 'exchange', 'other'];

function v_custom_request(array $in): array
{
    $v = new V($in);
    $v->str('name', 80, 2);
    $v->phone('phone');
    $v->optEmail('email');
    $v->enum('serviceType', SERVICE_TYPES);
    $v->str('description', 3000, 10);
    $v->optInt('quantity', 1, 10_000_000);
    $v->optInt('budget', 0, 1_000_000_000);
    $v->optUrl('referenceUrl');
    $v->str('notes', 1000);
    return [$v->ok() ? $v->data : null, $v->errors];
}

const REVIEW_LINK_RE = '/(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|io|me|iq|ly|gg)\b)/i';

function v_review(array $in): array
{
    $v = new V($in);
    $id = coerce_int($v->raw('orderItemId'));
    if ($id === null || $id < 1) $v->err('orderItemId', 'validation');
    $v->data['orderItemId'] = $id;
    $r = coerce_int($v->raw('rating') ?? 0);
    if ($r === null || $r < 1 || $r > 5) $v->err('rating', 'ratingRequired');
    $v->data['rating'] = $r;
    $c = $v->str('comment', 1000);
    if (!isset($v->errors['comment']) && preg_match(REVIEW_LINK_RE, $c)) $v->err('comment', 'reviewNoLinks');
    $v->str('displayName', 40, 2, 'displayNameRequired');
    return [$v->ok() ? $v->data : null, $v->errors];
}
