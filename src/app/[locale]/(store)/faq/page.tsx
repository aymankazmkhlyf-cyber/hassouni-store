import type { Metadata } from "next";
import { faq } from "@/lib/i18n/content";
import { resolveLocale, type LocaleParams } from "@/lib/i18n/server";
import { FaqList } from "@/components/store/faq-list";
import { PageHeader } from "@/components/store/product-card";

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const { t } = await resolveLocale(params);
  return { title: t.nav.faq };
}

export default async function FaqPage({ params }: LocaleParams) {
  const { locale, t } = await resolveLocale(params);
  return (
    <>
      <PageHeader title={t.home.faqTitle} />
      <div className="mx-auto max-w-3xl px-4 py-8">
        <FaqList items={faq[locale]} />
      </div>
    </>
  );
}
