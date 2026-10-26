import Link from "next/link";
import { requireStaffPage } from "@/lib/auth/current-user";
import { formatIQD } from "@/lib/domain/money";
import { pageNumber, resolveLocale, sp, type LocaleParams } from "@/lib/i18n/server";
import { adminListProducts } from "@/lib/services/admin-catalog";
import { Badge } from "@/components/ui/badge";
import { ButtonLink, buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/form";
import { Icon } from "@/components/ui/icon";
import { Pagination } from "@/components/ui/pagination";
import { AdminTitle } from "@/components/admin/messages";

type Props = LocaleParams & { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function AdminProducts({ params, searchParams }: Props) {
  const { locale, t } = await resolveLocale(params);
  await requireStaffPage(locale, "products:write");
  const q = await searchParams;
  const search = sp(q.q)?.slice(0, 80);
  const { rows, page, pages } = await adminListProducts({ q: search, page: pageNumber(q.page) });
  const p = t.admin.productsPage;
  return (
    <>
      <AdminTitle title={t.admin.products} action={<ButtonLink href={`/${locale}/admin/products/new`} size="sm"><Icon name="plus" className="size-4" /> {p.new}</ButtonLink>} />
      <form method="get" className="mb-4 flex gap-2">
        <Input name="q" defaultValue={search} placeholder={t.common.search} maxLength={80} className="max-w-xs" aria-label={t.common.search} />
        <button className={buttonClass("secondary", "md")} type="submit">{t.common.search}</button>
      </form>
      {rows.length === 0 ? (
        <EmptyState icon="box" title={p.empty} />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <thead className="border-b border-line text-xs text-fg-subtle">
              <tr>
                <th className="px-4 py-3 text-start font-semibold">{p.nameAr}</th>
                <th className="px-4 py-3 text-start font-semibold">{p.category}</th>
                <th className="px-4 py-3 text-start font-semibold">{p.price}</th>
                <th className="px-4 py-3 text-start font-semibold">{p.status}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-muted">
                  <td className="px-4 py-3">
                    <Link href={`/${locale}/admin/products/${r.id}`} className="font-bold text-brand hover:underline">{locale === "ar" ? r.nameAr : r.nameEn}</Link>
                    <span className="ltr-nums block text-xs text-fg-subtle" dir="ltr">/{r.slug}</span>
                  </td>
                  <td className="px-4 py-3">{locale === "ar" ? r.categoryNameAr : r.categoryNameEn}</td>
                  <td className="ltr-nums px-4 py-3" dir="ltr">{r.pricingMode === "package" ? `${r.packageCount} ×` : r.unitPrice != null ? formatIQD(r.unitPrice, locale) : "—"}</td>
                  <td className="px-4 py-3">
                    <span className="flex flex-wrap gap-1">
                      <Badge tone={r.isActive ? "success" : "neutral"}>{r.isActive ? t.common.active : t.common.inactive}</Badge>
                      {r.isFeatured ? <Badge tone="brand">{p.featured}</Badge> : null}
                      {r.isSample ? <Badge tone="warning">{t.common.sample}</Badge> : null}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      <Pagination page={page} pages={pages} basePath={`/${locale}/admin/products`} params={{ q: search }} t={t} />
    </>
  );
}
