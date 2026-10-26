import type { Metadata } from "next";
import { resolveLocale, type LocaleParams } from "@/lib/i18n/server";
import { getSettings } from "@/lib/services/settings";
import { Icon } from "@/components/ui/icon";
import { ContactLinks } from "@/components/store/contact-links";
import { PageHeader } from "@/components/store/product-card";

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const { t } = await resolveLocale(params);
  return { title: t.contact.title };
}

export default async function ContactPage({ params }: LocaleParams) {
  const { locale, t } = await resolveLocale(params);
  const settings = await getSettings();
  const hours = locale === "ar" ? settings.hoursAr : settings.hoursEn;
  return (
    <>
      <PageHeader title={t.contact.title} subtitle={t.contact.body} />
      <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
        <ContactLinks settings={settings} t={t} />
        <p className="text-sm text-fg-muted">{t.contact.noApp}</p>
        {hours ? (
          <p className="flex items-center gap-2 rounded-xl bg-muted p-4 text-sm">
            <Icon name="clock" className="size-5 text-accent" />
            <span className="font-semibold">{t.contact.hours}:</span> {hours}
          </p>
        ) : null}
        {settings.supportEmail ? (
          <p className="text-sm">
            <a href={`mailto:${settings.supportEmail}`} className="ltr-nums font-semibold text-brand hover:underline" dir="ltr">{settings.supportEmail}</a>
          </p>
        ) : null}
      </div>
    </>
  );
}
