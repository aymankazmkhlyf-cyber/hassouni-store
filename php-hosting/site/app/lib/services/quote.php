<?php
/**
 * Re-prices a cart from the database. This is the ONLY place totals come from:
 * the cart page displays it and order creation persists it.
 * $items: [['productId','packageId','quantity','inputs'], ...] (already shape-checked).
 * Line arrays use the same camelCase keys the cart page expects.
 */

declare(strict_types=1);

function quote_cart(array $items): array
{
    $data = load_pricing_data(array_column($items, 'productId'));
    $lines = [];
    foreach ($items as $index => $item) {
        $product = $data[$item['productId']] ?? null;
        if (!$product) {
            $lines[] = ['ok' => false, 'index' => $index, 'productId' => $item['productId'], 'error' => 'product_unavailable'];
            continue;
        }
        $priced = price_line($product, $product['packages'], $product['tiers'], $item['packageId'], $item['quantity']);
        if (!$priced['ok']) {
            $lines[] = ['ok' => false, 'index' => $index, 'productId' => (int) $product['id'], 'error' => $priced['error']];
            continue;
        }
        $defs = array_map('field_def', $product['fields']);
        $fields = validate_field_values($defs, $item['inputs']);
        if (!$fields['ok']) {
            $lines[] = [
                'ok' => false,
                'index' => $index,
                'productId' => (int) $product['id'],
                'error' => 'fields',
                'fieldErrors' => array_map(function ($e) use ($defs) {
                    $def = null;
                    foreach ($defs as $d) if ($d['key'] === $e['key']) $def = $d;
                    return $e + ['labelAr' => $def['labelAr'] ?? $e['key'], 'labelEn' => $def['labelEn'] ?? $e['key']];
                }, $fields['errors']),
            ];
            continue;
        }
        $pkg = null;
        if ($product['pricing_mode'] === 'package') {
            foreach ($product['packages'] as $p) if ((int) $p['id'] === $item['packageId']) $pkg = $p;
        }
        $lines[] = [
            'ok' => true,
            'index' => $index,
            'productId' => (int) $product['id'],
            'packageId' => $pkg ? (int) $pkg['id'] : null,
            'slug' => $product['slug'],
            'nameAr' => $product['name_ar'],
            'nameEn' => $product['name_en'],
            'packageLabelAr' => $pkg['label_ar'] ?? null,
            'packageLabelEn' => $pkg['label_en'] ?? null,
            'isSample' => (bool) $product['is_sample'],
            'unitPrice' => $priced['unitPrice'],
            'quantity' => $priced['quantity'],
            'lineTotal' => $priced['lineTotal'],
            'inputs' => $fields['values'],
        ];
    }
    $total = 0;
    foreach ($lines as $l) if ($l['ok']) $total += $l['lineTotal'];
    $valid = $lines !== [] && !in_array(false, array_column($lines, 'ok'), true) && $total <= MAX_ORDER_TOTAL_IQD;
    return ['lines' => $lines, 'total' => $total, 'valid' => $valid];
}
