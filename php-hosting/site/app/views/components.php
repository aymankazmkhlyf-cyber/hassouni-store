<?php
/* Storefront building blocks shared by several pages (same markup as the original components). */

declare(strict_types=1);

function lp(string $path): string
{
    return url('/' . loc() . $path);
}

function copy_button(string $value): string
{
    $t = T();
    $fallback = '<button type="button" class="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-brand hover:bg-brand-soft">' . icon('copy', 'size-3.5') . '<span aria-live="polite">' . e($t['common']['copy']) . '</span></button>';
    return island('CopyButton', ['value' => $value, 'label' => $t['common']['copy'], 'copiedLabel' => $t['common']['copied']], $fallback, 'span', 'contents');
}

function contact_links(array $settings, ?string $message = null, string $variant = 'cards'): string
{
    $t = T();
    $items = [];
    if ($settings['whatsapp']) $items[] = ['whatsapp', $t['contact']['whatsapp'], $settings['whatsapp'], whatsapp_link($settings['whatsapp'], $message), 'text-[#128c4a] dark:text-[#4ade80]'];
    if ($settings['telegram']) $items[] = ['telegram', $t['contact']['telegram'], telegram_handle($settings['telegram']), telegram_link($settings['telegram']), 'text-[#1f87c7] dark:text-[#5cc0ff]'];
    if ($settings['instagram']) {
        $detail = preg_replace('#/$#', '', preg_replace('#^https?://(www\.)?instagram\.com/#', '@', $settings['instagram']));
        $items[] = ['instagram', $t['contact']['instagram'], $detail, $settings['instagram'], 'text-[#c13584] dark:text-[#f472b6]'];
    }
    if ($variant === 'icons') {
        $h = '<ul class="flex items-center gap-2">';
        foreach ($items as [$key, $label, , $href, $cls]) {
            $h .= '<li><a href="' . e($href) . '" target="_blank" rel="noopener noreferrer" aria-label="' . e($label) . '" class="' . cn('grid size-10 place-items-center rounded-xl bg-muted hover:brightness-95', $cls) . '">' . icon($key, 'size-5') . '</a></li>';
        }
        return $h . '</ul>';
    }
    $h = '<ul class="grid gap-3 sm:grid-cols-3">';
    foreach ($items as [$key, $label, $detail, $href, $cls]) {
        $h .= '<li><a href="' . e($href) . '" target="_blank" rel="noopener noreferrer" class="flex items-center gap-3 rounded-2xl border border-line bg-elevated p-4 transition hover:border-brand hover:shadow-soft">';
        $h .= '<span class="' . cn('grid size-11 shrink-0 place-items-center rounded-xl bg-muted', $cls) . '">' . icon($key, 'size-6') . '</span>';
        $h .= '<span class="min-w-0"><span class="block font-bold">' . e($label) . '</span><span class="ltr-nums block truncate text-sm text-fg-muted" dir="ltr">' . e($detail) . '</span></span></a></li>';
    }
    return $h . '</ul>';
}

