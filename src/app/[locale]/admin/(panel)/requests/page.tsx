import { updateRequestAction } from "@/app/actions/admin";
import { requireStaffPage } from "@/lib/auth/current-user";
import type { RequestStatus } from "@/lib/db/schema";
import { formatIQD } from "@/lib/domain/money";
import { formatDateTime } from "@/lib/i18n";
import { pageNumber, resolveLocale, sp, type LocaleParams } from "@/lib/i18n/server";
import { listCustomRequests } from "@/lib/services/custom-requests";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Select, Textarea } from "@/components/ui/form";
import { Pagination } from "@/components/ui/pagination";
import { SubmitButton } from "@/components/ui/submit-button";
import { ActionForm } from "@/components/admin/action-form";
import { AdminTitle, adminMessages } from "@/components/admin/messages";

const STATUSES: RequestStatus[] = ["new", "in_review", "quoted", "closed"];
type Props = LocaleParams & { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function AdminRequests({ params, searchParams }: Props) {
  const { locale, t } = await resolveLocale(params);
  await requireStaffPage(locale, "requests:manage");
  const q = await searchParams;
  const status = STATUSES.find((s) => s === sp(q.status));
  const { rows, page, pages } = await listCustomRequests({ status, page: pageNumber(q.page) });
  const r = t.admin.requestsPage;
  return (
    <>
      <AdminTitle title={t.admin.requests} />
      <form method="get" className="mb-4 flex gap-2">
        <Select name="status" defaultValue={status ?? ""} className="max-w-xs" aria-label={r.status}>
          <option value="">{t.common.all}</option>
          {STATUSES.map((s) => <option key={s} value={s}>{r.statuses[s]}</option>)}
        </Select>
        <button className={buttonClass("secondary", "md")} type="submit">{t.common.filter}</button>
      </form>
      {rows.length === 0 ? <EmptyState icon="wand" title={r.empty} /> : null}
      <div className="space-y-4">
        {rows.map((req) => (
          <Card key={req.id} className="p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <span className="ltr-nums font-bold" dir="ltr">{req.reference}</span>
                <Badge tone="brand">{t.custom.types[req.serviceType as keyof typeof t.custom.types] ?? req.serviceType}</Badge>
                <Badge tone={req.status === "new" ? "warning" : req.status === "closed" ? "neutral" : "info"}>{r.statuses[req.status]}</Badge>
              </span>
              <span className="ltr-nums text-xs text-fg-subtle">{formatDateTime(req.createdAt, locale)}</span>
            </div>
            <dl className="grid gap-1 text-sm sm:grid-cols-2">
              <div><dt className="inline font-semibold">{t.checkout.name}: </dt><dd className="inline">{req.name}</dd></div>
              <div><dt className="inline font-semibold">{t.checkout.phone}: </dt><dd className="ltr-nums inline" dir="ltr">{req.phone}</dd></div>
              {req.email ? <div><dt className="inline font-semibold">{t.checkout.email}: </dt><dd className="ltr-nums inline" dir="ltr">{req.email}</dd></div> : null}
              {req.quantity ? <div><dt className="inline font-semibold">{t.custom.quantity}: </dt><dd className="ltr-nums inline">{req.quantity}</dd></div> : null}
              {req.budget != null ? <div><dt className="inline font-semibold">{t.custom.budget}: </dt><dd className="ltr-nums inline" dir="ltr">{formatIQD(req.budget, locale)}</dd></div> : null}
              {req.referenceUrl ? <div className="sm:col-span-2"><dt className="inline font-semibold">{t.custom.referenceUrl}: </dt><dd className="inline break-all"><a href={req.referenceUrl} target="_blank" rel="noopener noreferrer nofollow" className="text-brand underline" dir="ltr">{req.referenceUrl}</a></dd></div> : null}
            </dl>
            <p className="mt-3 rounded-xl bg-muted p-3 text-sm whitespace-pre-line">{req.description}</p>
            {req.notes ? <p className="mt-2 text-sm whitespace-pre-line text-fg-muted">{req.notes}</p> : null}
            <ActionForm action={updateRequestAction} messages={adminMessages(t)} className="mt-4 grid gap-3 sm:grid-cols-[12rem_1fr_auto] sm:items-end">
              <input type="hidden" name="id" value={req.id} />
              <label className="text-xs font-semibold">{r.status}
                <Select name="status" defaultValue={req.status} className="mt-1">{STATUSES.map((s) => <option key={s} value={s}>{r.statuses[s]}</option>)}</Select>
              </label>
              <label className="text-xs font-semibold">{t.admin.orderDetail.adminNotes}
                <Textarea name="adminNotes" defaultValue={req.adminNotes} rows={1} className="mt-1 min-h-11" maxLength={3000} />
              </label>
              <SubmitButton size="sm" variant="secondary">{r.update}</SubmitButton>
            </ActionForm>
          </Card>
        ))}
      </div>
      <Pagination page={page} pages={pages} basePath={`/${locale}/admin/requests`} params={{ status }} t={t} />
    </>
  );
}
