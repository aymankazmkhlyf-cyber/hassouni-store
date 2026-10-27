import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq, inArray } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { paymentMethods, products } from "@/lib/db/schema";
import { buildOrderSupportMessage } from "@/lib/domain/contact";
import { formatIQD } from "@/lib/domain/money";
import { customerCanSubmitPayment } from "@/lib/domain/order-status";
import { formatDateTime, getDictionary, isLocale } from "@/lib/i18n";
import { sp } from "@/lib/i18n/server";
import { getOrderByAccessKey, getOrderForUser, latestPayment } from "@/lib/services/orders";
import { defaultDisplayName, reviewsForOrder } from "@/lib/services/reviews";
import { getSettings } from "@/lib/services/settings";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/ui/status-badge";
import { ContactLinks } from "@/components/store/contact-links";
import { PaymentProofForm } from "@/components/store/payment-proof-form";
import { PaymentDetails, paymentDetailsStrings } from "@/components/store/payment-details";
import { ReviewForm } from "@/components/store/review-form";
import { OrderNotify } from "@/components/store/order-notify";
import { RememberOrder } from "@/components/store/recent-orders";
import { GuideHelp } from "@/components/store/guide-help";
import { PAYMENT_GUIDES, getGuide } from "@/lib/i18n/guides";
import { ReorderButton, type ReorderItem } from "@/components/store/reorder-button";
import { isTerminal } from "@/lib/domain/order-status";
import { emailConfigured } from "@/lib/services/email";
import { getVapidKeys } from "@/lib/services/push";

