<?php
/* Live support chat with automatic replies and Telegram alerts for the owner. */

declare(strict_types=1);

const MAX_MESSAGE_LENGTH = 1000;

function support_cookie(): string
{
    return cookie_name('hds_support');
}

/** Auto-reply rules: [id, regex, reply(locale, methods)]. */
function bot_rules(): array
{
    return [
        ['password', '/كلمة\s*(ال)?(سر|مرور)|باسورد|باسوورد|رمز\s*(ال)?تحقق|password|otp|verification code/iu', fn($l, $m) => $l === 'ar'
            ? '⚠️ تنبيه: نحن لا نطلب أبداً كلمة المرور أو رمز التحقق لأي حساب. لا ترسلها لأي أحد، حتى لو قال إنه من المتجر.'
            : "⚠️ Note: we never ask for any account password or verification code. Don't send them to anyone, even someone claiming to be the store."],
        ['payment', '/دفع|ادفع|زين|زين\s*كاش|اسيا|آسيا|ماستر|حوال|تحويل|pay|payment|zain|asia|master/iu', function ($l, $methods) {
            $list = implode("\n", array_map(fn($m) => '• ' . ($l === 'ar' ? $m['name_ar'] : $m['name_en']) . ': ' . $m['account_details'], array_values(array_filter($methods, fn($m) => $m['account_details'] !== ''))));
            $names = implode($l === 'ar' ? '، ' : ', ', array_map(fn($m) => $l === 'ar' ? $m['name_ar'] : $m['name_en'], $methods));
            // With no payee details configured, name the methods instead of printing an empty list.
            $body = $list !== '' ? $list : $names;
            return $l === 'ar'
                ? "💳 طرق الدفع:\n$body\nبعد إنشاء الطلب تظهر لك تعليمات الدفع، ادفع وأرسل رقم العملية أو صورة الإيصال من صفحة الطلب، ونأكد الدفع يدوياً."
                : "💳 Payment methods:\n$body\nAfter placing your order you'll see the payment instructions; pay and send the transaction number or receipt from the order page; we confirm payments manually.";
        }],
        ['order', '/طلبي|طلب\s*رقم|تتبع|وين\s*(ال)?طلب|تأخر|تاخر|HDS-|order|track|delay/iu', fn($l, $m) => $l === 'ar'
            ? "📦 تقدر تتابع طلبك من صفحة تتبع الطلب: /ar/track\nإذا عندك استفسار، اكتب رقم الطلب هنا (يبدأ بـ HDS-) فقط، ولا ترسل رمز الوصول."
            : "📦 You can follow your order on the tracking page: /en/track\nFor questions, write your order reference here (starts with HDS-) only — never send the access key."],
        ['prices', '/سعر|اسعار|أسعار|بكم|شكد|كم\s*سعر|price|cost|how much/iu', fn($l, $m) => $l === 'ar' ? '🏷️ كل الخدمات وأسعارها هنا: /ar/services' : '🏷️ All services and prices are here: /en/services'],
        ['pubg', '/شدات|شده|شدة|ببجي|pubg|\buc\b/iu', fn($l, $m) => $l === 'ar' ? '🎮 شدات ببجي برقم اللاعب فقط: /ar/services/pubg-mobile-uc' : '🎮 PUBG UC with your player ID only: /en/services/pubg-mobile-uc'],
    ];
}

function bot_welcome(string $locale, array $settings, string $name): string
{
    $store = $locale === 'ar' ? $settings['storeNameAr'] : $settings['storeNameEn'];
    $hours = $locale === 'ar' ? $settings['hoursAr'] : $settings['hoursEn'];
    return $locale === 'ar'
        ? "أهلاً $name 👋 وصلت رسالتك إلى $store. أحد أعضاء الفريق راح يرد عليك هنا بأقرب وقت." . ($hours ? "\n🕒 أوقات الرد: $hours" : '')
        : "Hi $name 👋 Your message reached $store. A team member will reply here as soon as possible." . ($hours ? "\n🕒 Response hours: $hours" : '');
}

/** Bot replies carry a hidden marker (U+2063) so each rule fires once per thread. */
function bot_tag(string $id): string
{
    return "\u{2063}$id\u{2063}";
}

function tag_of(string $body): ?string
{
    return preg_match('/\x{2063}(\w+)\x{2063}/u', $body, $m) ? $m[1] : null;
}

function strip_tag_marker(string $body): string
{
    return preg_replace('/\x{2063}\w+\x{2063}/u', '', $body);
}

function get_thread_by_token(?string $token): ?array
{
    if (!$token || strlen($token) > 100) return null;
    return one('SELECT * FROM support_threads WHERE token_hash = ?', [sha256($token)]);
}

function start_thread(string $name, ?string $phone, string $locale, ?string $userId, string $firstMessage, string $baseUrl): array
{
    $token = generate_session_token();
    $id = uuid4();
    insert('support_threads', ['id' => $id, 'token_hash' => sha256($token), 'name' => $name, 'phone' => $phone, 'locale' => $locale, 'user_id' => $userId, 'last_message_at' => now_db(), 'created_at' => now_db(), 'updated_at' => now_db()]);
    $thread = one('SELECT * FROM support_threads WHERE id = ?', [$id]);
    add_customer_message($thread, $firstMessage, true, $baseUrl);
    return ['token' => $token, 'thread' => $thread];
}

