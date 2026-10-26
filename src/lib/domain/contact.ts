export type ContactConfig = { whatsapp: string; telegram: string; instagram: string };

/** wa.me expects the international number with digits only. */
export function whatsappLink(phone: string, message?: string): string {
  const digits = phone.replace(/\D/g, "");
  const base = `https://wa.me/${digits}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

/** Telegram chat link. t.me cannot prefill a message for a user chat, so none is attached. */
export function telegramLink(username: string): string {
  const handle = username.trim().replace(/^@/, "").replace(/^https?:\/\/t\.me\//, "");
  if (!/^[A-Za-z0-9_]{3,32}$/.test(handle)) return "https://t.me/";
  return `https://t.me/${handle}`;
}

export function telegramHandle(username: string): string {
  return "@" + username.trim().replace(/^@/, "").replace(/^https?:\/\/t\.me\//, "");
}

export function isSafeHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

export type SupportMessageOrder = {
  reference: string;
  status: string;
  total: string;
  items: { name: string; quantity: number }[];
};

/**
 * Prepares a support message about an order. Contains only the public reference,
 * status and a short item summary — never access keys, payment details or contact data.
 */
export function buildOrderSupportMessage(order: SupportMessageOrder, locale: "ar" | "en"): string {
  const items = order.items
    .slice(0, 5)
    .map((i) => `- ${i.name} × ${i.quantity}`)
    .join("\n");
  const more = order.items.length > 5 ? (locale === "ar" ? "\n- …" : "\n- …") : "";
  if (locale === "ar") {
    return `مرحباً، أحتاج مساعدة بخصوص طلبي.\nرقم الطلب: ${order.reference}\nالحالة: ${order.status}\nالمجموع: ${order.total}\nالخدمات:\n${items}${more}`;
  }
  return `Hello, I need help with my order.\nOrder reference: ${order.reference}\nStatus: ${order.status}\nTotal: ${order.total}\nServices:\n${items}${more}`;
}
