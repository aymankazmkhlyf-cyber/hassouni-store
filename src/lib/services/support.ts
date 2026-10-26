import { and, asc, count, desc, eq, gt, sql } from "drizzle-orm";
import { db, type DbOrTx } from "@/lib/db";
import { paymentMethods, supportMessages, supportThreads, type SupportThread } from "@/lib/db/schema";
import { generateSessionToken, sha256 } from "@/lib/domain/tokens";
import type { Locale } from "@/lib/i18n/config";
import { audit, type Actor } from "./audit";
import { sendTelegram } from "./notify";
import { loadSettings, type StoreSettings } from "./settings";

export const MAX_MESSAGE_LENGTH = 1000;
export const SUPPORT_COOKIE = process.env.NODE_ENV === "production" ? "__Host-hds_support" : "hds_support";

/* ------------------------------ Auto replies ----------------------------- */

type BotRule = { id: string; match: RegExp; reply: (ctx: BotContext) => string };
type BotContext = { locale: Locale; settings: StoreSettings; methods: { nameAr: string; nameEn: string; accountDetails: string }[] };

const RULES: BotRule[] = [
  {
    id: "password",
    match: /كلمة\s*(ال)?(سر|مرور)|باسورد|باسوورد|رمز\s*(ال)?تحقق|password|otp|verification code/i,
    reply: ({ locale }) =>
      locale === "ar"
        ? "⚠️ تنبيه: نحن لا نطلب أبداً كلمة المرور أو رمز التحقق لأي حساب. لا ترسلها لأي أحد، حتى لو قال إنه من المتجر."
        : "⚠️ Note: we never ask for any account password or verification code. Don't send them to anyone, even someone claiming to be the store.",
  },
  {
    id: "payment",
    match: /دفع|ادفع|زين|زين\s*كاش|اسيا|آسيا|ماستر|حوال|تحويل|pay|payment|zain|asia|master/i,
    reply: ({ locale, methods }) => {
      const list = methods
        .filter((m) => m.accountDetails)
        .map((m) => `• ${locale === "ar" ? m.nameAr : m.nameEn}: ${m.accountDetails}`)
        .join("\n");
      const names = methods.map((m) => (locale === "ar" ? m.nameAr : m.nameEn)).join(locale === "ar" ? "، " : ", ");
      // With no payee details configured, name the methods instead of printing an empty list.
      const body = list || names;
      return locale === "ar"
        ? `💳 طرق الدفع:\n${body}\nبعد إنشاء الطلب تظهر لك تعليمات الدفع، ادفع وأرسل رقم العملية أو صورة الإيصال من صفحة الطلب، ونأكد الدفع يدوياً.`
        : `💳 Payment methods:\n${body}\nAfter placing your order you'll see the payment instructions; pay and send the transaction number or receipt from the order page; we confirm payments manually.`;
    },
  },
  {
    id: "order",
    match: /طلبي|طلب\s*رقم|تتبع|وين\s*(ال)?طلب|تأخر|تاخر|HDS-|order|track|delay/i,
    reply: ({ locale }) =>
      locale === "ar"
        ? "📦 تقدر تتابع طلبك من صفحة تتبع الطلب: /ar/track\nإذا عندك استفسار، اكتب رقم الطلب هنا (يبدأ بـ HDS-) فقط، ولا ترسل رمز الوصول."
        : "📦 You can follow your order on the tracking page: /en/track\nFor questions, write your order reference here (starts with HDS-) only — never send the access key.",
  },
  {
    id: "prices",
    match: /سعر|اسعار|أسعار|بكم|شكد|كم\s*سعر|price|cost|how much/i,
    reply: ({ locale }) =>
      locale === "ar" ? "🏷️ كل الخدمات وأسعارها هنا: /ar/services" : "🏷️ All services and prices are here: /en/services",
  },
  {
    id: "pubg",
    match: /شدات|شده|شدة|ببجي|pubg|\buc\b/i,
    reply: ({ locale }) => (locale === "ar" ? "🎮 شدات ببجي برقم اللاعب فقط: /ar/services/pubg-mobile-uc" : "🎮 PUBG UC with your player ID only: /en/services/pubg-mobile-uc"),
  },
];

