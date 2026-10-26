import Link from "next/link";
import type { Locale } from "@/lib/i18n/config";

/** Text-based logo mark; a custom uploaded logo replaces the mark when configured. */
export function Logo({ locale, name, logoUrl, href }: { locale: Locale; name: string; logoUrl?: string | null; href?: string }) {
  return (
    <Link href={href ?? `/${locale}`} className="group flex items-center gap-2.5 rounded-xl" aria-label={name}>
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- served from our own DB-backed file route
        <img src={logoUrl} alt="" width={36} height={36} className="size-9 rounded-xl object-cover" />
      ) : (
        <span className="hero-gradient grid size-9 place-items-center rounded-xl text-lg font-black text-white shadow-soft" aria-hidden="true">
          {locale === "ar" ? "ح" : "H"}
        </span>
      )}
      <span className="flex flex-col leading-tight whitespace-nowrap">
        <span className="text-[0.95rem] font-extrabold tracking-tight">{locale === "ar" ? "حسوني" : "Hassouni"}</span>
        <span className="hidden text-[0.68rem] font-semibold text-fg-subtle min-[400px]:block">{locale === "ar" ? "لخدمات السوشل ميديا" : "Digital Services"}</span>
      </span>
    </Link>
  );
}
