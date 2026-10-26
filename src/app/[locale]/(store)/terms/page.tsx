import type { Metadata } from "next";
import { resolveLocale, type LocaleParams } from "@/lib/i18n/server";
import { getSettings } from "@/lib/services/settings";
import { PolicyPage } from "@/components/store/policy-page";

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const { t } = await resolveLocale(params);
  return { title: t.legal.terms };
}

export default async function TermsPage({ params }: LocaleParams) {
  const { locale, t } = await resolveLocale(params);
  const s = await getSettings();
  return <PolicyPage title={t.legal.terms} text={locale === "ar" ? s.termsAr : s.termsEn} updatedAt={s.policiesUpdatedAt} locale={locale} t={t} />;
}
