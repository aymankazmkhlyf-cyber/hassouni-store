<?php
/*
 * Optional Telegram alerts for the store owner. Set telegram_bot_token (from
 * @BotFather) in app/config.php, then press "Link Telegram" in Admin → Support.
 * Without a token every function here is a silent no-op.
 */

declare(strict_types=1);

function telegram_configured(): bool
{
    return (string) config('telegram_bot_token', '') !== '';
}

function telegram_call(string $method, ?array $body = null): mixed
{
    $token = (string) config('telegram_bot_token', '');
    if ($token === '' || !function_exists('curl_init')) return null;
    $ch = curl_init("https://api.telegram.org/bot$token/$method");
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 5,
        CURLOPT_CONNECTTIMEOUT => 4,
    ] + ($body !== null ? [CURLOPT_POST => true, CURLOPT_POSTFIELDS => json_out($body), CURLOPT_HTTPHEADER => ['Content-Type: application/json']] : []));
    $res = curl_exec($ch);
    curl_close($ch);
    if ($res === false) {
        // Never log the URL: it contains the bot token.
        log_error("telegram $method failed");
        return null;
    }
    $data = json_decode((string) $res, true);
    return is_array($data) && !empty($data['ok']) ? $data['result'] : null;
}

function send_telegram(string $chatId, string $text): bool
{
    if ($chatId === '') return false;
    return telegram_call('sendMessage', ['chat_id' => $chatId, 'text' => mb_substr($text, 0, 3500), 'disable_web_page_preview' => true]) !== null;
}

/** Finds the private chat of whoever most recently pressed Start on the bot. */
function find_latest_private_chat(): ?array
{
    $updates = telegram_call('getUpdates');
    if (!is_array($updates)) return null;
    foreach (array_reverse($updates) as $u) {
        $chat = $u['message']['chat'] ?? null;
        if ($chat && ($chat['type'] ?? '') === 'private') return ['id' => (string) $chat['id'], 'name' => $chat['first_name'] ?? $chat['username'] ?? ''];
    }
    return null;
}

/** Sends a Telegram alert to the linked staff chat, if configured. Never throws. */
function notify_staff(string $text): void
{
    if (!telegram_configured()) return;
    try {
        $chat = load_settings(true)['telegramChatId'];
        if ($chat) send_telegram($chat, $text);
    } catch (Throwable) {
        log_error('staff notification failed');
    }
}

/**
 * Runs slow work (Telegram, email, push) after the response has been sent, so
 * customers never wait for it (like Next's after()).
 */
function after_response(callable $fn): void
{
    $GLOBALS['AFTER'][] = $fn;
}

function run_after_response(): void
{
    $jobs = $GLOBALS['AFTER'] ?? [];
    if (!$jobs) return;
    $GLOBALS['AFTER'] = [];
    if (function_exists('fastcgi_finish_request')) fastcgi_finish_request();
    elseif (function_exists('litespeed_finish_request')) litespeed_finish_request();
    ignore_user_abort(true);
    foreach ($jobs as $job) {
        try {
            $job();
        } catch (Throwable $e) {
            log_error('background job failed: ' . $e->getMessage());
        }
    }
}