function add_customer_message(array $thread, string $body, bool $isFirst, string $baseUrl): void
{
    $text = js_slice(trim_js($body), MAX_MESSAGE_LENGTH);
    if ($text === '') return;
    $settings = load_settings();
    $methods = all('SELECT name_ar, name_en, account_details FROM payment_methods WHERE is_enabled = 1 ORDER BY sort_order ASC');
    $locale = $thread['locale'] === 'en' ? 'en' : 'ar';
    $sent = [];
    foreach (all("SELECT body FROM support_messages WHERE thread_id = ? AND sender = 'bot'", [$thread['id']]) as $m) {
        if ($t = tag_of($m['body'])) $sent[$t] = true;
    }
    $now = now_db();
    insert('support_messages', ['thread_id' => $thread['id'], 'sender' => 'customer', 'body' => $text, 'created_at' => $now]);
    $bot = $isFirst ? [['welcome', bot_welcome($locale, $settings, $thread['name'])]] : [];
    foreach (bot_rules() as [$id, $re, $reply]) {
        if (preg_match($re, $text) && !isset($sent[$id])) $bot[] = [$id, $reply($locale, $methods)];
    }
    foreach ($bot as [$id, $b]) insert('support_messages', ['thread_id' => $thread['id'], 'sender' => 'bot', 'body' => bot_tag($id) . $b, 'created_at' => $now]);
    q("UPDATE support_threads SET status = 'open', last_message_at = ?, unread_for_staff = unread_for_staff + 1, unread_for_customer = unread_for_customer + ? WHERE id = ?", [$now, count($bot), $thread['id']]);

    // Phone alert at most once a minute per conversation, so a burst of messages is one ping.
    $last = db_time($thread['last_notified_at']);
    if (($last === null || microtime(true) - $last > 60) && $settings['telegramChatId'] && telegram_configured()) {
        $threadId = $thread['id'];
        $name = $thread['name'];
        $phone = $thread['phone'];
        $chat = $settings['telegramChatId'];
        after_response(function () use ($chat, $name, $phone, $text, $baseUrl, $threadId) {
            $ok = send_telegram($chat, "💬 رسالة دعم جديدة من $name" . ($phone ? " ($phone)" : '') . ":\n\n" . js_slice($text, 500) . "\n\n↩️ للرد: $baseUrl/ar/admin/support/$threadId");
            if ($ok) update('support_threads', ['last_notified_at' => now_db()], 'id = ?', [$threadId]);
        });
    }
}

function list_messages(string $threadId, int $afterId = 0): array
{
    $rows = all('SELECT id, sender, body, created_at FROM support_messages WHERE thread_id = ? AND id > ? ORDER BY id ASC LIMIT 200', [$threadId, $afterId]);
    return array_map(fn($r) => ['id' => (int) $r['id'], 'sender' => $r['sender'], 'body' => strip_tag_marker($r['body']), 'createdAt' => iso_time($r['created_at'])], $rows);
}

function mark_read_by_customer(string $threadId): void
{
    q('UPDATE support_threads SET unread_for_customer = 0 WHERE id = ?', [$threadId]);
}

function list_threads(?string $status, int $page): array
{
    $pageSize = 30;
    $page = max($page, 1);
    $where = $status ? 'WHERE t.status = ?' : '';
    $params = $status ? [$status] : [];
    $rows = all(
        "SELECT t.id, t.name, t.phone, t.status, t.unread_for_staff, t.last_message_at,
                (SELECT m.body FROM support_messages m WHERE m.thread_id = t.id AND m.sender <> 'bot' ORDER BY m.id DESC LIMIT 1) AS preview
           FROM support_threads t $where ORDER BY t.unread_for_staff DESC, t.last_message_at DESC LIMIT ? OFFSET ?",
        [...$params, $pageSize, ($page - 1) * $pageSize],
    );
    $total = (int) val("SELECT COUNT(*) FROM support_threads t $where", $params);
    return ['rows' => $rows, 'page' => $page, 'pages' => max(1, (int) ceil($total / $pageSize))];
}

function staff_unread_count(): int
{
    return (int) val('SELECT COALESCE(SUM(unread_for_staff), 0) FROM support_threads');
}

function get_thread(string $id): ?array
{
    if (!preg_match('/^[0-9a-f-]{36}$/i', $id)) return null;
    return one('SELECT * FROM support_threads WHERE id = ?', [strtolower($id)]);
}

function mark_read_by_staff(string $threadId): void
{
    q('UPDATE support_threads SET unread_for_staff = 0 WHERE id = ?', [$threadId]);
}

function add_staff_message(string $threadId, string $body, array $actor): bool
{
    $text = js_slice(trim_js($body), MAX_MESSAGE_LENGTH);
    if ($text === '') return false;
    if (!get_thread($threadId)) return false;
    insert('support_messages', ['thread_id' => $threadId, 'sender' => 'staff', 'staff_id' => $actor['id'], 'body' => $text, 'created_at' => now_db()]);
    q("UPDATE support_threads SET status = 'open', last_message_at = ?, unread_for_staff = 0, unread_for_customer = unread_for_customer + 1 WHERE id = ?", [now_db(), $threadId]);
    return true;
}

function set_thread_status(string $threadId, string $status, array $actor): void
{
    update('support_threads', ['status' => $status], 'id = ?', [$threadId]);
    audit($actor, "support.$status", 'support_thread', $threadId);
}

/** Retention: delete conversations with no activity for $days. */
function purge_old_threads(int $days): int
{
    return q('DELETE FROM support_threads WHERE last_message_at < ?', [now_db(-$days * 86400)])->rowCount();
}
