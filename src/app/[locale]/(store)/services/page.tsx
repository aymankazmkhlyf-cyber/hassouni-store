import type { Metadata } from "next";
import { pageNumber, resolveLocale, sp, type LocaleParams } from "@/lib/i18n/server";
import { listCategories, listProducts } from "@/lib/services/catalog";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { PageHeader, ProductGrid } from "@/components/store/product-card";
import { CatalogFilters, parseSort } from "@/components/store/catalog-filters";

type Props = LocaleParams & { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const { t } = await resolveLocale(params);
  return { title: t.shop.title };
}

export default async function ShopPage({ params, searchParams }: Props) {
  const { locale, t } = await resolveLocale(params);
  const query = await searchParams;
  const categories = await listCategories({ activeOnly: true });
  const categorySlug = sp(query.category);
  const category = categories.find((c) => c.slug === categorySlug);
  const sort = parseSort(sp(query.sort));
  const result = await listProducts({ categoryId: category?.id, sort, page: pageNumber(query.page) });

  return (
    <>
      <PageHeader title={t.shop.title} subtitle={t.shop.subtitle} />
      <div className="mx-auto max-w-6xl px-4 py-8">
        <CatalogFilters action={`/${locale}/services`} t={t} locale={locale} categories={categories} category={category?.slug} sort={sort} />
        {result.items.length ? (
          <ProductGrid items={result.items} locale={locale} t={t} />
        ) : (
          <EmptyState title={t.shop.empty} />
        )}
        <Pagination page={result.page} pages={result.pages} basePath={`/${locale}/services`} params={{ category: category?.slug, sort }} t={t} />
      </div>
    </>
  );
}
