import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { resolveLocale, sp, type LocaleParams } from "@/lib/i18n/server";
import { Card } from "@/components/ui/card";
import { LoginForm } from "@/components/store/forms";

type Props = LocaleParams & { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const { t } = await resolveLocale(params);
  return { title: t.auth.loginTitle, robots: { index: false } };
}

export default async function LoginPage({ params, searchParams }: Props) {
  const { locale, t } = await resolveLocale(params);
  if (await getCurrentUser()) redirect(`/${locale}/account`);
  const next = sp((await searchParams).next);
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="mb-6 text-center text-2xl font-extrabold">{t.auth.loginTitle}</h1>
      <Card className="p-5">
        <LoginForm locale={locale} next={next} mode="customer" s={{ email: t.auth.email, password: t.auth.password, submit: t.auth.submitLogin }} errors={{ ...t.errors, ...t.auth }} />
      </Card>
      <p className="mt-4 text-center text-sm text-fg-muted">
        {t.auth.noAccount}{" "}
        <Link href={`/${locale}/register${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-semibold text-brand hover:underline">{t.auth.registerTitle}</Link>
      </p>
    </div>
  );
}
