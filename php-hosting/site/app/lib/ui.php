<?php
/*
 * UI building blocks (the PHP versions of the original React components).
 * Every function returns an HTML string with the same classes as before, so
 * the compiled Tailwind stylesheet styles them identically.
 */

declare(strict_types=1);

/** Current locale and dictionary of this request. */
function loc(): string
{
    return $GLOBALS['LOCALE'] ?? 'ar';
}

function T(): array
{
    return $GLOBALS['T'] ??= dict(loc());
}

function icon(string $name, string $class = 'size-5', ?string $title = null): string
{
    $icons = data_file('icons.json')['icons'];
    $svg = $icons[$name] ?? $icons['spark'];
    $svg = str_replace('__CLASS__', e($class), $svg);
    if ($title !== null) $svg = str_replace('aria-hidden="true"', 'role="img" aria-label="' . e($title) . '"', $svg);
    return $svg;
}

function button_class(string $variant = 'primary', string $size = 'md', ?string $class = null): string
{
    $base = 'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors duration-150 disabled:opacity-55 disabled:cursor-not-allowed select-none whitespace-nowrap';
    $variants = [
        'primary' => 'bg-brand text-brand-fg hover:bg-brand-hover shadow-soft',
        'secondary' => 'bg-brand-soft text-brand-soft-fg hover:brightness-95 dark:hover:brightness-125',
        'outline' => 'border border-line-strong bg-elevated text-fg hover:bg-muted',
        'ghost' => 'text-fg hover:bg-muted',
        'danger' => 'bg-danger text-white hover:brightness-110 dark:text-black',
    ];
    $sizes = ['sm' => 'h-9 px-3 text-sm', 'md' => 'h-11 px-4 text-[0.95rem]', 'lg' => 'h-13 px-6 text-base'];
    return cn($base, $variants[$variant], $sizes[$size], $class);
}

function button_link(string $href, string $html, string $variant = 'primary', string $size = 'md', ?string $class = null, string $extra = ''): string
{
    return '<a href="' . e($href) . '" class="' . button_class($variant, $size, $class) . '"' . $extra . '>' . $html . '</a>';
}

const BADGE_TONES = [
    'neutral' => 'bg-muted text-fg-muted',
    'brand' => 'bg-brand-soft text-brand-soft-fg',
    'success' => 'bg-success-soft text-success',
    'warning' => 'bg-warning-soft text-warning',
    'danger' => 'bg-danger-soft text-danger',
    'info' => 'bg-info-soft text-info',
    'accent' => 'bg-accent-soft text-accent',
];

function badge(string $html, string $tone = 'neutral', ?string $class = null): string
{
    return '<span class="' . cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap', BADGE_TONES[$tone], $class) . '">' . $html . '</span>';
}

/** $title is plain text; $bodyHtml is already-escaped HTML. */
function alert(string $tone = 'info', ?string $title = null, ?string $bodyHtml = null, ?string $class = null): string
{
    $tones = [
        'info' => ['border-info/30 bg-info-soft text-info', 'info'],
        'success' => ['border-success/30 bg-success-soft text-success', 'check'],
        'warning' => ['border-warning/30 bg-warning-soft text-warning', 'alert'],
        'danger' => ['border-danger/30 bg-danger-soft text-danger', 'alert'],
    ];
    [$box, $ic] = $tones[$tone];
    $h = '<div role="' . ($tone === 'danger' ? 'alert' : 'status') . '" class="' . cn('flex gap-3 rounded-xl border p-3.5 text-sm', $box, $class) . '">';
    $h .= icon($ic, 'mt-0.5 size-5 shrink-0');
    $h .= '<div class="min-w-0 space-y-1">';
    if ($title !== null && $title !== '') $h .= '<p class="font-bold">' . e($title) . '</p>';
    if ($bodyHtml !== null && $bodyHtml !== '') $h .= '<div class="text-fg-muted [&amp;_strong]:text-fg">' . $bodyHtml . '</div>';
    return $h . '</div></div>';
}

function card_open(?string $class = null, string $attrs = ''): string
{
    return '<div class="' . cn('rounded-(--radius-card) border border-line bg-elevated shadow-soft', $class) . '"' . $attrs . '>';
}

function card_header(string $title, ?string $description = null, string $actionHtml = ''): string
{
    $h = '<div class="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4"><div>';
    $h .= '<h2 class="text-base font-bold">' . e($title) . '</h2>';
    if ($description) $h .= '<p class="mt-0.5 text-sm text-fg-muted">' . e($description) . '</p>';
    return $h . '</div>' . $actionHtml . '</div>';
}

function empty_state(string $title, ?string $body = null, string $actionHtml = '', string $icon = 'box'): string
{
    $h = '<div class="flex flex-col items-center gap-3 rounded-(--radius-card) border border-dashed border-line-strong bg-elevated px-6 py-12 text-center">';
    $h .= '<span class="grid size-14 place-items-center rounded-2xl bg-brand-soft text-brand-soft-fg">' . icon($icon, 'size-7') . '</span>';
    $h .= '<h2 class="text-lg font-bold">' . e($title) . '</h2>';
    if ($body) $h .= '<p class="max-w-md text-sm text-fg-muted">' . e($body) . '</p>';
    return $h . $actionHtml . '</div>';
}

