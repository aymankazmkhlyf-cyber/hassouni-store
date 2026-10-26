import "@fontsource-variable/cairo";
import "../globals.css";
import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { dirFor } from "@/lib/i18n/config";
import { resolveLocale, type LocaleParams } from "@/lib/i18n/server";

// Applies the stored/OS theme before first paint to avoid a flash.
const themeScript = `(function(){try{var t=localStorage.getItem('hds_theme');var d=t?t==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;if(d)document.documentElement.classList.add('dark')}catch(e){}})();`;

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const { locale, t } = await resolveLocale(params);
  const base = process.env.APP_URL ? new URL(process.env.APP_URL) : undefined;
  return {
    metadataBase: base,
    title: { default: t.meta.storeName, template: `%s | ${t.meta.storeName}` },
    description: t.meta.description,
    applicationName: t.meta.storeName,
    alternates: { languages: { ar: "/ar", en: "/en" } },
    openGraph: { siteName: t.meta.storeName, locale: locale === "ar" ? "ar_IQ" : "en_US", type: "website" },
    formatDetection: { telephone: false },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f6fb" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0c14" },
  ],
};

export default async function RootLayout({ children, params }: LocaleParams & { children: React.ReactNode }) {
  const { locale } = await resolveLocale(params);
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang={locale} dir={dirFor(locale)} suppressHydrationWarning>
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
