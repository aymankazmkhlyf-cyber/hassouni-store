<?php
declare(strict_types=1);

function page_contact(array $params): array
{
    $l = loc();
    $t = T();
    $settings = load_settings();
    $hours = setting_l($settings, 'hours', $l);
    $h = page_header($t['contact']['title'], $t['contact']['body']) . '<div class="mx-auto max-w-4xl space-y-6 px-4 py-8">' . contact_links($settings)
        . '<p class="text-sm text-fg-muted">' . e($t['contact']['noApp']) . '</p>';
    if ($hours !== '') $h .= '<p class="flex items-center gap-2 rounded-xl bg-muted p-4 text-sm">' . icon('clock', 'size-5 text-accent') . '<span class="font-semibold">' . e($t['contact']['hours']) . ':</span> ' . e($hours) . '</p>';
    if ($settings['supportEmail'] !== '') $h .= '<p class="text-sm"><a href="mailto:' . e($settings['supportEmail']) . '" class="ltr-nums font-semibold text-brand hover:underline" dir="ltr">' . e($settings['supportEmail']) . '</a></p>';
    return ['title' => $t['contact']['title'], 'html' => $h . '</div>'];
}

function page_faq(array $params): array
{
    $t = T();
    return ['title' => $t['nav']['faq'], 'html' => page_header($t['home']['faqTitle']) . '<div class="mx-auto max-w-3xl px-4 py-8">' . faq_list(data_file('content.json')['faq'][loc()]) . '</div>'];
}

function page_custom_request(array $params): array
{
    $l = loc();
    $t = T();
    $user = current_user();
    $strings = $t['custom'];
    $types = $strings['types'];
    unset($strings['types'], $strings['title'], $strings['body']);
    $strings = array_merge($strings, ['name' => $t['checkout']['name'], 'phone' => $t['checkout']['phone'], 'email' => $t['checkout']['email'], 'optional' => $t['common']['optional'], 'home' => $t['errors']['goHome']]);
    $h = page_header($t['custom']['title'], $t['custom']['body']) . '<div class="mx-auto max-w-3xl px-4 py-8">' . card_open('p-5 sm:p-6')
        . island('CustomRequestForm', [
            'locale' => $l, 's' => $strings, 'types' => $types, 'errors' => $t['errors'],
            'defaults' => ['name' => $user['name'] ?? '', 'phone' => $user['phone'] ?? '', 'email' => $user['email'] ?? '', 'serviceType' => query('type')],
        ], '<div class="h-96"></div>') . '</div></div>';
    return ['title' => $t['custom']['title'], 'html' => $h];
}

function page_terms(array $params): array
{
    $t = T();
    $s = load_settings();
    return ['title' => $t['legal']['terms'], 'html' => policy_page($t['legal']['terms'], setting_l($s, 'terms', loc()), $s['policiesUpdatedAt'])];
}

function page_privacy(array $params): array
{
    $t = T();
    $s = load_settings();
    return ['title' => $t['legal']['privacy'], 'html' => policy_page($t['legal']['privacy'], setting_l($s, 'privacy', loc()), $s['policiesUpdatedAt'])];
}

function page_refund(array $params): array
{
    $t = T();
    $s = load_settings();
    return ['title' => $t['legal']['refund'], 'html' => policy_page($t['legal']['refund'], setting_l($s, 'refund', loc()), $s['policiesUpdatedAt'])];
}
