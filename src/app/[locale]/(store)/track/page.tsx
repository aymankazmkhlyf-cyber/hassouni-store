import type { Metadata } from "next";
import { resolveLocale, type LocaleParams } from "@/lib/i18n/server";
import { Card } from "@/components/ui/card";
import { TrackForm } from "@/components/store/forms";
import { PageHeader } from "@/components/store/product-card";

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const { t } = await resolveLocale(params);
  return { title: t.track.title };
}

export default async function TrackPage({ params }: LocaleParams) {
  const { locale, t } = await resolveLocale(params);
  return (
    <>
      <PageHeader title={t.track.title} subtitle={t.track.body} />
      <div className="mx-auto max-w-md px-4 py-8">
        <Card className="p-5">
          <TrackForm locale={locale} s={t.track} errors={{ ...t.errors }} />
        </Card>
        <p className="mt-4 text-center text-sm text-fg-muted">{t.track.accountHint}</p>
      </div>
    </>
  );
}
