import Link from "next/link";
import { Suspense } from "react";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n";
import type { SessionUser } from "@/lib/auth/session";
import { isStaffRole } from "@/lib/auth/permissions";
import type { StoreSettings } from "@/lib/services/settings";
import { Logo } from "@/components/ui/logo";
import { Icon } from "@/components/ui/icon";
import { CartButton, LanguageSwitcher, MobileMenu, ThemeToggle } from "./header-widgets";
import { ContactLinks } from "./contact-links";

export function Header({
  locale,
  t,
  user,
  settings,
  categories,
}: {
  locale: Locale;
  t: Dictionary;
  user: SessionUser | null;
  settings: StoreSettings;
  categories: { slug: string; nameAr: string; nameEn: string; icon: string }[];
}) {
  const l = (p: string) => `/${locale}${p}`;
  const nav = [
    { href: l("/services"), label: t.nav.services, icon: "grid" },
    { href: l("/custom-request"), label: t.nav.customRequest, icon: "wand" },
    { href: l("/track"), label: t.nav.track, icon: "search" },
    { href: l("/faq"), label: t.nav.faq, icon: "info" },
    { href: l("/contact"), label: t.nav.contact, icon: "chat" },
  ];
  const accountHref = user ? (isStaffRole(user.role) ? l("/admin") : l("/account")) : l("/login");
  const notice = locale === "ar" ? settings.noticeAr : settings.noticeEn;
  const logoUrl = settings.logoFileId ? `/api/files/${settings.logoFileId}` : null;

  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:start-2 focus:z-[60] focus:rounded-lg focus:bg-brand focus:px-4 focus:py-2 focus:text-brand-fg">
        {t.nav.skipToContent}
      </a>
      {notice ? (
        <div className="bg-brand px-4 py-2 text-center text-sm font-semibold text-brand-fg" role="note">
          {notice}
        </div>
      ) : null}
      <header className="sticky top-0 z-40 border-b border-line bg-elevated/85 backdrop-blur-md supports-[backdrop-filter]:bg-elevated/75">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4">
          <MobileMenu
            title={t.nav.menu}
            openLabel={t.nav.menu}
            closeLabel={t.nav.closeMenu}
            links={[
              { href: l(""), label: t.nav.home, icon: "home" },
              ...nav,
              ...categories.map((c) => ({ href: l(`/category/${c.slug}`), label: locale === "ar" ? c.nameAr : c.nameEn, icon: c.icon })),
              { href: accountHref, label: user ? t.nav.account : t.nav.login, icon: "user" },
            ]}
            footer={<ContactLinks settings={settings} t={t} variant="icons" />}
          />
          <Logo locale={locale} name={locale === "ar" ? settings.storeNameAr : settings.storeNameEn} logoUrl={logoUrl} />

          <nav aria-label={t.nav.menu} className="ms-6 hidden xl:block">
            <ul className="flex items-center gap-1">
              {nav.map((n) => (
                <li key={n.href}>
                  <Link href={n.href} className="rounded-lg px-3 py-2 text-sm font-semibold whitespace-nowrap text-fg-muted hover:bg-muted hover:text-fg">
                    {n.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="ms-auto flex items-center gap-0.5">
            <form action={l("/search")} method="get" role="search" className="relative me-1 hidden md:block">
              <label htmlFor="header-search" className="sr-only">{t.nav.search}</label>
              <Icon name="search" className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" />
              <input
                id="header-search"
                name="q"
                type="search"
                maxLength={80}
                placeholder={t.nav.searchPlaceholder}
                className="h-10 w-52 rounded-xl border border-line bg-muted ps-9 pe-3 text-sm placeholder:text-fg-subtle focus:border-brand focus:bg-elevated focus:outline-none lg:w-60"
              />
            </form>
            <Link href={l("/search")} className="grid size-10 place-items-center rounded-xl hover:bg-muted md:hidden" aria-label={t.nav.search}>
              <Icon name="search" className="size-5" />
            </Link>
            <ThemeToggle label={t.nav.themeToggle} />
            <Suspense fallback={<span className="inline-block h-10 w-20" />}>
              <LanguageSwitcher locale={locale} label={t.nav.language} ariaLabel={t.nav.languageLabel} />
            </Suspense>
            <Link href={accountHref} className="hidden size-10 place-items-center rounded-xl hover:bg-muted sm:grid" aria-label={user ? t.nav.account : t.nav.login}>
              <Icon name="user" className="size-5" />
            </Link>
            <CartButton locale={locale} label={t.nav.cart} />
          </div>
        </div>
      </header>
    </>
  );
}