function spinner(string $class = 'size-4'): string
{
    return '<svg class="' . e($class) . ' animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-opacity="0.25" stroke-width="3"></circle><path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" stroke-width="3" stroke-linecap="round"></path></svg>';
}

/* ------------------------------ Forms ------------------------------ */

const CONTROL_CLASS = 'w-full rounded-xl border border-line-strong bg-elevated px-3.5 text-fg placeholder:text-fg-subtle transition-colors focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25 aria-[invalid=true]:border-danger disabled:opacity-60';

/** Builds an HTML attribute string from an array (true → bare attribute, null/false → skipped). */
function attrs(array $a): string
{
    $out = '';
    foreach ($a as $k => $v) {
        if ($v === null || $v === false) continue;
        $out .= $v === true ? ' ' . $k : ' ' . $k . '="' . e($v) . '"';
    }
    return $out;
}

function input_tag(array $a, ?string $class = null): string
{
    return '<input' . attrs(['class' => cn(CONTROL_CLASS, 'h-11', $class)] + $a) . '>';
}

function textarea_tag(array $a, string $value = '', ?string $class = null): string
{
    return '<textarea' . attrs(['class' => cn(CONTROL_CLASS, 'min-h-28 py-2.5 leading-relaxed', $class)] + $a) . '>' . e($value) . '</textarea>';
}

/** $options: [value => label]; $selected value. */
function select_tag(array $a, array $options, ?string $selected = null, ?string $class = null): string
{
    $h = '<select' . attrs(['class' => cn(CONTROL_CLASS, 'h-11 pe-9', $class)] + $a) . '>';
    foreach ($options as $v => $label) {
        $h .= '<option value="' . e($v) . '"' . ((string) $v === (string) $selected ? ' selected' : '') . '>' . e($label) . '</option>';
    }
    return $h . '</select>';
}

function checkbox_tag(array $a, string $labelHtml, ?string $class = null): string
{
    return '<label class="' . cn('flex cursor-pointer items-start gap-2.5 text-sm', $class) . '"><input type="checkbox" class="mt-1 size-4.5 shrink-0 accent-(--brand)"' . attrs($a) . '><span>' . $labelHtml . '</span></label>';
}

/** Label + control + hint (same markup as the React <Field>). */
function field(string $id, string $label, string $controlHtml, array $opts = []): string
{
    $h = '<div class="' . cn('space-y-1.5', $opts['class'] ?? null) . '">';
    $h .= '<label for="' . e($id) . '" class="flex items-center gap-1.5 text-sm font-semibold">' . e($label);
    if (!empty($opts['required'])) $h .= '<span class="text-danger" aria-hidden="true">*</span>';
    elseif (!empty($opts['optional'])) $h .= '<span class="text-xs font-normal text-fg-subtle">(' . e($opts['optional']) . ')</span>';
    $h .= '</label>' . $controlHtml;
    if (!empty($opts['hint'])) $h .= '<p id="' . e($id) . '-hint" class="text-xs text-fg-subtle">' . e($opts['hint']) . '</p>';
    return $h . '</div>';
}

/* ------------------------------ Data display ------------------------------ */

function price_html(int $amount, string $locale, ?string $class = null): string
{
    return '<span class="' . cn('ltr-nums font-bold tabular-nums', $class) . '" dir="ltr">' . e(format_iqd($amount, $locale)) . '</span>';
}

function price_with_compare(int $amount, ?int $compareAt, string $locale, string $wasLabel): string
{
    $h = '<span class="inline-flex flex-wrap items-baseline gap-x-2">' . price_html($amount, $locale);
    if ($compareAt !== null && $compareAt > $amount) {
        $h .= '<s class="text-sm text-fg-subtle"><span class="sr-only">' . e($wasLabel) . ': </span>' . price_html($compareAt, $locale, 'font-normal') . '</s>';
    }
    return $h . '</span>';
}

function stars(float $value, ?string $label = null, ?string $class = null): string
{
    $star = 'M12 2.8l2.85 5.9 6.45.85-4.75 4.45 1.2 6.4L12 17.3l-5.75 3.1 1.2-6.4L2.7 9.55l6.45-.85z';
    $h = '<span class="' . cn('inline-flex items-center gap-0.5', $class) . '"' . ($label ? ' role="img" aria-label="' . e($label) . '"' : ' aria-hidden="true"') . '>';
    for ($i = 0; $i < 5; $i++) {
        $fill = max(0, min(1, $value - $i));
        $h .= '<span class="relative inline-block size-[1em]"><svg viewBox="0 0 24 24" class="absolute inset-0 size-full text-line-strong" fill="currentColor" aria-hidden="true"><path d="' . $star . '"></path></svg>';
        if ($fill > 0) {
            $h .= '<span class="absolute inset-y-0 start-0 overflow-hidden" style="width:' . ($fill * 100) . '%"><svg viewBox="0 0 24 24" class="size-[1em] text-amber-400" fill="currentColor" aria-hidden="true"><path d="' . $star . '"></path></svg></span>';
        }
        $h .= '</span>';
    }
    return $h . '</span>';
}

