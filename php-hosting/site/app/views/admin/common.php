<?php
/* Shared admin building blocks (PHP versions of ActionForm, SubmitButton, AdminTitle). */

declare(strict_types=1);

/** Flat message map for action forms: error codes + success messages. */
function admin_messages(): array
{
    $t = T();
    return array_merge($t['errors'], [
        'saved' => $t['common']['saved'],
        'deactivated' => $t['admin']['productsPage']['deactivated'],
        'hasProducts' => $t['admin']['categoriesPage']['hasProducts'],
        'invalidCredentials' => $t['auth']['invalidCredentials'],
    ]);
}

function admin_title(string $title, ?string $subtitle = null, string $actionHtml = ''): string
{
    return '<div class="mb-6 flex flex-wrap items-end justify-between gap-3"><div><h1 class="text-2xl font-extrabold tracking-tight">' . e($title) . '</h1>'
        . ($subtitle ? '<p class="mt-1 text-sm text-fg-muted">' . e($subtitle) . '</p>' : '') . '</div>' . $actionHtml . '</div>';
}

/**
 * A form that posts to /_action/admin.<name> and shows the result in place
 * (see islands/action-forms.tsx). $labels names fields in error lists.
 */
function action_form(string $action, string $innerHtml, ?string $class = null, array $labels = [], ?array $messages = null): string
{
    return '<form method="post" enctype="multipart/form-data" action="' . e(url('/_action/' . $action)) . '" data-action-form'
        . ' data-messages="' . json_attr($messages ?? admin_messages()) . '" data-labels="' . json_attr((object) $labels) . '"'
        . ($class ? ' class="' . e($class) . '"' : '') . '><input type="hidden" name="locale" value="' . loc() . '">' . $innerHtml . '</form>';
}

/** Submit button; $opts: variant, size, class, name, value, confirm, pending, disabled. */
function submit_button(string $html, array $opts = []): string
{
    return '<button type="submit" class="' . button_class($opts['variant'] ?? 'primary', $opts['size'] ?? 'md', $opts['class'] ?? null) . '"'
        . attrs([
            'name' => $opts['name'] ?? null,
            'value' => $opts['value'] ?? null,
            'data-confirm' => $opts['confirm'] ?? null,
            'data-pending-label' => $opts['pending'] ?? null,
            'disabled' => !empty($opts['disabled']),
        ]) . '>' . $html . '</button>';
}

function hidden(string $name, string|int $value): string
{
    return '<input type="hidden" name="' . e($name) . '" value="' . e((string) $value) . '">';
}

function admin_page(array $user, string $title, string $html): array
{
    return ['title' => $title, 'layout' => 'admin', 'user' => $user, 'private' => true, 'html' => $html];
}
