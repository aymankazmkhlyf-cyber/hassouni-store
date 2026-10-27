import Link from "next/link";
import { resolveLocale, type LocaleParams } from "@/lib/i18n/server";
import { faq } from "@/lib/i18n/content";
import { listCategories, listProducts } from "@/lib/services/catalog";
import { latestReviews, storeStats } from "@/lib/services/reviews";
import { fmt } from "@/lib/i18n/config";
import { getSettings } from "@/lib/services/settings";
import { ButtonLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { CategoryCard, ProductGrid } from "@/components/store/product-card";
import { ContactLinks } from "@/components/store/contact-links";
import { FaqList } from "@/components/store/faq-list";
import { LatestReviews } from "@/components/store/reviews";

/** Below these, the counters would look odd, so they stay hidden until real numbers grow. */
const COMPLETED_MIN = 10;
const RATING_MIN = 3;

export default async function HomePage({ params }: LocaleParams) {
  const { locale, t } = await resolveLocale(params);
  const settings = await getSettings();
  const [categories, featured, offers, reviews, stats] = await Promise.all([
    listCategories({ activeOnly: true }),
    listProducts({ featuredOnly: true, pageSize: 8 }),
    settings.showOffers ? listProducts({ offersOnly: true, pageSize: 4 }) : Promise.resolve(null),
    latestReviews(6),
    storeStats(),
  ]);
  // Shown only once the numbers are meaningful; they always come from real orders and reviews.
  const showCompleted = stats.completed >= COMPLETED_MIN;
  const showRating = stats.rating != null && stats.reviews >= RATING_MIN;
  const heroTitle = (locale === "ar" ? settings.heroTitleAr : settings.heroTitleEn) || t.home.heroTitle;
  const heroSubtitle = (locale === "ar" ? settings.heroSubtitleAr : settings.heroSubtitleEn) || t.home.heroSubtitle;

  return (
    <>
      <section className="px-4 pt-4 sm:pt-6">
        <div className="hero-gradient relative mx-auto max-w-6xl overflow-hidden rounded-[1.75rem] text-white shadow-lift">
          <div className="grid-pattern absolute inset-0 opacity-60" aria-hidden="true" />
          <div className="relative grid gap-8 px-6 py-12 sm:px-10 sm:py-16 lg:grid-cols-[1.4fr_1fr] lg:items-center">
            <div className="animate-in">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold ring-1 ring-white/25">
                <Icon name="shield" className="size-4" /> {t.home.heroBadge}
              </span>
              <h1 className="mt-4 text-3xl leading-tight font-black tracking-tight sm:text-5xl sm:leading-tight">{heroTitle}</h1>
              <p className="mt-4 max-w-xl text-base text-white/85 sm:text-lg">{heroSubtitle}</p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link href={`/${locale}/services`} className="inline-flex h-12 items-center gap-2 rounded-xl bg-white px-6 font-bold text-[#2a1c86] shadow-soft transition hover:bg-white/90">
                  {t.home.heroCta} <Icon name="chevron-end" className="size-4.5 rtl:rotate-180" />
                </Link>
                <Link href={`/${locale}/custom-request`} className="inline-flex h-12 items-center rounded-xl px-5 font-bold text-white ring-1 ring-white/40 transition hover:bg-white/10">
                  {t.home.heroSecondary}
                </Link>
              </div>
              <ul className="mt-6 flex flex-wrap gap-2 text-sm" data-testid="hero-stats">
                {showCompleted ? (
                  <li className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 font-semibold ring-1 ring-white/25">
                    <Icon name="check" className="size-4" /> {fmt(t.home.statCompleted, { n: stats.completed.toLocaleString("en-US") })}
                  </li>
                ) : null}
                {showRating ? (
                  <li className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 font-semibold ring-1 ring-white/25">
                    <Icon name="star" className="size-4" /> {fmt(t.home.statRating, { avg: stats.rating!.toFixed(1), n: stats.reviews })}
                  </li>
                ) : null}
                <li className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 font-semibold ring-1 ring-white/25">
                  <Icon name="clock" className="size-4" /> {t.home.statSpeed}
                </li>
              </ul>
            </div>
            <ul className="hidden grid-cols-2 gap-3 lg:grid" aria-hidden="true">
              {categories.slice(0, 4).map((c) => (
                <li key={c.id} className="rounded-2xl bg-white/12 p-4 ring-1 ring-white/20 backdrop-blur-sm">
                  <Icon name={c.icon} className="size-7" />
                  <p className="mt-3 text-sm font-bold">{locale === "ar" ? c.nameAr : c.nameEn}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <Section title={t.home.categories} action={<Link href={`/${locale}/services`} className="text-sm font-semibold text-brand hover:underline">{t.common.viewAll}</Link>}>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((c) => (
            <li key={c.id}>
              <CategoryCard c={c} locale={locale} />
            </li>
          ))}
        </ul>
      </Section>

      {featured.items.length ? (
        <Section title={t.home.featured}>
          <ProductGrid items={featured.items} locale={locale} t={t} />
        </Section>
      ) : null}

      {offers && offers.items.length ? (
        <Section title={t.home.offers}>
          <ProductGrid items={offers.items} locale={locale} t={t} />
        </Section>
      ) : null}

      <Section title={t.home.howTitle}>
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {t.home.how.map((step, i) => (
            <li key={step.title} className="rounded-(--radius-card) border border-line bg-elevated p-5 shadow-soft">
              <span className="grid size-10 place-items-center rounded-xl bg-brand text-lg font-black text-brand-fg">{i + 1}</span>
              <h3 className="mt-4 font-bold">{step.title}</h3>
              <p className="mt-1 text-sm text-fg-muted">{step.body}</p>
            </li>
          ))}
        </ol>
      </Section>

      <LatestReviews items={reviews} locale={locale} t={t} />

      <Section title={t.home.faqTitle} action={<Link href={`/${locale}/faq`} className="text-sm font-semibold text-brand hover:underline">{t.common.viewAll}</Link>}>
        <FaqList items={faq[locale].slice(0, 4)} />
      </Section>

      <Section title={t.home.supportTitle}>
        <p className="mb-4 text-fg-muted">{t.home.supportBody}</p>
        <ContactLinks settings={settings} t={t} />
      </Section>

      <div className="mx-auto mt-10 max-w-6xl px-4">
        <ButtonLink href={`/${locale}/services`} size="lg" className="w-full sm:w-auto">
          {t.home.heroCta}
        </ButtonLink>
      </div>
    </>
  );
}

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="mx-auto mt-14 max-w-6xl px-4">
      <div className="mb-5 flex items-end justify-between gap-4">
        <h2 className="text-xl font-extrabold tracking-tight sm:text-2xl">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
