import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { supportThreads } from "@/lib/db/schema";
import {
  addCustomerMessage,
  addStaffMessage,
  getThreadByToken,
  listMessages,
  listThreads,
  markReadByCustomer,
  markReadByStaff,
  pickBotReplies,
  purgeOldThreads,
  staffUnreadCount,
  startThread,
} from "@/lib/services/support";
import { loadSettings } from "@/lib/services/settings";
import { hasDb, makeUser } from "./helpers";

describe.skipIf(!hasDb)("live support chat", () => {
  it("opens a thread with an instant welcome and keyword auto-replies", async () => {
    const { token, thread } = await startThread({ name: "علي", phone: "+9647701234567", locale: "ar", userId: null, firstMessage: "شلون ادفع بزين كاش؟" });
    const msgs = await listMessages(thread.id);
    expect(msgs.map((m) => m.sender)).toEqual(["customer", "bot", "bot"]);
    expect(msgs[1]!.body).toContain("أهلاً علي");
    expect(msgs[2]!.body).toContain("طرق الدفع");
    expect(msgs.some((m) => m.body.includes("⁣"))).toBe(false); // internal tags never leak
    expect((await getThreadByToken(token))?.id).toBe(thread.id);
  });

  it("answers each topic only once per conversation", async () => {
    const { thread } = await startThread({ name: "Sara", phone: null, locale: "en", userId: null, firstMessage: "hello" });
    const t = (await db.query.supportThreads.findFirst({ where: eq(supportThreads.id, thread.id) }))!;
    await addCustomerMessage(t, "how much is the price?");
    await addCustomerMessage(t, "price again please");
    const bots = (await listMessages(thread.id)).filter((m) => m.sender === "bot");
    expect(bots.filter((m) => m.body.includes("/en/services")).length).toBe(1);
  });

  it("warns about passwords and never asks for one", async () => {
    const settings = await loadSettings();
    const r = pickBotReplies("ارسلك كلمة السر؟", new Set(), { locale: "ar", settings, methods: [] });
    expect(r[0]!.id).toBe("password");
    expect(r[0]!.body).toContain("لا نطلب");
  });

  it("a visitor can only reach their own thread", async () => {
    const a = await startThread({ name: "A", phone: null, locale: "ar", userId: null, firstMessage: "hi" });
    expect(await getThreadByToken("not-a-real-token")).toBeNull();
    expect(await getThreadByToken(undefined)).toBeNull();
    expect((await getThreadByToken(a.token))?.name).toBe("A");
  });

  it("tracks unread counts for staff and customer, and staff replies reach the customer", async () => {
    const staff = await makeUser("staff");
    const before = await staffUnreadCount();
    const { thread } = await startThread({ name: "B", phone: null, locale: "ar", userId: null, firstMessage: "مرحبا" });
    expect(await staffUnreadCount()).toBe(before + 1);
    await markReadByStaff(thread.id);
    expect(await staffUnreadCount()).toBe(before);

    await markReadByCustomer(thread.id);
    expect(await addStaffMessage(thread.id, "أهلاً، كيف نقدر نساعدك؟", staff)).toBe(true);
    const t = await db.query.supportThreads.findFirst({ where: eq(supportThreads.id, thread.id) });
    expect(t!.unreadForCustomer).toBe(1);
    const last = (await listMessages(thread.id)).at(-1)!;
    expect(last).toMatchObject({ sender: "staff", body: "أهلاً، كيف نقدر نساعدك؟" });

    const afterId = last.id;
    expect(await listMessages(thread.id, afterId)).toEqual([]);
    expect(await addStaffMessage(thread.id, "   ", staff)).toBe(false);
    const list = await listThreads({});
    expect(list.rows.some((r) => r.id === thread.id)).toBe(true);
  });

  it("purges conversations older than the retention period", async () => {
    const { thread } = await startThread({ name: "Old", phone: null, locale: "ar", userId: null, firstMessage: "x" });
    await db.update(supportThreads).set({ lastMessageAt: new Date(Date.now() - 400 * 86400000) }).where(eq(supportThreads.id, thread.id));
    expect(await purgeOldThreads(365)).toBeGreaterThanOrEqual(1);
    expect(await db.query.supportThreads.findFirst({ where: eq(supportThreads.id, thread.id) })).toBeUndefined();
  });
});

describe("support auto-reply content", () => {
  it("never sends an empty payment list", async () => {
    const { pickBotReplies } = await import("@/lib/services/support");
    const { storeSettingsSchema } = await import("@/lib/services/settings");
    const settings = storeSettingsSchema.parse({});
    const none = pickBotReplies("payment?", new Set(), { locale: "en", settings, methods: [{ nameAr: "زين كاش", nameEn: "Zain Cash", accountDetails: "" }] });
    expect(none[0]!.body).toContain("Zain Cash");
    const withNumber = pickBotReplies("زين كاش", new Set(), { locale: "ar", settings, methods: [{ nameAr: "زين كاش", nameEn: "Zain Cash", accountDetails: "07757382822" }] });
    expect(withNumber[0]!.body).toContain("زين كاش: 07757382822");
  });
});

describe.skipIf(!hasDb)("daily maintenance", () => {
  it("runs at most once per day", async () => {
    const { maybeRunMaintenance } = await import("@/lib/services/maintenance");
    const { saveSettings } = await import("@/lib/services/settings");
    await saveSettings({ lastMaintenanceAt: "" });
    const now = Date.now();
    expect(await maybeRunMaintenance(now)).toBe(true);
    expect(await maybeRunMaintenance(now + 60_000)).toBe(false);
    expect(await maybeRunMaintenance(now + 25 * 60 * 60 * 1000)).toBe(true);
  });
});