function product_card(array $p): string
{
    $t = T();
    $l = loc();
    $name = L($p, 'name', $l);
    $summary = L($p, 'summary', $l);
    $h = '<article class="group relative flex h-full flex-col overflow-hidden rounded-(--radius-card) border border-line bg-elevated shadow-soft transition duration-200 hover:-translate-y-0.5 hover:border-brand/50 hover:shadow-lift">';
    $h .= '<div class="relative aspect-[16/10] overflow-hidden bg-muted">';
    $h .= $p['image_file_id']
        ? '<img src="' . e(file_url($p['image_file_id'])) . '" alt="" loading="lazy" decoding="async" class="size-full object-cover transition duration-300 group-hover:scale-[1.03]">'
        : product_art($p['slug'], $p['icon']);
    $h .= '<div class="absolute end-3 top-3 flex flex-wrap justify-end gap-1.5">';
    if ($p['is_featured']) $h .= badge('⭐ ' . e($t['product']['popular']), 'warning', 'shadow-sm');
    if ($p['has_offer']) $h .= badge(e($t['product']['discount']), 'danger');
    if ($p['is_sample']) $h .= badge(e($t['common']['sample']), 'warning');
    $h .= '</div></div><div class="flex flex-1 flex-col gap-2 p-4">';
    $h .= '<p class="text-xs font-semibold text-brand">' . e(L($p, 'category_name', $l)) . '</p>';
    $h .= '<h3 class="text-base leading-snug font-bold"><a href="' . e(lp('/services/' . $p['slug'])) . '" class="after:absolute after:inset-0 focus-visible:outline-none">' . e($name) . '</a></h3>';
    if ($summary !== '') $h .= '<p class="line-clamp-2 text-sm text-fg-muted">' . e($summary) . '</p>';
    if ($p['rating_count'] > 0 && $p['rating_avg'] !== null) {
        $avg = number_format($p['rating_avg'], 1, '.', '');
        $h .= '<p class="flex items-center gap-1.5 text-xs">' . stars($p['rating_avg'], fmt($t['reviews']['outOf'], ['avg' => $avg]), 'text-sm') . '<span class="ltr-nums font-bold">' . $avg . '</span><span class="ltr-nums text-fg-subtle">(' . $p['rating_count'] . ')</span></p>';
    }
    $h .= '<div class="mt-auto flex items-end justify-between gap-2 pt-2">';
    $h .= $p['starting_price'] !== null
        ? '<p class="text-sm"><span class="block text-xs text-fg-subtle">' . e($t['common']['from']) . '</span>' . price_html($p['starting_price'], $l, 'text-lg text-fg') . '</p>'
        : '<span></span>';
    $h .= '<span class="grid size-9 place-items-center rounded-xl bg-brand-soft text-brand-soft-fg transition group-hover:bg-brand group-hover:text-brand-fg" aria-hidden="true">' . icon('chevron-end', 'size-4.5 rtl:rotate-180') . '</span>';
    return $h . '</div></div></article>';
}

function product_grid(array $items): string
{
    $h = '<ul class="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">';
    foreach ($items as $p) $h .= '<li>' . product_card($p) . '</li>';
    return $h . '</ul>';
}

function category_card(array $c): string
{
    $l = loc();
    return '<a href="' . e(lp('/category/' . $c['slug'])) . '" class="group flex h-full items-start gap-3.5 rounded-(--radius-card) border border-line bg-elevated p-4 shadow-soft transition hover:border-brand/50 hover:shadow-lift">'
        . '<span class="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand-soft-fg transition group-hover:bg-brand group-hover:text-brand-fg">' . icon($c['icon'], 'size-6') . '</span>'
        . '<span class="min-w-0"><span class="block font-bold">' . e(L($c, 'name', $l)) . '</span><span class="mt-0.5 line-clamp-2 block text-sm text-fg-muted">' . e(L($c, 'description', $l)) . '</span></span></a>';
}

function page_header(string $title, ?string $subtitle = null, string $childrenHtml = ''): string
{
    $h = '<div class="border-b border-line bg-elevated"><div class="mx-auto max-w-6xl px-4 py-8 sm:py-10">' . $childrenHtml;
    $h .= '<h1 class="text-2xl font-extrabold tracking-tight sm:text-3xl">' . e($title) . '</h1>';
    if ($subtitle) $h .= '<p class="mt-2 max-w-2xl text-fg-muted">' . e($subtitle) . '</p>';
    return $h . '</div></div>';
}

/** $items: [[label, href|null], ...] */
function breadcrumbs(array $items): string
{
    $h = '<nav aria-label="breadcrumb" class="mb-3"><ol class="flex flex-wrap items-center gap-1 text-xs text-fg-subtle">';
    foreach ($items as $i => [$label, $href]) {
        $h .= '<li class="flex items-center gap-1">' . ($i > 0 ? icon('chevron-end', 'size-3 rtl:rotate-180') : '');
        $h .= $href ? '<a href="' . e($href) . '" class="hover:text-brand">' . e($label) . '</a>' : '<span aria-current="page" class="text-fg-muted">' . e($label) . '</span>';
        $h .= '</li>';
    }
    return $h . '</ol></nav>';
}

