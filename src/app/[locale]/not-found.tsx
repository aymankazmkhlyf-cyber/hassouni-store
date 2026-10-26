import Link from "next/link";
import { headers } from "next/headers";
import { getDictionary } from "@/lib/i18n";
import { buttonClass } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

export default async function NotFound() {
  // not-found receives no params; the proxy forwards the URL's locale as a request header.
  const locale = (await headers()).get("x-hds-locale") === "en" ? "en" : "ar";
  const t = getDictionary(locale);
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center gap-4 px-4 py-20 text-center">
      <span className="hero-gradient grid size-20 place-items-center rounded-3xl text-4xl font-black text-white shadow-lift">404</span>
      <h1 className="text-2xl font-extrabold">{t.errors.notFoundTitle}</h1>
      <p className="text-fg-muted">{t.errors.notFoundBody}</p>
      <Link href={`/${locale}`} className={buttonClass("primary", "md")}>
        <Icon name="home" className="size-4" /> {t.errors.goHome}
      </Link>
    </div>
  );
}
