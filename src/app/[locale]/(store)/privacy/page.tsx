import type { Metadata } from "next";
import { resolveLocale, type LocaleParams } from "@/lib/i18n/server";
import { getSettings } from "@/lib/services/settings";
import { PolicyPage } from "@/components/store/policy-page";

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const { t } = await resolveLocale(params);
  return { title: t.legal.privacy };
}

export default async function PrivacyPage({ params }: LocaleParams) {
  const { locale, t } = await resolveLocale(params);
  const s = await getSettings();
  return <PolicyPage title={t.legal.privacy} text={locale === "ar" ? s.privacyAr : s.privacyEn} updatedAt={s.policiesUpdatedAt} locale={locale} t={t} />;
}