function parse_sort(?string $v): string
{
    return in_array($v, ['price_asc', 'price_desc', 'newest'], true) ? $v : 'featured';
}

function catalog_filters(string $action, string $sort, ?array $categories = null, ?string $category = null): string
{
    $t = T();
    $l = loc();
    $h = '<form action="' . e($action) . '" method="get" class="mb-6 flex flex-wrap items-end gap-3 rounded-(--radius-card) border border-line bg-elevated p-3 shadow-soft">';
    if ($categories !== null) {
        $opts = ['' => $t['common']['all']];
        foreach ($categories as $c) $opts[$c['slug']] = L($c, 'name', $l);
        $h .= '<label class="min-w-40 flex-1 text-sm font-semibold sm:flex-none"><span class="mb-1 block">' . e($t['shop']['category']) . '</span>' . select_tag(['name' => 'category'], $opts, $category ?? '') . '</label>';
    }
    $h .= '<label class="min-w-40 flex-1 text-sm font-semibold sm:flex-none"><span class="mb-1 block">' . e($t['shop']['sort']) . '</span>'
        . select_tag(['name' => 'sort'], ['featured' => $t['shop']['sortFeatured'], 'price_asc' => $t['shop']['sortPriceAsc'], 'price_desc' => $t['shop']['sortPriceDesc'], 'newest' => $t['shop']['sortNewest']], $sort) . '</label>';
    return $h . '<button type="submit" class="' . button_class('secondary', 'md') . '">' . e($t['common']['filter']) . '</button></form>';
}

function faq_list(array $items): string
{
    $h = '<div class="divide-y divide-line overflow-hidden rounded-(--radius-card) border border-line bg-elevated shadow-soft">';
    foreach ($items as $item) {
        $h .= '<details class="group"><summary class="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-semibold hover:bg-muted [&amp;::-webkit-details-marker]:hidden">' . e($item['q'])
            . icon('chevron-down', 'size-5 shrink-0 text-fg-subtle transition group-open:rotate-180') . '</summary><p class="px-5 pb-5 text-fg-muted">' . e($item['a']) . '</p></details>';
    }
    return $h . '</div>';
}

/* ------------------------------ Guides ------------------------------ */

function guides(): array
{
    return data_file('guides.json')['guides'];
}

function get_guide(string $slug): ?array
{
    foreach (guides() as $g) if ($g['slug'] === $slug) return $g;
    return null;
}

function guide_for_product(string $productSlug): ?array
{
    foreach (guides() as $g) if (in_array($productSlug, $g['products'], true)) return $g;
    return null;
}

function payment_guide(string $methodCode): ?array
{
    $slug = data_file('guides.json')['paymentGuides'][$methodCode] ?? null;
    return $slug ? get_guide($slug) : null;
}

function guide_art(array $guide, string $locale, string $class): string
{
    return str_replace('__CLASS__', e($class), data_file('guide-art.json')[$guide['slug'] . ':' . $locale] ?? '');
}

/** Collapsible "how do I…?" help with the guide's illustration and steps (no JavaScript needed). */
function guide_help(array $guide, string $summary, string $readMore, bool $open = false): string
{
    $l = loc();
    $h = '<details class="group rounded-2xl border border-brand/30 bg-brand-soft/40 p-3 open:bg-elevated"' . ($open ? ' open' : '') . ' data-testid="guide-help">';
    $h .= '<summary class="flex cursor-pointer list-none items-center gap-2 text-sm font-bold text-brand-soft-fg [&amp;::-webkit-details-marker]:hidden">' . icon('info', 'size-4.5 shrink-0') . '<span class="flex-1">' . e($summary) . '</span>' . icon('plus', 'size-4 transition group-open:rotate-45') . '</summary>';
    $h .= '<div class="mt-3 grid gap-4 sm:grid-cols-[11rem_1fr] sm:items-start">' . guide_art($guide, $l, 'mx-auto w-44 max-w-full');
    $h .= '<div class="space-y-2 text-sm"><ol class="list-decimal space-y-1.5 ps-5">';
    foreach ($guide['steps'][$l] as $s) $h .= '<li>' . e($s) . '</li>';
    $h .= '</ol>';
    if (!empty($guide['tips'][$l][0])) $h .= '<p class="text-xs text-fg-muted">💡 ' . e($guide['tips'][$l][0]) . '</p>';
    $h .= '<a href="' . e(lp('/guides/' . $guide['slug'])) . '" class="inline-block text-xs font-semibold text-brand hover:underline">' . e($readMore) . '</a>';
    return $h . '</div></div></details>';
}

