<?php
declare(strict_types=1);

/** Effective unit price for a quantity: the highest tier whose threshold is met, else the base price. */
function tier_unit_price(int $basePrice, array $tiers, int $quantity): int
{
    $best = null;
    foreach ($tiers as $tier) {
        if ($quantity >= $tier['min_quantity'] && ($best === null || $tier['min_quantity'] > $best['min_quantity'])) $best = $tier;
    }
    return $best ? (int) $best['unit_price'] : $basePrice;
}

function quantity_bounds(array $product): array
{
    // Packages are bought as whole packages; quantity is the number of packages.
    if ($product['pricing_mode'] === 'package') return ['min' => 1, 'max' => $product['max_quantity'] ?? 20];
    return ['min' => (int) $product['min_quantity'], 'max' => $product['max_quantity'] ?? 1_000_000];
}

/**
 * Authoritative line price calculation. Runs on the server against database
 * rows only — prices sent by the browser are never used.
 * $product needs is_active, category_active, pricing_mode, unit_price, min_quantity, max_quantity.
 */
function price_line(array $product, array $packages, array $tiers, ?int $packageId, mixed $quantity): array
{
    if (!$product['is_active'] || !$product['category_active']) return ['ok' => false, 'error' => 'product_unavailable'];
    if (!is_int($quantity) || $quantity < 1) return ['ok' => false, 'error' => 'invalid_quantity'];

    $bounds = quantity_bounds($product);
    if ($quantity < $bounds['min']) return ['ok' => false, 'error' => 'below_minimum'];
    if ($quantity > $bounds['max']) return ['ok' => false, 'error' => 'above_maximum'];

    if ($product['pricing_mode'] === 'package') {
        if ($packageId === null) return ['ok' => false, 'error' => 'package_required'];
        $pkg = null;
        foreach ($packages as $p) if ((int) $p['id'] === $packageId && (int) $p['product_id'] === (int) $product['id']) $pkg = $p;
        if (!$pkg || !$pkg['is_active']) return ['ok' => false, 'error' => 'package_unavailable'];
        $unitPrice = (int) $pkg['price'];
    } else {
        if ($product['unit_price'] === null) return ['ok' => false, 'error' => 'product_unavailable'];
        $unitPrice = tier_unit_price((int) $product['unit_price'], $tiers, $quantity);
    }

    $lineTotal = $unitPrice * $quantity;
    if (!is_int($lineTotal) || $lineTotal > MAX_ORDER_TOTAL_IQD) return ['ok' => false, 'error' => 'total_too_large'];
    return ['ok' => true, 'unitPrice' => $unitPrice, 'quantity' => $quantity, 'lineTotal' => $lineTotal];
}
