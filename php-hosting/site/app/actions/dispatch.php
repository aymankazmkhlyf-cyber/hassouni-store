<?php
/*
 * POST /_action/<group>.<name> — the PHP versions of the original server actions.
 * Answers JSON { state, redirect?, refresh? } to the islands / admin forms.
 * Plain HTML form posts (no JavaScript) get a redirect instead: to the action's
 * target, or back to the page with the result kept for one view ("flash").
 */

declare(strict_types=1);

final class ActionRedirect extends Exception
{
    public function __construct(public readonly string $to)
    {
        parent::__construct('redirect');
    }
}

/** Ends an action with a navigation (like redirect() inside a server action). */
function action_redirect(string $to): never
{
    throw new ActionRedirect($to);
}

/** Asks the page to reload after $ms (like revalidatePath refreshing server-rendered parts). */
function action_refresh(int $ms = 0): void
{
    $GLOBALS['ACTION_REFRESH'] = $ms;
}

function action_locale(): string
{
    $l = $_POST['locale'] ?? null;
    return is_locale($l) ? $l : 'ar';
}

/** Only same-site relative paths are allowed as post-login destinations (no open redirects). */
function safe_next(mixed $v, string $locale, string $fallback): string
{
    $v = is_string($v) ? $v : '';
    return preg_match('#^/(ar|en)(/[\w\-/]*)?$#', $v) && !str_starts_with($v, '//') ? $v : "/$locale$fallback";
}

function form_str(string $k): string
{
    $v = $_POST[$k] ?? '';
    return is_string($v) ? $v : '';
}

/** String-valued form entries only (like Object.fromEntries of FormData without files). */
function form_entries(): array
{
    return array_filter($_POST, 'is_string');
}

const ACTION_GROUPS = ['auth', 'cart', 'checkout', 'orders', 'custom', 'password', 'push', 'reviews', 'support', 'wallet', 'admin'];

function run_action(string $name): void
{
    if (!preg_match('/^([a-z]+)\.([A-Za-z]+)$/', $name, $m) || !in_array($m[1], ACTION_GROUPS, true)) send_text('Not found', 404);
    $GLOBALS['LOCALE'] = action_locale();
    $GLOBALS['T'] = dict($GLOBALS['LOCALE']);
    require_once APP_DIR . '/actions/' . $m[1] . '.php';
    $fn = 'action_' . $m[1] . '_' . strtolower(preg_replace('/([a-z])([A-Z])/', '$1_$2', $m[2]));
    if (!function_exists($fn)) send_text('Not found', 404);

    $isFetch = ($_SERVER['HTTP_X_REQUESTED_WITH'] ?? '') === 'fetch';
    $json = str_starts_with((string) ($_SERVER['CONTENT_TYPE'] ?? ''), 'application/json');
    // An upload bigger than post_max_size arrives as an empty POST.
    if (!$json && empty($_POST) && empty($_FILES) && (int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > 0) {
        send_json(['state' => ['error' => 'file_too_large']]);
    }
    $redirect = null;
    try {
        $state = $json ? $fn(...(array_values((array) (json_body()['args'] ?? [])))) : $fn();
    } catch (ActionRedirect $r) {
        $state = null;
        $redirect = url($r->to);
    }
    $reply = ['state' => $state];
    if ($redirect) $reply['redirect'] = $redirect;
    if (isset($GLOBALS['ACTION_REFRESH'])) $reply['refresh'] = $GLOBALS['ACTION_REFRESH'];

    if ($isFetch || $json) {
        $headers = [];
        send_json($reply, 200, $headers);
    }
    // No JavaScript: navigate, keeping the result for the next page view.
    if (!$redirect) {
        set_cookie('hds_flash', base64url(json_out($state ?? [])), time() + 60, false);
        $ref = (string) ($_SERVER['HTTP_REFERER'] ?? '');
        $host = parse_url($ref, PHP_URL_HOST);
        $redirect = $host && $host === parse_url(site_url(), PHP_URL_HOST) ? $ref : url('/' . action_locale());
    }
    header('Location: ' . $redirect, true, 303);
    exit;
}