/* ------------------------------ Payment details ------------------------------ */

/** Amount, where to pay (number + optional transfer QR) and the method's instructions. */
function payment_details(?array $method, ?int $amount): string
{
    $t = T();
    $l = loc();
    $o = $t['order'];
    $instructions = $method ? L($method, 'instructions', $l) : '';
    $h = '<div class="grid gap-3 rounded-xl bg-muted p-4 sm:grid-cols-2" data-testid="payment-details">';
    $h .= '<div><p class="text-xs text-fg-subtle">' . e($o['amountDue']) . '</p><p class="ltr-nums text-2xl font-black" dir="ltr">' . ($amount ? e(format_iqd($amount, $l)) : '—') . '</p></div>';
    $h .= '<div><p class="text-xs text-fg-subtle">' . e($o['payTo']) . ($method ? ' — ' . e(L($method, 'name', $l)) : '') . '</p>';
    $h .= $method && $method['account_details'] !== ''
        ? '<p class="flex items-center gap-2"><span class="ltr-nums font-bold" dir="ltr">' . e($method['account_details']) . '</span>' . copy_button($method['account_details']) . '</p>'
        : '<p class="text-sm text-fg-muted">' . e($o['payToMissing']) . '</p>';
    $h .= '</div>';
    if ($method && $method['qr_file_id']) {
        $src = e(file_url($method['qr_file_id']));
        $h .= '<figure class="flex flex-col items-center gap-2 rounded-xl bg-elevated p-3 sm:col-span-2 sm:flex-row sm:items-center sm:gap-4"><img src="' . $src . '" alt="' . e($o['qrAlt']) . '" class="w-48 max-w-full rounded-lg">'
            . '<figcaption class="space-y-1 text-sm"><p class="font-bold">' . e($o['scanQr']) . '</p><p class="text-fg-muted">' . e($o['scanQrHint']) . '</p><a href="' . $src . '" download="payment-qr" class="inline-block font-semibold text-brand hover:underline">' . e($o['saveQr']) . '</a></figcaption></figure>';
    }
    if ($instructions !== '') $h .= '<p class="text-sm whitespace-pre-line text-fg-muted sm:col-span-2">' . e($instructions) . '</p>';
    return $h . '</div>';
}

/* ------------------------------ Reviews ------------------------------ */

function review_card(array $r, ?array $product = null): string
{
    $t = T();
    $l = loc();
    $pkg = L($r, 'package_label', $l);
    $h = '<article class="flex h-full flex-col gap-2 rounded-2xl border border-line bg-elevated p-4"><div class="flex items-center justify-between gap-2">';
    $h .= stars((float) $r['rating'], fmt($t['reviews']['starsLabel'], ['n' => $r['rating']]), 'text-base');
    $h .= '<time class="ltr-nums text-xs text-fg-subtle" datetime="' . e(iso_time($r['created_at'])) . '">' . e(format_date($r['created_at'], $l)) . '</time></div>';
    if ($r['comment'] !== '') $h .= '<p class="text-sm leading-relaxed whitespace-pre-line" dir="auto">' . e($r['comment']) . '</p>';
    $h .= '<p class="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-fg-muted"><span class="font-bold text-fg" dir="auto">' . e($r['display_name']) . '</span>';
    $h .= '<span class="inline-flex items-center gap-1 font-semibold text-success">' . icon('check', 'size-3.5') . ' ' . e($t['reviews']['verified']) . '</span>';
    if ($pkg !== '') $h .= '<span>· ' . e($pkg) . '</span>';
    $h .= '</p>';
    if ($product) $h .= '<a href="' . e($product['href']) . '" class="text-xs font-semibold text-brand hover:underline">' . e(fmt($t['reviews']['on'], ['product' => $product['name']])) . '</a>';
    if ($r['staff_reply']) {
        $h .= '<div class="rounded-xl bg-muted p-3 text-sm"><p class="mb-0.5 text-xs font-bold text-brand">' . e($t['reviews']['storeReply']) . '</p><p class="whitespace-pre-line text-fg-muted" dir="auto">' . e($r['staff_reply']) . '</p></div>';
    }
    return $h . '</article>';
}

