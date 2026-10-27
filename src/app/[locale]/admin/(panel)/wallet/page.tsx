import { adjustWalletAction, reviewTopupAction } from "@/app/actions/admin";
import { requireStaffPage } from "@/lib/auth/current-user";
import { hasPermission } from "@/lib/auth/permissions";
import type { TopupStatus } from "@/lib/db/schema";
import { formatIQD } from "@/lib/domain/money";
import { formatDateTime } from "@/lib/i18n";
import { pageNumber, resolveLocale, sp, type LocaleParams } from "@/lib/i18n/server";
import { findCustomer, listTopupsAdmin, recentWalletTransactions } from "@/lib/services/wallet";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Select } from "@/components/ui/form";
import { Pagination } from "@/components/ui/pagination";
import { SubmitButton } from "@/components/ui/submit-button";
import { ActionForm } from "@/components/admin/action-form";
import { AdminTitle, adminMessages } from "@/components/admin/messages";

const STATUSES: TopupStatus[] = ["submitted", "approved", "rejected"];
const TONE = { submitted: "warning", approved: "success", rejected: "danger" } as const;
type Props = LocaleParams & { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function AdminWallet({ params, searchParams }: Props) {
  const { locale, t } = await resolveLocale(params);
  const me = await requireStaffPage(locale, "payments:review");
  const q = await searchParams;
  const status = STATUSES.find((s) => s === (sp(q.status) ?? "submitted")) ?? (sp(q.status) === "all" ? undefined : "submitted");
  const { rows, page, pages } = await listTopupsAdmin({ status, page: pageNumber(q.page) });
  const w = t.admin.walletPage;
  const ws = t.wallet;
  const ar = locale === "ar";
  const messages = adminMessages(t);
  const canAdjust = hasPermission(me.role, "wallet:adjust");
  const lookup = sp(q.find)?.trim().slice(0, 200) ?? "";
  const customer = canAdjust && lookup ? await findCustomer(lookup) : null;
  const history = customer ? await recentWalletTransactions(customer.id) : [];

  return (
    <>
      <AdminTitle title={t.admin.wallet} />
      <Alert tone="info" className="mb-4">{w.intro}</Alert>

      {canAdjust ? (
        <Card className="mb-6 p-5">
          <h2 className="mb-3 font-bold">{w.findTitle}</h2>
          <form method="get" className="flex flex-wrap gap-2">
            <Input name="find" defaultValue={lookup} placeholder={w.findPlaceholder} className="max-w-sm" dir="ltr" aria-label={w.findPlaceholder} />
            <button type="submit" className={buttonClass("secondary", "md")}>{w.find}</button>
          </form>
          {lookup && !customer ? <p className="mt-3 text-sm text-warning">{w.notFound}</p> : null}
          {customer ? (
            <div className="mt-4 space-y-4" data-testid="wallet-customer">
              <div className="flex flex-wrap items-center gap-3 rounded-xl bg-muted p-3 text-sm">
                <span className="font-bold">{customer.name}</span>
                {customer.username ? <span className="ltr-nums" dir="ltr">@{customer.username}</span> : null}
                <span className="ltr-nums text-fg-muted" dir="ltr">{customer.email}</span>
                <span className="ms-auto">{w.balance}: <span className="ltr-nums font-black" dir="ltr">{formatIQD(customer.walletBalance, locale)}</span></span>
              </div>
              <ActionForm action={adjustWalletAction} messages={messages} className="grid gap-3 sm:grid-cols-[10rem_10rem_1fr_auto] sm:items-end" resetOnSuccess>
                <input type="hidden" name="userId" value={customer.id} />
                <label className="text-xs font-semibold">&nbsp;
                  <Select name="direction" defaultValue="credit" className="mt-1">
                    <option value="credit">{w.credit}</option>
                    <option value="debit">{w.debit}</option>
                  </Select>
                </label>
                <label className="text-xs font-semibold">{w.amount}
                  <Input name="amount" type="number" min={250} step={250} required dir="ltr" className="mt-1" />
                </label>
                <label className="text-xs font-semibold">{w.adjustNote}
                  <Input name="note" required maxLength={300} className="mt-1" />
                </label>
                <SubmitButton size="sm">{w.apply}</SubmitButton>
              </ActionForm>
              {history.length ? (
                <div>
                  <h3 className="mb-2 text-sm font-bold">{w.recent}</h3>
                  <ul className="divide-y divide-line rounded-xl border border-line text-sm">
                    {history.map((h) => (
                      <li key={h.id} className="flex flex-wrap justify-between gap-2 px-3 py-2">
                        <span>{ws.types[h.type]}{h.note ? <span className="text-fg-muted" dir="auto"> · {h.note}</span> : null} <span className="ltr-nums text-xs text-fg-subtle">{formatDateTime(h.createdAt, locale)}</span></span>
                        <span className={`ltr-nums font-bold ${h.amount > 0 ? "text-success" : "text-danger"}`} dir="ltr">{h.amount > 0 ? "+" : "−"}{formatIQD(Math.abs(h.amount), locale)} → {formatIQD(h.balanceAfter, locale)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
        </Card>
      ) : null}

      <form method="get" className="mb-4 flex gap-2">
        <Select name="status" defaultValue={status ?? "all"} className="max-w-xs" aria-label={t.order.status}>
          <option value="submitted">{w.pending}</option>
          <option value="approved">{ws.status.approved}</option>
          <option value="rejected">{ws.status.rejected}</option>
          <option value="all">{w.all}</option>
        </Select>
        <button className={buttonClass("secondary", "md")} type="submit">{t.common.filter}</button>
      </form>
      {rows.length === 0 ? <EmptyState icon="wallet" title={w.empty} /> : null}
      <div className="space-y-4">
        {rows.map((r) => (
          <Card key={r.id} className="p-5" data-testid={`topup-${r.id}`}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <span className="flex flex-wrap items-center gap-2">
                <span className="ltr-nums text-xl font-black" dir="ltr">{formatIQD(r.amount, locale)}</span>
                <Badge>{ar ? r.methodNameAr : r.methodNameEn}</Badge>
                <Badge tone={TONE[r.status]}>{ws.status[r.status]}</Badge>
              </span>
              <span className="ltr-nums text-xs text-fg-subtle">{formatDateTime(r.createdAt, locale)}</span>
            </div>
            <dl className="grid gap-1 text-sm sm:grid-cols-2">
              <div><dt className="inline font-semibold">{w.customer}: </dt><dd className="inline">{r.userName ?? "—"} {r.username ? <span className="ltr-nums" dir="ltr">(@{r.username})</span> : null}</dd></div>
              <div><dt className="inline font-semibold">{w.balance}: </dt><dd className="ltr-nums inline" dir="ltr">{r.balance != null ? formatIQD(r.balance, locale) : "—"}</dd></div>
              {r.customerReference ? <div><dt className="inline font-semibold">{w.reference}: </dt><dd className="ltr-nums inline font-bold" dir="ltr">{r.customerReference}</dd></div> : null}
              {r.receiptFileId ? <div><a href={`/api/files/${r.receiptFileId}`} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand underline">{w.receipt}</a></div> : null}
              {r.reviewNote ? <div className="sm:col-span-2 text-fg-muted">{r.reviewNote}</div> : null}
            </dl>
            {r.status === "submitted" ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <ActionForm action={reviewTopupAction} messages={messages} className="space-y-2">
                  <input type="hidden" name="topupId" value={r.id} />
                  <input type="hidden" name="decision" value="approve" />
                  <label className="block text-xs font-semibold">{w.note}<Input name="note" maxLength={300} className="mt-1" /></label>
                  <SubmitButton size="sm" confirmMessage={`${w.approve}: ${formatIQD(r.amount, locale)}`}>{w.approve}</SubmitButton>
                </ActionForm>
                <ActionForm action={reviewTopupAction} messages={messages} className="space-y-2">
                  <input type="hidden" name="topupId" value={r.id} />
                  <input type="hidden" name="decision" value="reject" />
                  <label className="block text-xs font-semibold">{w.rejectReason}<Input name="note" required maxLength={300} className="mt-1" /></label>
                  <SubmitButton size="sm" variant="danger">{w.reject}</SubmitButton>
                </ActionForm>
              </div>
            ) : null}
          </Card>
        ))}
      </div>
      <Pagination page={page} pages={pages} basePath={`/${locale}/admin/wallet`} params={{ status: status ?? "all" }} t={t} />
    </>
  );
}
