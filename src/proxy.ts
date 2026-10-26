import { NextResponse, type NextRequest } from "next/server";

const LOCALES = ["ar", "en"];
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function sameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  // Browsers always send Origin on cross-site POSTs; a missing header is only tolerated in development.
  if (!origin) return process.env.NODE_ENV !== "production";
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // Defense in depth on top of Next's built-in Server Action origin check.
  if (!SAFE_METHODS.has(req.method) && !sameOrigin(req)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const first = pathname.split("/")[1] ?? "";
  if (!pathname.startsWith("/api") && !LOCALES.includes(first)) {
    const pref = req.cookies.get("hds_locale")?.value;
    const locale = pref && LOCALES.includes(pref) ? pref : "ar";
    const url = req.nextUrl.clone();
    url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
    url.search = search;
    return NextResponse.redirect(url);
  }

  // btoa instead of Buffer: works in both the Node.js and edge runtimes.
  const nonce = btoa(crypto.randomUUID());
  const isDev = process.env.NODE_ENV === "development";
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    // Inline style attributes are used by React for a few dynamic values; scripts remain nonce-locked.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  if (LOCALES.includes(first)) requestHeaders.set("x-hds-locale", first);
  requestHeaders.set("Content-Security-Policy", csp);

  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set("Content-Security-Policy", csp);

  // Private pages must never be cached by shared caches or indexed.
  if (/^\/(ar|en)\/(admin|orders|account|checkout)(\/|$)/.test(pathname)) {
    res.headers.set("Cache-Control", "private, no-store");
    res.headers.set("X-Robots-Tag", "noindex, nofollow");
  }
  return res;
}

export const config = {
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico|icon.svg|robots.txt|sitemap.xml|.*\\.(?:png|jpg|jpeg|webp|svg|ico|woff2?)$).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