function product_reviews(array $summary, array $items): string
{
    $t = T();
    $h = '<section id="reviews" class="mt-14 scroll-mt-24" aria-labelledby="reviews-title"><h2 id="reviews-title" class="mb-5 text-xl font-extrabold">' . e($t['reviews']['title']) . '</h2>';
    if ($summary['count'] === 0) {
        return $h . '<div class="rounded-2xl border border-dashed border-line-strong p-6 text-center"><p class="font-bold">' . e($t['reviews']['none']) . '</p><p class="mt-1 text-sm text-fg-muted">' . e($t['reviews']['noneBody']) . '</p></div></section>';
    }
    $avg = number_format($summary['average'], 1, '.', '');
    $h .= '<div class="grid gap-6 lg:grid-cols-[17rem_1fr]"><div class="h-fit rounded-2xl border border-line bg-elevated p-5">';
    $h .= '<p class="ltr-nums text-4xl font-black" dir="ltr">' . $avg . '</p>' . stars((float) $summary['average'], fmt($t['reviews']['outOf'], ['avg' => $avg]), 'mt-1 text-xl');
    $h .= '<p class="mt-1 text-sm text-fg-muted">' . e(fmt($t['reviews']['count'], ['count' => $summary['count']])) . '</p><ul class="mt-4 space-y-1.5">';
    foreach ([5, 4, 3, 2, 1] as $n) {
        $c = $summary['distribution'][$n - 1] ?? 0;
        $h .= '<li class="flex items-center gap-2 text-xs"><span class="ltr-nums w-3 text-fg-muted">' . $n . '</span><span class="h-2 flex-1 overflow-hidden rounded-full bg-muted"><span class="block h-full rounded-full bg-amber-400" style="width:' . ($c / $summary['count'] * 100) . '%"></span></span><span class="ltr-nums w-6 text-end text-fg-subtle">' . $c . '</span></li>';
    }
    $h .= '</ul><p class="mt-4 text-xs text-fg-subtle">' . e($t['reviews']['noneBody']) . '</p></div><ul class="grid gap-3 sm:grid-cols-2">';
    foreach ($items as $r) $h .= '<li>' . review_card($r) . '</li>';
    return $h . '</ul></div></section>';
}

function latest_reviews_section(array $items): string
{
    if (!$items) return '';
    $t = T();
    $l = loc();
    $h = '<section class="mx-auto max-w-6xl px-4 py-10"><h2 class="text-2xl font-extrabold">' . e($t['reviews']['latestTitle']) . '</h2><p class="mt-1 mb-5 text-fg-muted">' . e($t['reviews']['latestBody']) . '</p><ul class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">';
    foreach ($items as $r) $h .= '<li>' . review_card($r, ['href' => lp('/services/' . $r['product_slug'] . '#reviews'), 'name' => L($r, 'product_name', $l)]) . '</li>';
    return $h . '</ul></section>';
}

function policy_page(string $title, string $text, string $updatedAt): string
{
    $t = T();
    $sub = $updatedAt !== '' ? $t['legal']['lastUpdated'] . ': ' . format_date($updatedAt, loc()) : null;
    return page_header($title, $sub) . '<div class="mx-auto max-w-3xl px-4 py-8"><article class="rounded-(--radius-card) border border-line bg-elevated p-5 shadow-soft sm:p-8">' . rich_text($text, 'prose-policy') . '</article></div>';
}
