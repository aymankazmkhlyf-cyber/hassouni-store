<?php
/* Page shell: <head> metadata, store header/footer, admin frame, error pages. */

declare(strict_types=1);

const THEME_SCRIPT = "(function(){try{var t=localStorage.getItem('hds_theme');var d=t?t==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;if(d)document.documentElement.classList.add('dark')}catch(e){}})();";

/**
 * $page keys: html, title?, description?, layout (store|admin|bare), private?, noindex?, nofollow?,
 * status?, referrer?, alternates? (bool, default true).
 */
function render_page(array $page): void
{
    $locale = loc();
    $t = T();
    if (!empty($page['status'])) http_response_code($page['status']);
    send_security_headers(!empty($page['private']));
    header('Content-Type: text/html; charset=utf-8');

    $store = $t['meta']['storeName'];
    $title = isset($page['title']) && $page['title'] !== '' ? $page['title'] . ' | ' . $store : $store;
    $desc = $page['description'] ?? $t['meta']['description'];
    $base = site_url();
    $path = request_path();
    $robots = [];
    if (!empty($page['noindex']) || !empty($page['private'])) $robots[] = 'noindex';
    if (!empty($page['nofollow']) || !empty($page['private'])) $robots[] = 'nofollow';

    $head = '<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">';
    $head .= '<title>' . e($title) . '</title>';
    if ($desc !== '') $head .= '<meta name="description" content="' . e($desc) . '">';
    $head .= '<meta name="application-name" content="' . e($store) . '">';
    if ($robots) $head .= '<meta name="robots" content="' . implode(', ', $robots) . '">';
    if (!empty($page['referrer'])) $head .= '<meta name="referrer" content="' . e($page['referrer']) . '">';
    if (($page['alternates'] ?? true) && $base !== '') {
        $rest = preg_replace('#^/(ar|en)#', '', $path);
        foreach (LOCALES as $l) $head .= '<link rel="alternate" hreflang="' . $l . '" href="' . e($base . '/' . $l . $rest) . '">';
    }
    $head .= '<meta property="og:title" content="' . e($page['title'] ?? $store) . '"><meta property="og:description" content="' . e($desc) . '">';
    $head .= '<meta property="og:site_name" content="' . e($store) . '"><meta property="og:locale" content="' . ($locale === 'ar' ? 'ar_IQ' : 'en_US') . '"><meta property="og:type" content="' . e($page['ogType'] ?? 'website') . '">';
    if (!empty($page['canonical']) && $base !== '') $head .= '<link rel="canonical" href="' . e($base . $page['canonical']) . '">';
    if ($base !== '') $head .= '<meta property="og:url" content="' . e($base . $path) . '"><meta property="og:image" content="' . e($base . '/og-image.png') . '"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">';
    $head .= '<meta name="twitter:card" content="summary_large_image">';
    $head .= '<meta name="format-detection" content="telephone=no">';
    $head .= '<meta name="apple-mobile-web-app-capable" content="yes"><meta name="mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-title" content="' . e($t['meta']['shortName']) . '"><meta name="apple-mobile-web-app-status-bar-style" content="default">';
    $head .= '<meta name="theme-color" media="(prefers-color-scheme: light)" content="#f6f6fb"><meta name="theme-color" media="(prefers-color-scheme: dark)" content="#0c0c14">';
    $head .= '<link rel="icon" href="' . e(url('/icon.svg')) . '" type="image/svg+xml"><link rel="apple-touch-icon" href="' . e(url('/apple-touch-icon.png')) . '"><link rel="manifest" href="' . e(url('/manifest.webmanifest')) . '">';
    $head .= '<link rel="preload" href="' . e(url('/assets/fonts/cairo-arabic-wght-normal.woff2')) . '" as="font" type="font/woff2" crossorigin>';
    $head .= '<script nonce="' . e(csp_nonce()) . '">' . THEME_SCRIPT . '</script>';
    $head .= '<link rel="stylesheet" href="' . e(asset('app.css')) . '">';
    $head .= $page['head'] ?? '';

    $body = match ($page['layout'] ?? 'store') {
        'admin' => admin_frame($page['html'], $page['user']),
        'bare' => $page['html'],
        default => store_frame($page['html']),
    };

    echo '<!DOCTYPE html><html lang="' . $locale . '" dir="' . dir_for($locale) . '"><head>' . $head . '</head><body class="antialiased">'
        . $body
        . '<script src="' . e(asset('islands.js')) . '" nonce="' . e(csp_nonce()) . '" defer></script></body></html>';
}

