<?php
declare(strict_types=1);

function page_guides(array $params): array
{
    $l = loc();
    $t = T();
    $h = page_header($t['guides']['title'], $t['guides']['subtitle']) . '<div class="mx-auto max-w-6xl px-4 py-8"><ul class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">';
    foreach (guides() as $g) {
        $h .= '<li><a href="' . e(lp('/guides/' . $g['slug'])) . '" class="group flex h-full gap-4 rounded-(--radius-card) border border-line bg-elevated p-4 shadow-soft transition hover:-translate-y-0.5 hover:border-brand/50">'
            . guide_art($g, $l, 'w-24 shrink-0') . '<span class="min-w-0"><span class="block leading-snug font-bold group-hover:text-brand">' . e($g['title'][$l]) . '</span><span class="mt-1 line-clamp-3 block text-sm text-fg-muted">' . e($g['description'][$l]) . '</span></span></a></li>';
    }
    return ['title' => $t['guides']['title'], 'description' => $t['guides']['subtitle'], 'canonical' => "/$l/guides", 'html' => $h . '</ul></div>'];
}

/** JSON for <script type="application/ld+json">, with "<" escaped so it can never close the tag. */
function ld_json(array $data): string
{
    return str_replace('<', '<', json_out($data));
}

function page_guide(array $params): array
{
    $l = loc();
    $t = T();
    $guide = get_guide($params['slug']);
    if (!$guide) not_found();
    $related = [];
    if ($guide['products']) {
        $active = array_map('intval', array_column(all('SELECT id FROM products WHERE slug IN (' . placeholders($guide['products']) . ') AND is_active = 1', $guide['products']), 'id'));
        if ($active) $related = array_values(array_filter(list_products(['page_size' => 48])['items'], fn($p) => in_array((int) $p['id'], $active, true)));
    }
    $others = array_slice(array_values(array_filter(guides(), fn($g) => $g['slug'] !== $guide['slug'])), 0, 4);
    $howTo = [
        '@context' => 'https://schema.org', '@type' => 'HowTo', 'name' => $guide['title'][$l], 'description' => $guide['description'][$l], 'inLanguage' => $l,
        'dateModified' => $guide['updated'], 'step' => array_map(fn($text, $i) => ['@type' => 'HowToStep', 'position' => $i + 1, 'text' => $text], $guide['steps'][$l], array_keys($guide['steps'][$l])),
    ];
    $faq = $guide['faq'][$l] ? [
        '@context' => 'https://schema.org', '@type' => 'FAQPage',
        'mainEntity' => array_map(fn($f) => ['@type' => 'Question', 'name' => $f['q'], 'acceptedAnswer' => ['@type' => 'Answer', 'text' => $f['a']]], $guide['faq'][$l]),
    ] : null;
    $g = $t['guides'];
    $h = '<article class="mx-auto max-w-4xl px-4 py-6 sm:py-10"><script type="application/ld+json">' . ld_json($howTo) . '</script>' . ($faq ? '<script type="application/ld+json">' . ld_json($faq) . '</script>' : '');
    $h .= breadcrumbs([[$t['nav']['home'], lp('')], [$g['title'], lp('/guides')], [$guide['title'][$l], null]]);
    $h .= '<header class="mb-6"><h1 class="text-2xl leading-tight font-extrabold sm:text-3xl">' . e($guide['title'][$l]) . '</h1><p class="mt-2 text-fg-muted">' . e($guide['description'][$l]) . '</p></header>';
    $h .= '<div class="grid gap-6 md:grid-cols-[16rem_1fr] md:items-start">' . guide_art($guide, $l, 'mx-auto w-64 max-w-full rounded-2xl md:sticky md:top-24') . '<div class="space-y-6">';
    $h .= '<section class="rounded-(--radius-card) border border-line bg-elevated p-5 shadow-soft"><h2 class="mb-3 font-bold">' . e($g['steps']) . '</h2><ol class="space-y-3">';
    foreach ($guide['steps'][$l] as $i => $s) $h .= '<li class="flex gap-3"><span class="grid size-7 shrink-0 place-items-center rounded-full bg-brand text-sm font-bold text-brand-fg">' . ($i + 1) . '</span><span class="pt-0.5">' . e($s) . '</span></li>';
    $h .= '</ol></section>';
    if ($guide['tips'][$l]) {
        $h .= '<section class="rounded-(--radius-card) border border-warning/30 bg-warning-soft p-5"><h2 class="mb-2 font-bold text-warning">' . e($g['tips']) . '</h2><ul class="space-y-1.5 text-sm">';
        foreach ($guide['tips'][$l] as $tip) $h .= '<li class="flex gap-2">' . icon('alert', 'mt-0.5 size-4 shrink-0 text-warning') . ' ' . e($tip) . '</li>';
        $h .= '</ul></section>';
    }
    if ($guide['faq'][$l]) {
        $h .= '<section class="rounded-(--radius-card) border border-line bg-elevated p-5 shadow-soft"><h2 class="mb-3 font-bold">' . e($g['faq']) . '</h2><dl class="space-y-3 text-sm">';
        foreach ($guide['faq'][$l] as $f) $h .= '<div><dt class="font-bold">' . e($f['q']) . '</dt><dd class="mt-0.5 text-fg-muted">' . e($f['a']) . '</dd></div>';
        $h .= '</dl></section>';
    }
    $h .= '</div></div>';
    if ($related) $h .= '<section class="mt-12"><h2 class="mb-5 text-xl font-extrabold">' . e($g['related']) . '</h2>' . product_grid($related) . '</section>';
    $h .= '<section class="mt-12"><h2 class="mb-4 text-lg font-bold">' . e($g['more']) . '</h2><ul class="grid gap-2 sm:grid-cols-2">';
    foreach ($others as $og) $h .= '<li><a href="' . e(lp('/guides/' . $og['slug'])) . '" class="flex items-center gap-2 rounded-xl border border-line bg-elevated px-4 py-3 text-sm font-semibold hover:border-brand/50 hover:text-brand">' . icon('book', 'size-4.5 shrink-0') . ' ' . e($og['title'][$l]) . '</a></li>';
    return ['title' => $guide['title'][$l], 'description' => $guide['description'][$l], 'canonical' => "/$l/guides/{$guide['slug']}", 'ogType' => 'article', 'html' => $h . '</ul></section></article>'];
}
