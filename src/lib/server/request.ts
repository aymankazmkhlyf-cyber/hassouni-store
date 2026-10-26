import "server-only";
import { headers } from "next/headers";

/** Client IP for rate limiting. Forwarded headers are only trusted behind a known proxy. */
export async function clientIp(): Promise<string> {
  const h = await headers();
  // Vercel and Netlify always sit behind their own proxy, so forwarded headers are trustworthy there.
  if (process.env.TRUST_PROXY === "true" || process.env.VERCEL === "1" || process.env.NETLIFY === "true") {
    const fwd = h.get("x-forwarded-for")?.split(",")[0]?.trim();
    if (fwd) return fwd;
    const real = h.get("x-real-ip");
    if (real) return real;
  }
  return "local";
}

export async function userAgent(): Promise<string | null> {
  return (await headers()).get("user-agent");
}

/** Public base URL of the site (no trailing slash): APP_URL if set, else the request host. */
export async function siteUrl(): Promise<string> {
  const configured = process.env.APP_URL?.replace(/\/$/, "");
  if (configured) return configured;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return process.env.URL ?? "";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
