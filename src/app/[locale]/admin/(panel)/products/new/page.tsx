import { requireStaffPage } from "@/lib/auth/current-user";
import { resolveLocale, type LocaleParams } from "@/lib/i18n/server";
import { listCategories } from "@/lib/services/catalog";
import { ProductForm } from "@/components/admin/product-form";
import { AdminTitle } from "@/components/admin/messages";

export default async function NewProduct({ params }: LocaleParams) {
  const { locale, t } = await resolveLocale(params);
  await requireStaffPage(locale, "products:write");
  const categories = await listCategories();
  return (
    <>
      <AdminTitle title={t.admin.productsPage.newTitle} />
      <ProductForm locale={locale} t={t} categories={categories} />
    </>
  );
}