/* ------------------------------ Store frame ------------------------------ */

function store_frame(string $main): string
{
    $locale = loc();
    $t = T();
    $user = current_user();
    $settings = load_settings();
    $categories = list_categories(true);
    $support = array_merge($t['support'], ['rateLimited' => $t['errors']['rateLimited'], 'invalidPhone' => $t['errors']['invalidPhone']]);
    return store_header($user, $settings, $categories)
        . '<main id="main" class="min-h-[60vh]">' . $main . '</main>'
        . store_footer($settings, $categories)
        . island('SupportWidget', ['locale' => $locale, 's' => $support])
        . island('ServiceWorkerRegister', [])
        . island('InstallPrompt', ['s' => $t['pwa']]);
}

function store_header(?array $user, array $settings, array $categories): string
{
    $locale = loc();
    $t = T();
    $nav = [
        [lp('/services'), $t['nav']['services'], 'grid'],
        [lp('/custom-request'), $t['nav']['customRequest'], 'wand'],
        [lp('/track'), $t['nav']['track'], 'search'],
        [lp('/faq'), $t['nav']['faq'], 'info'],
        [lp('/contact'), $t['nav']['contact'], 'chat'],
    ];
    $accountHref = $user ? (is_staff_role($user['role']) ? lp('/admin') : lp('/account')) : lp('/login');
    $notice = setting_l($settings, 'notice', $locale);
    $logoUrl = file_url($settings['logoFileId']);
    $storeName = setting_l($settings, 'storeName', $locale);

    $menuLinks = [['href' => lp(''), 'label' => $t['nav']['home'], 'icon' => 'home']];
    foreach ($nav as [$href, $label, $ic]) $menuLinks[] = ['href' => $href, 'label' => $label, 'icon' => $ic];
    foreach ($categories as $c) $menuLinks[] = ['href' => lp('/category/' . $c['slug']), 'label' => L($c, 'name', $locale), 'icon' => $c['icon']];
    $menuLinks[] = ['href' => $accountHref, 'label' => $user ? $t['nav']['account'] : $t['nav']['login'], 'icon' => 'user'];

    $h = '<a href="#main" class="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:start-2 focus:z-[60] focus:rounded-lg focus:bg-brand focus:px-4 focus:py-2 focus:text-brand-fg">' . e($t['nav']['skipToContent']) . '</a>';
    if ($notice !== '') $h .= '<div class="bg-brand px-4 py-2 text-center text-sm font-semibold text-brand-fg" role="note">' . e($notice) . '</div>';
    $h .= '<header class="sticky top-0 z-40 border-b border-line bg-elevated/85 backdrop-blur-md supports-[backdrop-filter]:bg-elevated/75"><div class="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4">';
    $h .= island('MobileMenu', [
        'title' => $t['nav']['menu'], 'openLabel' => $t['nav']['menu'], 'closeLabel' => $t['nav']['closeMenu'],
        'links' => $menuLinks, 'footerHtml' => contact_links($settings, null, 'icons'),
    ], '<button type="button" class="grid size-10 place-items-center rounded-xl hover:bg-muted xl:hidden" aria-label="' . e($t['nav']['menu']) . '">' . icon('menu', 'size-5.5') . '</button>', 'div', 'contents');
    $h .= logo_html($locale, $storeName, $logoUrl);
    $h .= '<nav aria-label="' . e($t['nav']['menu']) . '" class="ms-6 hidden xl:block"><ul class="flex items-center gap-1">';
    foreach ($nav as [$href, $label]) $h .= '<li><a href="' . e($href) . '" class="rounded-lg px-3 py-2 text-sm font-semibold whitespace-nowrap text-fg-muted hover:bg-muted hover:text-fg">' . e($label) . '</a></li>';
    $h .= '</ul></nav><div class="ms-auto flex items-center gap-0.5">';
    $h .= '<form action="' . e(lp('/search')) . '" method="get" role="search" class="relative me-1 hidden md:block"><label for="header-search" class="sr-only">' . e($t['nav']['search']) . '</label>'
        . icon('search', 'pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle')
        . '<input id="header-search" name="q" type="search" maxlength="80" placeholder="' . e($t['nav']['searchPlaceholder']) . '" class="h-10 w-52 rounded-xl border border-line bg-muted ps-9 pe-3 text-sm placeholder:text-fg-subtle focus:border-brand focus:bg-elevated focus:outline-none lg:w-60"></form>';
    $h .= '<a href="' . e(lp('/search')) . '" class="grid size-10 place-items-center rounded-xl hover:bg-muted md:hidden" aria-label="' . e($t['nav']['search']) . '">' . icon('search', 'size-5') . '</a>';
    $h .= header_widgets($locale, $t);
    $h .= '<a href="' . e($accountHref) . '" class="hidden size-10 place-items-center rounded-xl hover:bg-muted sm:grid" aria-label="' . e($user ? $t['nav']['account'] : $t['nav']['login']) . '">' . icon('user', 'size-5') . '</a>';
    $h .= island('CartButton', ['locale' => $locale, 'label' => $t['nav']['cart']], '<a href="' . e(lp('/cart')) . '" class="relative grid size-10 place-items-center rounded-xl text-fg hover:bg-muted" aria-label="' . e($t['nav']['cart']) . '">' . icon('cart', 'size-5.5') . '</a>', 'div', 'contents');
    return $h . '</div></div></header>';
}

