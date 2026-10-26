import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale, getDictionary } from "@/lib/i18n";
import { pageNumber, sp } from "@/lib/i18n/server";
import { getActiveCategoryBySlug, listProducts } from "@/lib/services/catalog";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { Breadcrumbs, PageHeader, ProductGrid } from "@/components/store/product-card";
import { CatalogFilters, parseSort } from "@/components/store/catalog-filters";

type Props = {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

async function load(params: Props["params"]) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const category = await getActiveCategoryBySlug(slug);
  if (!category) notFound();
  return { locale, t: getDictionary(locale), category };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, category } = await load(params);
  return {
    title: locale === "ar" ? category.nameAr : category.nameEn,
    description: locale === "ar" ? category.descriptionAr : category.descriptionEn,
  };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { locale, t, category } = await load(params);
  const query = await searchParams;
  const sort = parseSort(sp(query.sort));
  const result = await listProducts({ categoryId: category.id, sort, page: pageNumber(query.page) });
  const name = locale === "ar" ? category.nameAr : category.nameEn;
  const isCustom = category.slug === "custom";

  return (
    <>
      <PageHeader title={name} subtitle={locale === "ar" ? category.descriptionAr : category.descriptionEn}>
        <Breadcrumbs items={[{ href: `/${locale}`, label: t.nav.home }, { href: `/${locale}/services`, label: t.nav.services }, { label: name }]} />
      </PageHeader>
      <div className="mx-auto max-w-6xl px-4 py-8">
        {isCustom ? (
          <div className="mb-8">
            <EmptyState
              icon="wand"
              title={t.custom.title}
              body={t.custom.body}
              action={<ButtonLink href={`/${locale}/custom-request`}>{t.nav.customRequest}</ButtonLink>}
            />
          </div>
        ) : null}
        {result.items.length ? (
          <>
            <CatalogFilters action={`/${locale}/category/${category.slug}`} t={t} locale={locale} sort={sort} />
            <ProductGrid items={result.items} locale={locale} t={t} />
          </>
        ) : isCustom ? null : (
          <EmptyState title={t.shop.empty} action={<ButtonLink href={`/${locale}/services`} variant="secondary">{t.cart.continue}</ButtonLink>} />
        )}
        <Pagination page={result.page} pages={result.pages} basePath={`/${locale}/category/${category.slug}`} params={{ sort }} t={t} />
      </div>
    </>
  );
}
