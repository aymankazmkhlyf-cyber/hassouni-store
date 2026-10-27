import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { orders, type OrderStatus } from "@/lib/db/schema";
import { getDictionary } from "@/lib/i18n";
import { fmt, isLocale } from "@/lib/i18n/config";
import { emailConfigured, escapeHtml, sendEmail } from "./email";
import { pushToOrder, type PushSender } from "./push";
import { loadSettings } from "./settings";

/** Status changes the customer is told about (the customer's own actions are not echoed back). */
export type CustomerEvent = Extract<OrderStatus, "paid" | "processing" | "completed" | "cancelled" | "rejected" | "refunded"> | "paymentRejected";

const STATUS_EVENTS = new Set<OrderStatus>(["paid", "processing", "completed", "cancelled", "rejected", "refunded"]);

export function eventForStatus(to: OrderStatus): CustomerEvent | null {
  return STATUS_EVENTS.has(to) ? (to as CustomerEvent) : null;
}

/**
 * Tells the customer about an order update by browser push (devices that
 * opted in on the order page) and by email (when they left an email address
 * and email is configured). Links go to the track page with the reference
 * filled in; the access key is never stored in plain text, so it is not sent.
 * Never throws: a failed notification must not affect the order itself.
 */
export async function notifyCustomer(orderId: string, event: CustomerEvent, baseUrl: string, opts: { send?: PushSender } = {}) {
  try {
    const order = await db.query.orders.findFirst({
      where: eq(orders.id, orderId),
      columns: { reference: true, locale: true, customerEmail: true, anonymizedAt: true },
    });
    if (!order || order.anonymizedAt) return { push: 0, email: false };
    const locale = isLocale(order.locale) ? order.locale : "ar";
    const t = getDictionary(locale);
    const msg = t.notify.status[event];
    const title = msg.title;
    const body = fmt(msg.body, { ref: order.reference });
    const path = `/${locale}/track?ref=${encodeURIComponent(order.reference)}${event === "completed" ? "#review" : ""}`;
    const settings = await loadSettings();
    const contact = baseUrl.startsWith("https://") ? baseUrl : settings.supportEmail ? `mailto:${settings.supportEmail}` : "mailto:support@example.com";

    const push = await pushToOrder(orderId, { title, body, url: path, tag: order.reference, ref: order.reference }, contact, { send: opts.send });

    let email = false;
    if (order.customerEmail && emailConfigured()) {
      const storeName = locale === "ar" ? settings.storeNameAr : settings.storeNameEn;
      const link = `${baseUrl}${path}`;
      const dir = locale === "ar" ? "rtl" : "ltr";
      email = await sendEmail(
        order.customerEmail,
        `${title} — ${order.reference}`,
        `${body}\n\n${t.notify.openOrder}: ${link}\n\n${storeName}`,
        `<div dir="${dir}" style="font-family:Tahoma,Arial,sans-serif;font-size:15px;line-height:1.7;color:#1c1b29">
<h2 style="margin:0 0 8px">${escapeHtml(title)}</h2>
<p style="margin:0 0 16px">${escapeHtml(body)}</p>
<p><a href="${escapeHtml(link)}" style="display:inline-block;background:#5a3ff0;color:#fff;padding:10px 18px;border-radius:10px;text-decoration:none;font-weight:bold">${escapeHtml(t.notify.openOrder)}</a></p>
<p style="color:#77748c;font-size:13px">${escapeHtml(storeName)}</p></div>`,
      );
    }
    return { push, email };
  } catch {
    console.error("customer notification failed");
    return { push: 0, email: false };
  }
}