/** Theme toggle + language switcher (islands with server-rendered fallbacks so nothing jumps). */
function header_widgets(string $locale, array $t): string
{
    $qs = $_SERVER['QUERY_STRING'] ?? '';
    $to = other_locale($locale);
    $h = island('ThemeToggle', ['label' => $t['nav']['themeToggle']], '<button type="button" aria-label="' . e($t['nav']['themeToggle']) . '" class="grid size-10 place-items-center rounded-xl hover:bg-muted">' . icon('moon', 'size-5') . '</button>', 'div', 'contents');
    $h .= island('LanguageSwitcher', ['locale' => $locale, 'label' => $t['nav']['language'], 'ariaLabel' => $t['nav']['languageLabel']],
        '<a href="' . e(switch_locale_path(request_path(), $qs, $to)) . '" hreflang="' . $to . '" lang="' . $to . '" aria-label="' . e($t['nav']['languageLabel']) . '" class="inline-flex h-10 items-center gap-1.5 rounded-xl px-2.5 text-sm font-semibold hover:bg-muted">' . icon('globe', 'size-4.5') . '<span>' . e($t['nav']['language']) . '</span></a>', 'div', 'contents');
    return $h;
}

function store_footer(array $settings, array $categories): string
{
    $locale = loc();
    $t = T();
    $name = setting_l($settings, 'storeName', $locale);
    $col = function (string $title, array $links) {
        $h = '<div><h2 class="mb-3 text-sm font-bold">' . e($title) . '</h2><ul class="space-y-2">';
        foreach ($links as [$href, $label]) $h .= '<li><a href="' . e($href) . '" class="text-sm text-fg-muted hover:text-brand">' . e($label) . '</a></li>';
        return $h . '</ul></div>';
    };
    $h = '<footer class="mt-20 border-t border-line bg-elevated"><div class="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4"><div class="space-y-4">';
    $h .= logo_html($locale, $name, file_url($settings['logoFileId']));
    $h .= '<p class="text-sm text-fg-muted">' . e($t['footer']['about']) . '</p>' . contact_links($settings, null, 'icons');
    $h .= island('InstallAppButton', ['s' => ['getApp' => $t['pwa']['getApp'], 'installed' => $t['pwa']['installed']], 'className' => 'inline-flex items-center gap-2 rounded-xl border border-brand/40 bg-brand-soft px-3.5 py-2 text-sm font-bold text-brand-soft-fg hover:bg-brand hover:text-brand-fg']);
    $h .= '</div>';
    $h .= $col($t['nav']['categories'], array_map(fn($c) => [lp('/category/' . $c['slug']), L($c, 'name', $locale)], $categories));
    $h .= $col($t['footer']['links'], [
        [lp('/services'), $t['nav']['services']], [lp('/custom-request'), $t['nav']['customRequest']], [lp('/track'), $t['nav']['track']],
        [lp('/guides'), $t['guides']['title']], [lp('/faq'), $t['nav']['faq']], [lp('/contact'), $t['nav']['contact']],
    ]);
    $h .= $col($t['footer']['policies'], [[lp('/terms'), $t['legal']['terms']], [lp('/privacy'), $t['legal']['privacy']], [lp('/refund-policy'), $t['legal']['refund']]]);
    $year = baghdad(time())->format('Y');
    return $h . '</div><div class="border-t border-line"><p class="mx-auto max-w-6xl px-4 py-5 text-center text-xs text-fg-subtle">© <span class="ltr-nums">' . $year . '</span> ' . e($name) . '. ' . e($t['footer']['rights']) . '</p></div></footer>';
}

