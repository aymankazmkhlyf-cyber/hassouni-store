import { savePaymentMethodAction } from "@/app/actions/admin";
import { requireStaffPage } from "@/lib/auth/current-user";
import { resolveLocale, type LocaleParams } from "@/lib/i18n/server";
import { listPaymentMethods } from "@/lib/services/admin-catalog";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Checkbox, Input, Textarea } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { ActionForm } from "@/components/admin/action-form";
import { AdminTitle, adminMessages } from "@/components/admin/messages";

export default async function AdminPaymentMethods({ params }: LocaleParams) {
  const { locale, t } = await resolveLocale(params);
  await requireStaffPage(locale, "payment_methods:write");
  const methods = await listPaymentMethods();
  const p = t.admin.paymentsPage;
  const f = (label: string, el: React.ReactNode, cls = "") => (
    <label className={`block text-xs font-semibold ${cls}`}><span className="mb-1 block">{label}</span>{el}</label>
  );
  return (
    <>
      <AdminTitle title={t.admin.paymentMethods} />
      <Alert tone="info" className="mb-4">{p.intro}</Alert>
      <div className="space-y-4">
        {methods.map((m) => (
          <Card key={m.id} className="p-5">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <h2 className="font-bold">{locale === "ar" ? m.nameAr : m.nameEn}</h2>
              <Badge className="ltr-nums">{m.code}</Badge>
              <Badge tone={m.isEnabled ? "success" : "neutral"}>{m.isEnabled ? t.common.active : t.common.inactive}</Badge>
            </div>
            {m.code === "mastercard" ? <Alert tone="warning" className="mb-4">{p.cardWarning}</Alert> : null}
            <ActionForm action={savePaymentMethodAction} messages={adminMessages(t)} className="grid gap-3 sm:grid-cols-2">
              <input type="hidden" name="id" value={m.id} />
              {f(p.nameAr, <Input name="nameAr" defaultValue={m.nameAr} required maxLength={80} dir="rtl" />)}
              {f(p.nameEn, <Input name="nameEn" defaultValue={m.nameEn} required maxLength={80} dir="ltr" />)}
              {f(p.instructionsAr, <Textarea name="instructionsAr" defaultValue={m.instructionsAr} maxLength={3000} rows={3} dir="rtl" />)}
              {f(p.instructionsEn, <Textarea name="instructionsEn" defaultValue={m.instructionsEn} maxLength={3000} rows={3} dir="ltr" />)}
              {f(p.accountDetails, <Input name="accountDetails" defaultValue={m.accountDetails} maxLength={300} dir="ltr" />, "sm:col-span-2")}
              {f(t.admin.categoriesPage.sortOrder, <Input name="sortOrder" type="number" defaultValue={m.sortOrder} dir="ltr" />)}
              <div className="space-y-2 sm:col-span-2">
                <span className="block text-xs font-semibold">{p.qr}</span>
                <div className="flex flex-wrap items-center gap-3">
                  {m.qrFileId ? (
                    // eslint-disable-next-line @next/next/no-img-element -- DB-backed image route
                    <img src={`/api/files/${m.qrFileId}`} alt="" className="size-24 rounded-lg border border-line object-contain" />
                  ) : null}
                  <input
                    name="qr"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="text-sm file:me-3 file:rounded-lg file:border-0 file:bg-brand-soft file:px-3 file:py-2 file:font-semibold file:text-brand-soft-fg"
                  />
                  {m.qrFileId ? <Checkbox name="removeQr" label={p.removeQr} /> : null}
                </div>
                <p className="text-xs text-fg-muted">{p.qrHint}</p>
              </div>
              <div className="flex flex-wrap items-end gap-4 sm:col-span-2">
                <Checkbox name="isEnabled" defaultChecked={m.isEnabled} label={p.enabled} />
                <Checkbox name="requiresReference" defaultChecked={m.requiresReference} label={p.requiresReference} />
                <Checkbox name="allowsReceipt" defaultChecked={m.allowsReceipt} label={p.allowsReceipt} />
              </div>
              <div className="sm:col-span-2"><SubmitButton size="sm">{t.common.save}</SubmitButton></div>
            </ActionForm>
          </Card>
        ))}
      </div>
    </>
  );
}
