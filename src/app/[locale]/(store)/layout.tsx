import { getCurrentUser } from "@/lib/auth/current-user";
import { resolveLocale, type LocaleParams } from "@/lib/i18n/server";
import { listCategories } from "@/lib/services/catalog";
import { getSettings } from "@/lib/services/settings";
import { CartProvider } from "@/components/store/cart-provider";
import { Footer } from "@/components/store/footer";
import { Header } from "@/components/store/header";

export default async function StoreLayout({ children, params }: LocaleParams & { children: React.ReactNode }) {
  const { locale, t } = await resolveLocale(params);
  const [user, settings, categories] = await Promise.all([getCurrentUser(), getSettings(), listCategories({ activeOnly: true })]);
  return (
    <CartProvider>
      <Header locale={locale} t={t} user={user} settings={settings} categories={categories} />
      <main id="main" className="min-h-[60vh]">
        {children}
      </main>
      <Footer locale={locale} t={t} settings={settings} categories={categories} />
    </CartProvider>
  );
}