/* ------------------------------ Admin frame ------------------------------ */

function admin_frame(string $main, array $user): string
{
    $locale = loc();
    $t = T();
    $a = lp('/admin');
    $all = [
        [$a, $t['admin']['dashboard'], 'chart', 'dashboard:view', true],
        ["$a/orders", $t['admin']['orders'], 'receipt', 'orders:read', false],
        ["$a/support", $t['admin']['support'], 'chat', 'support:manage', false],
        ["$a/reviews", $t['admin']['reviews'], 'star', 'reviews:manage', false],
        ["$a/wallet", $t['admin']['wallet'], 'wallet', 'payments:review', false],
        ["$a/products", $t['admin']['products'], 'box', 'products:write', false],
        ["$a/categories", $t['admin']['categories'], 'grid', 'categories:write', false],
        ["$a/payment-methods", $t['admin']['paymentMethods'], 'card', 'payment_methods:write', false],
        ["$a/customers", $t['admin']['customers'], 'users', 'customers:read', false],
        ["$a/requests", $t['admin']['requests'], 'wand', 'requests:manage', false],
        ["$a/settings", $t['admin']['settings'], 'settings', 'settings:write', false],
        ["$a/audit", $t['admin']['audit'], 'list', 'audit:read', false],
        ["$a/password", $t['admin']['password'], 'lock', 'dashboard:view', false],
    ];
    // Hiding links is cosmetic; every page and action re-checks permissions on the server.
    $links = [];
    foreach ($all as [$href, $label, $ic, $perm, $exact]) {
        if (has_permission($user['role'], $perm)) $links[] = ['href' => $href, 'label' => $label, 'icon' => $ic, 'exact' => $exact];
    }
    $h = '<div class="min-h-dvh bg-bg"><header class="sticky top-0 z-30 border-b border-line bg-elevated/90 backdrop-blur"><div class="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4">';
    $h .= logo_html($locale, $t['meta']['storeName'], null, $a) . badge(e($t['admin']['panel']), 'brand', 'hidden sm:inline-flex');
    $h .= '<div class="ms-auto flex items-center gap-1"><span class="hidden text-xs text-fg-subtle md:inline">' . e($t['admin']['signedInAs']) . ' <span class="font-semibold text-fg">' . e($user['name']) . '</span> (' . e($user['role']) . ')</span>';
    if (has_permission($user['role'], 'support:manage')) {
        $h .= island('SupportNotifier', ['href' => "$a/support", 'label' => $t['admin']['support'], 'newMessage' => $t['admin']['supportPage']['newMessage']], '', 'div', 'contents');
    }
    $h .= header_widgets($locale, $t);
    $h .= button_link(lp(''), icon('external', 'size-4') . ' ' . e($t['admin']['viewStore']), 'ghost', 'sm', 'hidden sm:inline-flex');
    $h .= '<form action="' . e(url('/_action/auth.logout')) . '" method="post"><input type="hidden" name="locale" value="' . $locale . '"><button type="submit" class="' . button_class('ghost', 'sm') . '" aria-label="' . e($t['nav']['logout']) . '">' . icon('logout', 'size-4') . ' <span class="hidden sm:inline">' . e($t['nav']['logout']) . '</span></button></form>';
    $h .= '</div></div></header><div class="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[14rem_1fr]"><aside class="lg:sticky lg:top-22 lg:self-start">';
    $h .= island('AdminNav', ['links' => $links], admin_nav_fallback($links));
    return $h . '</aside><main id="main" class="min-w-0">' . $main . '</main></div></div>';
}