function welcome(ctx: BotContext, name: string): string {
  const store = ctx.locale === "ar" ? ctx.settings.storeNameAr : ctx.settings.storeNameEn;
  const hours = ctx.locale === "ar" ? ctx.settings.hoursAr : ctx.settings.hoursEn;
  return ctx.locale === "ar"
    ? `أهلاً ${name} 👋 وصلت رسالتك إلى ${store}. أحد أعضاء الفريق راح يرد عليك هنا بأقرب وقت.${hours ? `\n🕒 أوقات الرد: ${hours}` : ""}`
    : `Hi ${name} 👋 Your message reached ${store}. A team member will reply here as soon as possible.${hours ? `\n🕒 Response hours: ${hours}` : ""}`;
}

/** Picks auto replies for a customer message; each rule answers at most once per thread. */
export function pickBotReplies(text: string, alreadySent: Set<string>, ctx: BotContext): { id: string; body: string }[] {
  return RULES.filter((r) => r.match.test(text) && !alreadySent.has(r.id)).map((r) => ({ id: r.id, body: `${r.reply(ctx)}` }));
}

/* ------------------------------- Customer -------------------------------- */

export async function getThreadByToken(token: string | undefined, conn: DbOrTx = db): Promise<SupportThread | null> {
  if (!token || token.length > 100) return null;
  return (await conn.query.supportThreads.findFirst({ where: eq(supportThreads.tokenHash, sha256(token)) })) ?? null;
}

export async function startThread(
  input: { name: string; phone: string | null; locale: Locale; userId: string | null; firstMessage: string; baseUrl?: string },
  conn: DbOrTx = db,
): Promise<{ token: string; thread: SupportThread }> {
  const token = generateSessionToken();
  const [thread] = await conn
    .insert(supportThreads)
    .values({ tokenHash: sha256(token), name: input.name, phone: input.phone, locale: input.locale, userId: input.userId })
    .returning();
  await addCustomerMessage(thread!, input.firstMessage, conn, { isFirst: true, baseUrl: input.baseUrl });
  return { token, thread: thread! };
}

/** Bot replies are tagged with a hidden marker so each rule fires once per thread. */
const BOT_TAG = (id: string) => `⁣${id}⁣`;
const tagOf = (body: string) => /⁣(\w+)⁣/.exec(body)?.[1];
export const stripTag = (body: string) => body.replace(/⁣\w+⁣/g, "");

export async function addCustomerMessage(thread: SupportThread, body: string, conn: DbOrTx = db, opts: { isFirst?: boolean; baseUrl?: string } = {}) {
  const text = body.trim().slice(0, MAX_MESSAGE_LENGTH);
  if (!text) return;
  const settings = await loadSettings(conn);
  const methods = await conn
    .select({ nameAr: paymentMethods.nameAr, nameEn: paymentMethods.nameEn, accountDetails: paymentMethods.accountDetails })
    .from(paymentMethods)
    .where(eq(paymentMethods.isEnabled, true))
    .orderBy(asc(paymentMethods.sortOrder));
  const ctx: BotContext = { locale: thread.locale === "en" ? "en" : "ar", settings, methods };

  const previous = await conn.select({ body: supportMessages.body }).from(supportMessages).where(and(eq(supportMessages.threadId, thread.id), eq(supportMessages.sender, "bot")));
  const sent = new Set(previous.map((m) => tagOf(m.body)).filter((x): x is string => !!x));

  const now = new Date();
  await conn.insert(supportMessages).values({ threadId: thread.id, sender: "customer", body: text });
  const bot = [
    ...(opts.isFirst ? [{ id: "welcome", body: welcome(ctx, thread.name) }] : []),
    ...pickBotReplies(text, sent, ctx),
  ];
  if (bot.length) {
    await conn.insert(supportMessages).values(bot.map((b) => ({ threadId: thread.id, sender: "bot" as const, body: `${BOT_TAG(b.id)}${b.body}` })));
  }
  await conn
    .update(supportThreads)
    .set({
      status: "open",
      lastMessageAt: now,
      unreadForStaff: sql`${supportThreads.unreadForStaff} + 1`,
      unreadForCustomer: sql`${supportThreads.unreadForCustomer} + ${bot.length}`,
    })
    .where(eq(supportThreads.id, thread.id));

  // Phone alert at most once a minute per conversation, so a burst of messages is one ping.
  const shouldNotify = !thread.lastNotifiedAt || now.getTime() - thread.lastNotifiedAt.getTime() > 60_000;
  if (shouldNotify && settings.telegramChatId) {
    const base = opts.baseUrl ?? process.env.APP_URL ?? process.env.URL ?? "";
    const ok = await sendTelegram(
      settings.telegramChatId,
      `💬 رسالة دعم جديدة من ${thread.name}${thread.phone ? ` (${thread.phone})` : ""}:\n\n${text.slice(0, 500)}\n\n↩️ للرد: ${base}/ar/admin/support/${thread.id}`,
    );
    if (ok) await conn.update(supportThreads).set({ lastNotifiedAt: now }).where(eq(supportThreads.id, thread.id));
  }
}