const ORDER_TONE = ['pending_payment' => 'warning', 'payment_review' => 'info', 'paid' => 'brand', 'processing' => 'accent', 'completed' => 'success', 'cancelled' => 'neutral', 'rejected' => 'danger', 'refunded' => 'neutral'];
const PAYMENT_TONE = ['awaiting' => 'warning', 'submitted' => 'info', 'confirmed' => 'success', 'rejected' => 'danger', 'refunded' => 'neutral'];

function order_status_badge(string $status): string
{
    return badge(e(T()['orderStatus'][$status] ?? $status), ORDER_TONE[$status] ?? 'neutral');
}

function payment_status_badge(string $status): string
{
    return badge(e(T()['paymentStatus'][$status] ?? $status), PAYMENT_TONE[$status] ?? 'neutral');
}

/** "## heading", "- list item" and blank-line paragraphs; everything is escaped. */
function rich_text(string $text, ?string $class = null): string
{
    $h = '<div' . ($class ? ' class="' . e($class) . '"' : '') . '>';
    foreach (preg_split('/\n{2,}/', str_replace("\r\n", "\n", $text)) as $block) {
        $lines = array_values(array_filter(explode("\n", $block), fn($l) => trim_js($l) !== ''));
        if (!$lines) continue;
        $nodes = '';
        $list = [];
        $flush = function () use (&$list, &$nodes) {
            if ($list) {
                $nodes .= '<ul>' . implode('', array_map(fn($li) => '<li>' . e($li) . '</li>', $list)) . '</ul>';
                $list = [];
            }
        };
        foreach ($lines as $line) {
            $l = trim_js($line);
            if (str_starts_with($l, '## ')) { $flush(); $nodes .= '<h2>' . e(substr($l, 3)) . '</h2>'; }
            elseif (str_starts_with($l, '- ')) $list[] = substr($l, 2);
            else { $flush(); $nodes .= '<p>' . e($l) . '</p>'; }
        }
        $flush();
        $h .= '<div>' . $nodes . '</div>';
    }
    return $h . '</div>';
}

function pagination(int $page, int $pages, string $basePath, array $params): string
{
    if ($pages <= 1) return '';
    $t = T();
    $href = function (int $p) use ($basePath, $params) {
        $qs = array_filter($params, fn($v) => $v !== null && $v !== '');
        if ($p > 1) $qs['page'] = (string) $p;
        $s = http_build_query($qs, '', '&', PHP_QUERY_RFC3986);
        return $s ? "$basePath?$s" : $basePath;
    };
    $label = fmt($t['common']['page'], ['page' => $page, 'pages' => $pages]);
    $h = '<nav aria-label="' . e($label) . '" class="mt-8 flex items-center justify-center gap-3">';
    if ($page > 1) $h .= '<a href="' . e($href($page - 1)) . '" class="' . button_class('outline', 'sm') . '" rel="prev">' . icon('chevron-start', 'size-4') . ' ' . e($t['common']['previous']) . '</a>';
    $h .= '<span class="text-sm text-fg-muted">' . e($label) . '</span>';
    if ($page < $pages) $h .= '<a href="' . e($href($page + 1)) . '" class="' . button_class('outline', 'sm') . '" rel="next">' . e($t['common']['next']) . ' ' . icon('chevron-end', 'size-4') . '</a>';
    return $h . '</nav>';
}

function logo_html(string $locale, string $name, ?string $logoUrl = null, ?string $href = null): string
{
    $h = '<a href="' . e($href ?? url("/$locale")) . '" class="group flex items-center gap-2.5 rounded-xl" aria-label="' . e($name) . '">';
    if ($logoUrl) $h .= '<img src="' . e($logoUrl) . '" alt="" width="36" height="36" class="size-9 rounded-xl object-cover">';
    else $h .= '<span class="hero-gradient grid size-9 place-items-center rounded-xl text-lg font-black text-white shadow-soft" aria-hidden="true">' . ($locale === 'ar' ? 'ح' : 'H') . '</span>';
    $h .= '<span class="flex flex-col leading-tight whitespace-nowrap"><span class="text-[0.95rem] font-extrabold tracking-tight">' . ($locale === 'ar' ? 'حسوني' : 'Hassouni') . '</span>';
    $h .= '<span class="hidden text-[0.68rem] font-semibold text-fg-subtle min-[400px]:block">' . ($locale === 'ar' ? 'لخدمات السوشل ميديا' : 'Digital Services') . '</span></span>';
    return $h . '</a>';
}

/** Mount point for an interactive component (React island bundled in assets/islands.js). */
function island(string $name, array $props, string $fallbackHtml = '', string $tag = 'div', ?string $class = null): string
{
    return '<' . $tag . ' data-island="' . e($name) . '" data-props="' . json_attr($props) . '"' . ($class ? ' class="' . e($class) . '"' : '') . '>' . $fallbackHtml . '</' . $tag . '>';
}

function file_url(?string $id): ?string
{
    return $id ? url('/api/files/' . $id) : null;
}
