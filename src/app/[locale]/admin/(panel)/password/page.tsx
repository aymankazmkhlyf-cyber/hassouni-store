import { requireStaffPage } from "@/lib/auth/current-user";
import { resolveLocale, type LocaleParams } from "@/lib/i18n/server";
import { Card } from "@/components/ui/card";
import { AdminTitle } from "@/components/admin/messages";
import { ChangePasswordForm } from "@/components/admin/password-forms";

export default async function AdminPasswordPage({ params }: LocaleParams) {
  const { locale, t } = await resolveLocale(params);
  const user = await requireStaffPage(locale);
  return (
    <>
      <AdminTitle title={t.password.changeTitle} />
      <Card className="max-w-md p-6">
        <ChangePasswordForm locale={locale} email={user.email} s={{ ...t.password, errors: { ...t.password.errors, rateLimited: t.errors.rateLimited, unauthorized: t.errors.unauthorized } }} />
      </Card>
    </>
  );
}
