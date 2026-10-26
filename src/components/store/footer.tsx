import Link from "next/link";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n";
import type { StoreSettings } from "@/lib/services/settings";
import { Logo } from "@/components/ui/logo";
import { ContactLinks } from "./contact-links";

export function Footer({
  locale,
  t,
  settings,
  categories,
}: {
  locale: Locale;
  t: Dictionary;
  settings: StoreSettings;
  categories: { slug: string; nameAr: string; nameEn: string }[];
}) {
  const l = (p: string) => `/${locale}${p}`;
  const year = new Intl.DateTimeFormat("en", { year: "numeric", timeZone: "Asia/Baghdad" }).format(new Date());
  const name = locale === "ar" ? settings.storeNameAr : settings.storeNameEn;
  return (
    <footer className="mt-20 border-t border-line bg-elevated">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-4">
          <Logo locale={locale} name={name} logoUrl={settings.logoFileId ? `/api/files/${settings.logoFileId}` : null} />
          <p className="text-sm text-fg-muted">{t.footer.about}</p>
          <ContactLinks settings={settings} t={t} variant="icons" />
        </div>
        <FooterCol title={t.nav.categories} links={categories.map((c) => ({ href: l(`/category/${c.slug}`), label: locale === "ar" ? c.nameAr : c.nameEn }))} />
        <FooterCol
          title={t.footer.links}
          links={[
            { href: l("/services"), label: t.nav.services },
            { href: l("/custom-request"), label: t.nav.customRequest },
            { href: l("/track"), label: t.nav.track },
            { href: l("/faq"), label: t.nav.faq },
            { href: l("/contact"), label: t.nav.contact },
          ]}
        />
        <FooterCol
          title={t.footer.policies}
          links={[
            { href: l("/terms"), label: t.legal.terms },
            { href: l("/privacy"), label: t.legal.privacy },
            { href: l("/refund-policy"), label: t.legal.refund },
          ]}
        />
      </div>
      <div className="border-t border-line">
        <p className="mx-auto max-w-6xl px-4 py-5 text-center text-xs text-fg-subtle">
          © <span className="ltr-nums">{year}</span> {name}. {t.footer.rights}
        </p>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: { href: string; label: string }[] }) {
  return (
    <div>
      <h2 className="mb-3 text-sm font-bold">{title}</h2>
      <ul className="space-y-2">
        {links.map((x) => (
          <li key={x.href}>
            <Link href={x.href} className="text-sm text-fg-muted hover:text-brand">
              {x.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
