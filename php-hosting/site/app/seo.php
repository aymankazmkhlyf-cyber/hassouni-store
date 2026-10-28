<?php
/* robots.txt, sitemap.xml and the web app manifest. */

declare(strict_types=1);

function serve_seo_file(string $path): never
{
    if ($path === '/robots.txt') {
        $base = site_url();
        send_text("User-Agent: *\nAllow: /\nDisallow: /api/\nDisallow: /*/admin\nDisallow: /*/orders/\nDisallow: /*/account\nDisallow: /*/checkout\nDisallow: /*/cart\n\nSitemap: $base/sitemap.xml\n", 200);
    }
    if ($path === '/manifest.webmanifest') {
        $icon = fn($s) => [['src' => '/icon-192.png', 'sizes' => '192x192']];
        send_text(json_out([
            'id' => '/ar',
            'name' => 'متجر حسوني لخدمات السوشل ميديا',
            'short_name' => 'حسوني',
            'description' => 'خدمات رقمية في العراق: سوشل ميديا، شحن ألعاب، اشتراكات وتصاميم.',
            'start_url' => '/ar',
            'scope' => '/',
            'display' => 'standalone',
            'dir' => 'rtl',
            'lang' => 'ar',
            'background_color' => '#f6f6fb',
            'theme_color' => '#5a3ff0',
            'orientation' => 'portrait',
            'categories' => ['shopping', 'business'],
            'shortcuts' => [
                ['name' => 'كل الخدمات', 'short_name' => 'الخدمات', 'url' => '/ar/services', 'icons' => $icon(0)],
                ['name' => 'السلة', 'url' => '/ar/cart', 'icons' => $icon(0)],
                ['name' => 'تتبع طلب', 'url' => '/ar/track', 'icons' => $icon(0)],
            ],
            'icons' => [
                ['src' => '/icon-192.png', 'sizes' => '192x192', 'type' => 'image/png'],
                ['src' => '/icon-512.png', 'sizes' => '512x512', 'type' => 'image/png'],
                ['src' => '/icon-maskable-512.png', 'sizes' => '512x512', 'type' => 'image/png', 'purpose' => 'maskable'],
            ],
        ]), 200, 'application/manifest+json; charset=utf-8');
    }
    // Sitemap: public pages, active categories and active products in both languages.
    $base = site_url();
    $urls = [];
    $both = function (string $p, ?string $lastmod, float $priority) use (&$urls, $base) {
        foreach (LOCALES as $l) {
            $urls[] = [$base . '/' . $l . $p, $lastmod, $l === 'ar' ? $priority : $priority - 0.1, $p];
        }
    };
    foreach (['', '/services', '/guides', '/custom-request', '/contact', '/faq', '/track', '/terms', '/privacy', '/refund-policy'] as $p) $both($p, null, $p === '' ? 1 : 0.7);
    foreach (all('SELECT slug, updated_at FROM categories WHERE is_active = 1') as $c) $both('/category/' . $c['slug'], iso_time($c['updated_at']), 0.8);
    foreach (all('SELECT slug, updated_at FROM products WHERE is_active = 1') as $p) $both('/services/' . $p['slug'], iso_time($p['updated_at']), 0.9);
    foreach (data_file('guides.json')['guides'] as $g) $both('/guides/' . $g['slug'], $g['updated'] . 'T00:00:00.000Z', 0.7);

    $xml = '<?xml version="1.0" encoding="UTF-8"?>' . "\n" . '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">' . "\n";
    foreach ($urls as [$loc, $lastmod, $priority, $p]) {
        $xml .= '<url><loc>' . e($loc) . '</loc>';
        foreach (LOCALES as $l) $xml .= '<xhtml:link rel="alternate" hreflang="' . $l . '" href="' . e($base . '/' . $l . $p) . '" />';
        if ($lastmod) $xml .= '<lastmod>' . e($lastmod) . '</lastmod>';
        $xml .= '<priority>' . rtrim(rtrim(number_format($priority, 1, '.', ''), '0'), '.') . '</priority></url>' . "\n";
    }
    send_text($xml . '</urlset>' . "\n", 200, 'application/xml; charset=utf-8');
}
