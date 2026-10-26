import "dotenv/config";
import { eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../src/lib/db/schema";

/*
 * One-time catalog updates supplied by the store owner, applied during deploy
 * (see "deploy:build"). Each update runs once in a transaction; its id is then
 * recorded in store_settings so later edits made in the admin dashboard are
 * never overwritten by a redeploy.
 */

type Db = ReturnType<typeof drizzle<typeof schema>>;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
type Pkg = { labelAr: string; labelEn: string; price: number };
type Field = Omit<typeof schema.productFields.$inferInsert, "productId" | "sortOrder">;

type ProductSpec = {
  slug: string;
  category: string;
  nameAr: string;
  nameEn: string;
  summaryAr: string;
  summaryEn: string;
  descriptionAr: string;
  descriptionEn: string;
  icon: string;
  deliveryTimeAr: string;
  deliveryTimeEn: string;
  isFeatured: boolean;
  sortOrder: number;
  fields: Field[];
} & ({ mode: "package"; packages: Pkg[]; maxPackages: number } | { mode: "unit"; unitPrice: number; min: number; max: number });

const n = (x: number) => x.toLocaleString("en-US");

/** Same price per unit across sizes, e.g. 5 IQD per follower. */
function packs(sizes: number[], pricePerThousand: number, ar: string, en: string): Pkg[] {
  return sizes.map((s) => ({ labelAr: `${n(s)} ${ar}`, labelEn: `${n(s)} ${en}`, price: (s / 1000) * pricePerThousand }));
}

const noPassword = {
  helpAr: "يجب أن يكون الحساب عاماً. لا نطلب كلمة المرور أبداً.",
  helpEn: "The account must be public. We never ask for your password.",
};
const SIZES = [1000, 2000, 3000, 5000, 10000];

/** Updates owner-provided pricing and sets which products are confirmed (not samples). */
async function catalogV1(tx: Tx) {
  const products: ProductSpec[] = [
    {
      slug: "instagram-followers",
      category: "social-media",
      nameAr: "متابعين إنستغرام",
      nameEn: "Instagram Followers",
      summaryAr: "كل 1,000 متابع بـ 5,000 دينار.",
      summaryEn: "5,000 IQD per 1,000 followers.",
      descriptionAr: "اختر الباقة وأدخل رابط حسابك العام. يبدأ التنفيذ بعد تأكيد الدفع.\n\nلا نطلب كلمة المرور أو رمز التحقق أبداً.",
      descriptionEn: "Choose a package and enter your public profile link. Work starts after payment is confirmed.\n\nWe never ask for a password or verification code.",
      icon: "users",
      deliveryTimeAr: "من 1 إلى 48 ساعة",
      deliveryTimeEn: "1 to 48 hours",
      isFeatured: true,
      sortOrder: 10,
      mode: "package",
      packages: packs(SIZES, 5000, "متابع", "followers"),
      maxPackages: 10,
      fields: [{ key: "profile_url", labelAr: "رابط الحساب", labelEn: "Profile link", type: "url", required: true, maxLength: 300, ...noPassword }],
    },
    {
      slug: "tiktok-followers",
      category: "social-media",
      nameAr: "متابعين تيك توك",
      nameEn: "TikTok Followers",
      summaryAr: "كل 1,000 متابع بـ 5,000 دينار.",
      summaryEn: "5,000 IQD per 1,000 followers.",
      descriptionAr: "اختر الباقة وأدخل رابط حسابك العام على تيك توك. يبدأ التنفيذ بعد تأكيد الدفع.\n\nلا نطلب كلمة المرور أو رمز التحقق أبداً.",
      descriptionEn: "Choose a package and enter your public TikTok profile link. Work starts after payment is confirmed.\n\nWe never ask for a password or verification code.",
      icon: "users",
      deliveryTimeAr: "من 1 إلى 48 ساعة",
      deliveryTimeEn: "1 to 48 hours",
      isFeatured: true,
      sortOrder: 11,
      mode: "package",
      packages: packs(SIZES, 5000, "متابع", "followers"),
      maxPackages: 10,
      fields: [{ key: "profile_url", labelAr: "رابط الحساب", labelEn: "Profile link", type: "url", required: true, maxLength: 300, ...noPassword }],
    },
    {
      slug: "telegram-members",
      category: "social-media",
      nameAr: "متابعين (أعضاء) تلكرام",
      nameEn: "Telegram Members",
      summaryAr: "كل 1,000 عضو بـ 5,000 دينار لقناتك أو مجموعتك.",
      summaryEn: "5,000 IQD per 1,000 members for your channel or group.",
      descriptionAr: "اختر الباقة وأدخل رابط قناتك أو مجموعتك العامة على تلكرام. يبدأ التنفيذ بعد تأكيد الدفع.",
      descriptionEn: "Choose a package and enter the link to your public Telegram channel or group. Work starts after payment is confirmed.",
      icon: "chat",
      deliveryTimeAr: "من 1 إلى 48 ساعة",
      deliveryTimeEn: "1 to 48 hours",
      isFeatured: false,
      sortOrder: 12,
      mode: "package",
      packages: packs(SIZES, 5000, "عضو", "members"),
      maxPackages: 10,
      fields: [
        {
          key: "channel_url",
          labelAr: "رابط القناة أو المجموعة",
          labelEn: "Channel or group link",
          type: "url",
          required: true,
          maxLength: 300,
          helpAr: "مثال: https://t.me/اسم_القناة — يجب أن تكون عامة.",
          helpEn: "Example: https://t.me/your_channel — it must be public.",
        },
      ],
    },
    {
      slug: "instagram-likes",
      category: "social-media",
      nameAr: "لايكات إنستغرام",
      nameEn: "Instagram Likes",
      summaryAr: "كل 1,000 لايك بـ 1,000 دينار.",
      summaryEn: "1,000 IQD per 1,000 likes.",
      descriptionAr: "اختر الباقة وأدخل رابط المنشور العام.",
      descriptionEn: "Choose a package and enter the public post link.",
      icon: "heart",
      deliveryTimeAr: "من 1 إلى 24 ساعة",
      deliveryTimeEn: "1 to 24 hours",
      isFeatured: true,
      sortOrder: 20,
      mode: "package",
      packages: packs(SIZES, 1000, "لايك", "likes"),
      maxPackages: 10,
      fields: [{ key: "post_url", labelAr: "رابط المنشور", labelEn: "Post link", type: "url", required: true, maxLength: 300, ...noPassword }],
    },
    {
      slug: "tiktok-likes",
      category: "social-media",
      nameAr: "لايكات تيك توك",
      nameEn: "TikTok Likes",
      summaryAr: "كل 1,000 لايك بـ 1,000 دينار.",
      summaryEn: "1,000 IQD per 1,000 likes.",
      descriptionAr: "اختر الباقة وأدخل رابط الفيديو العام.",
      descriptionEn: "Choose a package and enter the public video link.",
      icon: "heart",
      deliveryTimeAr: "من 1 إلى 24 ساعة",
      deliveryTimeEn: "1 to 24 hours",
      isFeatured: false,
      sortOrder: 21,
      mode: "package",
      packages: packs(SIZES, 1000, "لايك", "likes"),
      maxPackages: 10,
      fields: [{ key: "video_url", labelAr: "رابط الفيديو", labelEn: "Video link", type: "url", required: true, maxLength: 300, ...noPassword }],
    },
    {
      slug: "pubg-mobile-uc",
      category: "gaming",
      nameAr: "شدات ببجي موبايل (UC)",
      nameEn: "PUBG Mobile UC",
      summaryAr: "شحن شدات ببجي موبايل برقم اللاعب (ID) فقط.",
      summaryEn: "PUBG Mobile UC top-up using your player ID only.",
      descriptionAr:
        "اختر الباقة وأدخل رقم اللاعب (Player ID) بدقة. لا نطلب كلمة مرور الحساب أو تسجيل الدخول.\n\nتأكد من رقم اللاعب قبل الطلب؛ الشحن لرقم خاطئ قد لا يكون قابلاً للاسترجاع.",
      descriptionEn:
        "Choose a package and enter your exact Player ID. We never ask for your account password or login.\n\nDouble-check the ID; top-ups sent to a wrong ID may not be refundable.",
      icon: "gamepad",
      deliveryTimeAr: "من 15 دقيقة إلى 6 ساعات بعد تأكيد الدفع",
      deliveryTimeEn: "15 minutes to 6 hours after payment confirmation",
      isFeatured: true,
      sortOrder: 10,
      mode: "package",
      packages: [
        [24, 1000],
        [48, 2000],
        [96, 4000],
        [144, 5000],
        [248, 8000],
        [500, 14000],
        [852, 25000],
      ].map(([uc, price]) => ({ labelAr: `${uc} شدة`, labelEn: `${uc} UC`, price: price! })),
      maxPackages: 10,
      fields: [
        {
          key: "player_id",
          labelAr: "رقم اللاعب (Player ID)",
          labelEn: "Player ID",
          helpAr: "تجده في ملفك الشخصي داخل اللعبة.",
          helpEn: "Found on your in-game profile.",
          type: "number",
          required: true,
          maxLength: 20,
        },
        { key: "player_name", labelAr: "اسم اللاعب (للتأكيد)", labelEn: "Player name (for verification)", type: "text", required: false, maxLength: 40 },
      ],
    },
    {
      slug: "whatsapp-telegram-number",
      category: "accounts-numbers",
      nameAr: "رقم لتفعيل واتساب أو تلكرام",
      nameEn: "Number for WhatsApp or Telegram activation",
      summaryAr: "رقم واحد بـ 5,000 دينار لتفعيل حسابك الخاص.",
      summaryEn: "5,000 IQD per number to activate your own account.",
      descriptionAr:
        "رقم لتفعيل حساب واتساب أو تلكرام خاص بك. بعد تأكيد الدفع يرسل لك فريق الدعم الرقم ورمز التفعيل عبر المحادثة.\n\n- للاستخدام المشروع فقط ووفق شروط التطبيق والقوانين.\n- يُمنع استخدامه للاحتيال أو الإزعاج أو انتحال الشخصية، ويحق للمتجر رفض الطلب.\n- لا نطلب منك أي كلمة مرور.",
      descriptionEn:
        "A number to activate your own WhatsApp or Telegram account. After payment is confirmed, support sends you the number and the activation code in chat.\n\n- Lawful use only, in line with the app's terms and the law.\n- Not for fraud, spam or impersonation; the store may refuse any order.\n- We never ask for any password.",
      icon: "phone",
      deliveryTimeAr: "خلال ساعة بعد تأكيد الدفع",
      deliveryTimeEn: "Within an hour after payment confirmation",
      isFeatured: false,
      sortOrder: 5,
      mode: "unit",
      unitPrice: 5000,
      min: 1,
      max: 5,
      fields: [
        {
          key: "platform",
          labelAr: "التطبيق",
          labelEn: "App",
          type: "select",
          required: true,
          maxLength: 20,
          options: [
            { value: "whatsapp", labelAr: "واتساب", labelEn: "WhatsApp" },
            { value: "telegram", labelAr: "تلكرام", labelEn: "Telegram" },
          ],
        },
      ],
    },
  ];

  const cats = await tx.select({ id: schema.categories.id, slug: schema.categories.slug }).from(schema.categories);
  const catId = new Map(cats.map((c) => [c.slug, c.id]));

  for (const spec of products) {
    const categoryId = catId.get(spec.category);
    if (!categoryId) throw new Error(`category ${spec.category} missing`);
    const values = {
      categoryId,
      slug: spec.slug,
      nameAr: spec.nameAr,
      nameEn: spec.nameEn,
      summaryAr: spec.summaryAr,
      summaryEn: spec.summaryEn,
      descriptionAr: spec.descriptionAr,
      descriptionEn: spec.descriptionEn,
      icon: spec.icon,
      deliveryTimeAr: spec.deliveryTimeAr,
      deliveryTimeEn: spec.deliveryTimeEn,
      isFeatured: spec.isFeatured,
      isActive: true,
      isSample: false,
      sortOrder: spec.sortOrder,
      compareAtPrice: null,
      ...(spec.mode === "package"
        ? { pricingMode: "package" as const, unitPrice: null, minQuantity: 1, maxQuantity: spec.maxPackages }
        : { pricingMode: "unit" as const, unitPrice: spec.unitPrice, minQuantity: spec.min, maxQuantity: spec.max }),
    };
    const existing = await tx.query.products.findFirst({ where: eq(schema.products.slug, spec.slug) });
    const id = existing
      ? (await tx.update(schema.products).set(values).where(eq(schema.products.id, existing.id)).returning({ id: schema.products.id }))[0]!.id
      : (await tx.insert(schema.products).values(values).returning({ id: schema.products.id }))[0]!.id;

    // Replace pricing and fields. Past order items keep their own name/price snapshots.
    await tx.delete(schema.productPackages).where(eq(schema.productPackages.productId, id));
    await tx.delete(schema.priceTiers).where(eq(schema.priceTiers.productId, id));
    await tx.delete(schema.productFields).where(eq(schema.productFields.productId, id));
    if (spec.mode === "package") {
      await tx.insert(schema.productPackages).values(spec.packages.map((p, i) => ({ ...p, productId: id, sortOrder: i })));
    }
    await tx.insert(schema.productFields).values(spec.fields.map((f, i) => ({ ...f, productId: id, sortOrder: i })));
  }

  // The owner approved the existing design prices: they are no longer samples.
  await tx
    .update(schema.products)
    .set({ isSample: false })
    .where(inArray(schema.products.slug, ["social-post-design", "ad-banner-design", "poster-design"]));
}

/** Owner round 2: TikTok views pricing, real payment details, hide unpriced samples. */
async function catalogV2(tx: Tx) {
  const views = await tx.query.products.findFirst({ where: eq(schema.products.slug, "tiktok-views") });
  if (views) {
    await tx
      .update(schema.products)
      .set({
        pricingMode: "package",
        unitPrice: null,
        compareAtPrice: null,
        minQuantity: 1,
        maxQuantity: 10,
        isSample: false,
        isActive: true,
        summaryAr: "كل 1,000 مشاهدة بـ 1,000 دينار.",
        summaryEn: "1,000 IQD per 1,000 views.",
        descriptionAr: "اختر الباقة وأدخل رابط الفيديو العام على تيك توك.",
        descriptionEn: "Choose a package and enter the public TikTok video link.",
      })
      .where(eq(schema.products.id, views.id));
    await tx.delete(schema.priceTiers).where(eq(schema.priceTiers.productId, views.id));
    await tx.delete(schema.productPackages).where(eq(schema.productPackages.productId, views.id));
    await tx.insert(schema.productPackages).values(packs(SIZES, 1000, "مشاهدة", "views").map((p, i) => ({ ...p, productId: views.id, sortOrder: i })));
  }

  // Not offered by the store: delete, or deactivate if an order already references it.
  const music = await tx.query.products.findFirst({ where: eq(schema.products.slug, "music-app-subscription") });
  if (music) {
    const used = await tx.query.orderItems.findFirst({ where: eq(schema.orderItems.productId, music.id) });
    if (used) await tx.update(schema.products).set({ isActive: false, isFeatured: false }).where(eq(schema.products.id, music.id));
    else await tx.delete(schema.products).where(eq(schema.products.id, music.id));
  }

  // Samples without a confirmed price are hidden until the owner sets real prices in the dashboard.
  await tx
    .update(schema.products)
    .set({ isActive: false, isFeatured: false })
    .where(inArray(schema.products.slug, ["free-fire-diamonds", "design-tool-subscription", "business-profile-setup"]));

  const methods: { code: string; nameAr: string; nameEn: string; accountDetails: string; instructionsAr: string; instructionsEn: string }[] = [
    {
      code: "zain_cash",
      nameAr: "زين كاش",
      nameEn: "Zain Cash",
      accountDetails: "07757382822",
      instructionsAr: "حوّل المبلغ المطلوب إلى رقم زين كاش 07757382822، ثم أرسل رقم العملية أو صورة الإيصال من صفحة الطلب.",
      instructionsEn: "Transfer the amount due to Zain Cash number 07757382822, then send the transaction number or a receipt photo from the order page.",
    },
    {
      code: "asiacell",
      nameAr: "آسياسيل",
      nameEn: "AsiaCell",
      accountDetails: "07757382822",
      instructionsAr: "حوّل المبلغ (رصيد آسياسيل) إلى الرقم 07757382822، ثم أرسل لقطة شاشة للتحويل من صفحة الطلب.",
      instructionsEn: "Transfer the amount (AsiaCell credit) to 07757382822, then send a screenshot of the transfer from the order page.",
    },
    {
      code: "mastercard",
      nameAr: "ماستركارد",
      nameEn: "Mastercard",
      accountDetails: "2025988359",
      instructionsAr: "حوّل المبلغ إلى رقم الماستر كارد 2025988359 من تطبيق مصرفك، ثم أرسل صورة الإيصال من صفحة الطلب. لا تشارك رقم بطاقتك أو الرمز السري مع أي أحد.",
      instructionsEn: "Transfer the amount to Mastercard number 2025988359 from your banking app, then send the receipt photo from the order page. Never share your own card number or PIN with anyone.",
    },
  ];
  for (const m of methods) {
    await tx
      .update(schema.paymentMethods)
      // Either a transaction number or a receipt photo is enough.
      .set({ ...m, isEnabled: true, requiresReference: false, allowsReceipt: true })
      .where(eq(schema.paymentMethods.code, m.code));
  }
}

const UPDATES: { id: string; run: (tx: Tx) => Promise<void> }[] = [
  { id: "2026-10-26-catalog-v1", run: catalogV1 },
  { id: "2026-10-26-catalog-v2", run: catalogV2 },
];

const KEY = "content_updates";

export async function applyContentUpdates(url: string) {
  const pool = new Pool({ connectionString: url, max: 1 });
  const db = drizzle({ client: pool, schema });
  try {
    for (const update of UPDATES) {
      await db.transaction(async (tx) => {
        // Lock the bookkeeping row so concurrent deploys cannot apply an update twice.
        await tx.insert(schema.storeSettings).values({ key: KEY, value: [] }).onConflictDoNothing();
        const [row] = await tx.select().from(schema.storeSettings).where(eq(schema.storeSettings.key, KEY)).for("update");
        const applied = Array.isArray(row?.value) ? (row.value as string[]) : [];
        if (applied.includes(update.id)) {
          console.log(`content update ${update.id}: already applied`);
          return;
        }
        await update.run(tx);
        await tx.update(schema.storeSettings).set({ value: [...applied, update.id] }).where(eq(schema.storeSettings.key, KEY));
        console.log(`content update ${update.id}: applied`);
      });
    }
  } finally {
    await pool.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set");
    process.exit(1);
  }
  applyContentUpdates(url).catch((e) => {
    console.error("Content update failed:", e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