function admin_nav_fallback(array $links): string
{
    $path = request_path();
    $h = '<nav aria-label="Admin"><ul class="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">';
    foreach ($links as $l) {
        $active = $l['exact'] ? $path === $l['href'] : ($path === $l['href'] || str_starts_with($path, $l['href'] . '/'));
        $h .= '<li class="shrink-0"><a href="' . e($l['href']) . '"' . ($active ? ' aria-current="page"' : '') . ' class="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold whitespace-nowrap text-fg-muted hover:bg-muted hover:text-fg aria-[current=page]:bg-brand-soft aria-[current=page]:text-brand-soft-fg">' . icon($l['icon'], 'size-4.5') . e($l['label']) . '</a></li>';
    }
    return $h . '</ul></nav>';
}

/* ------------------------------ Error pages ------------------------------ */

function not_found_page(): array
{
    $t = T();
    $html = '<div class="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center gap-4 px-4 py-20 text-center">'
        . '<span class="hero-gradient grid size-20 place-items-center rounded-3xl text-4xl font-black text-white shadow-lift">404</span>'
        . '<h1 class="text-2xl font-extrabold">' . e($t['errors']['notFoundTitle']) . '</h1><p class="text-fg-muted">' . e($t['errors']['notFoundBody']) . '</p>'
        . button_link(lp(''), icon('home', 'size-4') . ' ' . e($t['errors']['goHome'])) . '</div>';
    // Like the original, the 404 page is shown without the store header and footer.
    return ['html' => $html, 'layout' => 'bare', 'noindex' => true, 'status' => 404, 'title' => $t['errors']['notFoundTitle']];
}

function render_error_page(): string
{
    $locale = loc();
    $s = $locale === 'en'
        ? ['Something went wrong', 'Please try again. If the problem continues, contact us.', 'Try again', 'Back to home']
        : ['حدث خطأ غير متوقع', 'يرجى المحاولة مرة أخرى. إذا استمرت المشكلة تواصل معنا.', 'حاول مرة أخرى', 'العودة إلى الرئيسية'];
    $css = function_exists('asset') ? '<link rel="stylesheet" href="' . e(asset('app.css')) . '">' : '';
    return '<!DOCTYPE html><html lang="' . $locale . '" dir="' . ($locale === 'ar' ? 'rtl' : 'ltr') . '"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>' . e($s[0]) . '</title>' . $css . '</head><body class="antialiased">'
        . '<div class="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center gap-4 px-4 py-20 text-center" role="alert"><h1 class="text-2xl font-extrabold">' . e($s[0]) . '</h1><p class="text-fg-muted">' . e($s[1]) . '</p>'
        . '<div class="flex gap-2"><a href="" class="' . button_class() . '">' . e($s[2]) . '</a><a href="/' . $locale . '" class="inline-flex h-11 items-center rounded-xl px-4 font-semibold hover:bg-muted">' . e($s[3]) . '</a></div></div></body></html>';
}
