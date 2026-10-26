import { eq } from "drizzle-orm";
import { cache } from "react";
import { z } from "zod";
import { db, type DbOrTx } from "@/lib/db";
import { storeSettings } from "@/lib/db/schema";
import { defaultPolicies } from "@/lib/i18n/content";

const str = (max: number, def = "") => z.string().max(max).catch(def).default(def);

export const storeSettingsSchema = z.object({
  storeNameAr: str(120, "متجر حسوني لخدمات السوشل ميديا"),
  storeNameEn: str(120, "Hassouni Digital Services"),
  logoFileId: z.uuid().nullable().catch(null).default(null),
  whatsapp: str(30, "+9647757382822"),
  telegram: str(40, "h_gms"),
  instagram: str(300, "https://www.instagram.com/1q3v_"),
  supportEmail: str(200),
  hoursAr: str(200, "يومياً من 10 صباحاً حتى 12 منتصف الليل (بتوقيت بغداد)"),
  hoursEn: str(200, "Daily, 10 AM to midnight (Baghdad time)"),
  ordersEnabled: z.boolean().catch(true).default(true),
  noticeAr: str(300),
  noticeEn: str(300),
  heroTitleAr: str(120),
  heroTitleEn: str(120),
  heroSubtitleAr: str(400),
  heroSubtitleEn: str(400),
  showOffers: z.boolean().catch(true).default(true),
  retentionDays: z.number().int().min(30).max(3650).catch(365).default(365),
  termsAr: str(20000, defaultPolicies.termsAr),
  termsEn: str(20000, defaultPolicies.termsEn),
  privacyAr: str(20000, defaultPolicies.privacyAr),
  privacyEn: str(20000, defaultPolicies.privacyEn),
  refundAr: str(20000, defaultPolicies.refundAr),
  refundEn: str(20000, defaultPolicies.refundEn),
  policiesUpdatedAt: z.string().catch("").default(""),
  /** Telegram chat that receives new-support-message alerts (linked from Admin → Support). */
  telegramChatId: z.string().max(40).catch("").default(""),
});

export type StoreSettings = z.infer<typeof storeSettingsSchema>;

const KEY = "store";

export async function loadSettings(conn: DbOrTx = db): Promise<StoreSettings> {
  const row = await conn.query.storeSettings.findFirst({ where: eq(storeSettings.key, KEY) });
  return storeSettingsSchema.parse(row?.value ?? {});
}

/** Per-request memoized settings for server components. */
export const getSettings = cache(() => loadSettings());

export async function saveSettings(patch: Partial<StoreSettings>, conn: DbOrTx = db): Promise<StoreSettings> {
  const current = await loadSettings(conn);
  const next = storeSettingsSchema.parse({ ...current, ...patch });
  await conn
    .insert(storeSettings)
    .values({ key: KEY, value: next })
    .onConflictDoUpdate({ target: storeSettings.key, set: { value: next, updatedAt: new Date() } });
  return next;
}
