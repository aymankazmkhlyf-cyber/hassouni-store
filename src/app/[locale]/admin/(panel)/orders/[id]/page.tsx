import Link from "next/link";
import { notFound } from "next/navigation";
import { inArray } from "drizzle-orm";
import { changeOrderStatusAction, reviewPaymentAction, saveAdminNotesAction } from "@/app/actions/admin";
import { requireStaffPage } from "@/lib/auth/current-user";
import { hasPermission } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { whatsappLink } from "@/lib/domain/contact";
import { formatIQD } from "@/lib/domain/money";
import { allowedTransitions } from "@/lib/domain/order-status";
import { fmt, formatDateTime, isLocale, getDictionary } from "@/lib/i18n";
import { loadOrderFull } from "@/lib/services/orders";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Select, Textarea, Input } from "@/components/ui/form";
import { Icon } from "@/components/ui/icon";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/ui/status-badge";
import { SubmitButton } from "@/components/ui/submit-button";
import { ActionForm } from "@/components/admin/action-form";
import { AdminTitle, adminMessages } from "@/components/admin/messages";

type Props = { params: Promise<{ locale: string; id: string }> };

export default async function AdminOrderDetail({ params }: Props) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDictionary(locale);
  const user = await requireStaffPage(locale, "orders:read");
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const order = await loadOrderFull(id);
  if (!order) notFound();

  const ar = locale === "ar";
  const d = t.admin.orderDetail;
  const messages = adminMessages(t);
  const canUpdate = hasPermission(user.role, "orders:update");
  const canReview = hasPermission(user.role, "payments:review");
  const transitions = allowedTransitions(order.status);

  const actorIds = [...new Set([...order.history.map((h) => h.actorId), ...order.payments.map((p) => p.reviewedById)].filter((x): x is string => !!x))];
  const actors = actorIds.length ? await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, actorIds)) : [];
  const actorName = (uid: string | null) => actors.find((a) => a.id === uid)?.name;

  // Message for the customer: reference and status only.
  const customerMsg = ar
    ? `مرحباً ${order.customerName}، بخصوص طلبك ${order.reference} من ${t.meta.storeName}: الحالة الحالية «${t.orderStatus[order.status]}».`
    : `Hello ${order.customerName}, regarding your order ${order.reference} at ${t.meta.storeName}: current status “${t.orderStatus[order.status]}”.`;

  return (
    <>
      <AdminTitle
        title={fmt(d.title, { ref: order.reference })}
        subtitle={formatDateTime(order.createdAt, locale)}
        action={<OrderStatusBadge status={order.status} t={t} />}
      />
      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader title={d.items} />
            <ul className="divide-y divide-line">
              {order.items.map((i) => (
                <li key={i.id} className="space-y-2 px-5 py-4">
                  <div className="flex flex-wrap justify-between gap-2">
                    <div>
                      <p className="font-bold">{ar ? i.productNameAr : i.productNameEn}</p>
                      {(ar ? i.packageLabelAr : i.packageLabelEn) ? <p className="text-sm text-fg-muted">{ar ? i.packageLabelAr : i.packageLabelEn}</p> : null}
                      <p className="text-xs text-fg-subtle"><span className="ltr-nums">{formatIQD(i.unitPrice, locale)}</span> × <span className="ltr-nums">{i.quantity.toLocaleString("en-US")}</span></p>
                    </div>
                    <p className="ltr-nums font-bold" dir="ltr">{formatIQD(i.lineTotal, locale)}</p>
                  </div>
                  {i.inputs.length ? (
                    <dl className="grid gap-1 rounded-xl bg-muted p-3 text-sm">
                      <p className="text-xs font-semibold text-fg-subtle">{d.inputs}</p>
                      {i.inputs.map((inp) => (
                        <div key={inp.key} className="flex flex-wrap gap-x-2">
                          <dt className="font-semibold">{ar ? inp.labelAr : inp.labelEn}:</dt>
                          <dd dir="auto" className="break-all">{inp.value}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : null}
                </li>
              ))}
            </ul>
            <div className="flex justify-between border-t border-line px-5 py-4">
              <span className="font-bold">{t.order.total}</span>
              <span className="ltr-nums text-xl font-black" dir="ltr">{formatIQD(order.total, locale)}</span>
            </div>
          </Card>

          <Card>
            <CardHeader title={d.payments} description={`${t.order.paymentMethod}: ${ar ? order.paymentMethodNameAr : order.paymentMethodNameEn}`} />
            {order.payments.every((p) => p.status === "awaiting") ? <p className="px-5 pt-4 text-sm text-fg-muted">{d.noPayments}</p> : null}
            <ul className="divide-y divide-line">
              {order.payments.map((p) => (
                <li key={p.id} className="space-y-3 px-5 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <PaymentStatusBadge status={p.status} t={t} />
                    <span className="ltr-nums text-xs text-fg-subtle">{formatDateTime(p.submittedAt ?? p.createdAt, locale)}</span>
                  </div>
                  <dl className="grid gap-1 text-sm">
                    <div className="flex gap-2"><dt className="font-semibold">{d.reference}:</dt><dd className="ltr-nums" dir="ltr">{p.customerReference ?? "—"}</dd></div>
                    <div className="flex gap-2"><dt className="font-semibold">{t.order.amountDue}:</dt><dd className="ltr-nums" dir="ltr">{formatIQD(p.amount, locale)}</dd></div>
                    {p.reviewedById ? <div className="flex gap-2"><dt className="font-semibold">{d.reviewedBy}:</dt><dd>{actorName(p.reviewedById) ?? "—"}</dd></div> : null}
                    {p.reviewNote ? <div className="flex gap-2"><dt className="font-semibold">{d.reviewNote}:</dt><dd>{p.reviewNote}</dd></div> : null}
                  </dl>
                  {p.receiptFileId ? (
                    <a href={`/api/files/${p.receiptFileId}`} target="_blank" rel="noopener noreferrer" className={buttonClass("outline", "sm")}>
                      <Icon name="file" className="size-4" /> {d.receipt}
                    </a>
                  ) : null}
                  {canReview && p.status === "submitted" ? (
                    <ActionForm action={reviewPaymentAction} messages={messages} className="space-y-2 rounded-xl border border-line p-3">
                      <input type="hidden" name="paymentId" value={p.id} />
                      <label className="block text-xs font-semibold">
                        {d.reviewNote}
                        <Input name="note" maxLength={500} className="mt-1" />
                      </label>
                      <div className="flex flex-wrap gap-2">
                        <SubmitButton name="decision" value="confirm" size="sm" confirmMessage={d.confirmPrompt}>
                          <Icon name="check" className="size-4" /> {d.confirmPayment}
                        </SubmitButton>
                        <SubmitButton name="decision" value="reject" size="sm" variant="danger" confirmMessage={d.rejectPrompt}>
                          {d.rejectPayment}
                        </SubmitButton>
                      </div>
                    </ActionForm>
                  ) : null}
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardHeader title={d.history} />
            <ol className="space-y-3 px-5 py-4">
              {order.history.map((h) => (
                <li key={h.id} className="flex flex-wrap items-start justify-between gap-2 text-sm">
                  <span>
                    <span className="font-semibold">{h.fromStatus ? `${t.orderStatus[h.fromStatus]} ← ` : ""}{t.orderStatus[h.toStatus]}</span>
                    <span className="block text-xs text-fg-subtle">
                      {h.actorType === "customer" ? d.actorCustomer : h.actorType === "staff" ? `${d.actorStaff}${actorName(h.actorId) ? ` (${actorName(h.actorId)})` : ""}` : d.actorSystem}
                      {h.note ? ` — ${h.note}` : ""}
                    </span>
                  </span>
                  <span className="ltr-nums text-xs text-fg-subtle">{formatDateTime(h.createdAt, locale)}</span>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title={d.customer} />
            <dl className="space-y-2 px-5 py-4 text-sm">
              <div><dt className="text-xs text-fg-subtle">{t.checkout.name}</dt><dd className="font-semibold">{order.customerName}</dd></div>
              <div><dt className="text-xs text-fg-subtle">{t.checkout.phone}</dt><dd className="ltr-nums font-semibold" dir="ltr">{order.customerPhone || "—"}</dd></div>
              <div><dt className="text-xs text-fg-subtle">{t.checkout.email}</dt><dd className="ltr-nums" dir="ltr">{order.customerEmail ?? "—"}</dd></div>
              {order.userId && hasPermission(user.role, "customers:read") ? (
                <div><Link href={`/${locale}/admin/customers/${order.userId}`} className="text-sm font-semibold text-brand hover:underline">{t.admin.customers} →</Link></div>
              ) : null}
              {order.customerNotes ? <div><dt className="text-xs text-fg-subtle">{t.order.yourNotes}</dt><dd className="whitespace-pre-line">{order.customerNotes}</dd></div> : null}
              {order.anonymizedAt ? <Badge tone="neutral">anonymized</Badge> : null}
            </dl>
            {order.customerPhone ? (
              <div className="border-t border-line px-5 py-3">
                <a href={whatsappLink(order.customerPhone, customerMsg)} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary", "sm")}>
                  <Icon name="whatsapp" className="size-4" /> {d.messageCustomer}
                </a>
              </div>
            ) : null}
          </Card>

          {canUpdate ? (
            <Card>
              <CardHeader title={d.changeStatus} />
              <div className="px-5 py-4">
                {transitions.length === 0 ? (
                  <p className="text-sm text-fg-muted">{d.noTransitions}</p>
                ) : (
                  <ActionForm action={changeOrderStatusAction} messages={messages} className="space-y-3">
                    <input type="hidden" name="orderId" value={order.id} />
                    <label className="block text-xs font-semibold">
                      {d.newStatus}
                      <Select name="toStatus" className="mt-1" required>
                        {transitions.map((s) => <option key={s} value={s}>{t.orderStatus[s]}</option>)}
                      </Select>
                    </label>
                    <label className="block text-xs font-semibold">
                      {d.statusNote}
                      <Input name="note" maxLength={500} className="mt-1" />
                    </label>
                    <SubmitButton size="sm" confirmMessage={d.statusPrompt}>{d.apply}</SubmitButton>
                  </ActionForm>
                )}
              </div>
            </Card>
          ) : null}

          {canUpdate ? (
            <Card>
              <CardHeader title={d.adminNotes} />
              <ActionForm action={saveAdminNotesAction} messages={messages} className="space-y-3 px-5 py-4">
                <input type="hidden" name="orderId" value={order.id} />
                <Textarea name="adminNotes" defaultValue={order.adminNotes} maxLength={5000} rows={5} aria-label={d.adminNotes} />
                <SubmitButton size="sm" variant="secondary">{t.common.save}</SubmitButton>
              </ActionForm>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}
