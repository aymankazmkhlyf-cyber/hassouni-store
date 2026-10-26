import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fmt, getDictionary, isLocale } from "@/lib/i18n";
import { formatIQD } from "@/lib/domain/money";
import { getProductDetail, listProducts } from "@/lib/services/catalog";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { RichText } from "@/components/ui/rich-text";
import { AddToCart, type AddToCartProduct } from "@/components/store/add-to-cart";
import { ProductArt } from "@/components/store/product-art";
import { Breadcrumbs, ProductGrid } from "@/components/store/product-card";

type Props = { params: Promise<{ locale: string; slug: string }> };

async function load(params: Props["params"]) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const product = await getProductDetail(slug);
  if (!product) notFound();
  return { locale, t: getDictionary(locale), product };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, product } = await load(params);
  return {
    title: locale === "ar" ? product.nameAr : product.nameEn,
    description: locale === "ar" ? product.summaryAr : product.summaryEn,
  };
}

export default async function ProductPage({ params }: Props) {
  const { locale, t, product } = await load(params);
  const ar = locale === "ar";
  const name = ar ? product.nameAr : product.nameEn;
  const categoryName = ar ? product.category.nameAr : product.category.nameEn;
  const delivery = ar ? product.deliveryTimeAr : product.deliveryTimeEn;
  const related = await listProducts({ categoryId: product.categoryId, excludeId: product.id, pageSize: 4 });

  const forClient: AddToCartProduct = {
    id: product.id,
    slug: product.slug,
    nameAr: product.nameAr,
    nameEn: product.nameEn,
    pricingMode: product.pricingMode,
    unitPrice: product.unitPrice,
    minQuantity: product.minQuantity,
    maxQuantity: product.maxQuantity,
    packages: product.packages.map(({ id, labelAr, labelEn, price, compareAtPrice }) => ({ id, labelAr, labelEn, price, compareAtPrice })),
    tiers: product.tiers.map(({ minQuantity, unitPrice }) => ({ minQuantity, unitPrice })),
    fields: product.fields.map(({ key, labelAr, labelEn, helpAr, helpEn, type, required, maxLength, options }) => ({
      key, labelAr, labelEn, helpAr, helpEn, type, required, maxLength, options,
    })),
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-10">
      <Breadcrumbs
        items={[
          { href: `/${locale}`, label: t.nav.home },
          { href: `/${locale}/category/${product.category.slug}`, label: categoryName },
          { label: name },
        ]}
      />
      <div className="grid gap-8 lg:grid-cols-[1fr_1.1fr]">
        <div className="space-y-5">
          <div className="relative aspect-[4/3] overflow-hidden rounded-(--radius-card) bg-muted shadow-soft">
            {product.imageFileId ? (
              // eslint-disable-next-line @next/next/no-img-element -- DB-backed image route
              <img src={`/api/files/${product.imageFileId}`} alt={name} className="size-full object-cover" />
            ) : (
              <div className="art-hero size-full">
                <ProductArt slug={product.slug} icon={product.icon} size="hero" />
              </div>
            )}
          </div>
          {product.tiers.length && product.unitPrice != null ? (
            <div className="rounded-(--radius-card) border border-line bg-elevated p-4 shadow-soft">
              <h2 className="mb-2 text-sm font-bold">{t.product.tiers}</h2>
              <ul className="space-y-1 text-sm text-fg-muted">
                {product.tiers.map((tier) => (
                  <li key={tier.minQuantity}>
                    {fmt(t.product.tierRow, { min: tier.minQuantity.toLocaleString("en-US"), price: formatIQD(tier.unitPrice, locale) })}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="space-y-5">
          <div>
            <div className="mb-2 flex flex-wrap gap-2">
              <Badge tone="brand">{categoryName}</Badge>
              {product.isSample ? <Badge tone="warning">{t.common.sample}</Badge> : null}
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{name}</h1>
            {(ar ? product.summaryAr : product.summaryEn) ? <p className="mt-2 text-fg-muted">{ar ? product.summaryAr : product.summaryEn}</p> : null}
          </div>

          {product.isSample ? <Alert tone="warning">{t.common.sampleNote}</Alert> : null}

          {delivery ? (
            <p className="flex items-center gap-2 text-sm">
              <Icon name="clock" className="size-5 text-accent" />
              <span className="font-semibold">{t.product.delivery}:</span> <span className="text-fg-muted">{delivery}</span>
            </p>
          ) : null}

          <div className="rounded-(--radius-card) border border-line bg-elevated p-4 shadow-soft sm:p-5">
            <AddToCart
              product={forClient}
              locale={locale}
              s={{
                addToCart: t.product.addToCart,
                added: t.product.added,
                goToCart: t.product.goToCart,
                quantity: product.pricingMode === "package" ? `${t.product.quantity} (${t.product.package})` : t.product.quantity,
                choosePackage: t.product.choosePackage,
                minMax: t.product.minMax,
                unitPrice: t.product.unitPrice,
                estimatedTotal: t.product.estimatedTotal,
                requiredInfo: t.product.requiredInfo,
                noPasswords: t.product.noPasswords,
                optional: t.common.optional,
                limitReached: t.cart.limitReached,
                wasPrice: t.product.wasPrice,
                errors: { ...t.errors },
              }}
            />
          </div>

          {(ar ? product.descriptionAr : product.descriptionEn) ? (
            <section className="rounded-(--radius-card) border border-line bg-elevated p-5 shadow-soft">
              <h2 className="mb-2 font-bold">{t.product.description}</h2>
              <RichText text={ar ? product.descriptionAr : product.descriptionEn} className="prose-policy" />
            </section>
          ) : null}
        </div>
      </div>

      {related.items.length ? (
        <section className="mt-14">
          <h2 className="mb-5 text-xl font-extrabold">{t.product.related}</h2>
          <ProductGrid items={related.items} locale={locale} t={t} />
        </section>
      ) : null}
    </div>
  );
}
