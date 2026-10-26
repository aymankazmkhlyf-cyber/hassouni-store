import type { Metadata } from "next";
import { resolveLocale, type LocaleParams } from "@/lib/i18n/server";
import { CartView } from "@/components/store/cart-view";
import { PageHeader } from "@/components/store/product-card";

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const { t } = await resolveLocale(params);
  return { title: t.cart.title, robots: { index: false } };
}

export default async function CartPage({ params }: LocaleParams) {
  const { locale, t } = await resolveLocale(params);
  return (
    <>
      <PageHeader title={t.cart.title} />
      <div className="mx-auto max-w-6xl px-4 py-8">
        <CartView
          locale={locale}
          s={{
            title: t.cart.title,
            empty: t.cart.empty,
            emptyBody: t.cart.emptyBody,
            continue: t.cart.continue,
            checkout: t.cart.checkout,
            remove: t.cart.remove,
            total: t.cart.total,
            unitPrice: t.cart.unitPrice,
            quantity: t.product.quantity,
            updating: t.cart.updating,
            fixErrors: t.cart.fixErrors,
            serverPrices: t.cart.serverPrices,
            sample: t.common.sample,
            generic: t.errors.generic,
            errors: { ...t.errors },
          }}
        />
      </div>
    </>
  );
}
