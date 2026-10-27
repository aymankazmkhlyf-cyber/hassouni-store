import Link from "next/link";
import type { Dictionary } from "@/lib/i18n";
import { fmt, type Locale } from "@/lib/i18n/config";
import { formatDate } from "@/lib/i18n";
import type { PublicReview, RatingSummary } from "@/lib/services/reviews";
import { Icon } from "@/components/ui/icon";
import { Stars } from "@/components/ui/stars";

function ReviewCard({ r, locale, t, product }: { r: PublicReview; locale: Locale; t: Dictionary; product?: { href: string; name: string } }) {
  const pkg = locale === "ar" ? r.packageLabelAr : r.packageLabelEn;
  return (
    <article className="flex h-full flex-col gap-2 rounded-2xl border border-line bg-elevated p-4">
      <div className="flex items-center justify-between gap-2">
        <Stars value={r.rating} label={fmt(t.reviews.starsLabel, { n: r.rating })} className="text-base" />
        <time className="ltr-nums text-xs text-fg-subtle" dateTime={r.createdAt.toISOString()}>{formatDate(r.createdAt, locale)}</time>
      </div>
      {r.comment ? <p className="text-sm leading-relaxed whitespace-pre-line" dir="auto">{r.comment}</p> : null}
      <p className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-fg-muted">
        <span className="font-bold text-fg" dir="auto">{r.displayName}</span>
        <span className="inline-flex items-center gap-1 font-semibold text-success">
          <Icon name="check" className="size-3.5" /> {t.reviews.verified}
        </span>
        {pkg ? <span>· {pkg}</span> : null}
      </p>
      {product ? (
        <Link href={product.href} className="text-xs font-semibold text-brand hover:underline">{fmt(t.reviews.on, { product: product.name })}</Link>
      ) : null}
      {r.staffReply ? (
        <div className="rounded-xl bg-muted p-3 text-sm">
          <p className="mb-0.5 text-xs font-bold text-brand">{t.reviews.storeReply}</p>
          <p className="whitespace-pre-line text-fg-muted" dir="auto">{r.staffReply}</p>
        </div>
      ) : null}
    </article>
  );
}

export function ProductReviews({ summary, items, locale, t }: { summary: RatingSummary; items: PublicReview[]; locale: Locale; t: Dictionary }) {
  return (
    <section id="reviews" className="mt-14 scroll-mt-24" aria-labelledby="reviews-title">
      <h2 id="reviews-title" className="mb-5 text-xl font-extrabold">{t.reviews.title}</h2>
      {summary.count === 0 ? (
        <div className="rounded-2xl border border-dashed border-line-strong p-6 text-center">
          <p className="font-bold">{t.reviews.none}</p>
          <p className="mt-1 text-sm text-fg-muted">{t.reviews.noneBody}</p>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[17rem_1fr]">
          <div className="h-fit rounded-2xl border border-line bg-elevated p-5">
            <p className="ltr-nums text-4xl font-black" dir="ltr">{summary.average.toFixed(1)}</p>
            <Stars value={summary.average} label={fmt(t.reviews.outOf, { avg: summary.average.toFixed(1) })} className="mt-1 text-xl" />
            <p className="mt-1 text-sm text-fg-muted">{fmt(t.reviews.count, { count: summary.count })}</p>
            <ul className="mt-4 space-y-1.5">
              {[5, 4, 3, 2, 1].map((n) => {
                const c = summary.distribution[n - 1] ?? 0;
                return (
                  <li key={n} className="flex items-center gap-2 text-xs">
                    <span className="ltr-nums w-3 text-fg-muted">{n}</span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <span className="block h-full rounded-full bg-amber-400" style={{ width: `${(c / summary.count) * 100}%` }} />
                    </span>
                    <span className="ltr-nums w-6 text-end text-fg-subtle">{c}</span>
                  </li>
                );
              })}
            </ul>
            <p className="mt-4 text-xs text-fg-subtle">{t.reviews.noneBody}</p>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {items.map((r) => (
              <li key={r.id}><ReviewCard r={r} locale={locale} t={t} /></li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

export function LatestReviews({
  items,
  locale,
  t,
}: {
  items: (PublicReview & { productSlug: string; productNameAr: string; productNameEn: string })[];
  locale: Locale;
  t: Dictionary;
}) {
  if (!items.length) return null;
  return (
    <section className="mx-auto max-w-6xl px-4 py-10">
      <h2 className="text-2xl font-extrabold">{t.reviews.latestTitle}</h2>
      <p className="mt-1 mb-5 text-fg-muted">{t.reviews.latestBody}</p>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((r) => (
          <li key={r.id}>
            <ReviewCard
              r={r}
              locale={locale}
              t={t}
              product={{ href: `/${locale}/services/${r.productSlug}#reviews`, name: locale === "ar" ? r.productNameAr : r.productNameEn }}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
