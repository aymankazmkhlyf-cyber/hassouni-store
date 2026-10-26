/*
 * Transactional email through Resend's HTTPS API (free tier: 3,000 emails/month).
 * Set RESEND_API_KEY in the host environment. Without a verified domain, Resend
 * delivers only to the email address of the Resend account itself, which is
 * enough for the store owner's own admin account. EMAIL_FROM can be set once a
 * domain is verified (e.g. "Hassouni <no-reply@your-domain>").
 */

export function emailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}

export async function sendEmail(to: string, subject: string, text: string, html: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.EMAIL_FROM || "Hassouni Store <onboarding@resend.dev>", to: [to], subject, text, html }),
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (!res.ok) console.error("email send failed", res.status);
    return res.ok;
  } catch {
    console.error("email send failed");
    return false;
  }
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
