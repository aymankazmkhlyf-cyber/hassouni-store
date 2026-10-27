import Link from "next/link";
import { notFound } from "next/navigation";
import { anonymizeCustomerAction, setCustomerStatusAction } from "@/app/actions/admin";
import { requireStaffPage } from "@/lib/auth/current-user";
import { hasPermission } from "@/lib/auth/permissions";
import { formatIQD } from "@/lib/domain/money";
import { formatDate, getDictionary, isLocale } from "@/lib/i18n";
import { getCustomer } from "@/lib/services/accounts";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { OrderStatusBadge } from "@/components/ui/status-badge";
import { SubmitButton } from "@/components/ui/submit-button";
import { ActionForm } from "@/components/admin/action-form";
import { AdminTitle, adminMessages } from "@/components/admin/messages";

type Props = { params: Promise<{ locale: string; id: string }> };

export default async function AdminCustomer({ params }: Props) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDictionary(locale);
  const viewer = await requireStaffPage(locale, "customers:read");
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const data = await getCustomer(id);
  if (!data) notFound();
  const { user, orders } = data;
  const c = t.admin.customersPage;
  const canWrite = hasPermission(viewer.role, "customers:write") && user.role === "customer";
  return (
    <>
      <AdminTitle title={user.name} subtitle={user.email} action={<span className="flex gap-1"><Badge>{user.role}</Badge>{user.status === "suspended" ? <Badge tone="danger">{c.suspended}</Badge> : null}</span>} />
      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader title={c.orders} />
          <ul className="divide-y divide-line">
            {orders.length === 0 ? <li className="p-5 text-sm text-fg-muted">{t.account.noOrders}</li> : null}
            {orders.map((o) => (
              <li key={o.id}>
                <Link href={`/${locale}/admin/orders/${o.id}`} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 hover:bg-muted">
                  <span className="ltr-nums font-bold" dir="ltr">{o.reference}</span>
                  <span className="flex items-center gap-2 text-sm">
                    <OrderStatusBadge status={o.status} t={t} />
                    <span className="ltr-nums" dir="ltr">{formatIQD(o.total, locale)}</span>
                    <span className="ltr-nums text-xs text-fg-subtle">{formatDate(o.createdAt, locale)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
        <div className="space-y-4">
          <Card className="space-y-2 p-5 text-sm">
            <p><span className="text-fg-subtle">{t.checkout.phone}: </span><span className="ltr-nums" dir="ltr">{user.phone ?? "—"}</span></p>
            <p><span className="text-fg-subtle">{t.wallet.walletId}: </span><span className="ltr-nums" dir="ltr">{user.username ? `@${user.username}` : "—"}</span></p>
            <p>
              <span className="text-fg-subtle">{t.wallet.balance}: </span>
              <a href={`/${locale}/admin/wallet?find=${encodeURIComponent(user.username ?? user.email)}`} className="ltr-nums font-bold text-brand hover:underline" dir="ltr">{formatIQD(user.walletBalance, locale)}</a>
            </p>
            <p><span className="text-fg-subtle">{c.joined}: </span><span className="ltr-nums">{formatDate(user.createdAt, locale)}</span></p>
          </Card>
          {canWrite ? (
            <Card className="space-y-4 p-5">
              <ActionForm action={setCustomerStatusAction} messages={adminMessages(t)}>
                <input type="hidden" name="id" value={user.id} />
                <input type="hidden" name="status" value={user.status === "active" ? "suspended" : "active"} />
                <SubmitButton size="sm" variant="outline" confirmMessage={t.common.confirmAction}>{user.status === "active" ? c.suspend : c.unsuspend}</SubmitButton>
              </ActionForm>
              <ActionForm action={anonymizeCustomerAction} messages={adminMessages(t)} className="space-y-2">
                <input type="hidden" name="id" value={user.id} />
                <input type="hidden" name="locale" value={locale} />
                <p className="text-xs text-fg-muted">{c.anonymizeConfirm}</p>
                <SubmitButton size="sm" variant="danger" confirmMessage={c.anonymizeConfirm}>{c.anonymize}</SubmitButton>
              </ActionForm>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}
