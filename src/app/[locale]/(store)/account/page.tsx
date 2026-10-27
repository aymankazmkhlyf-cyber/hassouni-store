import type { Metadata } from "next";
import Link from "next/link";
import { logoutAction } from "@/app/actions/auth";
import { requireCustomerPage } from "@/lib/auth/current-user";
import { formatIQD } from "@/lib/domain/money";
import { formatDate } from "@/lib/i18n";
import { resolveLocale, type LocaleParams } from "@/lib/i18n/server";
import { listOrdersForUser } from "@/lib/services/orders";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { OrderStatusBadge } from "@/components/ui/status-badge";
import { DeleteAccountForm } from "@/components/store/forms";
import { PageHeader } from "@/components/store/product-card";

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const { t } = await resolveLocale(params);
  return { title: t.account.title, robots: { index: false } };
}

export default async function AccountPage({ params }: LocaleParams) {
  const { locale, t } = await resolveLocale(params);
  const user = await requireCustomerPage(locale);
  const orders = await listOrdersForUser(user.id);
  const isCustomer = user.role === "customer";
  return (
    <>
      <PageHeader title={t.account.title} subtitle={`${user.name} · ${user.email}${user.username ? ` · @${user.username}` : ""}`} />
      <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
        <div className="flex flex-wrap gap-2">
          {!isCustomer ? <ButtonLink href={`/${locale}/admin`} variant="secondary"><Icon name="grid" className="size-4" /> {t.admin.panel}</ButtonLink> : null}
          <form action={logoutAction}>
            <input type="hidden" name="locale" value={locale} />
            <Button type="submit" variant="outline"><Icon name="logout" className="size-4" /> {t.nav.logout}</Button>
          </form>
        </div>

        {isCustomer ? (
          <Link
            href={`/${locale}/account/wallet`}
            className="flex flex-wrap items-center justify-between gap-3 rounded-(--radius-card) bg-[linear-gradient(135deg,var(--hero-from),var(--hero-to))] p-5 text-white shadow-lift"
            data-testid="account-wallet"
          >
            <span className="flex items-center gap-3">
              <Icon name="wallet" className="size-7" />
              <span>
                <span className="block text-sm text-white/80">{t.wallet.balance}</span>
                <span className="ltr-nums block text-2xl font-black" dir="ltr">{formatIQD(user.walletBalance, locale)}</span>
              </span>
            </span>
            <span className="text-end text-sm">
              {user.username ? <span className="ltr-nums block font-bold" dir="ltr">@{user.username}</span> : null}
              <span className="font-semibold underline">{t.wallet.openWallet}</span>
            </span>
          </Link>
        ) : null}

        <Card>
          <CardHeader title={t.account.orders} />
          {orders.length === 0 ? (
            <div className="p-5"><EmptyState icon="inbox" title={t.account.noOrders} action={<ButtonLink href={`/${locale}/services`}>{t.cart.continue}</ButtonLink>} /></div>
          ) : (
            <ul className="divide-y divide-line">
              {orders.map((o) => (
                <li key={o.id}>
                  <Link href={`/${locale}/orders/${o.reference}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 hover:bg-muted">
                    <span className="min-w-0">
                      <span className="ltr-nums block font-bold" dir="ltr">{o.reference}</span>
                      <span className="block truncate text-xs text-fg-subtle">
                        <span className="ltr-nums">{formatDate(o.createdAt, locale)}</span> · {o.items.map((i) => (locale === "ar" ? i.productNameAr : i.productNameEn)).join(locale === "ar" ? "، " : ", ")}
                      </span>
                    </span>
                    <span className="flex items-center gap-3">
                      <OrderStatusBadge status={o.status} t={t} />
                      <span className="ltr-nums font-bold" dir="ltr">{formatIQD(o.total, locale)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {isCustomer ? (
          <Card>
            <CardHeader title={t.account.deleteAccount} description={t.account.deleteAccountBody} />
            <div className="p-5">
              <DeleteAccountForm locale={locale} s={{ label: t.account.deleteConfirm, submit: t.account.deleteAccount, confirm: t.account.deleteAccountBody }} errors={{ ...t.errors }} />
            </div>
          </Card>
        ) : null}
      </div>
    </>
  );
}
