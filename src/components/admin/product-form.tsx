import { saveProductAction } from "@/app/actions/admin";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n";
import { serializeFields, serializePackages, serializeTiers } from "@/lib/domain/admin-parse";
import type { adminGetProduct } from "@/lib/services/admin-catalog";
import { Card, CardHeader } from "@/components/ui/card";
import { Checkbox, Input, Select, Textarea } from "@/components/ui/form";
import { CATALOG_ICONS } from "@/components/ui/icon";
import { Alert } from "@/components/ui/alert";
import { SubmitButton } from "@/components/ui/submit-button";
import { ActionForm } from "./action-form";
import { adminMessages } from "./messages";

type Product = NonNullable<Awaited<ReturnType<typeof adminGetProduct>>>;

function L({ label, hint, children, className }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block text-sm font-semibold ${className ?? ""}`}>
      <span className="mb-1 block">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs font-normal text-fg-subtle">{hint}</span> : null}
    </label>
  );
}

export function ProductForm({
  locale,
  t,
  categories,
  product,
}: {
  locale: Locale;
  t: Dictionary;
  categories: { id: number; nameAr: string; nameEn: string }[];
  product?: Product;
}) {
  const p = t.admin.productsPage;
  const labels: Record<string, string> = {
    categoryId: p.category, slug: p.slug, nameAr: p.nameAr, nameEn: p.nameEn, unitPrice: p.unitPrice,
    compareAtPrice: p.compareAtPrice, minQuantity: p.minQuantity, maxQuantity: p.maxQuantity,
    packages: p.packages, tiers: p.tiers, fields: p.fields, image: p.image,
  };
  return (
    <ActionForm action={saveProductAction} messages={adminMessages(t)} labels={labels} className="space-y-6">
      <input type="hidden" name="locale" value={locale} />
      {product ? <input type="hidden" name="id" value={product.id} /> : null}

      <Card>
        <CardHeader title={product ? p.editTitle : p.newTitle} />
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <L label={p.nameAr}><Input name="nameAr" defaultValue={product?.nameAr} required maxLength={120} dir="rtl" /></L>
          <L label={p.nameEn}><Input name="nameEn" defaultValue={product?.nameEn} required maxLength={120} dir="ltr" /></L>
          <L label={p.slug} hint={p.slugHint}><Input name="slug" defaultValue={product?.slug} required pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={80} dir="ltr" /></L>
          <L label={p.category}>
            <Select name="categoryId" defaultValue={product?.categoryId} required>
              {categories.map((c) => <option key={c.id} value={c.id}>{locale === "ar" ? c.nameAr : c.nameEn}</option>)}
            </Select>
          </L>
          <L label={p.summaryAr}><Input name="summaryAr" defaultValue={product?.summaryAr} maxLength={300} dir="rtl" /></L>
          <L label={p.summaryEn}><Input name="summaryEn" defaultValue={product?.summaryEn} maxLength={300} dir="ltr" /></L>
          <L label={p.descriptionAr}><Textarea name="descriptionAr" defaultValue={product?.descriptionAr} maxLength={5000} rows={5} dir="rtl" /></L>
          <L label={p.descriptionEn}><Textarea name="descriptionEn" defaultValue={product?.descriptionEn} maxLength={5000} rows={5} dir="ltr" /></L>
          <L label={p.deliveryAr}><Input name="deliveryTimeAr" defaultValue={product?.deliveryTimeAr} maxLength={120} dir="rtl" /></L>
          <L label={p.deliveryEn}><Input name="deliveryTimeEn" defaultValue={product?.deliveryTimeEn} maxLength={120} dir="ltr" /></L>
          <L label={p.icon}>
            <Select name="icon" defaultValue={product?.icon ?? "spark"}>
              {CATALOG_ICONS.map((i) => <option key={i} value={i}>{i}</option>)}
            </Select>
          </L>
          <L label={p.sortOrder}><Input name="sortOrder" type="number" defaultValue={product?.sortOrder ?? 0} dir="ltr" /></L>
          <L label={p.image} className="sm:col-span-2">
            <input name="image" type="file" accept="image/jpeg,image/png,image/webp" className="block w-full text-sm file:me-3 file:rounded-lg file:border-0 file:bg-brand-soft file:px-3 file:py-2 file:font-semibold file:text-brand-soft-fg" />
          </L>
          {product?.imageFileId ? (
            <div className="flex items-center gap-3 sm:col-span-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/files/${product.imageFileId}`} alt="" className="size-16 rounded-xl object-cover" />
              <Checkbox name="removeImage" label={p.removeImage} />
            </div>
          ) : null}
          <div className="flex flex-wrap gap-5 sm:col-span-2">
            <Checkbox name="isActive" defaultChecked={product?.isActive ?? true} label={p.active} />
            <Checkbox name="isFeatured" defaultChecked={product?.isFeatured ?? false} label={p.featured} />
            <Checkbox name="isSample" defaultChecked={product?.isSample ?? false} label={p.sample} />
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title={p.pricingMode} />
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <L label={p.pricingMode} className="sm:col-span-2">
            <Select name="pricingMode" defaultValue={product?.pricingMode ?? "unit"}>
              <option value="unit">{p.modeUnit}</option>
              <option value="package">{p.modePackage}</option>
            </Select>
          </L>
          <L label={p.unitPrice}><Input name="unitPrice" type="number" min={0} defaultValue={product?.unitPrice ?? ""} dir="ltr" /></L>
          <L label={p.compareAtPrice}><Input name="compareAtPrice" type="number" min={0} defaultValue={product?.compareAtPrice ?? ""} dir="ltr" /></L>
          <L label={p.minQuantity}><Input name="minQuantity" type="number" min={1} defaultValue={product?.minQuantity ?? 1} dir="ltr" /></L>
          <L label={p.maxQuantity}><Input name="maxQuantity" type="number" min={1} defaultValue={product?.maxQuantity ?? ""} dir="ltr" /></L>
          <L label={p.packages} hint={p.packagesHint} className="sm:col-span-2">
            <Textarea name="packages" defaultValue={product ? serializePackages(product.packages) : ""} rows={4} dir="auto" className="font-mono text-sm" placeholder="60 شدة | 60 UC | 1500" />
          </L>
          <L label={p.tiers} hint={p.tiersHint} className="sm:col-span-2">
            <Textarea name="tiers" defaultValue={product ? serializeTiers(product.tiers) : ""} rows={3} dir="ltr" className="font-mono text-sm" placeholder="1000 | 8" />
          </L>
        </div>
      </Card>

      <Card>
        <CardHeader title={p.fields} />
        <div className="space-y-3 p-5">
          <Alert tone="warning">{p.fieldsWarning}</Alert>
          <L label={p.fields} hint={p.fieldsHint}>
            <Textarea name="fields" defaultValue={product ? serializeFields(product.fields) : ""} rows={5} dir="auto" className="font-mono text-sm" placeholder="player_id | رقم اللاعب | Player ID | number | required" />
          </L>
        </div>
      </Card>

      <SubmitButton size="lg" pendingLabel={t.common.saving}>{t.common.save}</SubmitButton>
    </ActionForm>
  );
}
