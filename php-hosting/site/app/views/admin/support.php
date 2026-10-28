<?php
declare(strict_types=1);

require_once __DIR__ . '/common.php';

function page_admin_support(array $params): array
{
    $l = loc();
    $t = T();
    $user = require_staff_page($l, 'support:manage');
    $status = in_array(query('status'), ['open', 'closed'], true) ? query('status') : null;
    $res = list_threads($status, page_number(query('page')));
    $settings = load_settings();
    $s = $t['admin']['supportPage'];
    $h = admin_title($t['admin']['support']) . '<div class="grid gap-6 xl:grid-cols-[1.6fr_1fr]"><div><nav class="mb-3 flex gap-1" aria-label="' . e($s['all']) . '">';
    foreach ([[null, $s['all']], ['open', $s['open']], ['closed', $s['closed']]] as [$key, $label]) {
        $h .= '<a href="' . e(lp('/admin/support') . ($key ? "?status=$key" : '')) . '"' . ($status === $key ? ' aria-current="page"' : '') . ' class="rounded-xl px-3 py-1.5 text-sm font-semibold text-fg-muted hover:bg-muted aria-[current=page]:bg-brand-soft aria-[current=page]:text-brand-soft-fg">' . e($label) . '</a>';
    }
    $h .= '</nav>';
    if (!$res['rows']) $h .= empty_state($s['empty'], null, '', 'chat');
    else {
        $h .= card_open() . '<ul class="divide-y divide-line">';
        foreach ($res['rows'] as $r) {
            $h .= '<li><a href="' . e(lp('/admin/support/' . $r['id'])) . '" class="flex items-start justify-between gap-3 px-5 py-3.5 hover:bg-muted"><span class="min-w-0"><span class="flex items-center gap-2 font-bold">' . e($r['name'])
                . ((int) $r['unread_for_staff'] > 0 ? badge((int) $r['unread_for_staff'] . ' ' . e($s['unread']), 'danger') : '') . ($r['status'] === 'closed' ? badge(e($s['closed'])) : '')
                . '</span><span class="block truncate text-sm text-fg-muted">' . e($r['preview'] ? strip_tag_marker($r['preview']) : '') . '</span></span><span class="ltr-nums shrink-0 text-xs text-fg-subtle">' . e(format_datetime($r['last_message_at'], $l)) . '</span></a></li>';
        }
        $h .= '</ul></div>';
    }
    $h .= pagination($res['page'], $res['pages'], lp('/admin/support'), ['status' => $status]) . '</div>';
    $h .= card_open() . card_header($s['notifications']) . '<div class="space-y-5 p-5">' . island('BrowserNotifyButton', ['enable' => $s['browserEnable'], 'on' => $s['browserOn'], 'blocked' => $s['browserBlocked']])
        . '<div class="space-y-2"><p class="text-sm font-bold">' . e($s['telegram']) . '</p>'
        . ($settings['telegramChatId'] && telegram_configured() ? '<p class="text-sm text-success">' . e($s['telegramLinked']) . '</p>' : '')
        . '<p class="text-sm whitespace-pre-line text-fg-muted">' . e($s['telegramSteps']) . '</p>'
        . (has_permission($user['role'], 'settings:write') ? island('TelegramLink', ['label' => $s['telegramLink'], 'done' => $s['telegramDone'], 'errors' => $s['telegramErrors']]) : '')
        . '</div></div></div></div>';
    return admin_page($user, $t['admin']['support'], $h);
}

function page_admin_support_thread(array $params): array
{
    $l = loc();
    $t = T();
    $user = require_staff_page($l, 'support:manage');
    $thread = get_thread($params['id']);
    if (!$thread) not_found();
    $messages = list_messages($thread['id']);
    mark_read_by_staff($thread['id']);
    $s = $t['admin']['supportPage'];
    $open = $thread['status'] === 'open';
    $action = '<span class="flex flex-wrap items-center gap-2">' . badge(e($open ? $s['open'] : $s['closed']), $open ? 'success' : 'neutral')
        . ($thread['phone'] ? '<a href="' . e(whatsapp_link($thread['phone'])) . '" target="_blank" rel="noopener noreferrer" class="' . button_class('outline', 'sm') . '">' . icon('whatsapp', 'size-4') . ' <span class="ltr-nums" dir="ltr">' . e($thread['phone']) . '</span></a>' : '')
        . '<form method="post" action="' . e(url('/_action/support.setStatus')) . '">' . hidden('locale', $l) . hidden('id', $thread['id']) . hidden('status', $open ? 'closed' : 'open')
        . '<button type="submit" class="' . button_class('ghost', 'sm') . '">' . e($open ? $s['close'] : $s['reopen']) . '</button></form></span>';
    $h = admin_title($thread['name'], format_datetime($thread['created_at'], $l), $action)
        . island('SupportThreadView', [
            'threadId' => $thread['id'], 'initial' => $messages, 'locale' => $l,
            's' => ['customer' => $thread['name'], 'bot' => $t['support']['bot'], 'staff' => $t['support']['staff'], 'reply' => $s['reply'], 'send' => $s['send'], 'error' => $t['support']['error']],
        ]);
    return admin_page($user, $thread['name'], $h);
}