export async function listMessages(threadId: string, afterId = 0, conn: DbOrTx = db) {
  const rows = await conn
    .select({ id: supportMessages.id, sender: supportMessages.sender, body: supportMessages.body, createdAt: supportMessages.createdAt })
    .from(supportMessages)
    .where(and(eq(supportMessages.threadId, threadId), gt(supportMessages.id, afterId)))
    .orderBy(asc(supportMessages.id))
    .limit(200);
  return rows.map((r) => ({ ...r, body: stripTag(r.body), createdAt: r.createdAt.toISOString() }));
}

export async function markReadByCustomer(threadId: string, conn: DbOrTx = db) {
  await conn.update(supportThreads).set({ unreadForCustomer: 0 }).where(eq(supportThreads.id, threadId));
}

/* --------------------------------- Staff --------------------------------- */

export async function listThreads(opts: { page?: number; status?: "open" | "closed" }, conn: DbOrTx = db) {
  const pageSize = 30;
  const page = Math.max(opts.page ?? 1, 1);
  const where = opts.status ? eq(supportThreads.status, opts.status) : undefined;
  const [rows, totalRow] = await Promise.all([
    conn
      .select({
        id: supportThreads.id,
        name: supportThreads.name,
        phone: supportThreads.phone,
        status: supportThreads.status,
        unreadForStaff: supportThreads.unreadForStaff,
        lastMessageAt: supportThreads.lastMessageAt,
        preview: sql<string | null>`(SELECT m.body FROM support_messages m WHERE m.thread_id = "support_threads"."id" AND m.sender <> 'bot' ORDER BY m.id DESC LIMIT 1)`,
      })
      .from(supportThreads)
      .where(where)
      .orderBy(desc(supportThreads.unreadForStaff), desc(supportThreads.lastMessageAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    conn.select({ n: count() }).from(supportThreads).where(where),
  ]);
  return { rows, page, pages: Math.max(1, Math.ceil((totalRow[0]?.n ?? 0) / pageSize)) };
}

export async function staffUnreadCount(conn: DbOrTx = db): Promise<number> {
  const [r] = await conn.select({ n: sql<number>`coalesce(sum(${supportThreads.unreadForStaff}), 0)`.mapWith(Number) }).from(supportThreads);
  return r?.n ?? 0;
}

export async function getThread(id: string, conn: DbOrTx = db) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  return (await conn.query.supportThreads.findFirst({ where: eq(supportThreads.id, id) })) ?? null;
}

export async function markReadByStaff(threadId: string, conn: DbOrTx = db) {
  await conn.update(supportThreads).set({ unreadForStaff: 0 }).where(eq(supportThreads.id, threadId));
}

export async function addStaffMessage(threadId: string, body: string, actor: Actor, conn: DbOrTx = db) {
  const text = body.trim().slice(0, MAX_MESSAGE_LENGTH);
  if (!text) return false;
  const thread = await getThread(threadId, conn);
  if (!thread) return false;
  await conn.insert(supportMessages).values({ threadId, sender: "staff", staffId: actor.id, body: text });
  await conn
    .update(supportThreads)
    .set({ status: "open", lastMessageAt: new Date(), unreadForStaff: 0, unreadForCustomer: sql`${supportThreads.unreadForCustomer} + 1` })
    .where(eq(supportThreads.id, threadId));
  return true;
}

export async function setThreadStatus(threadId: string, status: "open" | "closed", actor: Actor, conn: DbOrTx = db) {
  await conn.update(supportThreads).set({ status }).where(eq(supportThreads.id, threadId));
  await audit(actor, `support.${status}`, "support_thread", threadId, {}, conn);
}

/** Retention: delete conversations with no activity for `days`. */
export async function purgeOldThreads(days: number, conn: DbOrTx = db) {
  const res = await conn.execute(sql`DELETE FROM support_threads WHERE last_message_at < now() - make_interval(days => ${days})`);
  return res.rowCount ?? 0;
}
