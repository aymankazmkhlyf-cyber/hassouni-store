<?php
declare(strict_types=1);

const ORDER_STATUSES = ['pending_payment', 'payment_review', 'paid', 'processing', 'completed', 'cancelled', 'rejected', 'refunded'];
const PAYMENT_STATUSES = ['awaiting', 'submitted', 'confirmed', 'rejected', 'refunded'];

/**
 * Allowed transitions. Anything not listed is rejected server-side.
 * - Once money is confirmed (paid and later) the order can only end as completed or refunded.
 * - cancelled / rejected / refunded are terminal.
 */
const ORDER_TRANSITIONS = [
    'pending_payment' => ['payment_review', 'paid', 'cancelled', 'rejected'],
    'payment_review' => ['paid', 'pending_payment', 'cancelled', 'rejected'],
    'paid' => ['processing', 'completed', 'refunded'],
    'processing' => ['completed', 'refunded'],
    'completed' => ['refunded'],
    'cancelled' => [],
    'rejected' => [],
    'refunded' => [],
];

/** Statuses in which the store has actually received the money. */
const CONFIRMED_REVENUE_STATUSES = ['paid', 'processing', 'completed'];

function allowed_transitions(string $from): array
{
    return ORDER_TRANSITIONS[$from] ?? [];
}

function can_transition(string $from, string $to): bool
{
    return in_array($to, ORDER_TRANSITIONS[$from] ?? [], true);
}

/** A customer may upload / replace payment proof only before payment is confirmed. */
function customer_can_submit_payment(string $status): bool
{
    return $status === 'pending_payment' || $status === 'payment_review';
}

function is_terminal_status(string $status): bool
{
    return (ORDER_TRANSITIONS[$status] ?? []) === [];
}