type Props = {
  params: Promise<{ locale: string; reference: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const metadata: Metadata = { robots: { index: false, follow: false }, referrer: "no-referrer" };

export default async function OrderPage({ params, searchParams }: Props) {
  const { locale, reference } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDictionary(locale);
  const query = await searchParams;
  const key = sp(query.key) ?? null;
  const isNew = sp(query.new) === "1";
  const ar = locale === "ar";

  // Access requires the secret key OR being the logged-in owner. Knowing the reference alone is not enough.
  const user = await getCurrentUser();
  const order = key ? await getOrderByAccessKey(reference, key) : user ? await getOrderForUser(reference, user.id) : undefined;

  if (!order) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <EmptyState icon="lock" title={t.order.notFound} action={<ButtonLink href={`/${locale}/track`}>{t.nav.track}</ButtonLink>} />
      </div>
    );
  }

  const settings = await getSettings();
  const method = order.paymentMethodId ? await db.query.paymentMethods.findFirst({ where: eq(paymentMethods.id, order.paymentMethodId) }) : undefined;
  const payment = latestPayment(order.payments);
  const canPay = customerCanSubmitPayment(order.status);
  const canReview = order.status === "completed";
  const myReviews = canReview ? await reviewsForOrder(order.id) : [];
  // "Order again": same services, packages, quantities and details, if the services are still offered.
  const productIds = order.items.map((i) => i.productId).filter((x): x is number => x != null);
  const activeProducts = canReview && productIds.length
    ? await db.select({ id: products.id, slug: products.slug }).from(products).where(and(inArray(products.id, productIds), eq(products.isActive, true)))
    : [];
  const reorderItems: ReorderItem[] = order.items.flatMap((i) => {
    const p = activeProducts.find((x) => x.id === i.productId);
    if (!p || !i.productId) return [];
    return [{
      productId: i.productId,
      slug: p.slug,
      packageId: i.packageId,
      quantity: i.quantity,
      inputs: Object.fromEntries(i.inputs.map((x) => [x.key, x.value])),
      nameAr: i.productNameAr,
      nameEn: i.productNameEn,
      packageLabelAr: i.packageLabelAr,
      packageLabelEn: i.packageLabelEn,
      unitPrice: i.unitPrice,
    }];
  });
  // Updates still to come: offer notifications until the order is delivered or closed.
  const canNotify = !isTerminal(order.status) && order.status !== "completed";
  const vapidPublicKey = canNotify ? (await getVapidKeys()).publicKey : "";
  const supportMessage = buildOrderSupportMessage(
    {
      reference: order.reference,
      status: t.orderStatus[order.status],
      total: formatIQD(order.total, locale),
      items: order.items.map((i) => ({ name: ar ? i.productNameAr : i.productNameEn, quantity: i.quantity })),
    },
    locale,
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      {key ? <RememberOrder reference={order.reference} accessKey={key} /> : null}
      {isNew ? (
        <div className="animate-in rounded-(--radius-card) border border-success/30 bg-success-soft p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-success text-white dark:text-black"><Icon name="check" className="size-6" /></span>
            <div>
              <h1 className="text-xl font-extrabold">{t.order.confirmationTitle}</h1>
              <p className="mt-1 text-fg-muted">{t.order.confirmationBody}</p>
            </div>
          </div>
        </div>
      ) : (
        <h1 className="text-2xl font-extrabold">{t.order.details}</h1>
      )}

      <section className="grid gap-4 rounded-(--radius-card) border border-line bg-elevated p-5 shadow-soft sm:grid-cols-2">
        <div>
          <p className="text-xs text-fg-subtle">{t.order.reference}</p>
          <p className="flex items-center gap-2">
            <span className="ltr-nums text-lg font-black tracking-wide" dir="ltr">{order.reference}</span>
            <CopyButton value={order.reference} label={t.common.copy} copiedLabel={t.common.copied} />
          </p>
        </div>
        {key ? (
          <div>
            <p className="text-xs text-fg-subtle">{t.order.accessKey}</p>
            <p className="flex items-center gap-2">
              <span className="ltr-nums font-mono text-sm font-bold break-all" dir="ltr">{key}</span>
              <CopyButton value={key} label={t.common.copy} copiedLabel={t.common.copied} />
            </p>
          </div>
        ) : null}
        {key && isNew ? <Alert tone="warning" className="sm:col-span-2">{t.order.accessKeyWarning} {t.order.bookmark}</Alert> : null}
        <dl className="grid grid-cols-2 gap-3 text-sm sm:col-span-2 sm:grid-cols-4">
          <div><dt className="text-xs text-fg-subtle">{t.order.status}</dt><dd className="mt-1"><OrderStatusBadge status={order.status} t={t} /></dd></div>
          <div><dt className="text-xs text-fg-subtle">{t.order.paymentStatus}</dt><dd className="mt-1">{payment ? <PaymentStatusBadge status={payment.status} t={t} /> : "—"}</dd></div>
          <div><dt className="text-xs text-fg-subtle">{t.order.paymentMethod}</dt><dd className="mt-1 font-semibold">{ar ? order.paymentMethodNameAr : order.paymentMethodNameEn}</dd></div>
          <div><dt className="text-xs text-fg-subtle">{t.order.createdAt}</dt><dd className="ltr-nums mt-1 font-semibold">{formatDateTime(order.createdAt, locale)}</dd></div>
        </dl>
      </section>

      {order.deliveryNote ? (
        <section className="space-y-2 rounded-(--radius-card) border border-success/40 bg-success-soft p-5" data-testid="delivery-note">
          <h2 className="flex items-center gap-2 font-bold text-success"><Icon name="gift" className="size-5" /> {t.order.deliveryNote}</h2>
          <p className="ltr-nums text-sm font-semibold whitespace-pre-line break-words select-all" dir="auto">{order.deliveryNote}</p>
          <CopyButton value={order.deliveryNote} label={t.common.copy} copiedLabel={t.common.copied} />
        </section>
      ) : null}

      {canNotify ? (
        <OrderNotify
          reference={order.reference}
          accessKey={key}
          locale={locale}
          vapidPublicKey={vapidPublicKey}
          emailOn={!!order.customerEmail && emailConfigured()}
          s={t.notify}
        />
      ) : null}

      {canPay ? (
        <section className="space-y-4 rounded-(--radius-card) border border-brand/30 bg-elevated p-5 shadow-soft">
          <h2 className="flex items-center gap-2 font-bold"><Icon name="receipt" className="size-5 text-brand" /> {t.order.payTitle}</h2>
          <ol className="list-decimal space-y-1 ps-5 text-sm text-fg-muted">
            <li>{t.order.stepPay}</li>
            <li>{t.order.stepProof}</li>
            <li>{t.order.stepWait}</li>
          </ol>
          <PaymentDetails method={method} amount={order.total} locale={locale} s={paymentDetailsStrings(t)} />
          {method && PAYMENT_GUIDES[method.code] && getGuide(PAYMENT_GUIDES[method.code]!) ? (
            <GuideHelp guide={getGuide(PAYMENT_GUIDES[method.code]!)!} locale={locale} summary={t.guides.howToPay} readMore={t.guides.readMore} />
          ) : null}
          {payment?.status === "rejected" && payment.reviewNote ? (
            <Alert tone="danger" title={t.order.rejectedReason}>{payment.reviewNote}</Alert>
          ) : null}
          {payment?.status === "submitted" ? <Alert tone="info" title={t.order.proofSubmitted} /> : null}
          <h3 className="pt-2 text-sm font-bold">{t.order.submitProof}</h3>
          <PaymentProofForm
            reference={order.reference}
            accessKey={key}
            requiresReference={method?.requiresReference ?? false}
            allowsReceipt={method?.allowsReceipt ?? true}
            s={{
              title: t.order.submitProof,
              ref: t.order.proofReference,
              receipt: t.order.proofReceipt,
              submit: t.order.proofSubmit,
              submitting: t.order.proofSubmitting,
              submitted: t.order.proofSubmitted,
              note: t.order.proofNote,
              errors: { ...t.errors },
            }}
          />
        </section>
      ) : null}

      <section className="rounded-(--radius-card) border border-line bg-elevated shadow-soft">
        <h2 className="border-b border-line px-5 py-4 font-bold">{t.order.items}</h2>
        <ul className="divide-y divide-line">
          {order.items.map((i) => (
            <li key={i.id} className="flex flex-wrap justify-between gap-3 px-5 py-4">
              <div className="min-w-0">
                <p className="font-semibold">{ar ? i.productNameAr : i.productNameEn}</p>
                {(ar ? i.packageLabelAr : i.packageLabelEn) ? <p className="text-sm text-fg-muted">{ar ? i.packageLabelAr : i.packageLabelEn}</p> : null}
                <p className="text-xs text-fg-subtle"><span className="ltr-nums">{formatIQD(i.unitPrice, locale)}</span> × <span className="ltr-nums">{i.quantity}</span></p>
                {i.inputs.length ? (
                  <dl className="mt-1 space-y-0.5 text-xs text-fg-subtle">
                    {i.inputs.map((inp) => (
                      <div key={inp.key} className="flex gap-1"><dt className="font-semibold">{ar ? inp.labelAr : inp.labelEn}:</dt><dd dir="auto" className="break-all">{inp.value}</dd></div>
                    ))}
                  </dl>
                ) : null}
              </div>
              <p className="ltr-nums font-bold" dir="ltr">{formatIQD(i.lineTotal, locale)}</p>
            </li>
          ))}
        </ul>
        <div className="flex justify-between border-t border-line px-5 py-4">
          <span className="font-bold">{t.order.total}</span>
          <span className="ltr-nums text-xl font-black" dir="ltr">{formatIQD(order.total, locale)}</span>
        </div>
      </section>

      {canReview && reorderItems.length ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-(--radius-card) border border-line bg-elevated p-4 shadow-soft">
          <p className="text-sm text-fg-muted">{t.order.reorderHint}</p>
          <ReorderButton items={reorderItems} locale={locale} label={t.order.reorder} />
        </div>
      ) : null}

      {canReview ? (
        <section id="review" className="space-y-3 rounded-(--radius-card) border border-amber-400/40 bg-elevated p-5 shadow-soft">
          <h2 className="flex items-center gap-2 font-bold"><Icon name="star" className="size-5 text-amber-500" /> {t.reviews.rateTitle}</h2>
          <p className="text-sm text-fg-muted">{t.reviews.rateBody}</p>
          {order.items
            .filter((i) => i.productId != null)
            .map((i) => {
              const mine = myReviews.find((r) => r.orderItemId === i.id);
              return (
                <ReviewForm
                  key={i.id}
                  reference={order.reference}
                  accessKey={key}
                  item={{ id: i.id, name: ar ? i.productNameAr : i.productNameEn, packageLabel: ar ? i.packageLabelAr : i.packageLabelEn }}
                  existing={mine ? { rating: mine.rating, comment: mine.comment, displayName: mine.displayName, hidden: mine.status === "hidden" } : null}
                  defaultName={defaultDisplayName(order.customerName)}
                  s={{
                    rating: t.reviews.rating,
                    ratingLabels: [...t.reviews.ratingLabels],
                    starsLabel: t.reviews.starsLabel,
                    comment: t.reviews.comment,
                    commentHint: t.reviews.commentHint,
                    displayName: t.reviews.displayName,
                    displayNameHint: t.reviews.displayNameHint,
                    submit: t.reviews.submit,
                    update: t.reviews.update,
                    submitting: t.reviews.submitting,
                    thanks: t.reviews.thanks,
                    updated: t.reviews.updated,
                    hiddenNote: t.reviews.hiddenNote,
                    errors: { ...t.errors },
                  }}
                />
              );
            })}
        </section>
      ) : null}

      <section className="rounded-(--radius-card) border border-line bg-elevated p-5 shadow-soft">
        <h2 className="mb-4 font-bold">{t.order.history}</h2>
        <ol className="relative space-y-4 border-s-2 border-line ps-5">
          {order.history.map((h) => (
            <li key={h.id} className="relative">
              <span className="absolute -start-[1.72rem] top-1.5 size-3 rounded-full border-2 border-elevated bg-brand" aria-hidden="true" />
              <p className="font-semibold">{t.orderStatus[h.toStatus]}</p>
              <p className="ltr-nums text-xs text-fg-subtle">{formatDateTime(h.createdAt, locale)}</p>
            </li>
          ))}
        </ol>
      </section>

      {order.customerNotes ? (
        <section className="rounded-(--radius-card) border border-line bg-elevated p-5 shadow-soft">
          <h2 className="mb-1 font-bold">{t.order.yourNotes}</h2>
          <p className="text-sm whitespace-pre-line text-fg-muted">{order.customerNotes}</p>
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="font-bold">{t.order.contactSupport}</h2>
        <p className="text-sm text-fg-muted">{t.order.contactSupportHint}</p>
        <ContactLinks settings={settings} t={t} message={supportMessage} />
        <p className="text-xs text-fg-subtle">{t.contact.noApp}</p>
      </section>

      <p className="text-center text-sm">
        <Link href={`/${locale}/services`} className="font-semibold text-brand hover:underline">{t.cart.continue}</Link>
      </p>
    </div>
  );
}
