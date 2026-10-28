/*
 * Build step: exports the store's texts, guides, icons and illustrations from
 * the original TypeScript sources into JSON files the PHP site reads, so both
 * versions show exactly the same words and artwork.
 *   npx tsx php-hosting/build/export-data.tsx   (run from the repository root)
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ar from "@/lib/i18n/dictionaries/ar";
import en from "@/lib/i18n/dictionaries/en";
import { faq, defaultPolicies, privacyAdditions } from "@/lib/i18n/content";
import { GUIDES, PAYMENT_GUIDES } from "@/lib/i18n/guides";
import { Icon, CATALOG_ICONS } from "@/components/ui/icon";
import { GuideArt } from "@/components/store/guide-art";

const out = new URL("../site/app/data/", import.meta.url);
mkdirSync(out, { recursive: true });
const write = (name: string, data: unknown) => writeFileSync(new URL(name, out), JSON.stringify(data, null, 1) + "\n");

write("i18n-ar.json", ar);
write("i18n-en.json", en);
write("content.json", { faq, defaultPolicies, privacyAdditions });
write("guides.json", { guides: GUIDES, paymentGuides: PAYMENT_GUIDES });

// Icons: rendered once with a class placeholder; PHP substitutes the class.
const iconSource = readFileSync(new URL("../../src/components/ui/icon.tsx", import.meta.url), "utf8");
const names = new Set<string>(["whatsapp", "telegram", "instagram"]);
for (const m of iconSource.matchAll(/^\s+"?([a-z][a-z-]*)"?: "M/gm)) names.add(m[1]!);
const icons: Record<string, string> = {};
for (const name of names) icons[name] = renderToStaticMarkup(createElement(Icon, { name, className: "__CLASS__" }));
write("icons.json", { icons, catalog: CATALOG_ICONS });

// Guide illustrations per guide and language.
const art: Record<string, string> = {};
for (const g of GUIDES) {
  for (const locale of ["ar", "en"] as const) {
    art[`${g.slug}:${locale}`] = renderToStaticMarkup(
      createElement(GuideArt, {
        variant: g.art.variant,
        labels: { title: g.art.title[locale], a: g.art.a?.[locale], b: g.art.b?.[locale] },
        className: "__CLASS__",
      }),
    );
  }
}
write("guide-art.json", art);

// Product art themes (regex sources are compatible with PCRE).
const artSource = readFileSync(new URL("../../src/components/store/product-art.tsx", import.meta.url), "utf8");
const themes = [...artSource.matchAll(/\{ match: \/(.+?)\/, theme: (\{.+?\}) \}/g)].map((m) => ({
  match: m[1]!,
  // eslint-disable-next-line no-new-func -- trusted local source file
  theme: new Function(`return ${m[2]}`)(),
}));
write("product-art.json", themes);

console.log(`exported: ${names.size} icons, ${GUIDES.length} guides, ${themes.length} art themes`);
