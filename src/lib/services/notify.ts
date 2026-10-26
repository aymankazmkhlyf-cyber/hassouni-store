/*
 * Optional Telegram alerts for the store owner. Configure TELEGRAM_BOT_TOKEN
 * (from @BotFather) in the host's environment, then press "Link Telegram" in
 * Admin → Support. Without a token every function here is a silent no-op, so
 * the site never fails because of notifications.
 */

const API = "https://api.telegram.org";

export function telegramConfigured(): boolean {
  return !!process.env.TELEGRAM_BOT_TOKEN;
}

async function call<T>(method: string, body?: Record<string, unknown>): Promise<T | null> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return null;
  try {
    const res = await fetch(`${API}/bot${token}/${method}`, {
      method: body ? "POST" : "GET",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
    const data = (await res.json()) as { ok: boolean; result: T };
    return data.ok ? data.result : null;
  } catch {
    // Never log the URL: it contains the bot token.
    console.error(`telegram ${method} failed`);
    return null;
  }
}

export async function sendTelegram(chatId: string, text: string): Promise<boolean> {
  if (!chatId) return false;
  const r = await call<unknown>("sendMessage", { chat_id: chatId, text: text.slice(0, 3500), disable_web_page_preview: true });
  return r !== null;
}

/** Finds the private chat of whoever most recently pressed Start on the bot. */
export async function findLatestPrivateChat(): Promise<{ id: string; name: string } | null> {
  type Update = { message?: { chat: { id: number; type: string; first_name?: string; username?: string } } };
  const updates = await call<Update[]>("getUpdates");
  if (!updates) return null;
  for (const u of [...updates].reverse()) {
    const chat = u.message?.chat;
    if (chat && chat.type === "private") return { id: String(chat.id), name: chat.first_name ?? chat.username ?? "" };
  }
  return null;
}

/** Sends a Telegram alert to the linked staff chat, if one is configured. Never throws. */
export async function notifyStaff(text: string): Promise<void> {
  if (!telegramConfigured()) return;
  try {
    const { loadSettings } = await import("./settings");
    const { telegramChatId } = await loadSettings();
    if (telegramChatId) await sendTelegram(telegramChatId, text);
  } catch {
    console.error("staff notification failed");
  }
}
