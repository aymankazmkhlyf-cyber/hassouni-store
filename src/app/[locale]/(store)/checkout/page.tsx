import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth/current-user";
import { resolveLocale, type LocaleParams } from "@/lib/i18n/server";
import { listPaymentMethods } from "@/lib/services/admin-catalog";
import { getSettings } from "@/lib/services/settings";
import { Alert } from "@/components/ui/alert";
import { CheckoutForm } from "@/components/store/checkout-form";
import { PageHeader } from "@/components/store/product-card";

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const { t } = await resolveLocale(params);
  return { title: t.checkout.title, robots: { index: false } };
}

export default async function CheckoutPage({ params }: LocaleParams) {
  const { locale, t } = await resolveLocale(params);
  const [user, methods, settings] = await Promise.all([getCurrentUser(), listPaymentMethods({ enabledOnly: true }), getSettings()]);
  const ar = locale === "ar";
  return (
    <>
      <PageHeader title={t.checkout.title} />
      <div className="mx-auto max-w-6xl px-4 py-8">
        {!settings.ordersEnabled ? <Alert tone="warning" className="mb-6" title={t.errors.product_unavailable} /> : null}
        <CheckoutForm
          locale={locale}
          loggedIn={!!user}
          wallet={user?.role === "customer" ? { balance: user.walletBalance } : null}
          ordersEnabled={settings.ordersEnabled}
          defaults={{ name: user?.name ?? "", phone: user?.phone ?? "", email: user?.email ?? "" }}
          methods={methods.map((m) => ({ id: m.id, name: ar ? m.nameAr : m.nameEn, instructions: ar ? m.instructionsAr : m.instructionsEn }))}
          s={{
            ...t.checkout,
            terms: t.legal.terms,
            refund: t.legal.refund,
            login: t.nav.login,
            total: t.cart.total,
            empty: t.cart.empty,
            continue: t.cart.continue,
            optional: t.common.optional,
            fixErrors: t.cart.fixErrors,
            backToCart: t.nav.cart,
            walletName: t.wallet.payWithWallet,
            walletAvailable: t.wallet.available,
            walletInsufficient: t.wallet.insufficient,
            walletTopup: t.wallet.topupLink,
            walletInstant: t.wallet.walletInstant,
            walletLogin: t.wallet.loginForWallet,
            errors: { ...t.errors },
          }}
        />
      </div>
    </>
  );
}
