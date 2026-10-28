<?php
/*
 * Front controller: every request that is not a real file comes here
 * (see .htaccess). URLs are the same as on the original site.
 */

declare(strict_types=1);

require __DIR__ . '/app/bootstrap.php';

if (!is_installed()) {
    header('Location: ' . base_path() . '/install.php', true, 302);
    exit;
}

set_exception_handler(function (Throwable $e) {
    log_error(get_class($e) . ': ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
    if (!headers_sent()) http_response_code(500);
    echo render_error_page();
});

const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];

/** Page routes under /{locale}/… → [file, function]. */
const PAGE_ROUTES = [
    '' => ['store/home', 'page_home'],
    'services' => ['store/services', 'page_services'],
    'services/{slug}' => ['store/product', 'page_product'],
    'category/{slug}' => ['store/category', 'page_category'],
    'search' => ['store/search', 'page_search'],
    'cart' => ['store/cart', 'page_cart'],
    'checkout' => ['store/cart', 'page_checkout'],
    'orders/{reference}' => ['store/order', 'page_order'],
    'track' => ['store/cart', 'page_track'],
    'account' => ['store/account', 'page_account'],
    'account/wallet' => ['store/account', 'page_wallet'],
    'login' => ['store/auth', 'page_login'],
    'register' => ['store/auth', 'page_register'],
    'contact' => ['store/info', 'page_contact'],
    'faq' => ['store/info', 'page_faq'],
    'custom-request' => ['store/info', 'page_custom_request'],
    'terms' => ['store/info', 'page_terms'],
    'privacy' => ['store/info', 'page_privacy'],
    'refund-policy' => ['store/info', 'page_refund'],
    'guides' => ['store/guides', 'page_guides'],
    'guides/{slug}' => ['store/guides', 'page_guide'],
    'admin/login' => ['admin/auth', 'page_admin_login'],
    'admin/forgot-password' => ['admin/auth', 'page_admin_forgot'],
    'admin' => ['admin/dashboard', 'page_admin_dashboard'],
    'admin/orders' => ['admin/orders', 'page_admin_orders'],
    'admin/orders/{id}' => ['admin/orders', 'page_admin_order'],
    'admin/products' => ['admin/products', 'page_admin_products'],
    'admin/products/new' => ['admin/products', 'page_admin_product_new'],
    'admin/products/{id}' => ['admin/products', 'page_admin_product'],
    'admin/categories' => ['admin/catalog', 'page_admin_categories'],
    'admin/payment-methods' => ['admin/catalog', 'page_admin_payment_methods'],
    'admin/customers' => ['admin/customers', 'page_admin_customers'],
    'admin/customers/{id}' => ['admin/customers', 'page_admin_customer'],
    'admin/wallet' => ['admin/customers', 'page_admin_wallet'],
    'admin/reviews' => ['admin/reviews', 'page_admin_reviews'],
    'admin/requests' => ['admin/reviews', 'page_admin_requests'],
    'admin/support' => ['admin/support', 'page_admin_support'],
    'admin/support/{id}' => ['admin/support', 'page_admin_support_thread'],
    'admin/settings' => ['admin/settings', 'page_admin_settings'],
    'admin/audit' => ['admin/settings', 'page_admin_audit'],
    'admin/password' => ['admin/settings', 'page_admin_password'],
];

function match_route(string $rest): ?array
{
    foreach (PAGE_ROUTES as $pattern => $target) {
        $re = '#^' . preg_replace('#\\\{(\w+)\\\}#', '(?P<$1>[^/]+)', preg_quote($pattern, '#')) . '$#';
        if (preg_match($re, $rest, $m)) {
            return [$target, array_filter($m, 'is_string', ARRAY_FILTER_USE_KEY)];
        }
    }
    return null;
}

function dispatch(): void
{
    $path = request_path();
    $method = method();

    // Defence against cross-site form posts (cookies are SameSite=Lax as well).
    if (!in_array($method, SAFE_METHODS, true) && !same_origin_request()) send_text('Forbidden', 403);

    if (str_starts_with($path, '/_action/')) {
        if ($method !== 'POST') send_text('Method Not Allowed', 405);
        require APP_DIR . '/actions/dispatch.php';
        run_action(substr($path, 9));
        return;
    }
    if (str_starts_with($path, '/api/')) {
        require APP_DIR . '/api.php';
        run_api(substr($path, 5));
        return;
    }
    switch ($path) {
        case '/robots.txt':
        case '/sitemap.xml':
        case '/manifest.webmanifest':
            require APP_DIR . '/seo.php';
            serve_seo_file($path);
            return;
        case '/sw.js':
            // Always revalidated so updates reach customers quickly (sent from PHP so every host gets these headers).
            header('Content-Type: application/javascript; charset=utf-8');
            header('Cache-Control: no-cache, no-store, must-revalidate');
            header("Content-Security-Policy: default-src 'self'; script-src 'self'");
            header('X-Content-Type-Options: nosniff');
            readfile(APP_DIR . '/static/sw.js');
            return;
        case '/favicon.ico':
            header('Location: ' . url('/icon.svg'), true, 301);
            return;
    }

    $parts = explode('/', trim($path, '/'), 2);
    if (!is_locale($parts[0])) {
        // Same as the original: add the preferred language to the address.
        $pref = get_cookie(LOCALE_COOKIE);
        $locale = is_locale($pref) ? $pref : 'ar';
        $qs = $_SERVER['QUERY_STRING'] ?? '';
        $target = url('/' . $locale . ($path === '/' ? '' : $path)) . ($qs !== '' ? '?' . $qs : '');
        header('Location: ' . $target, true, 307);
        return;
    }
    $GLOBALS['LOCALE'] = $parts[0];
    $GLOBALS['T'] = dict($parts[0]);
    $rest = rtrim($parts[1] ?? '', '/');

    $route = match_route($rest);
    if (!$route) not_found();
    [[$file, $fn], $params] = $route;
    require_once APP_DIR . '/views/layout.php';
    require_once APP_DIR . '/views/components.php';
    require_once APP_DIR . '/views/' . $file . '.php';
    $page = $fn($params);
    render_page($page);
}

try {
    ob_start();
    dispatch();
    ob_end_flush();
} catch (HttpRedirect $r) {
    ob_end_clean();
    header('Location: ' . $r->location, true, $r->status);
} catch (HttpNotFound) {
    ob_end_clean();
    http_response_code(404);
    require_once APP_DIR . '/views/layout.php';
    require_once APP_DIR . '/views/components.php';
    render_page(not_found_page());
}
run_after_response();
