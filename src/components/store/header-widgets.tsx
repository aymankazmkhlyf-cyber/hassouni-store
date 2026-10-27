"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { LOCALE_COOKIE, otherLocale, switchLocalePath, type Locale } from "@/lib/i18n/config";
import { cn } from "@/components/ui/cn";
import { Icon } from "@/components/ui/icon";
import { useCart } from "./cart-provider";

export function CartButton({ locale, label }: { locale: Locale; label: string }) {
  const { lines, ready } = useCart();
  const count = ready ? lines.length : 0;
  // Bump the icon whenever something is added (including more of an existing line).
  const units = lines.reduce((sum, l) => sum + l.quantity, 0);
  const lastUnits = useRef<number | null>(null);
  const [bump, setBump] = useState(0);
  useEffect(() => {
    if (!ready) return;
    if (lastUnits.current != null && units > lastUnits.current) setBump((b) => b + 1);
    lastUnits.current = units;
  }, [ready, units]);
  return (
    <Link
      href={`/${locale}/cart`}
      className="relative grid size-10 place-items-center rounded-xl text-fg hover:bg-muted"
      aria-label={count ? `${label} (${count})` : label}
    >
      <Icon key={`i${bump}`} name="cart" className={cn("size-5.5", bump && "animate-bump text-brand")} />
      {count > 0 ? (
        <span key={`b${bump}`} className={cn("absolute -top-0.5 -end-0.5 grid min-w-5 place-items-center rounded-full bg-brand px-1 text-[0.68rem] font-bold text-brand-fg", bump && "animate-bump")} aria-hidden="true">
          {count}
        </span>
      ) : null}
    </Link>
  );
}

/** Switches language while keeping the current page and query string. */
export function LanguageSwitcher({ locale, label, ariaLabel }: { locale: Locale; label: string; ariaLabel: string }) {
  const pathname = usePathname();
  const search = useSearchParams();
  const to = otherLocale(locale);
  const qs = search.toString();
  return (
    <Link
      href={switchLocalePath(pathname, qs, to)}
      hrefLang={to}
      lang={to}
      aria-label={ariaLabel}
      onClick={() => {
        document.cookie = `${LOCALE_COOKIE}=${to}; path=/; max-age=31536000; samesite=lax`;
      }}
      className="inline-flex h-10 items-center gap-1.5 rounded-xl px-2.5 text-sm font-semibold hover:bg-muted"
    >
      <Icon name="globe" className="size-4.5" />
      <span>{label}</span>
    </Link>
  );
}

export function ThemeToggle({ label }: { label: string }) {
  const [dark, setDark] = useState<boolean | null>(null);
  useEffect(() => setDark(document.documentElement.classList.contains("dark")), []);
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={dark ?? undefined}
      className="grid size-10 place-items-center rounded-xl hover:bg-muted"
      onClick={() => {
        const next = !document.documentElement.classList.contains("dark");
        document.documentElement.classList.toggle("dark", next);
        setDark(next);
        try {
          localStorage.setItem("hds_theme", next ? "dark" : "light");
        } catch {
          /* ignore */
        }
      }}
    >
      <Icon name={dark ? "sun" : "moon"} className="size-5" />
    </button>
  );
}

export type MenuLink = { href: string; label: string; icon: string };

export function MobileMenu({ links, title, closeLabel, openLabel, footer }: { links: MenuLink[]; title: string; closeLabel: string; openLabel: string; footer?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button type="button" className="grid size-10 place-items-center rounded-xl hover:bg-muted xl:hidden" aria-label={openLabel} aria-expanded={open} onClick={() => setOpen(true)}>
        <Icon name="menu" className="size-5.5" />
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 xl:hidden" role="dialog" aria-modal="true" aria-label={title}>
          <button type="button" className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" aria-label={closeLabel} tabIndex={-1} onClick={() => setOpen(false)} />
          <div className="animate-in absolute inset-y-0 start-0 flex w-[min(20rem,86vw)] flex-col bg-elevated shadow-lift">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <span className="font-bold">{title}</span>
              <button ref={closeRef} type="button" className="grid size-10 place-items-center rounded-xl hover:bg-muted" aria-label={closeLabel} onClick={() => setOpen(false)}>
                <Icon name="close" className="size-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto p-2">
              <ul className="space-y-0.5">
                {links.map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      aria-current={pathname === l.href ? "page" : undefined}
                      className="flex items-center gap-3 rounded-xl px-3 py-2.5 font-semibold hover:bg-muted aria-[current=page]:bg-brand-soft aria-[current=page]:text-brand-soft-fg"
                    >
                      <Icon name={l.icon} className="size-5 text-fg-subtle" />
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
            {footer ? <div className="border-t border-line p-4">{footer}</div> : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
