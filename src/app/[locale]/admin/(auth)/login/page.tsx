import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { isStaffRole } from "@/lib/auth/permissions";
import { resolveLocale, type LocaleParams } from "@/lib/i18n/server";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { Logo } from "@/components/ui/logo";
import { LoginForm } from "@/components/store/forms";

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const { t } = await resolveLocale(params);
  return { title: t.auth.adminTitle, robots: { index: false, follow: false } };
}

export default async function AdminLoginPage({ params }: LocaleParams) {
  const { locale, t } = await resolveLocale(params);
  const user = await getCurrentUser();
  if (user && isStaffRole(user.role)) redirect(`/${locale}/admin`);
  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex justify-center"><Logo locale={locale} name={t.meta.storeName} /></div>
        <Card className="p-6">
          <h1 className="mb-1 flex items-center gap-2 text-xl font-extrabold"><Icon name="lock" className="size-5 text-brand" /> {t.auth.adminTitle}</h1>
          <p className="mb-5 text-sm text-fg-muted">{t.auth.adminOnly}</p>
          <LoginForm locale={locale} mode="staff" s={{ email: t.auth.email, password: t.auth.password, submit: t.auth.submitLogin }} errors={{ ...t.errors, ...t.auth }} />
        </Card>
      </div>
    </div>
  );
}
