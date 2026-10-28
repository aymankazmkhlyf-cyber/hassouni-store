<?php
declare(strict_types=1);

/** Below these, the counters would look odd, so they stay hidden until real numbers grow. */
const COMPLETED_MIN = 10;
const RATING_MIN = 3;

function home_section(string $title, string $children, string $action = ''): string
{
    return '<section class="mx-auto mt-14 max-w-6xl px-4"><div class="mb-5 flex items-end justify-between gap-4"><h2 class="text-xl font-extrabold tracking-tight sm:text-2xl">' . e($title) . '</h2>' . $action . '</div>' . $children . '</section>';
}

function page_home(array $params): array
{
    $l = loc();
    $t = T();
    $settings = load_settings();
    $categories = list_categories(true);
    $featured = list_products(['featured_only' => true, 'page_size' => 8]);
    $offers = $settings['showOffers'] ? list_products(['offers_only' => true, 'page_size' => 4]) : null;
    $reviews = latest_reviews(6);
    $stats = store_stats();
    // Shown only once the numbers are meaningful; they always come from real orders and reviews.
    $showCompleted = $stats['completed'] >= COMPLETED_MIN;
    $showRating = $stats['rating'] !== null && $stats['reviews'] >= RATING_MIN;
    $heroTitle = setting_l($settings, 'heroTitle', $l) ?: $t['home']['heroTitle'];
    $heroSubtitle = setting_l($settings, 'heroSubtitle', $l) ?: $t['home']['heroSubtitle'];

    $h = '<section class="px-4 pt-4 sm:pt-6"><div class="hero-gradient relative mx-auto max-w-6xl overflow-hidden rounded-[1.75rem] text-white shadow-lift">';
    $h .= '<div class="grid-pattern absolute inset-0 opacity-60" aria-hidden="true"></div><div class="relative grid gap-8 px-6 py-12 sm:px-10 sm:py-16 lg:grid-cols-[1.4fr_1fr] lg:items-center"><div class="animate-in">';
    $h .= '<span class="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold ring-1 ring-white/25">' . icon('shield', 'size-4') . ' ' . e($t['home']['heroBadge']) . '</span>';
    $h .= '<h1 class="mt-4 text-3xl leading-tight font-black tracking-tight sm:text-5xl sm:leading-tight">' . e($heroTitle) . '</h1>';
    $h .= '<p class="mt-4 max-w-xl text-base text-white/85 sm:text-lg">' . e($heroSubtitle) . '</p><div class="mt-7 flex flex-wrap gap-3">';
    $h .= '<a href="' . e(lp('/services')) . '" class="inline-flex h-12 items-center gap-2 rounded-xl bg-white px-6 font-bold text-[#2a1c86] shadow-soft transition hover:bg-white/90">' . e($t['home']['heroCta']) . ' ' . icon('chevron-end', 'size-4.5 rtl:rotate-180') . '</a>';
    $h .= '<a href="' . e(lp('/custom-request')) . '" class="inline-flex h-12 items-center rounded-xl px-5 font-bold text-white ring-1 ring-white/40 transition hover:bg-white/10">' . e($t['home']['heroSecondary']) . '</a></div>';
    $chip = fn(string $ic, string $text) => '<li class="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 font-semibold ring-1 ring-white/25">' . icon($ic, 'size-4') . ' ' . e($text) . '</li>';
    $h .= '<ul class="mt-6 flex flex-wrap gap-2 text-sm" data-testid="hero-stats">';
    if ($showCompleted) $h .= $chip('check', fmt($t['home']['statCompleted'], ['n' => num($stats['completed'])]));
    if ($showRating) $h .= $chip('star', fmt($t['home']['statRating'], ['avg' => number_format($stats['rating'], 1, '.', ''), 'n' => $stats['reviews']]));
    $h .= $chip('clock', $t['home']['statSpeed']) . '</ul></div>';
    $h .= '<ul class="hidden grid-cols-2 gap-3 lg:grid" aria-hidden="true">';
    foreach (array_slice($categories, 0, 4) as $c) {
        $h .= '<li class="rounded-2xl bg-white/12 p-4 ring-1 ring-white/20 backdrop-blur-sm">' . icon($c['icon'], 'size-7') . '<p class="mt-3 text-sm font-bold">' . e(L($c, 'name', $l)) . '</p></li>';
    }
    $h .= '</ul></div></div></section>';

    $viewAll = fn(string $href) => '<a href="' . e($href) . '" class="text-sm font-semibold text-brand hover:underline">' . e($t['common']['viewAll']) . '</a>';
    $cats = '<ul class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">';
    foreach ($categories as $c) $cats .= '<li>' . category_card($c) . '</li>';
    $h .= home_section($t['home']['categories'], $cats . '</ul>', $viewAll(lp('/services')));
    if ($featured['items']) $h .= home_section($t['home']['featured'], product_grid($featured['items']));
    if ($offers && $offers['items']) $h .= home_section($t['home']['offers'], product_grid($offers['items']));

    $how = '<ol class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">';
    foreach ($t['home']['how'] as $i => $step) {
        $how .= '<li class="rounded-(--radius-card) border border-line bg-elevated p-5 shadow-soft"><span class="grid size-10 place-items-center rounded-xl bg-brand text-lg font-black text-brand-fg">' . ($i + 1) . '</span><h3 class="mt-4 font-bold">' . e($step['title']) . '</h3><p class="mt-1 text-sm text-fg-muted">' . e($step['body']) . '</p></li>';
    }
    $h .= home_section($t['home']['howTitle'], $how . '</ol>');
    $h .= latest_reviews_section($reviews);
    $h .= home_section($t['home']['faqTitle'], faq_list(array_slice(data_file('content.json')['faq'][$l], 0, 4)), $viewAll(lp('/faq')));
    $h .= home_section($t['home']['supportTitle'], '<p class="mb-4 text-fg-muted">' . e($t['home']['supportBody']) . '</p>' . contact_links($settings));
    $h .= '<div class="mx-auto mt-10 max-w-6xl px-4">' . button_link(lp('/services'), e($t['home']['heroCta']), 'primary', 'lg', 'w-full sm:w-auto') . '</div>';
    return ['html' => $h];
}
