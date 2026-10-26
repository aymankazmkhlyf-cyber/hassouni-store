import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth/current-user";
import { resolveLocale, sp, type LocaleParams } from "@/lib/i18n/server";
import { Card } from "@/components/ui/card";
import { CustomRequestForm } from "@/components/store/forms";
import { PageHeader } from "@/components/store/product-card";

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const { t } = await resolveLocale(params);
  return { title: t.custom.title };
}

export default async function CustomRequestPage({ params, searchParams }: LocaleParams & { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { locale, t } = await resolveLocale(params);
  const preselected = sp((await searchParams).type);
  const user = await getCurrentUser();
  const { types, title: _title, body: _body, ...strings } = t.custom;
  return (
    <>
      <PageHeader title={t.custom.title} subtitle={t.custom.body} />
      <div className="mx-auto max-w-3xl px-4 py-8">
        <Card className="p-5 sm:p-6">
          <CustomRequestForm
            locale={locale}
            s={{ ...strings, name: t.checkout.name, phone: t.checkout.phone, email: t.checkout.email, optional: t.common.optional, home: t.errors.goHome }}
            types={{ ...types }}
            errors={{ ...t.errors }}
            defaults={{ name: user?.name ?? "", phone: user?.phone ?? "", email: user?.email ?? "", serviceType: preselected }}
          />
        </Card>
      </div>
    </>
  );
}
