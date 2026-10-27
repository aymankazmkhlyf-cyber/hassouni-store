import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { inArray, and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { products } from "@/lib/db/schema";
import { getDictionary, isLocale } from "@/lib/i18n";
import { GUIDES, getGuide } from "@/lib/i18n/guides";
import { listProducts } from "@/lib/services/catalog";
import { Icon } from "@/components/ui/icon";
import { GuideArt } from "@/components/store/guide-art";
import { Breadcrumbs, ProductGrid } from "@/components/store/product-card";

type Props = { params: Promise<{ locale: string; slug: string }> };

export function generateStaticParams() {
  return GUIDES.flatMap((g) => [{ locale: "ar", slug: g.slug }, { locale: "en", slug: g.slug }]);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const guide = getGuide(slug);
  if (!guide || !isLocale(locale)) return {};
  return {
    title: guide.title[locale],
    description: guide.description[locale],
    alternates: { canonical: `/${locale}/guides/${slug}`, languages: { ar: `/ar/guides/${slug}`, en: `/en/guides/${slug}` } },
    openGraph: { title: guide.title[locale], description: guide.description[locale], type: "article" },
  };
}

/** JSON for <script type="application/ld+json">, with "<" escaped so it can never close the tag. */
const ld = (data: unknown) => JSON.stringify(data).replace(/</g, "\\u003c");

export default async function GuidePage({ params }: Props) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const guide = getGuide(slug);
  if (!guide) notFound();
  const t = getDictionary(locale);

  const active = guide.products.length
    ? await db.select({ id: products.id }).from(products).where(and(inArray(products.slug, guide.products), eq(products.isActive, true)))
    : [];
  const related = active.length ? (await listProducts({ pageSize: 48 })).items.filter((p) => active.some((a) => a.id === p.id)) : [];
  const others = GUIDES.filter((g) => g.slug !== guide.slug).slice(0, 4);

  const howTo = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: guide.title[locale],
    description: guide.description[locale],
    inLanguage: locale,
    dateModified: guide.updated,
    step: guide.steps[locale].map((text, i) => ({ "@type": "HowToStep", position: i + 1, text })),
  };
  const faq = guide.faq[locale].length
    ? {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: guide.faq[locale].map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
      }
    : null;

  return (
    <article className="mx-auto max-w-4xl px-4 py-6 sm:py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ld(howTo) }} />
      {faq ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ld(faq) }} /> : null}
      <Breadcrumbs items={[{ href: `/${locale}`, label: t.nav.home }, { href: `/${locale}/guides`, label: t.guides.title }, { label: guide.title[locale] }]} />
      <header className="mb-6">
        <h1 className="text-2xl leading-tight font-extrabold sm:text-3xl">{guide.title[locale]}</h1>
        <p className="mt-2 text-fg-muted">{guide.description[locale]}</p>
      </header>

      <div className="grid gap-6 md:grid-cols-[16rem_1fr] md:items-start">
        <GuideArt
          variant={guide.art.variant}
          labels={{ title: guide.art.title[locale], a: guide.art.a?.[locale], b: guide.art.b?.[locale] }}
          className="mx-auto w-64 max-w-full rounded-2xl md:sticky md:top-24"
        />
        <div className="space-y-6">
          <section className="rounded-(--radius-card) border border-line bg-elevated p-5 shadow-soft">
            <h2 className="mb-3 font-bold">{t.guides.steps}</h2>
            <ol className="space-y-3">
              {guide.steps[locale].map((s, i) => (
                <li key={s} className="flex gap-3">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand text-sm font-bold text-brand-fg">{i + 1}</span>
                  <span className="pt-0.5">{s}</span>
                </li>
              ))}
            </ol>
          </section>
          {guide.tips[locale].length ? (
            <section className="rounded-(--radius-card) border border-warning/30 bg-warning-soft p-5">
              <h2 className="mb-2 font-bold text-warning">{t.guides.tips}</h2>
              <ul className="space-y-1.5 text-sm">
                {guide.tips[locale].map((tip) => (
                  <li key={tip} className="flex gap-2"><Icon name="alert" className="mt-0.5 size-4 shrink-0 text-warning" /> {tip}</li>
                ))}
              </ul>
            </section>
          ) : null}
          {guide.faq[locale].length ? (
            <section className="rounded-(--radius-card) border border-line bg-elevated p-5 shadow-soft">
              <h2 className="mb-3 font-bold">{t.guides.faq}</h2>
              <dl className="space-y-3 text-sm">
                {guide.faq[locale].map((f) => (
                  <div key={f.q}>
                    <dt className="font-bold">{f.q}</dt>
                    <dd className="mt-0.5 text-fg-muted">{f.a}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : null}
        </div>
      </div>

      {related.length ? (
        <section className="mt-12">
          <h2 className="mb-5 text-xl font-extrabold">{t.guides.related}</h2>
          <ProductGrid items={related} locale={locale} t={t} />
        </section>
      ) : null}

      <section className="mt-12">
        <h2 className="mb-4 text-lg font-bold">{t.guides.more}</h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {others.map((g) => (
            <li key={g.slug}>
              <Link href={`/${locale}/guides/${g.slug}`} className="flex items-center gap-2 rounded-xl border border-line bg-elevated px-4 py-3 text-sm font-semibold hover:border-brand/50 hover:text-brand">
                <Icon name="book" className="size-4.5 shrink-0" /> {g.title[locale]}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </article>
  );
}
