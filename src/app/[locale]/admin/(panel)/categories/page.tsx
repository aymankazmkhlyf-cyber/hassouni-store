import { deleteCategoryAction, moveCategoryAction, saveCategoryAction } from "@/app/actions/admin";
import { requireStaffPage } from "@/lib/auth/current-user";
import type { Dictionary } from "@/lib/i18n";
import { resolveLocale, type LocaleParams } from "@/lib/i18n/server";
import { listCategories } from "@/lib/services/catalog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Checkbox, Input, Select } from "@/components/ui/form";
import { CATALOG_ICONS, Icon } from "@/components/ui/icon";
import { SubmitButton } from "@/components/ui/submit-button";
import { ActionForm } from "@/components/admin/action-form";
import { AdminTitle, adminMessages } from "@/components/admin/messages";

type Cat = Awaited<ReturnType<typeof listCategories>>[number];

function CategoryFields({ t, c }: { t: Dictionary; c?: Cat }) {
  const p = t.admin.categoriesPage;
  const f = (label: string, el: React.ReactNode) => (
    <label className="block text-xs font-semibold"><span className="mb-1 block">{label}</span>{el}</label>
  );
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {f(p.nameAr, <Input name="nameAr" defaultValue={c?.nameAr} required maxLength={80} dir="rtl" />)}
      {f(p.nameEn, <Input name="nameEn" defaultValue={c?.nameEn} required maxLength={80} dir="ltr" />)}
      {f(p.slug, <Input name="slug" defaultValue={c?.slug} required pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={80} dir="ltr" />)}
      {f(p.descriptionAr, <Input name="descriptionAr" defaultValue={c?.descriptionAr} maxLength={500} dir="rtl" />)}
      {f(p.descriptionEn, <Input name="descriptionEn" defaultValue={c?.descriptionEn} maxLength={500} dir="ltr" />)}
      <div className="grid grid-cols-2 gap-3">
        {f(p.icon, <Select name="icon" defaultValue={c?.icon ?? "spark"}>{CATALOG_ICONS.map((i) => <option key={i}>{i}</option>)}</Select>)}
        {f(p.sortOrder, <Input name="sortOrder" type="number" defaultValue={c?.sortOrder ?? 0} dir="ltr" />)}
      </div>
      <Checkbox name="isActive" defaultChecked={c?.isActive ?? true} label={t.common.active} />
    </div>
  );
}

export default async function AdminCategories({ params }: LocaleParams) {
  const { locale, t } = await resolveLocale(params);
  await requireStaffPage(locale, "categories:write");
  const categories = await listCategories();
  const messages = adminMessages(t);
  const p = t.admin.categoriesPage;
  return (
    <>
      <AdminTitle title={t.admin.categories} />
      <div className="space-y-4">
        {categories.map((c, i) => (
          <Card key={c.id}>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3">
              <span className="flex items-center gap-2 font-bold">
                <Icon name={c.icon} className="size-5 text-brand" /> {locale === "ar" ? c.nameAr : c.nameEn}
                <Badge tone={c.isActive ? "success" : "neutral"}>{c.isActive ? t.common.active : t.common.inactive}</Badge>
                <Badge>{p.products}: {c.productCount}</Badge>
              </span>
              <span className="flex gap-1">
                <form action={moveCategoryAction}>
                  <input type="hidden" name="id" value={c.id} />
                  <input type="hidden" name="direction" value="up" />
                  <Button type="submit" variant="ghost" size="sm" disabled={i === 0} aria-label={p.moveUp}><Icon name="chevron-down" className="size-4 rotate-180" /></Button>
                </form>
                <form action={moveCategoryAction}>
                  <input type="hidden" name="id" value={c.id} />
                  <input type="hidden" name="direction" value="down" />
                  <Button type="submit" variant="ghost" size="sm" disabled={i === categories.length - 1} aria-label={p.moveDown}><Icon name="chevron-down" className="size-4" /></Button>
                </form>
              </span>
            </div>
            <div className="space-y-3 p-5">
              <ActionForm action={saveCategoryAction} messages={messages} labels={{ slug: p.slug }} className="space-y-3">
                <input type="hidden" name="id" value={c.id} />
                <CategoryFields t={t} c={c} />
                <SubmitButton size="sm" variant="secondary">{t.common.save}</SubmitButton>
              </ActionForm>
              <ActionForm action={deleteCategoryAction} messages={messages}>
                <input type="hidden" name="id" value={c.id} />
                <SubmitButton size="sm" variant="ghost" className="text-danger" confirmMessage={p.deleteConfirm}>
                  <Icon name="trash" className="size-4" /> {t.common.delete}
                </SubmitButton>
              </ActionForm>
            </div>
          </Card>
        ))}
        <Card>
          <CardHeader title={p.new} />
          <ActionForm action={saveCategoryAction} messages={messages} labels={{ slug: p.slug }} className="space-y-3 p-5" resetOnSuccess>
            <CategoryFields t={t} />
            <SubmitButton size="sm"><Icon name="plus" className="size-4" /> {t.common.create}</SubmitButton>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
