import type { Metadata } from "next";
import { resolveLocale, type LocaleParams } from "@/lib/i18n/server";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { Logo } from "@/components/ui/logo";
import { ForgotPasswordForm } from "@/components/admin/password-forms";

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const { t } = await resolveLocale(params);
  return { title: t.password.forgotTitle, robots: { index: false, follow: false } };
}

export default async function ForgotPasswordPage({ params }: LocaleParams) {
  const { locale, t } = await resolveLocale(params);
  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex justify-center"><Logo locale={locale} name={t.meta.storeName} /></div>
        <Card className="p-6">
          <h1 className="mb-4 flex items-center gap-2 text-xl font-extrabold"><Icon name="lock" className="size-5 text-brand" /> {t.password.forgotTitle}</h1>
          <ForgotPasswordForm locale={locale} s={{ ...t.password, errors: { ...t.password.errors, rateLimited: t.errors.rateLimited } }} />
        </Card>
      </div>
    </div>
  );
}
