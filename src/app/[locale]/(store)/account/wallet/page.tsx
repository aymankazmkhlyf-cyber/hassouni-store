import type { Metadata } from "next";
import Link from "next/link";
import { requireCustomerPage } from "@/lib/auth/current-user";
import { formatIQD } from "@/lib/domain/money";
import { formatDateTime } from "@/lib/i18n";
import { resolveLocale, type LocaleParams } from "@/lib/i18n/server";
import { listPaymentMethods } from "@/lib/services/admin-catalog";
import { getWallet } from "@/lib/services/wallet";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { Icon } from "@/components/ui/icon";
import { PageHeader } from "@/components/store/product-card";
import { paymentDetailsStrings } from "@/components/store/payment-details";
import { SetUsernameForm, TopupForm } from "@/components/store/wallet-forms";

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const { t } = await resolveLocale(params);
  return { title: t.wallet.title, robots: { index: false } };
}

const TONE = { submitted: "warning", approved: "success", rejected: "danger" } as const;

export default async function WalletPage({ params }: LocaleParams) {
  const { locale, t } = await resolveLocale(params);
  const user = await requireCustomerPage(locale);
  const ar = locale === "ar";
  const w = t.wallet;
  if (user.role !== "customer") {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <Link href={`/${locale}/account`} className="font-semibold text-brand">{t.account.title}</Link>
      </div>
    );
  }
  const [wallet, methods] = await Promise.all([getWallet(user.id), listPaymentMethods({ enabledOnly: true })]);
  if (!wallet) return null;

  return (
    <>
      <PageHeader title={w.title} subtitle={user.name} />
      <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
        <p className="text-sm">
          <Link href={`/${locale}/account`} className="font-semibold text-brand hover:underline">← {t.account.title}</Link>
        </p>

        <section className="grid gap-4 rounded-(--radius-card) bg-[linear-gradient(135deg,var(--hero-from),var(--hero-to))] p-6 text-white shadow-lift sm:grid-cols-2" data-testid="wallet-summary">
          <div>
            <p className="text-sm text-white/80">{w.balance}</p>
            <p className="ltr-nums mt-1 text-4xl font-black" dir="ltr" data-testid="wallet-balance">{formatIQD(wallet.balance, locale)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-white/80">{w.walletId}</p>
            {wallet.username ? (
              <p className="flex items-center gap-2">
                <span className="ltr-nums text-xl font-bold" dir="ltr">@{wallet.username}</span>
                <CopyButton value={wallet.username} label={t.common.copy} copiedLabel={t.common.copied} />
              </p>
            ) : (
              <p className="text-sm">{w.setUsernameBody}</p>
            )}
            <p className="text-xs text-white/75">{w.walletIdHint}</p>
          </div>
        </section>

        {!wallet.username ? (
          <Card className="p-5">
            <h2 className="mb-3 font-bold">{w.setUsernameTitle}</h2>
            <SetUsernameForm s={{ username: t.auth.username, usernameHint: t.auth.usernameHint, save: w.save }} errors={{ ...t.errors }} />
          </Card>
        ) : null}

        <Card className="p-5">
          <h2 className="mb-2 font-bold">{w.howTitle}</h2>
          <ul className="space-y-1.5 text-sm text-fg-muted">
            {w.how.map((line) => (
              <li key={line} className="flex gap-2"><Icon name="check" className="mt-0.5 size-4 shrink-0 text-success" /> {line}</li>
            ))}
          </ul>
        </Card>

        <Card className="p-5" id="topup">
          <h2 className="mb-1 flex items-center gap-2 font-bold"><Icon name="wallet" className="size-5 text-brand" /> {w.topupTitle}</h2>
          <ol className="mb-4 list-decimal space-y-0.5 ps-5 text-sm text-fg-muted">
            {w.topupSteps.map((step) => <li key={step}>{step}</li>)}
          </ol>
          {methods.length === 0 ? (
            <p className="text-sm text-warning">{w.noMethods}</p>
          ) : (
            <TopupForm
              locale={locale}
              methods={methods.map((m) => ({
                id: m.id,
                nameAr: m.nameAr,
                nameEn: m.nameEn,
                accountDetails: m.accountDetails,
                instructionsAr: m.instructionsAr,
                instructionsEn: m.instructionsEn,
                qrFileId: m.qrFileId,
                allowsReceipt: m.allowsReceipt,
              }))}
              s={w}
              pay={paymentDetailsStrings(t)}
              errors={{ ...t.errors }}
            />
          )}
        </Card>

        {wallet.topups.length ? (
          <Card>
            <CardHeader title={w.requests} />
            <ul className="divide-y divide-line">
              {wallet.topups.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                  <span>
                    <span className="ltr-nums font-bold" dir="ltr">{formatIQD(r.amount, locale)}</span>
                    <span className="text-fg-muted"> · {ar ? r.methodNameAr : r.methodNameEn} · </span>
                    <span className="ltr-nums text-xs text-fg-subtle">{formatDateTime(r.createdAt, locale)}</span>
                    {r.status === "rejected" && r.reviewNote ? <span className="block text-xs text-danger">{r.reviewNote}</span> : null}
                  </span>
                  <Badge tone={TONE[r.status]}>{w.status[r.status]}</Badge>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}

        <Card>
          <CardHeader title={w.history} />
          {wallet.transactions.length === 0 ? (
            <p className="px-5 py-6 text-center text-sm text-fg-muted">{w.empty}</p>
          ) : (
            <ul className="divide-y divide-line" data-testid="wallet-history">
              {wallet.transactions.map((tx) => (
                <li key={tx.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                  <span>
                    <span className="font-semibold">{w.types[tx.type]}</span>
                    {tx.note ? <span className="ltr-nums text-fg-muted" dir="auto"> · {tx.note}</span> : null}
                    <span className="ltr-nums block text-xs text-fg-subtle">{formatDateTime(tx.createdAt, locale)}</span>
                  </span>
                  <span className="text-end">
                    <span className={`ltr-nums block font-bold ${tx.amount > 0 ? "text-success" : "text-danger"}`} dir="ltr">
                      {tx.amount > 0 ? "+" : "−"}{formatIQD(Math.abs(tx.amount), locale)}
                    </span>
                    <span className="ltr-nums text-xs text-fg-subtle" dir="ltr">{formatIQD(tx.balanceAfter, locale)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
