import type { Metadata } from "next";
import { fmt } from "@/lib/i18n";
import { pageNumber, resolveLocale, sp, type LocaleParams } from "@/lib/i18n/server";
import { listProducts } from "@/lib/services/catalog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/form";
import { buttonClass } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { PageHeader, ProductGrid } from "@/components/store/product-card";

type Props = LocaleParams & { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const { t } = await resolveLocale(params);
  return { title: t.shop.searchTitle, robots: { index: false } };
}

export default async function SearchPage({ params, searchParams }: Props) {
  const { locale, t } = await resolveLocale(params);
  const query = await searchParams;
  const q = (sp(query.q) ?? "").trim().slice(0, 80);
  const result = q ? await listProducts({ q, page: pageNumber(query.page) }) : null;

  return (
    <>
      <PageHeader title={q ? fmt(t.shop.searchFor, { q }) : t.shop.searchTitle} subtitle={result ? fmt(t.shop.resultsCount, { count: result.total }) : t.shop.searchHint} />
      <div className="mx-auto max-w-6xl px-4 py-8">
        <form action={`/${locale}/search`} method="get" role="search" className="mb-8 flex gap-2">
          <label htmlFor="q" className="sr-only">{t.nav.search}</label>
          <Input id="q" name="q" type="search" defaultValue={q} maxLength={80} placeholder={t.nav.searchPlaceholder} className="flex-1" autoFocus={!q} />
          <button type="submit" className={buttonClass("primary", "md")}>{t.common.search}</button>
        </form>
        {result ? (
          result.items.length ? (
            <ProductGrid items={result.items} locale={locale} t={t} />
          ) : (
            <EmptyState icon="search" title={t.common.noResults} body={t.shop.searchEmpty} />
          )
        ) : null}
        {result ? <Pagination page={result.page} pages={result.pages} basePath={`/${locale}/search`} params={{ q }} t={t} /> : null}
      </div>
    </>
  );
}
