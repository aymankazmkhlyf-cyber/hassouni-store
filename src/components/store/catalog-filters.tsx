import type { Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import { Select } from "@/components/ui/form";
import { buttonClass } from "@/components/ui/button";

/** GET form — filters work without JavaScript and produce shareable URLs. */
export function CatalogFilters({
  action,
  t,
  locale,
  categories,
  category,
  sort,
  q,
}: {
  action: string;
  t: Dictionary;
  locale: Locale;
  categories?: { slug: string; nameAr: string; nameEn: string }[];
  category?: string;
  sort?: string;
  q?: string;
}) {
  return (
    <form action={action} method="get" className="mb-6 flex flex-wrap items-end gap-3 rounded-(--radius-card) border border-line bg-elevated p-3 shadow-soft">
      {q !== undefined ? <input type="hidden" name="q" value={q} /> : null}
      {categories ? (
        <label className="min-w-40 flex-1 text-sm font-semibold sm:flex-none">
          <span className="mb-1 block">{t.shop.category}</span>
          <Select name="category" defaultValue={category ?? ""}>
            <option value="">{t.common.all}</option>
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {locale === "ar" ? c.nameAr : c.nameEn}
              </option>
            ))}
          </Select>
        </label>
      ) : null}
      <label className="min-w-40 flex-1 text-sm font-semibold sm:flex-none">
        <span className="mb-1 block">{t.shop.sort}</span>
        <Select name="sort" defaultValue={sort ?? "featured"}>
          <option value="featured">{t.shop.sortFeatured}</option>
          <option value="price_asc">{t.shop.sortPriceAsc}</option>
          <option value="price_desc">{t.shop.sortPriceDesc}</option>
          <option value="newest">{t.shop.sortNewest}</option>
        </Select>
      </label>
      <button type="submit" className={buttonClass("secondary", "md")}>{t.common.filter}</button>
    </form>
  );
}

export function parseSort(v: string | undefined) {
  return v === "price_asc" || v === "price_desc" || v === "newest" ? v : "featured";
}
