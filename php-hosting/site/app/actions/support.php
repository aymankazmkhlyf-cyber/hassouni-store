<?php
declare(strict_types=1);

/** Customer sends a chat message. The first message opens a conversation tied to an httpOnly cookie. */
function action_support_send(mixed $input = null): array
{
    $input = is_array($input) ? $input : [];
    if (!consume_rate_limit('supportMessage', client_ip())) return ['ok' => false, 'error' => 'rateLimited'];
    $existing = get_thread_by_token(get_cookie(support_cookie()));
    $message = is_string($input['message'] ?? null) ? trim_js($input['message']) : '';
    try {
        if ($existing) {
            if ($message === '' || js_len($message) > MAX_MESSAGE_LENGTH) return ['ok' => false, 'error' => 'validation'];
            add_customer_message($existing, $message, false, site_url());
            return ['ok' => true];
        }
        $name = is_string($input['name'] ?? null) ? trim_js($input['name']) : '';
        $phoneRaw = is_string($input['phone'] ?? null) ? trim_js($input['phone']) : '';
        $locale = $input['locale'] ?? null;
        if (js_len($name) < 2 || js_len($name) > 60 || js_len($phoneRaw) > 30 || $message === '' || js_len($message) > MAX_MESSAGE_LENGTH || !is_string($locale)) {
            return ['ok' => false, 'error' => 'validation'];
        }
        $phone = $phoneRaw !== '' ? normalize_phone($phoneRaw) : null;
        if ($phoneRaw !== '' && !$phone) return ['ok' => false, 'error' => 'invalidPhone'];
        if (!consume_rate_limit('supportStart', client_ip())) return ['ok' => false, 'error' => 'rateLimited'];
        $user = current_user();
        $started = start_thread($name, $phone, is_locale($locale) ? $locale : 'ar', $user['id'] ?? null, $message, site_url());
        set_cookie(support_cookie(), $started['token'], time() + 90 * 86400);
        return ['ok' => true];
    } catch (Throwable $e) {
        log_error('support send failed: ' . $e->getMessage());
        return ['ok' => false, 'error' => 'generic'];
    }
}

/* --------------------------------- Staff --------------------------------- */

function action_support_staff_reply(mixed $threadId = null, mixed $body = null): array
{
    try {
        $user = assert_permission('support:manage');
    } catch (AuthError $e) {
        return ['ok' => false, 'error' => $e->codeKey];
    }
    if (!is_string($threadId) || !is_string($body)) return ['ok' => false, 'error' => 'validation'];
    try {
        return add_staff_message($threadId, $body, actor_of($user)) ? ['ok' => true] : ['ok' => false, 'error' => 'validation'];
    } catch (Throwable) {
        return ['ok' => false, 'error' => 'generic'];
    }
}

/** Plain form on the thread page: close / reopen a conversation. */
function action_support_set_status(): array
{
    $user = assert_permission('support:manage');
    $id = form_str('id');
    if (!is_uuid($id)) return [];
    set_thread_status(strtolower($id), form_str('status') === 'closed' ? 'closed' : 'open', actor_of($user));
    action_refresh();
    return ['ok' => true];
}

/** Links the Telegram chat of whoever last pressed Start on the bot, then sends a test alert. */
function action_support_link_telegram(): array
{
    try {
        $user = assert_permission('settings:write');
    } catch (AuthError) {
        return ['ok' => false, 'error' => 'forbidden'];
    }
    if (!telegram_configured()) return ['ok' => false, 'error' => 'notConfigured'];
    $chat = find_latest_private_chat();
    if (!$chat) return ['ok' => false, 'error' => 'noChat'];
    if (!send_telegram($chat['id'], '✅ تم ربط إشعارات متجر حسوني. راح توصلك هنا الطلبات الجديدة، وإثباتات الدفع، ورسائل الدعم من الزبائن.')) return ['ok' => false, 'error' => 'sendFailed'];
    save_settings(['telegramChatId' => $chat['id']]);
    audit(actor_of($user), 'support.telegram_link', 'settings', 'store');
    return ['ok' => true, 'name' => $chat['name']];
}
