import Link from "next/link";
import { requireStaffPage } from "@/lib/auth/current-user";
import { hasPermission } from "@/lib/auth/permissions";
import { maskPhone } from "@/lib/domain/phone";
import { formatDate } from "@/lib/i18n";
import { pageNumber, resolveLocale, sp, type LocaleParams } from "@/lib/i18n/server";
import { listCustomers } from "@/lib/services/accounts";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/form";
import { Pagination } from "@/components/ui/pagination";
import { AdminTitle } from "@/components/admin/messages";

type Props = LocaleParams & { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function AdminCustomers({ params, searchParams }: Props) {
  const { locale, t } = await resolveLocale(params);
  const user = await requireStaffPage(locale, "customers:read");
  const q = await searchParams;
  const search = sp(q.q)?.slice(0, 80);
  const { rows, page, pages } = await listCustomers({ q: search, page: pageNumber(q.page) });
  const c = t.admin.customersPage;
  const full = hasPermission(user.role, "customers:write");
  return (
    <>
      <AdminTitle title={c.registered} subtitle={c.guestNote} />
      <form method="get" className="mb-4 flex gap-2">
        <Input name="q" defaultValue={search} placeholder={c.searchPlaceholder} maxLength={80} className="max-w-xs" aria-label={t.common.search} />
        <button className={buttonClass("secondary", "md")} type="submit">{t.common.search}</button>
      </form>
      {rows.length === 0 ? (
        <EmptyState icon="users" title={t.common.noResults} />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <thead className="border-b border-line text-xs text-fg-subtle">
              <tr>
                <th className="px-4 py-3 text-start font-semibold">{t.auth.name}</th>
                <th className="px-4 py-3 text-start font-semibold">{t.auth.email}</th>
                <th className="px-4 py-3 text-start font-semibold">{c.role}</th>
                <th className="px-4 py-3 text-start font-semibold">{c.orders}</th>
                <th className="px-4 py-3 text-start font-semibold">{c.joined}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-muted">
                  <td className="px-4 py-3">
                    <Link href={`/${locale}/admin/customers/${r.id}`} className="font-bold text-brand hover:underline">{r.name}</Link>
                    {r.phone ? <span className="ltr-nums block text-xs text-fg-subtle" dir="ltr">{full ? r.phone : maskPhone(r.phone)}</span> : null}
                  </td>
                  <td className="ltr-nums px-4 py-3" dir="ltr">{r.email}</td>
                  <td className="px-4 py-3">
                    <Badge tone={r.role === "customer" ? "neutral" : "brand"}>{r.role}</Badge>{" "}
                    {r.status === "suspended" ? <Badge tone="danger">{c.suspended}</Badge> : null}
                  </td>
                  <td className="ltr-nums px-4 py-3">{r.orderCount}</td>
                  <td className="ltr-nums px-4 py-3 text-xs">{formatDate(r.createdAt, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      <Pagination page={page} pages={pages} basePath={`/${locale}/admin/customers`} params={{ q: search }} t={t} />
      <Alert tone="info" className="mt-6" title={c.retention}>{c.retentionBody}</Alert>
    </>
  );
}
