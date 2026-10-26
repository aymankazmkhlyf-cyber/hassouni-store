import { saveSettingsAction } from "@/app/actions/admin";
import { requireStaffPage } from "@/lib/auth/current-user";
import { resolveLocale, type LocaleParams } from "@/lib/i18n/server";
import { loadSettings } from "@/lib/services/settings";
import { Card, CardHeader } from "@/components/ui/card";
import { Checkbox, Input, Textarea } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { ActionForm } from "@/components/admin/action-form";
import { AdminTitle, adminMessages } from "@/components/admin/messages";

export default async function AdminSettings({ params }: LocaleParams) {
  const { locale, t } = await resolveLocale(params);
  await requireStaffPage(locale, "settings:write");
  const s = await loadSettings();
  const p = t.admin.settingsPage;
  const f = (label: string, el: React.ReactNode, cls = "") => (
    <label className={`block text-sm font-semibold ${cls}`}><span className="mb-1 block">{label}</span>{el}</label>
  );
  return (
    <>
      <AdminTitle title={t.admin.settings} />
      <ActionForm action={saveSettingsAction} messages={adminMessages(t)} labels={{ whatsapp: p.whatsapp, instagram: p.instagram, telegram: p.telegram, supportEmail: p.email, logo: p.logo }} className="space-y-6">
        <Card>
          <CardHeader title={p.general} />
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            {f(p.storeNameAr, <Input name="storeNameAr" defaultValue={s.storeNameAr} required maxLength={120} dir="rtl" />)}
            {f(p.storeNameEn, <Input name="storeNameEn" defaultValue={s.storeNameEn} required maxLength={120} dir="ltr" />)}
            {f(p.logo, <input name="logo" type="file" accept="image/jpeg,image/png,image/webp" className="block w-full text-sm file:me-3 file:rounded-lg file:border-0 file:bg-brand-soft file:px-3 file:py-2 file:font-semibold file:text-brand-soft-fg" />)}
            {s.logoFileId ? <div className="flex items-center gap-3">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={`/api/files/${s.logoFileId}`} alt="" className="size-12 rounded-xl object-cover" /><Checkbox name="removeLogo" label={p.removeLogo} /></div> : null}
            <div className="sm:col-span-2"><p className="text-sm font-semibold">{p.languages}</p><p className="text-sm text-fg-muted">{p.languagesBody}</p></div>
          </div>
        </Card>
        <Card>
          <CardHeader title={p.contact} />
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            {f(p.whatsapp, <Input name="whatsapp" defaultValue={s.whatsapp} maxLength={30} dir="ltr" />)}
            {f(p.telegram, <Input name="telegram" defaultValue={s.telegram} maxLength={40} dir="ltr" />)}
            {f(p.instagram, <Input name="instagram" type="url" defaultValue={s.instagram} maxLength={300} dir="ltr" />)}
            {f(p.email, <Input name="supportEmail" type="email" defaultValue={s.supportEmail} maxLength={200} dir="ltr" />)}
            {f(p.hoursAr, <Input name="hoursAr" defaultValue={s.hoursAr} maxLength={200} dir="rtl" />)}
            {f(p.hoursEn, <Input name="hoursEn" defaultValue={s.hoursEn} maxLength={200} dir="ltr" />)}
          </div>
        </Card>
        <Card>
          <CardHeader title={p.store} />
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <div className="flex flex-wrap gap-5 sm:col-span-2">
              <Checkbox name="ordersEnabled" defaultChecked={s.ordersEnabled} label={p.ordersEnabled} />
              <Checkbox name="showOffers" defaultChecked={s.showOffers} label={p.showOffers} />
            </div>
            {f(p.noticeAr, <Input name="noticeAr" defaultValue={s.noticeAr} maxLength={300} dir="rtl" />)}
            {f(p.noticeEn, <Input name="noticeEn" defaultValue={s.noticeEn} maxLength={300} dir="ltr" />)}
            {f(p.heroTitleAr, <Input name="heroTitleAr" defaultValue={s.heroTitleAr} maxLength={120} dir="rtl" />)}
            {f(p.heroTitleEn, <Input name="heroTitleEn" defaultValue={s.heroTitleEn} maxLength={120} dir="ltr" />)}
            {f(p.heroSubtitleAr, <Textarea name="heroSubtitleAr" defaultValue={s.heroSubtitleAr} maxLength={400} rows={2} dir="rtl" />)}
            {f(p.heroSubtitleEn, <Textarea name="heroSubtitleEn" defaultValue={s.heroSubtitleEn} maxLength={400} rows={2} dir="ltr" />)}
            {f(p.retentionDays, <Input name="retentionDays" type="number" min={30} max={3650} defaultValue={s.retentionDays} dir="ltr" />)}
          </div>
        </Card>
        <Card>
          <CardHeader title={p.policies} description={p.policyHint} />
          <div className="grid gap-4 p-5 lg:grid-cols-2">
            {f(p.termsAr, <Textarea name="termsAr" defaultValue={s.termsAr} rows={10} maxLength={20000} dir="rtl" />)}
            {f(p.termsEn, <Textarea name="termsEn" defaultValue={s.termsEn} rows={10} maxLength={20000} dir="ltr" />)}
            {f(p.privacyAr, <Textarea name="privacyAr" defaultValue={s.privacyAr} rows={10} maxLength={20000} dir="rtl" />)}
            {f(p.privacyEn, <Textarea name="privacyEn" defaultValue={s.privacyEn} rows={10} maxLength={20000} dir="ltr" />)}
            {f(p.refundAr, <Textarea name="refundAr" defaultValue={s.refundAr} rows={10} maxLength={20000} dir="rtl" />)}
            {f(p.refundEn, <Textarea name="refundEn" defaultValue={s.refundEn} rows={10} maxLength={20000} dir="ltr" />)}
          </div>
        </Card>
        <SubmitButton size="lg" pendingLabel={t.common.saving}>{t.common.save}</SubmitButton>
      </ActionForm>
    </>
  );
}
