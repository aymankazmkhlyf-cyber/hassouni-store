import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { resolveLocale, sp, type LocaleParams } from "@/lib/i18n/server";
import { Card } from "@/components/ui/card";
import { RegisterForm } from "@/components/store/forms";

type Props = LocaleParams & { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const { t } = await resolveLocale(params);
  return { title: t.auth.registerTitle, robots: { index: false } };
}

export default async function RegisterPage({ params, searchParams }: Props) {
  const { locale, t } = await resolveLocale(params);
  if (await getCurrentUser()) redirect(`/${locale}/account`);
  const next = sp((await searchParams).next);
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="mb-6 text-center text-2xl font-extrabold">{t.auth.registerTitle}</h1>
      <Card className="p-5">
        <RegisterForm
          locale={locale}
          next={next}
          s={{ name: t.auth.name, username: t.auth.username, usernameHint: t.auth.usernameHint, email: t.auth.email, phone: t.auth.phone, password: t.auth.password, passwordHint: t.auth.passwordHint, submit: t.auth.submitRegister }}
          errors={{ ...t.errors }}
        />
      </Card>
      <p className="mt-4 text-center text-sm text-fg-muted">
        {t.auth.haveAccount}{" "}
        <Link href={`/${locale}/login`} className="font-semibold text-brand hover:underline">{t.auth.loginTitle}</Link>
      </p>
    </div>
  );
}
