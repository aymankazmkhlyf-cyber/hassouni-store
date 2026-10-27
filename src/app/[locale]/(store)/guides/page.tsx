import type { Metadata } from "next";
import Link from "next/link";
import { GUIDES } from "@/lib/i18n/guides";
import { resolveLocale, type LocaleParams } from "@/lib/i18n/server";
import { GuideArt } from "@/components/store/guide-art";
import { PageHeader } from "@/components/store/product-card";

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const { locale, t } = await resolveLocale(params);
  return {
    title: t.guides.title,
    description: t.guides.subtitle,
    alternates: { canonical: `/${locale}/guides`, languages: { ar: "/ar/guides", en: "/en/guides" } },
  };
}

export default async function GuidesPage({ params }: LocaleParams) {
  const { locale, t } = await resolveLocale(params);
  return (
    <>
      <PageHeader title={t.guides.title} subtitle={t.guides.subtitle} />
      <div className="mx-auto max-w-6xl px-4 py-8">
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {GUIDES.map((g) => (
            <li key={g.slug}>
              <Link href={`/${locale}/guides/${g.slug}`} className="group flex h-full gap-4 rounded-(--radius-card) border border-line bg-elevated p-4 shadow-soft transition hover:-translate-y-0.5 hover:border-brand/50">
                <GuideArt variant={g.art.variant} labels={{ title: g.art.title[locale], a: g.art.a?.[locale], b: g.art.b?.[locale] }} className="w-24 shrink-0" />
                <span className="min-w-0">
                  <span className="block leading-snug font-bold group-hover:text-brand">{g.title[locale]}</span>
                  <span className="mt-1 line-clamp-3 block text-sm text-fg-muted">{g.description[locale]}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
