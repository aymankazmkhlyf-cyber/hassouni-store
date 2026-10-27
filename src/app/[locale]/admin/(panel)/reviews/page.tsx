import Link from "next/link";
import { moderateReviewAction, replyReviewAction } from "@/app/actions/admin";
import { requireStaffPage } from "@/lib/auth/current-user";
import type { ReviewStatus } from "@/lib/db/schema";
import { fmt, formatDateTime } from "@/lib/i18n";
import { pageNumber, resolveLocale, sp, type LocaleParams } from "@/lib/i18n/server";
import { listReviewsAdmin } from "@/lib/services/reviews";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Select, Textarea } from "@/components/ui/form";
import { Pagination } from "@/components/ui/pagination";
import { Stars } from "@/components/ui/stars";
import { SubmitButton } from "@/components/ui/submit-button";
import { ActionForm } from "@/components/admin/action-form";
import { AdminTitle, adminMessages } from "@/components/admin/messages";

const STATUSES: ReviewStatus[] = ["published", "hidden"];
type Props = LocaleParams & { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function AdminReviews({ params, searchParams }: Props) {
  const { locale, t } = await resolveLocale(params);
  await requireStaffPage(locale, "reviews:manage");
  const q = await searchParams;
  const status = STATUSES.find((s) => s === sp(q.status));
  const ratingRaw = Number(sp(q.rating));
  const rating = Number.isInteger(ratingRaw) && ratingRaw >= 1 && ratingRaw <= 5 ? ratingRaw : undefined;
  const { rows, total, page, pages } = await listReviewsAdmin({ status, rating, page: pageNumber(q.page) });
  const r = t.admin.reviewsPage;
  const ar = locale === "ar";
  const messages = adminMessages(t);

  return (
    <>
      <AdminTitle title={t.admin.reviews} />
      <p className="mb-4 max-w-3xl text-sm text-fg-muted">{r.intro}</p>
      <form method="get" className="mb-4 flex flex-wrap gap-2">
        <Select name="status" defaultValue={status ?? ""} className="max-w-[12rem]" aria-label={t.order.status}>
          <option value="">{r.all}</option>
          {STATUSES.map((s) => <option key={s} value={s}>{r[s]}</option>)}
        </Select>
        <Select name="rating" defaultValue={rating ? String(rating) : ""} className="max-w-[12rem]" aria-label={t.reviews.rating}>
          <option value="">{r.allRatings}</option>
          {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{"★".repeat(n)}</option>)}
        </Select>
        <button className={buttonClass("secondary", "md")} type="submit">{t.common.filter}</button>
        <span className="ms-auto self-center text-sm text-fg-muted">{r.total}: <span className="ltr-nums font-bold">{total}</span></span>
      </form>
      {rows.length === 0 ? <EmptyState icon="star" title={r.empty} /> : null}
      <div className="space-y-4">
        {rows.map((rev) => (
          <Card key={rev.id} className="p-5" data-testid={`admin-review-${rev.id}`}>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <span className="flex flex-wrap items-center gap-2">
                <Stars value={rev.rating} label={fmt(t.reviews.starsLabel, { n: rev.rating })} className="text-lg" />
                <Badge tone={rev.status === "published" ? "success" : "neutral"}>{r[rev.status]}</Badge>
                <span className="font-bold" dir="auto">{rev.displayName}</span>
              </span>
              <span className="ltr-nums text-xs text-fg-subtle">{formatDateTime(rev.createdAt, locale)}</span>
            </div>
            <p className="text-sm text-fg-muted">
              {ar ? rev.productNameAr : rev.productNameEn}
              {(ar ? rev.packageLabelAr : rev.packageLabelEn) ? ` · ${ar ? rev.packageLabelAr : rev.packageLabelEn}` : ""}
              {" · "}{r.order}{" "}
              <Link href={`/${locale}/admin/orders/${rev.orderId}`} className="ltr-nums font-semibold text-brand hover:underline" dir="ltr">{rev.orderReference}</Link>
            </p>
            {rev.comment ? <p className="mt-3 rounded-xl bg-muted p-3 text-sm whitespace-pre-line" dir="auto">{rev.comment}</p> : null}
            {rev.status === "hidden" && rev.hiddenReason ? <p className="mt-2 text-sm text-warning">{r.reasonLabel}: {rev.hiddenReason}</p> : null}

            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              <ActionForm action={replyReviewAction} messages={messages} className="space-y-2">
                <input type="hidden" name="reviewId" value={rev.id} />
                <label className="block text-xs font-semibold">{r.reply}
                  <Textarea name="reply" defaultValue={rev.staffReply ?? ""} rows={2} maxLength={1000} className="mt-1" />
                </label>
                <SubmitButton size="sm" variant="secondary">{r.saveReply}</SubmitButton>
              </ActionForm>
              {rev.status === "published" ? (
                <ActionForm action={moderateReviewAction} messages={messages} className="space-y-2">
                  <input type="hidden" name="reviewId" value={rev.id} />
                  <input type="hidden" name="status" value="hidden" />
                  <label className="block text-xs font-semibold">{r.hideReason}
                    <Input name="reason" required maxLength={300} className="mt-1" />
                  </label>
                  <SubmitButton size="sm" variant="danger">{r.hide}</SubmitButton>
                </ActionForm>
              ) : (
                <ActionForm action={moderateReviewAction} messages={messages} className="flex items-end">
                  <input type="hidden" name="reviewId" value={rev.id} />
                  <input type="hidden" name="status" value="published" />
                  <SubmitButton size="sm">{r.publish}</SubmitButton>
                </ActionForm>
              )}
            </div>
          </Card>
        ))}
      </div>
      <Pagination page={page} pages={pages} basePath={`/${locale}/admin/reviews`} params={{ status, rating: rating ? String(rating) : undefined }} t={t} />
    </>
  );
}
