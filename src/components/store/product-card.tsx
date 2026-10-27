import Link from "next/link";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n";
import type { ProductCard as ProductCardData } from "@/lib/services/catalog";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { Price } from "@/components/ui/price";
import { Stars } from "@/components/ui/stars";
import { fmt } from "@/lib/i18n/config";
import { ProductArt } from "./product-art";

export function ProductCard({ p, locale, t }: { p: ProductCardData; locale: Locale; t: Dictionary }) {
  const name = locale === "ar" ? p.nameAr : p.nameEn;
  const summary = locale === "ar" ? p.summaryAr : p.summaryEn;
  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-(--radius-card) border border-line bg-elevated shadow-soft transition duration-200 hover:-translate-y-0.5 hover:border-brand/50 hover:shadow-lift">
      <div className="relative aspect-[16/10] overflow-hidden bg-muted">
        {p.imageFileId ? (
          // eslint-disable-next-line @next/next/no-img-element -- DB-backed image route with long cache headers
          <img src={`/api/files/${p.imageFileId}`} alt="" loading="lazy" decoding="async" className="size-full object-cover transition duration-300 group-hover:scale-[1.03]" />
        ) : (
          <ProductArt slug={p.slug} icon={p.icon} />
        )}
        <div className="absolute end-3 top-3 flex flex-wrap justify-end gap-1.5">
          {p.isFeatured ? <Badge tone="warning" className="shadow-sm">⭐ {t.product.popular}</Badge> : null}
          {p.hasOffer ? <Badge tone="danger">{t.product.discount}</Badge> : null}
          {p.isSample ? <Badge tone="warning">{t.common.sample}</Badge> : null}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="text-xs font-semibold text-brand">{locale === "ar" ? p.categoryNameAr : p.categoryNameEn}</p>
        <h3 className="text-base leading-snug font-bold">
          <Link href={`/${locale}/services/${p.slug}`} className="after:absolute after:inset-0 focus-visible:outline-none">
            {name}
          </Link>
        </h3>
        {summary ? <p className="line-clamp-2 text-sm text-fg-muted">{summary}</p> : null}
        {p.ratingCount > 0 && p.ratingAvg != null ? (
          <p className="flex items-center gap-1.5 text-xs">
            <Stars value={p.ratingAvg} label={fmt(t.reviews.outOf, { avg: p.ratingAvg.toFixed(1) })} className="text-sm" />
            <span className="ltr-nums font-bold">{p.ratingAvg.toFixed(1)}</span>
            <span className="ltr-nums text-fg-subtle">({p.ratingCount})</span>
          </p>
        ) : null}
        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          {p.startingPrice != null ? (
            <p className="text-sm">
              <span className="block text-xs text-fg-subtle">{t.common.from}</span>
              <Price amount={p.startingPrice} locale={locale} className="text-lg text-fg" />
            </p>
          ) : (
            <span />
          )}
          <span className="grid size-9 place-items-center rounded-xl bg-brand-soft text-brand-soft-fg transition group-hover:bg-brand group-hover:text-brand-fg" aria-hidden="true">
            <Icon name="chevron-end" className="size-4.5 rtl:rotate-180" />
          </span>
        </div>
      </div>
    </article>
  );
}

export function ProductGrid({ items, locale, t }: { items: ProductCardData[]; locale: Locale; t: Dictionary }) {
  return (
    <ul className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {items.map((p) => (
        <li key={p.id}>
          <ProductCard p={p} locale={locale} t={t} />
        </li>
      ))}
    </ul>
  );
}

export function CategoryCard({
  c,
  locale,
}: {
  c: { slug: string; nameAr: string; nameEn: string; descriptionAr: string; descriptionEn: string; icon: string };
  locale: Locale;
}) {
  return (
    <Link
      href={`/${locale}/category/${c.slug}`}
      className="group flex h-full items-start gap-3.5 rounded-(--radius-card) border border-line bg-elevated p-4 shadow-soft transition hover:border-brand/50 hover:shadow-lift"
    >
      <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand-soft-fg transition group-hover:bg-brand group-hover:text-brand-fg">
        <Icon name={c.icon} className="size-6" />
      </span>
      <span className="min-w-0">
        <span className="block font-bold">{locale === "ar" ? c.nameAr : c.nameEn}</span>
        <span className="mt-0.5 line-clamp-2 block text-sm text-fg-muted">{locale === "ar" ? c.descriptionAr : c.descriptionEn}</span>
      </span>
    </Link>
  );
}

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <div className="border-b border-line bg-elevated">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
        {children}
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h1>
        {subtitle ? <p className="mt-2 max-w-2xl text-fg-muted">{subtitle}</p> : null}
      </div>
    </div>
  );
}

export function Breadcrumbs({ items }: { items: { href?: string; label: string }[] }) {
  return (
    <nav aria-label="breadcrumb" className="mb-3">
      <ol className="flex flex-wrap items-center gap-1 text-xs text-fg-subtle">
        {items.map((i, idx) => (
          <li key={idx} className="flex items-center gap-1">
            {idx > 0 ? <Icon name="chevron-end" className="size-3 rtl:rotate-180" /> : null}
            {i.href ? (
              <Link href={i.href} className="hover:text-brand">
                {i.label}
              </Link>
            ) : (
              <span aria-current="page" className="text-fg-muted">{i.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
