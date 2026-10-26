import "server-only";
import { headers } from "next/headers";

/** Client IP for rate limiting. Forwarded headers are only trusted behind a known proxy. */
export async function clientIp(): Promise<string> {
  const h = await headers();
  // Vercel always sits behind its own proxy, so its forwarded headers are trustworthy there.
  if (process.env.TRUST_PROXY === "true" || process.env.VERCEL === "1") {
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
