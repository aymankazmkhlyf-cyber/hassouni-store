import type { Metadata } from "next";
import { Suspense } from "react";
import { logoutAction } from "@/app/actions/auth";
import { requireStaffPage } from "@/lib/auth/current-user";
import { hasPermission, type Permission } from "@/lib/auth/permissions";
import { resolveLocale, type LocaleParams } from "@/lib/i18n/server";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Logo } from "@/components/ui/logo";
import { AdminNav } from "@/components/admin/admin-nav";
import { SupportNotifier } from "@/components/admin/support-notifier";
import { LanguageSwitcher, ThemeToggle } from "@/components/store/header-widgets";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AdminLayout({ children, params }: LocaleParams & { children: React.ReactNode }) {
  const { locale, t } = await resolveLocale(params);
  const user = await requireStaffPage(locale);
  const a = `/${locale}/admin`;
  const all: { href: string; label: string; icon: string; perm: Permission; exact?: boolean }[] = [
    { href: a, label: t.admin.dashboard, icon: "chart", perm: "dashboard:view", exact: true },
    { href: `${a}/orders`, label: t.admin.orders, icon: "receipt", perm: "orders:read" },
    { href: `${a}/support`, label: t.admin.support, icon: "chat", perm: "support:manage" },
    { href: `${a}/reviews`, label: t.admin.reviews, icon: "star", perm: "reviews:manage" },
    { href: `${a}/products`, label: t.admin.products, icon: "box", perm: "products:write" },
    { href: `${a}/categories`, label: t.admin.categories, icon: "grid", perm: "categories:write" },
    { href: `${a}/payment-methods`, label: t.admin.paymentMethods, icon: "card", perm: "payment_methods:write" },
    { href: `${a}/customers`, label: t.admin.customers, icon: "users", perm: "customers:read" },
    { href: `${a}/requests`, label: t.admin.requests, icon: "wand", perm: "requests:manage" },
    { href: `${a}/settings`, label: t.admin.settings, icon: "settings", perm: "settings:write" },
    { href: `${a}/audit`, label: t.admin.audit, icon: "list", perm: "audit:read" },
    { href: `${a}/password`, label: t.admin.password, icon: "lock", perm: "dashboard:view" },
  ];
  // Hiding links is cosmetic; every page and action re-checks permissions on the server.
  const links = all.filter((l) => hasPermission(user.role, l.perm));

  return (
    <div className="min-h-dvh bg-bg">
      <header className="sticky top-0 z-30 border-b border-line bg-elevated/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4">
          <Logo locale={locale} name={t.meta.storeName} href={a} />
          <Badge tone="brand" className="hidden sm:inline-flex">{t.admin.panel}</Badge>
          <div className="ms-auto flex items-center gap-1">
            <span className="hidden text-xs text-fg-subtle md:inline">
              {t.admin.signedInAs} <span className="font-semibold text-fg">{user.name}</span> ({user.role})
            </span>
            {hasPermission(user.role, "support:manage") ? (
              <SupportNotifier href={`${a}/support`} label={t.admin.support} newMessage={t.admin.supportPage.newMessage} />
            ) : null}
            <ThemeToggle label={t.nav.themeToggle} />
            <Suspense fallback={null}>
              <LanguageSwitcher locale={locale} label={t.nav.language} ariaLabel={t.nav.languageLabel} />
            </Suspense>
            <ButtonLink href={`/${locale}`} variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Icon name="external" className="size-4" /> {t.admin.viewStore}
            </ButtonLink>
            <form action={logoutAction}>
              <input type="hidden" name="locale" value={locale} />
              <Button type="submit" variant="ghost" size="sm" aria-label={t.nav.logout}>
                <Icon name="logout" className="size-4" /> <span className="hidden sm:inline">{t.nav.logout}</span>
              </Button>
            </form>
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[14rem_1fr]">
        <aside className="lg:sticky lg:top-22 lg:self-start">
          <AdminNav links={links} />
        </aside>
        <main id="main" className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
