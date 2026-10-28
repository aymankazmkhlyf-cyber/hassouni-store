<?php
declare(strict_types=1);

/** Read-only: returns server-calculated prices for the cart page. */
function action_cart_quote(mixed $items = null): array
{
    if (is_array($items) && array_is_list($items) && count($items) === 0) return ['lines' => [], 'total' => 0, 'valid' => false];
    $parsed = parse_cart_items($items);
    if ($parsed === null) return ['error' => 'cartInvalid'];
    return quote_cart($parsed);
}
