import { notFound } from "next/navigation";
import { deleteProductAction } from "@/app/actions/admin";
import { requireStaffPage } from "@/lib/auth/current-user";
import { getDictionary, isLocale } from "@/lib/i18n";
import { adminGetProduct } from "@/lib/services/admin-catalog";
import { listCategories } from "@/lib/services/catalog";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { SubmitButton } from "@/components/ui/submit-button";
import { ActionForm } from "@/components/admin/action-form";
import { AdminTitle, adminMessages } from "@/components/admin/messages";
import { ProductForm } from "@/components/admin/product-form";

type Props = { params: Promise<{ locale: string; id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function EditProduct({ params, searchParams }: Props) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDictionary(locale);
  await requireStaffPage(locale, "products:write");
  const productId = Number(id);
  if (!Number.isSafeInteger(productId)) notFound();
  const [product, categories] = await Promise.all([adminGetProduct(productId), listCategories()]);
  if (!product) notFound();
  const saved = (await searchParams).saved === "1";
  return (
    <>
      <AdminTitle
        title={locale === "ar" ? product.nameAr : product.nameEn}
        action={product.isActive ? <ButtonLink href={`/${locale}/services/${product.slug}`} variant="outline" size="sm" target="_blank"><Icon name="external" className="size-4" /> {t.admin.viewStore}</ButtonLink> : null}
      />
      {saved ? <Alert tone="success" className="mb-4" title={t.common.saved} /> : null}
      <ProductForm locale={locale} t={t} categories={categories} product={product} />
      <Card className="mt-8 border-danger/40">
        <CardHeader title={t.common.delete} description={t.admin.productsPage.deleteConfirm} />
        <ActionForm action={deleteProductAction} messages={adminMessages(t)} className="p-5">
          <input type="hidden" name="id" value={product.id} />
          <input type="hidden" name="locale" value={locale} />
          <SubmitButton variant="danger" confirmMessage={t.admin.productsPage.deleteConfirm}><Icon name="trash" className="size-4" /> {t.common.delete}</SubmitButton>
        </ActionForm>
      </Card>
    </>
  );
}
