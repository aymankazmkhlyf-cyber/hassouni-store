import Link from "next/link";
import { requireStaffPage } from "@/lib/auth/current-user";
import { hasPermission } from "@/lib/auth/permissions";
import { formatIQD } from "@/lib/domain/money";
import { ORDER_STATUSES } from "@/lib/domain/order-status";
import { maskPhone } from "@/lib/domain/phone";
import { formatDateTime } from "@/lib/i18n";
import { resolveLocale, type LocaleParams } from "@/lib/i18n/server";
import { listOrders } from "@/lib/services/admin-orders";
import { listPaymentMethods } from "@/lib/services/admin-catalog";
import { buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Select } from "@/components/ui/form";
import { Icon } from "@/components/ui/icon";
import { Pagination } from "@/components/ui/pagination";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/ui/status-badge";
import { AdminTitle } from "@/components/admin/messages";
import { filtersToParams, parseOrderFilters, PAYMENT_STATUSES } from "@/components/admin/order-filters";

type Props = LocaleParams & { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function AdminOrdersPage({ params, searchParams }: Props) {
  const { locale, t } = await resolveLocale(params);
  const user = await requireStaffPage(locale, "orders:read");
  const filters = parseOrderFilters(await searchParams);
  const [result, methods] = await Promise.all([listOrders(filters), listPaymentMethods()]);
  const p = filtersToParams(filters);
  const exportQs = new URLSearchParams(Object.entries(p).filter((e): e is [string, string] => !!e[1])).toString();
  const canSeeFullPhone = hasPermission(user.role, "customers:write");
  const o = t.admin.ordersPage;

  return (
    <>
      <AdminTitle
        title={t.admin.orders}
        action={
          hasPermission(user.role, "orders:export") ? (
            <a href={`/api/admin/orders/export${exportQs ? `?${exportQs}` : ""}`} className={buttonClass("outline", "sm")}>
              <Icon name="download" className="size-4" /> {o.export}
            </a>
          ) : null
        }
      />
      <form method="get" className="mb-4 grid gap-3 rounded-(--radius-card) border border-line bg-elevated p-3 shadow-soft sm:grid-cols-2 lg:grid-cols-6">
        <label className="text-xs font-semibold sm:col-span-2">
          <span className="mb-1 block">{t.common.search}</span>
          <Input name="q" defaultValue={filters.q} placeholder={o.searchPlaceholder} maxLength={80} />
        </label>
        <label className="text-xs font-semibold">
          <span className="mb-1 block">{o.status}</span>
          <Select name="status" defaultValue={filters.status ?? ""}>
            <option value="">{t.common.all}</option>
            {ORDER_STATUSES.map((s) => <option key={s} value={s}>{t.orderStatus[s]}</option>)}
          </Select>
        </label>
        <label className="text-xs font-semibold">
          <span className="mb-1 block">{o.paymentStatus}</span>
          <Select name="paymentStatus" defaultValue={filters.paymentStatus ?? ""}>
            <option value="">{t.common.all}</option>
            {PAYMENT_STATUSES.map((s) => <option key={s} value={s}>{t.paymentStatus[s]}</option>)}
          </Select>
        </label>
        <label className="text-xs font-semibold">
          <span className="mb-1 block">{o.method}</span>
          <Select name="method" defaultValue={filters.method ?? ""}>
            <option value="">{t.common.all}</option>
            {methods.map((m) => <option key={m.code} value={m.code}>{locale === "ar" ? m.nameAr : m.nameEn}</option>)}
          </Select>
        </label>
        <div className="grid grid-cols-2 gap-2 sm:col-span-2 lg:col-span-1 lg:grid-cols-1">
          <label className="text-xs font-semibold"><span className="mb-1 block">{o.from}</span><Input type="date" name="from" defaultValue={filters.from} /></label>
          <label className="text-xs font-semibold"><span className="mb-1 block">{o.to}</span><Input type="date" name="to" defaultValue={filters.to} /></label>
        </div>
        <div className="flex gap-2 sm:col-span-2 lg:col-span-6">
          <button type="submit" className={buttonClass("primary", "sm")}>{t.common.filter}</button>
          <Link href={`/${locale}/admin/orders`} className={buttonClass("ghost", "sm")}>{t.common.reset}</Link>
        </div>
      </form>

      {result.rows.length === 0 ? (
        <EmptyState icon="inbox" title={o.empty} />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[44rem] text-sm">
            <thead className="border-b border-line text-xs text-fg-subtle">
              <tr>
                <th className="px-4 py-3 text-start font-semibold">{t.order.reference}</th>
                <th className="px-4 py-3 text-start font-semibold">{o.customer}</th>
                <th className="px-4 py-3 text-start font-semibold">{o.status}</th>
                <th className="px-4 py-3 text-start font-semibold">{o.paymentStatus}</th>
                <th className="px-4 py-3 text-end font-semibold">{o.total}</th>
                <th className="px-4 py-3 text-start font-semibold">{o.date}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {result.rows.map((r) => (
                <tr key={r.id} className="hover:bg-muted">
                  <td className="px-4 py-3">
                    <Link href={`/${locale}/admin/orders/${r.id}`} className="ltr-nums font-bold text-brand hover:underline" dir="ltr">{r.reference}</Link>
                    <span className="block text-xs text-fg-subtle">{locale === "ar" ? r.paymentMethodNameAr : r.paymentMethodNameEn}</span>
                  </td>
                  <td className="px-4 py-3">
                    {r.customerName}
                    <span className="ltr-nums block text-xs text-fg-subtle" dir="ltr">{canSeeFullPhone ? r.customerPhone : maskPhone(r.customerPhone)}</span>
                  </td>
                  <td className="px-4 py-3"><OrderStatusBadge status={r.status} t={t} /></td>
                  <td className="px-4 py-3">{r.paymentStatus ? <PaymentStatusBadge status={r.paymentStatus} t={t} /> : "—"}</td>
                  <td className="ltr-nums px-4 py-3 text-end font-bold" dir="ltr">{formatIQD(r.total, locale)}</td>
                  <td className="ltr-nums px-4 py-3 text-xs text-fg-muted">{formatDateTime(r.createdAt, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      <Pagination page={result.page} pages={result.pages} basePath={`/${locale}/admin/orders`} params={p} t={t} />
    </>
  );
}
