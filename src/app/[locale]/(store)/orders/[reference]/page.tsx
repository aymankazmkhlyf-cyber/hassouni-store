import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { paymentMethods } from "@/lib/db/schema";
import { buildOrderSupportMessage } from "@/lib/domain/contact";
import { formatIQD } from "@/lib/domain/money";
import { customerCanSubmitPayment } from "@/lib/domain/order-status";
import { formatDateTime, getDictionary, isLocale } from "@/lib/i18n";
import { sp } from "@/lib/i18n/server";
import { getOrderByAccessKey, getOrderForUser, latestPayment } from "@/lib/services/orders";
import { getSettings } from "@/lib/services/settings";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/ui/status-badge";
import { ContactLinks } from "@/components/store/contact-links";
import { PaymentProofForm } from "@/components/store/payment-proof-form";

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

      {canPay ? (
        <section className="space-y-4 rounded-(--radius-card) border border-brand/30 bg-elevated p-5 shadow-soft">
          <h2 className="flex items-center gap-2 font-bold"><Icon name="receipt" className="size-5 text-brand" /> {t.order.payTitle}</h2>
          <ol className="list-decimal space-y-1 ps-5 text-sm text-fg-muted">
            <li>{t.order.stepPay}</li>
            <li>{t.order.stepProof}</li>
            <li>{t.order.stepWait}</li>
          </ol>
          <div className="grid gap-3 rounded-xl bg-muted p-4 sm:grid-cols-2">
            <div>
              <p className="text-xs text-fg-subtle">{t.order.amountDue}</p>
              <p className="ltr-nums text-2xl font-black" dir="ltr">{formatIQD(order.total, locale)}</p>
            </div>
            <div>
              <p className="text-xs text-fg-subtle">{t.order.payTo}</p>
              {method?.accountDetails ? (
                <p className="flex items-center gap-2">
                  <span className="ltr-nums font-bold" dir="ltr">{method.accountDetails}</span>
                  <CopyButton value={method.accountDetails} label={t.common.copy} copiedLabel={t.common.copied} />
                </p>
              ) : (
                <p className="text-sm text-fg-muted">{t.order.payToMissing}</p>
              )}
            </div>
            {method && (ar ? method.instructionsAr : method.instructionsEn) ? (
              <p className="text-sm whitespace-pre-line text-fg-muted sm:col-span-2">{ar ? method.instructionsAr : method.instructionsEn}</p>
            ) : null}
          </div>
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
