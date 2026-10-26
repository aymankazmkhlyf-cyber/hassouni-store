import Link from "next/link";
import { requireStaffPage } from "@/lib/auth/current-user";
import { formatIQD } from "@/lib/domain/money";
import { formatDateTime } from "@/lib/i18n";
import { resolveLocale, sp, type LocaleParams } from "@/lib/i18n/server";
import { dashboardStats } from "@/lib/services/admin-orders";
import { Alert } from "@/components/ui/alert";
import { Card, CardHeader } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { OrderStatusBadge } from "@/components/ui/status-badge";
import { AdminTitle } from "@/components/admin/messages";

type Props = LocaleParams & { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function AdminDashboard({ params, searchParams }: Props) {
  const { locale, t } = await resolveLocale(params);
  await requireStaffPage(locale, "dashboard:view");
  const denied = sp((await searchParams).denied) === "1";
  const s = await dashboardStats();
  const a = `/${locale}/admin`;
  const tiles = [
    { label: t.admin.stats.totalOrders, value: s.totalOrders.toLocaleString("en-US"), icon: "receipt", href: `${a}/orders` },
    { label: t.admin.stats.pending, value: s.pendingPayment.toLocaleString("en-US"), icon: "clock", href: `${a}/orders?status=pending_payment` },
    { label: t.admin.stats.review, value: s.paymentReview.toLocaleString("en-US"), icon: "alert", href: `${a}/orders?status=payment_review`, highlight: s.paymentReview > 0 },
    { label: t.admin.stats.completed, value: s.completed.toLocaleString("en-US"), icon: "check", href: `${a}/orders?status=completed` },
  ];
  return (
    <>
      <AdminTitle title={t.admin.dashboard} />
      {denied ? <Alert tone="danger" className="mb-4" title={t.errors.forbidden} /> : null}
      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((tile) => (
          <li key={tile.label}>
            <Link href={tile.href} className={`block rounded-(--radius-card) border bg-elevated p-4 shadow-soft transition hover:border-brand ${tile.highlight ? "border-info" : "border-line"}`}>
              <span className="flex items-center justify-between text-xs font-semibold text-fg-muted">
                {tile.label} <Icon name={tile.icon} className="size-4" />
              </span>
              <span className="ltr-nums mt-2 block text-2xl font-black">{tile.value}</span>
            </Link>
          </li>
        ))}
      </ul>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Card className="p-4">
          <p className="text-xs font-semibold text-fg-muted">{t.admin.stats.revenue}</p>
          <p className="ltr-nums mt-1 text-2xl font-black text-success" dir="ltr">{formatIQD(s.confirmedRevenue, locale)}</p>
          <p className="mt-1 text-xs text-fg-subtle">{t.admin.stats.revenueHint}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold text-fg-muted">{t.admin.stats.gross}</p>
          <p className="ltr-nums mt-1 text-2xl font-black" dir="ltr">{formatIQD(s.grossValue, locale)}</p>
          <p className="mt-1 text-xs text-fg-subtle">{t.admin.stats.grossHint}</p>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader title={t.admin.stats.recent} action={<Link href={`${a}/orders`} className="text-sm font-semibold text-brand">{t.common.viewAll}</Link>} />
          {s.recent.length === 0 ? (
            <p className="p-5 text-sm text-fg-muted">{t.admin.stats.noData}</p>
          ) : (
            <ul className="divide-y divide-line">
              {s.recent.map((o) => (
                <li key={o.id}>
                  <Link href={`${a}/orders/${o.id}`} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 hover:bg-muted">
                    <span>
                      <span className="ltr-nums block text-sm font-bold" dir="ltr">{o.reference}</span>
                      <span className="text-xs text-fg-subtle">{o.customerName} · <span className="ltr-nums">{formatDateTime(o.createdAt, locale)}</span></span>
                    </span>
                    <span className="flex items-center gap-2">
                      <OrderStatusBadge status={o.status} t={t} />
                      <span className="ltr-nums text-sm font-bold" dir="ltr">{formatIQD(o.total, locale)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <CardHeader title={t.admin.stats.bestSellers} />
          {s.bestSellers.length === 0 ? (
            <p className="p-5 text-sm text-fg-muted">{t.admin.stats.noData}</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs text-fg-subtle">
                <tr><th className="px-5 py-2 text-start font-semibold"></th><th className="px-3 py-2 text-end font-semibold">{t.admin.stats.units}</th><th className="px-5 py-2 text-end font-semibold">{t.admin.stats.revenueCol}</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {s.bestSellers.map((b, i) => (
                  <tr key={b.productId ?? `x${i}`}>
                    <td className="px-5 py-2.5 font-semibold">{locale === "ar" ? b.nameAr : b.nameEn}</td>
                    <td className="ltr-nums px-3 py-2.5 text-end">{b.units.toLocaleString("en-US")}</td>
                    <td className="ltr-nums px-5 py-2.5 text-end font-bold" dir="ltr">{formatIQD(b.revenue, locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </>
  );
}
