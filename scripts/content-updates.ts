import "dotenv/config";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../src/lib/db/schema";
import { defaultPolicies, privacyAdditions } from "../src/lib/i18n/content";

/*
 * One-time catalog updates supplied by the store owner, applied during deploy
 * (see "deploy:build"). Each update runs once in a transaction; its id is then
 * recorded in store_settings so later edits made in the admin dashboard are
 * never overwritten by a redeploy.
 */

type Db = ReturnType<typeof drizzle<typeof schema>>;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
type Pkg = { labelAr: string; labelEn: string; price: number; compareAtPrice?: number | null };
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
} & ({ mode: "package"; packages: Pkg[]; maxPackages: number } | { mode: "unit"; unitPrice: number; compareAtPrice?: number | null; min: number; max: number });

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

/** Inserts or updates products by slug, replacing their packages, tiers and fields. */
async function upsertProducts(tx: Tx, products: ProductSpec[]) {
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
      compareAtPrice: spec.mode === "unit" ? (spec.compareAtPrice ?? null) : null,
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
    if (spec.fields.length) await tx.insert(schema.productFields).values(spec.fields.map((f, i) => ({ ...f, productId: id, sortOrder: i })));
  }

}

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

  await upsertProducts(tx, products);

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

/**
 * A real ~5% promotional discount, rounded to the nearest 1,000 IQD (the owner wants whole
 * thousands only). When rounding leaves no discount, the package keeps its list price.
 */
function promo(listPrice: number) {
  const discounted = Math.round((listPrice * 0.95) / 1000) * 1000;
  return discounted >= 1000 && discounted < listPrice ? { price: discounted, compareAtPrice: listPrice } : { price: listPrice, compareAtPrice: null };
}

const emailField = (ar: string, en: string): Field => ({
  key: "account_email",
  labelAr: ar,
  labelEn: en,
  helpAr: "نحتاج البريد فقط. لن نطلب كلمة المرور أبداً.",
  helpEn: "We only need the email. We never ask for your password.",
  type: "text",
  required: true,
  maxLength: 120,
});
const telegramUser: Field = {
  key: "telegram_username",
  labelAr: "معرّف تلكرام (username)",
  labelEn: "Telegram username",
  helpAr: "مثال: @username — لن نطلب رمز التحقق أو كلمة المرور.",
  helpEn: "Example: @username — we never ask for a login code or password.",
  type: "text",
  required: true,
  maxLength: 40,
};
const subscriptionNote = {
  ar: "\n\nيتم التفعيل بالتنسيق مع الدعم بعد تأكيد الدفع. لا نطلب كلمة المرور أو رمز التحقق أبداً.",
  en: "\n\nActivation is arranged with support after payment is confirmed. We never ask for your password or verification code.",
};

/** Owner round 3: full catalog with Ludo, Facebook, subscriptions, Telegram, promotion, designs, exchange. */
async function catalogV3(tx: Tx) {
  // Categories: clearer names, a new balance-exchange category, and a deliberate order.
  const cats: (typeof schema.categories.$inferInsert)[] = [
    { slug: "social-media", nameAr: "خدمات السوشل ميديا", nameEn: "Social Media Services", descriptionAr: "متابعين، لايكات، مشاهدات وترويج لإنستغرام وتيك توك وفيسبوك وتلكرام.", descriptionEn: "Followers, likes, views and promotion for Instagram, TikTok, Facebook and Telegram.", icon: "users", sortOrder: 10 },
    { slug: "gaming", nameAr: "شحن الألعاب", nameEn: "Game Top-ups", descriptionAr: "شدات ببجي وألماس وذهب لودو ستار برقم اللاعب فقط. حسابات بيس تبدأ من 10,000 دينار عبر طلب خدمة خاصة.", descriptionEn: "PUBG UC and Ludo Star diamonds and gold using your player ID only. PES accounts from 10,000 IQD via a custom request.", icon: "gamepad", sortOrder: 20 },
    { slug: "subscriptions", nameAr: "الاشتراكات الرقمية", nameEn: "Digital Subscriptions", descriptionAr: "ChatGPT وGemini وClaude وتلكرام بريميوم واشتراك iPhone Plus.", descriptionEn: "ChatGPT, Gemini, Claude, Telegram Premium and iPhone Plus.", icon: "tv", sortOrder: 30 },
    { slug: "design", nameAr: "التصاميم", nameEn: "Design", descriptionAr: "تصاميم سوشل ميديا، بنرات، بوسترات، وتصاميم المواكب والحسينيات.", descriptionEn: "Social media designs, banners, posters, and designs for processions and Husseiniyas.", icon: "palette", sortOrder: 40 },
    { slug: "accounts-numbers", nameAr: "الأرقام والحسابات", nameEn: "Numbers & Accounts", descriptionAr: "أرقام لتفعيل واتساب وتلكرام وتجهيز الحسابات حسب الطلب. للاستخدام المشروع فقط.", descriptionEn: "Numbers for WhatsApp and Telegram activation and account setup on request. Lawful use only.", icon: "phone", sortOrder: 50 },
    { slug: "balance-exchange", nameAr: "تبديل الرصيد", nameEn: "Balance Exchange", descriptionAr: "تبديل بين آسياسيل وزين كاش وماستر كارد بكل الاتجاهات. اطلب الخدمة واكتب المبلغ والاتجاه، ونرد عليك بالسعر.", descriptionEn: "Exchange between AsiaCell, Zain Cash and Mastercard in any direction. Request it with the amount and direction and we reply with the rate.", icon: "card", sortOrder: 55 },
    { slug: "custom", nameAr: "خدمات خاصة", nameEn: "Custom Services", descriptionAr: "أي خدمة غير موجودة؟ اطلبها ونرد عليك بعرض.", descriptionEn: "Need something not listed? Request it and we will reply with an offer.", icon: "wand", sortOrder: 60 },
  ];
  for (const c of cats) {
    await tx.insert(schema.categories).values(c).onConflictDoUpdate({
      target: schema.categories.slug,
      set: { nameAr: c.nameAr, nameEn: c.nameEn, descriptionAr: c.descriptionAr, descriptionEn: c.descriptionEn, icon: c.icon, sortOrder: c.sortOrder, isActive: true },
    });
  }

  // Facebook: 1,000 = 3,000, 2,000 = 5,000, then +2,000 IQD per extra 1,000.
  const fbPrice = (k: number) => 3000 + (k / 1000 - 1) * 2000;
  const products: ProductSpec[] = [
    {
      slug: "facebook-followers", category: "social-media",
      nameAr: "متابعين فيسبوك", nameEn: "Facebook Followers",
      summaryAr: "1,000 متابع بـ 3,000 دينار فقط.", summaryEn: "1,000 followers for just 3,000 IQD.",
      descriptionAr: "اختر الباقة وأدخل رابط صفحتك أو حسابك العام على فيسبوك. يبدأ التنفيذ بعد تأكيد الدفع.\n\nلا نطلب كلمة المرور أبداً.",
      descriptionEn: "Choose a package and enter your public Facebook page or profile link. Work starts after payment is confirmed.\n\nWe never ask for your password.",
      icon: "users", deliveryTimeAr: "من 1 إلى 48 ساعة", deliveryTimeEn: "1 to 48 hours", isFeatured: false, sortOrder: 12,
      mode: "package", maxPackages: 10,
      packages: SIZES.map((k) => ({ labelAr: `${n(k)} متابع`, labelEn: `${n(k)} followers`, price: fbPrice(k) })),
      fields: [{ key: "profile_url", labelAr: "رابط الصفحة أو الحساب", labelEn: "Page or profile link", type: "url", required: true, maxLength: 300, ...noPassword }],
    },
    {
      slug: "social-promotion", category: "social-media",
      nameAr: "ترويج ممول (إنستغرام / تيك توك / فيسبوك)", nameEn: "Paid Promotion (Instagram / TikTok / Facebook)",
      summaryAr: "باقة البداية بـ 10,000 دينار، والحملات الأكبر حسب الطلب.", summaryEn: "Starter package 10,000 IQD; bigger campaigns on request.",
      descriptionAr: "نروّج منشورك أو حسابك للجمهور اللي تختاره. باقة البداية بـ 10,000 دينار، وكل 10,000 إضافية تكبّر الحملة (الكمية = عدد الباقات).\n\nللحملات الخاصة اطلب «خدمة خاصة» ونرسل لك عرضاً.",
      descriptionEn: "We promote your post or account to the audience you choose. The starter package is 10,000 IQD; each extra 10,000 grows the campaign (quantity = number of packages).\n\nFor special campaigns, send a custom request and we will send an offer.",
      icon: "megaphone", deliveryTimeAr: "تبدأ الحملة خلال 24 ساعة", deliveryTimeEn: "Campaign starts within 24 hours", isFeatured: false, sortOrder: 30,
      mode: "unit", unitPrice: 10000, min: 1, max: 20,
      fields: [
        { key: "platform", labelAr: "المنصة", labelEn: "Platform", type: "select", required: true, maxLength: 20, options: [
          { value: "instagram", labelAr: "إنستغرام", labelEn: "Instagram" },
          { value: "tiktok", labelAr: "تيك توك", labelEn: "TikTok" },
          { value: "facebook", labelAr: "فيسبوك", labelEn: "Facebook" },
        ] },
        { key: "post_url", labelAr: "رابط المنشور أو الحساب", labelEn: "Post or account link", type: "url", required: true, maxLength: 300 },
        { key: "audience", labelAr: "الجمهور المستهدف (المدينة، العمر، الاهتمامات)", labelEn: "Target audience (city, age, interests)", type: "textarea", required: false, maxLength: 1000 },
      ],
    },
    {
      slug: "pubg-mobile-uc", category: "gaming",
      nameAr: "شدات ببجي موبايل (UC)", nameEn: "PUBG Mobile UC",
      summaryAr: "خصم 5% على كل الباقات — شحن برقم اللاعب فقط.", summaryEn: "5% off every package — top-up with your player ID only.",
      descriptionAr: "اختر الباقة وأدخل رقم اللاعب (Player ID) بدقة. لا نطلب كلمة مرور الحساب أو تسجيل الدخول.\n\nتأكد من رقم اللاعب قبل الطلب؛ الشحن لرقم خاطئ قد لا يكون قابلاً للاسترجاع.",
      descriptionEn: "Choose a package and enter your exact Player ID. We never ask for your account password or login.\n\nDouble-check the ID; top-ups sent to a wrong ID may not be refundable.",
      icon: "gamepad", deliveryTimeAr: "من 15 دقيقة إلى 6 ساعات بعد تأكيد الدفع", deliveryTimeEn: "15 minutes to 6 hours after payment confirmation", isFeatured: true, sortOrder: 10,
      mode: "package", maxPackages: 10,
      packages: ([[24, 1000], [48, 2000], [96, 4000], [144, 5000], [248, 8000], [500, 14000], [852, 25000]] as const).map(([uc, p]) => ({ labelAr: `${uc} شدة`, labelEn: `${uc} UC`, ...promo(p) })),
      fields: [
        { key: "player_id", labelAr: "رقم اللاعب (Player ID)", labelEn: "Player ID", helpAr: "تجده في ملفك الشخصي داخل اللعبة.", helpEn: "Found on your in-game profile.", type: "number", required: true, maxLength: 20 },
        { key: "player_name", labelAr: "اسم اللاعب (للتأكيد)", labelEn: "Player name (for verification)", type: "text", required: false, maxLength: 40 },
      ],
    },
    ...(["diamonds", "gold"] as const).map((kind, idx): ProductSpec => ({
      slug: `ludo-star-${kind}`, category: "gaming",
      nameAr: kind === "diamonds" ? "لودو ستار — ألماس" : "لودو ستار — ذهب",
      nameEn: kind === "diamonds" ? "Ludo Star — Diamonds" : "Ludo Star — Gold",
      summaryAr: "خصم 5% على كل الباقات — شحن برقم اللاعب.", summaryEn: "5% off every package — top-up with your player ID.",
      descriptionAr: "اختر الباقة وأدخل رقم اللاعب (ID) في لودو ستار. لا نطلب كلمة المرور أو تسجيل الدخول.",
      descriptionEn: "Choose a package and enter your Ludo Star player ID. We never ask for your password or login.",
      icon: kind === "diamonds" ? "gem" : "spark", deliveryTimeAr: "من 15 دقيقة إلى 6 ساعات بعد تأكيد الدفع", deliveryTimeEn: "15 minutes to 6 hours after payment confirmation",
      isFeatured: kind === "diamonds", sortOrder: 20 + idx, mode: "package", maxPackages: 10,
      packages: (kind === "diamonds"
        ? [[405, 3000], [810, 4000], [2280, 10000], [5080, 20000]]
        : [[33340, 3000], [66680, 5000], [219500, 10000], [1443000, 20000]]
      ).map(([q, p]) => ({ labelAr: `${n(q!)} ${kind === "diamonds" ? "ألماسة" : "ذهب"}`, labelEn: `${n(q!)} ${kind === "diamonds" ? "diamonds" : "gold"}`, ...promo(p!) })),
      fields: [
        { key: "player_id", labelAr: "رقم اللاعب (ID)", labelEn: "Player ID", helpAr: "تجده في ملفك الشخصي داخل اللعبة.", helpEn: "Found on your in-game profile.", type: "number", required: true, maxLength: 20 },
        { key: "player_name", labelAr: "اسم اللاعب (للتأكيد)", labelEn: "Player name (for verification)", type: "text", required: false, maxLength: 40 },
      ],
    })),
    {
      slug: "chatgpt-plus", category: "subscriptions",
      nameAr: "اشتراك ChatGPT Plus", nameEn: "ChatGPT Plus Subscription",
      summaryAr: "الاشتراك الاحترافي — 30,000 دينار.", summaryEn: "The pro plan — 30,000 IQD.",
      descriptionAr: "اشتراك ChatGPT Plus بمميزات احترافية أعلى من اشتراك Go." + subscriptionNote.ar,
      descriptionEn: "ChatGPT Plus with more advanced features than the Go plan." + subscriptionNote.en,
      icon: "chat", deliveryTimeAr: "خلال 24 ساعة", deliveryTimeEn: "Within 24 hours", isFeatured: true, sortOrder: 10,
      mode: "package", maxPackages: 3, packages: [{ labelAr: "شهر واحد", labelEn: "1 month", price: 30000 }],
      fields: [emailField("بريد حساب ChatGPT", "ChatGPT account email")],
    },
    {
      slug: "chatgpt-go", category: "subscriptions",
      nameAr: "اشتراك ChatGPT Go", nameEn: "ChatGPT Go Subscription",
      summaryAr: "اشتراك اقتصادي — 10,000 دينار.", summaryEn: "Budget plan — 10,000 IQD.",
      descriptionAr: "اشتراك ChatGPT Go بسعر أقل ومميزات أقل من Plus." + subscriptionNote.ar,
      descriptionEn: "ChatGPT Go: lower price, fewer features than Plus." + subscriptionNote.en,
      icon: "chat", deliveryTimeAr: "خلال 24 ساعة", deliveryTimeEn: "Within 24 hours", isFeatured: false, sortOrder: 11,
      mode: "package", maxPackages: 3, packages: [{ labelAr: "شهر واحد", labelEn: "1 month", price: 10000 }],
      fields: [emailField("بريد حساب ChatGPT", "ChatGPT account email")],
    },
    {
      slug: "gemini", category: "subscriptions",
      nameAr: "اشتراك Gemini", nameEn: "Gemini Subscription",
      summaryAr: "شهر بـ 5,000 أو سنة بـ 25,000 دينار.", summaryEn: "1 month 5,000 or 1 year 25,000 IQD.",
      descriptionAr: "اشتراك Gemini من Google." + subscriptionNote.ar,
      descriptionEn: "Google Gemini subscription." + subscriptionNote.en,
      icon: "spark", deliveryTimeAr: "خلال 24 ساعة", deliveryTimeEn: "Within 24 hours", isFeatured: false, sortOrder: 12,
      mode: "package", maxPackages: 3, packages: [{ labelAr: "شهر واحد", labelEn: "1 month", price: 5000 }, { labelAr: "سنة كاملة", labelEn: "1 year", price: 25000 }],
      fields: [emailField("بريد حساب Google", "Google account email")],
    },
    {
      slug: "claude", category: "subscriptions",
      nameAr: "اشتراك Claude (شهري)", nameEn: "Claude Subscription (monthly)",
      summaryAr: "اشتراك شهري — 30,000 دينار.", summaryEn: "Monthly — 30,000 IQD.",
      descriptionAr: "اشتراك Claude الشهري." + subscriptionNote.ar,
      descriptionEn: "Monthly Claude subscription." + subscriptionNote.en,
      icon: "spark", deliveryTimeAr: "خلال 24 ساعة", deliveryTimeEn: "Within 24 hours", isFeatured: false, sortOrder: 13,
      mode: "package", maxPackages: 3, packages: [{ labelAr: "شهر واحد", labelEn: "1 month", price: 30000 }],
      fields: [emailField("بريد حساب Claude", "Claude account email")],
    },
    {
      slug: "iphone-plus-yearly", category: "subscriptions",
      nameAr: "اشتراك iPhone Plus (سنوي)", nameEn: "iPhone Plus Subscription (yearly)",
      summaryAr: "سنة كاملة بـ 25,000 دينار.", summaryEn: "A full year for 25,000 IQD.",
      descriptionAr: "اشتراك iPhone Plus لمدة سنة (لا يتوفر اشتراك شهري)." + subscriptionNote.ar,
      descriptionEn: "iPhone Plus for one year (no monthly plan available)." + subscriptionNote.en,
      icon: "phone", deliveryTimeAr: "خلال 24 ساعة", deliveryTimeEn: "Within 24 hours", isFeatured: false, sortOrder: 14,
      mode: "package", maxPackages: 3, packages: [{ labelAr: "سنة كاملة", labelEn: "1 year", price: 25000 }],
      fields: [emailField("بريد Apple ID", "Apple ID email")],
    },
    {
      slug: "telegram-premium", category: "subscriptions",
      nameAr: "تلكرام بريميوم (النجمة)", nameEn: "Telegram Premium",
      summaryAr: "النجمة وأسماء مميزة — من 10,000 دينار للشهر.", summaryEn: "Star badge and name styles — from 10,000 IQD a month.",
      descriptionAr: "تفعيل تلكرام بريميوم (النجمة، أنماط أسماء مختلفة وباقي المميزات) على حسابك مباشرة بمعرّفك فقط." + subscriptionNote.ar,
      descriptionEn: "Telegram Premium (star badge, name styles and all premium features) activated on your account using only your username." + subscriptionNote.en,
      icon: "chat", deliveryTimeAr: "خلال ساعة بعد تأكيد الدفع", deliveryTimeEn: "Within an hour after payment confirmation", isFeatured: true, sortOrder: 20,
      mode: "package", maxPackages: 3,
      packages: [
        { labelAr: "شهر واحد", labelEn: "1 month", price: 10000 },
        { labelAr: "3 أشهر", labelEn: "3 months", price: 22000 },
        { labelAr: "6 أشهر", labelEn: "6 months", price: 30000 },
        { labelAr: "سنة كاملة", labelEn: "1 year", price: 55000 },
      ],
      fields: [telegramUser],
    },
    {
      slug: "telegram-stars", category: "subscriptions",
      nameAr: "نجوم تلكرام", nameEn: "Telegram Stars",
      summaryAr: "100 نجمة بـ 3,000 دينار — وكميات أكبر حسب الطلب.", summaryEn: "100 Stars for 3,000 IQD — larger amounts on request.",
      descriptionAr: "نجوم تلكرام ترسل لحسابك بمعرّفك فقط. للكميات الأكبر اطلب «خدمة خاصة».",
      descriptionEn: "Telegram Stars sent to your account using only your username. For larger amounts, send a custom request.",
      icon: "spark", deliveryTimeAr: "خلال ساعة بعد تأكيد الدفع", deliveryTimeEn: "Within an hour after payment confirmation", isFeatured: false, sortOrder: 21,
      mode: "package", maxPackages: 5,
      packages: [
        { labelAr: "100 نجمة", labelEn: "100 Stars", price: 3000 },
        { labelAr: "250 نجمة", labelEn: "250 Stars", price: 8000 },
        { labelAr: "500 نجمة", labelEn: "500 Stars", price: 15000 },
      ],
      fields: [telegramUser],
    },
    {
      slug: "procession-design", category: "design",
      nameAr: "تصاميم المواكب والحسينيات", nameEn: "Procession & Husseiniya Designs",
      summaryAr: "5,000 دينار للتصميم الواحد حسب المتطلبات.", summaryEn: "5,000 IQD per design, depending on requirements.",
      descriptionAr: "تصاميم للمواكب والحسينيات والمناسبات الدينية: بوسترات، لافتات، وتصاميم سوشل ميديا. السعر للتصميم الواحد، والطلبات المعقدة يُتفق عليها مع الدعم.",
      descriptionEn: "Designs for processions, Husseiniyas and religious occasions: posters, banners and social media designs. Price is per design; complex requests are agreed with support.",
      icon: "image", deliveryTimeAr: "من 1 إلى 3 أيام", deliveryTimeEn: "1 to 3 days", isFeatured: false, sortOrder: 5,
      mode: "unit", unitPrice: 5000, min: 1, max: 30,
      fields: [
        { key: "brief", labelAr: "تفاصيل التصميم (الاسم، المناسبة، النصوص)", labelEn: "Design details (name, occasion, text)", type: "textarea", required: true, maxLength: 2000 },
        { key: "reference_url", labelAr: "رابط مرجعي", labelEn: "Reference link", type: "url", required: false, maxLength: 300 },
      ],
    },
  ];
  await upsertProducts(tx, products);

  // Featured on the homepage: a short, deliberate selection.
  await tx.update(schema.products).set({ isFeatured: false }).where(inArray(schema.products.slug, ["instagram-likes", "social-post-design"]));

  // Business profile setup: removed for now (deactivated instead if any order references it).
  const biz = await tx.query.products.findFirst({ where: eq(schema.products.slug, "business-profile-setup") });
  if (biz) {
    const used = await tx.query.orderItems.findFirst({ where: eq(schema.orderItems.productId, biz.id) });
    if (used) await tx.update(schema.products).set({ isActive: false }).where(eq(schema.products.id, biz.id));
    else await tx.delete(schema.products).where(eq(schema.products.id, biz.id));
  }
}

/** Owner round 4: every price must be a whole number of thousands (no 950, 1,500, 2,850 ...). */
async function catalogV4(tx: Tx) {
  const promoted = await tx.query.products.findMany({
    where: inArray(schema.products.slug, ["pubg-mobile-uc", "ludo-star-diamonds", "ludo-star-gold"]),
    with: { packages: true },
  });
  for (const product of promoted) {
    for (const pkg of product.packages) {
      const listPrice = pkg.compareAtPrice ?? pkg.price;
      await tx.update(schema.productPackages).set(promo(listPrice)).where(eq(schema.productPackages.id, pkg.id));
    }
    await tx
      .update(schema.products)
      .set({ summaryAr: "خصومات على الباقات الكبيرة — شحن برقم اللاعب فقط.", summaryEn: "Discounts on bigger packages — top-up with your player ID only." })
      .where(eq(schema.products.id, product.id));
  }
}

/**
 * Owner round 5: the promotion is a 5% BONUS QUANTITY (gift), not a price discount.
 * Prices return to the owner's list prices; each package label states the bonus,
 * e.g. "24 شدة + 1 هدية", so the order snapshot tells staff exactly what to deliver.
 * Packages are updated in place (same ids) so items already in customers' carts stay valid.
 */
async function catalogV5(tx: Tx) {
  const bonus = (q: number) => Math.max(1, Math.round(q * 0.05));
  const lines: Record<string, { q: number; price: number; ar: string; en: string }[]> = {
    "pubg-mobile-uc": ([[24, 1000], [48, 2000], [96, 4000], [144, 5000], [248, 8000], [500, 14000], [852, 25000]] as const).map(([q, price]) => ({ q, price, ar: "شدة", en: "UC" })),
    "ludo-star-diamonds": ([[405, 3000], [810, 4000], [2280, 10000], [5080, 20000]] as const).map(([q, price]) => ({ q, price, ar: "ألماسة", en: "diamonds" })),
    "ludo-star-gold": ([[33340, 3000], [66680, 5000], [219500, 10000], [1443000, 20000]] as const).map(([q, price]) => ({ q, price, ar: "ذهب", en: "gold" })),
  };
  for (const [slug, packs] of Object.entries(lines)) {
    const product = await tx.query.products.findFirst({ where: eq(schema.products.slug, slug), with: { packages: true } });
    if (!product) continue;
    const existing = [...product.packages].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
    for (let i = 0; i < packs.length; i++) {
      const p = packs[i]!;
      const row = {
        labelAr: `${n(p.q)} ${p.ar} + ${n(bonus(p.q))} هدية 🎁`,
        labelEn: `${n(p.q)} ${p.en} + ${n(bonus(p.q))} bonus 🎁`,
        price: p.price,
        compareAtPrice: null,
        isActive: true,
        sortOrder: i,
      };
      const current = existing[i];
      if (current) await tx.update(schema.productPackages).set(row).where(eq(schema.productPackages.id, current.id));
      else await tx.insert(schema.productPackages).values({ ...row, productId: product.id });
    }
    for (const extra of existing.slice(packs.length)) await tx.delete(schema.productPackages).where(eq(schema.productPackages.id, extra.id));
    await tx
      .update(schema.products)
      .set({ summaryAr: "🎁 هدية 5% إضافية من الكمية على كل باقة — بنفس السعر.", summaryEn: "🎁 5% extra quantity free on every package — same price." })
      .where(eq(schema.products.id, product.id));
  }
}

/**
 * Owner round 6: the store cannot deliver extra quantity, so the "bonus" labels are
 * removed (they promised something that would not be delivered). Instead each package
 * shows its genuine per-unit saving versus the smallest package, rounded down.
 */
async function catalogV6(tx: Tx) {
  const lines: Record<string, { q: number; price: number; ar: string; en: string }[]> = {
    "pubg-mobile-uc": ([[24, 1000], [48, 2000], [96, 4000], [144, 5000], [248, 8000], [500, 14000], [852, 25000]] as const).map(([q, price]) => ({ q, price, ar: "شدة", en: "UC" })),
    "ludo-star-diamonds": ([[405, 3000], [810, 4000], [2280, 10000], [5080, 20000]] as const).map(([q, price]) => ({ q, price, ar: "ألماسة", en: "diamonds" })),
    "ludo-star-gold": ([[33340, 3000], [66680, 5000], [219500, 10000], [1443000, 20000]] as const).map(([q, price]) => ({ q, price, ar: "ذهب", en: "gold" })),
  };
  for (const [slug, packs] of Object.entries(lines)) {
    const product = await tx.query.products.findFirst({ where: eq(schema.products.slug, slug), with: { packages: true } });
    if (!product) continue;
    const base = packs[0]!.price / packs[0]!.q; // IQD per unit in the smallest package
    const existing = [...product.packages].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
    for (let i = 0; i < packs.length; i++) {
      const p = packs[i]!;
      const saving = Math.floor((1 - p.price / p.q / base) * 100);
      const row = {
        labelAr: saving >= 10 ? `${n(p.q)} ${p.ar} — وفّر ${saving}%` : `${n(p.q)} ${p.ar}`,
        labelEn: saving >= 10 ? `${n(p.q)} ${p.en} — save ${saving}%` : `${n(p.q)} ${p.en}`,
        price: p.price,
        compareAtPrice: null,
        isActive: true,
        sortOrder: i,
      };
      const current = existing[i];
      if (current) await tx.update(schema.productPackages).set(row).where(eq(schema.productPackages.id, current.id));
      else await tx.insert(schema.productPackages).values({ ...row, productId: product.id });
    }
    for (const extra of existing.slice(packs.length)) await tx.delete(schema.productPackages).where(eq(schema.productPackages.id, extra.id));
    await tx
      .update(schema.products)
      .set({
        summaryAr: "كل ما كبرت الباقة كان سعر الوحدة أرخص — شحن برقم اللاعب فقط.",
        summaryEn: "The bigger the package, the cheaper each unit — top-up with your player ID only.",
      })
      .where(eq(schema.products.id, product.id));
  }
}

/** Owner round 7: service-specific terms and refund rules — only if the owner never edited the policies. */
async function catalogV7(tx: Tx) {
  const [row] = await tx.select().from(schema.storeSettings).where(eq(schema.storeSettings.key, "store")).for("update");
  if (!row) return;
  const value = row.value as Record<string, unknown>;
  if (typeof value.policiesUpdatedAt === "string" && value.policiesUpdatedAt !== "") return;
  await tx
    .update(schema.storeSettings)
    .set({
      value: {
        ...value,
        termsAr: defaultPolicies.termsAr,
        termsEn: defaultPolicies.termsEn,
        refundAr: defaultPolicies.refundAr,
        refundEn: defaultPolicies.refundEn,
        policiesUpdatedAt: new Date().toISOString(),
      },
    })
    .where(eq(schema.storeSettings.key, "store"));
}

/** Appends the reviews + notifications sections to the stored privacy policy (keeps any owner edits). */
async function privacyV8(tx: Tx) {
  const [row] = await tx.select().from(schema.storeSettings).where(eq(schema.storeSettings.key, "store")).for("update");
  if (!row) return;
  const value = row.value as Record<string, unknown>;
  const add = (current: unknown, fallback: string, extra: string, marker: string) => {
    const text = typeof current === "string" && current.trim() ? current : fallback;
    return text.includes(marker) ? text : text.trimEnd() + extra;
  };
  await tx
    .update(schema.storeSettings)
    .set({
      value: {
        ...value,
        privacyAr: add(value.privacyAr, defaultPolicies.privacyAr, privacyAdditions.ar, "## التقييمات"),
        privacyEn: add(value.privacyEn, defaultPolicies.privacyEn, privacyAdditions.en, "## Reviews"),
        policiesUpdatedAt: new Date().toISOString(),
      },
    })
    .where(eq(schema.storeSettings.key, "store"));
}

/**
 * The owner's card (2025988359) is a Qi Card: the old "Mastercard" entry becomes
 * "Qi Card (Super Qi)" with the owner's Super Qi transfer QR.
 */
async function superQiV9(tx: Tx) {
  const qr = readFileSync(new URL("./assets/super-qi-qr.jpg", import.meta.url));
  const [file] = await tx
    .insert(schema.files)
    .values({ kind: "payment_qr", mimeType: "image/jpeg", size: qr.length, sha256: createHash("sha256").update(qr.toString("base64")).digest("hex"), data: qr })
    .returning({ id: schema.files.id });
  await tx
    .update(schema.paymentMethods)
    .set({
      nameAr: "كي كارد (سوبر كي)",
      nameEn: "Qi Card (Super Qi)",
      accountDetails: "2025988359",
      instructionsAr:
        "ادفع من تطبيق سوبر كي: امسح رمز QR الظاهر هنا، أو حوّل إلى رقم البطاقة 2025988359 (باسم حسين رافد). اكتب المبلغ المطلوب بالضبط، ثم أرسل رقم العملية أو صورة الإيصال من هذه الصفحة. لا تشارك رقم بطاقتك أو رمزك السري مع أي أحد.",
      instructionsEn:
        "Pay in the Super Qi app: scan the QR code shown here, or transfer to card number 2025988359 (name: Hussein Rafid). Enter the exact amount due, then send the transaction number or a receipt photo from this page. Never share your own card number or PIN with anyone.",
      qrFileId: file!.id,
      isEnabled: true,
      requiresReference: false,
      allowsReceipt: true,
      sortOrder: 5,
    })
    .where(eq(schema.paymentMethods.code, "mastercard"));
}

/*
 * Owner round 10 (2026-10-27): new categories and services, prices and delivery times.
 *
 * Pricing rule from the owner: the official price plus a 75% margin, rounded UP
 * to whole thousands of IQD. Dollar prices use the Baghdad market rate of
 * 1,680 IQD per USD (Kifah/Harithiya exchanges, 27 Oct 2026). Sources noted per
 * product. Everything stays editable in Admin → Services.
 */
const USD_IQD = 1680;
const MARGIN = 1.75;
const upThousand = (x: number) => Math.ceil(Math.round(x) / 1000) * 1000;
const fromUsd = (usd: number) => upThousand(usd * USD_IQD * MARGIN);
const fromIqd = (iqd: number) => upThousand(iqd * MARGIN);

const FAST_AR = "من 10 إلى 20 دقيقة بعد تأكيد الدفع";
const FAST_EN = "10–20 minutes after payment is confirmed";

const giftNote = {
  ar: "\n\n• البطاقة للحساب الأمريكي (US) — تشتغل فقط على حساب منطقته الولايات المتحدة.\n• الدفع أولاً، وبعد تأكيد التحويل يظهر الكود في صفحة طلبك (قسم «تفاصيل التسليم») خلال 10 إلى 20 دقيقة.\n• الأكواد الرقمية لا تُسترجع بعد تسليمها.",
  en: "\n\n• The card is for US accounts — it only works on an account whose region is the United States.\n• Payment first: once the transfer is confirmed, the code appears on your order page (“Delivery details”) within 10–20 minutes.\n• Digital codes cannot be refunded once delivered.",
};
const subNote = {
  ar: "\n\nيتم التفعيل على حسابك أنت بكود أو دعوة رسمية بعد تأكيد الدفع، ونتواصل معك إذا احتجنا تفاصيل. لا نطلب كلمة المرور أو رمز التحقق أبداً.",
  en: "\n\nActivation is on your own account with an official code or invite after payment is confirmed; we contact you if we need details. We never ask for your password or verification code.",
};
const briefField = (ar: string, en: string, required = true): Field => ({
  key: "brief",
  labelAr: ar,
  labelEn: en,
  helpAr: "اكتب التفاصيل: الأسماء، الألوان، النصوص المطلوبة، وأي ملاحظات.",
  helpEn: "Add the details: names, colours, required text and any notes.",
  type: "textarea",
  required,
  maxLength: 2000,
});
const refField: Field = {
  key: "reference_url",
  labelAr: "رابط مثال أو ملفات (اختياري)",
  labelEn: "Example or files link (optional)",
  helpAr: "مثل رابط Google Drive أو منشور يعجبك.",
  helpEn: "E.g. a Google Drive link or a post you like.",
  type: "url",
  required: false,
  maxLength: 500,
};
const accountUrl: Field = {
  key: "account_url",
  labelAr: "رابط الحساب أو الصفحة",
  labelEn: "Account or page link",
  helpAr: "نُضاف كمسؤول أو شريك بالأدوات الرسمية — لا نطلب كلمة المرور.",
  helpEn: "We are added as a manager or partner with official tools — no password.",
  type: "url",
  required: true,
  maxLength: 300,
};
const accountType: Field = {
  key: "account_type",
  labelAr: "نوع الحساب",
  labelEn: "Account type",
  helpAr: "",
  helpEn: "",
  type: "select",
  required: true,
  maxLength: 40,
  options: [
    { value: "personal", labelAr: "شخصي / صانع محتوى", labelEn: "Personal / creator" },
    { value: "business", labelAr: "تجاري (محل أو خدمة)", labelEn: "Business (shop or service)" },
    { value: "store", labelAr: "متجر إلكتروني", labelEn: "Online store" },
    { value: "organization", labelAr: "مؤسسة أو جهة", labelEn: "Organization" },
  ],
};
const aboutField: Field = {
  key: "about",
  labelAr: "نبذة عن نشاطك وجمهورك (اختياري)",
  labelEn: "About your business and audience (optional)",
  helpAr: "",
  helpEn: "",
  type: "textarea",
  required: false,
  maxLength: 1500,
};
const pkg = (labelAr: string, labelEn: string, price: number): Pkg => ({ labelAr, labelEn, price });

async function catalogV10(tx: Tx) {
  const cats: (typeof schema.categories.$inferInsert)[] = [
    {
      slug: "gift-cards",
      nameAr: "بطاقات الهدايا",
      nameEn: "Gift Cards",
      descriptionAr: "بطاقات بلايستيشن وستيم وجوجل بلاي وآب ستور وإكس بوكس للحساب الأمريكي. الدفع أولاً ثم استلام الكود.",
      descriptionEn: "PlayStation, Steam, Google Play, App Store and Xbox cards for US accounts. Pay first, then receive the code.",
      icon: "gift",
      sortOrder: 25,
    },
    {
      slug: "montage",
      nameAr: "المونتاج",
      nameEn: "Video Editing",
      descriptionAr: "مونتاج ريلز وتيك توك، فيديوهات إعلانية، ومونتاج فيديوهات يوتيوب.",
      descriptionEn: "Reels and TikTok editing, ad videos and YouTube video editing.",
      icon: "tv",
      sortOrder: 45,
    },
    {
      slug: "account-management",
      nameAr: "إدارة الحسابات",
      nameEn: "Account Management",
      descriptionAr: "إدارة حسابات إنستغرام وتيك توك وفيسبوك والحملات الإعلانية بباقات شهرية حسب نوع حسابك.",
      descriptionEn: "Monthly management for Instagram, TikTok, Facebook and ad campaigns, by account type.",
      icon: "briefcase",
      sortOrder: 47,
    },
  ];
  for (const c of cats) {
    await tx.insert(schema.categories).values(c).onConflictDoUpdate({
      target: schema.categories.slug,
      set: { nameAr: c.nameAr, nameEn: c.nameEn, descriptionAr: c.descriptionAr, descriptionEn: c.descriptionEn, icon: c.icon, sortOrder: c.sortOrder, isActive: true },
    });
  }
  await tx
    .update(schema.categories)
    .set({
      descriptionAr: "تبديل بين آسياسيل وزين كاش وكي كارد بكل الاتجاهات. اطلب الخدمة واكتب المبلغ والاتجاه، ونرد عليك بالسعر.",
      descriptionEn: "Exchange between AsiaCell, Zain Cash and Qi Card in any direction. Request it with the amount and direction and we reply with the rate.",
    })
    .where(eq(schema.categories.slug, "balance-exchange"));
  await tx
    .update(schema.categories)
    .set({
      descriptionAr: "شدات ببجي، ألماس موبايل ليجندز، وألماس وذهب لودو ستار برقم اللاعب فقط — خلال 10 إلى 20 دقيقة من تأكيد الدفع.",
      descriptionEn: "PUBG UC, Mobile Legends diamonds and Ludo Star diamonds and gold with your player ID only — within 10–20 minutes of payment confirmation.",
    })
    .where(eq(schema.categories.slug, "gaming"));
  await tx
    .update(schema.categories)
    .set({
      descriptionAr: "ChatGPT وGemini وClaude وشاهد ويوتيوب بريميوم وسبوتيفاي ونتفليكس وCanva وCapCut وتلكرام بريميوم.",
      descriptionEn: "ChatGPT, Gemini, Claude, Shahid, YouTube Premium, Spotify, Netflix, Canva, CapCut and Telegram Premium.",
    })
    .where(eq(schema.categories.slug, "subscriptions"));

  // Mobile Legends — reference USD prices of official-web top-up packs (Joytify list, 25 Oct 2026).
  const mlbb: [string, string, number][] = [
    ["تذكرة الألماس الأسبوعية", "Weekly Diamond Pass", 1.65],
    ["86 ألماسة", "86 diamonds", 1.3],
    ["172 ألماسة", "172 diamonds", 2.6],
    ["257 ألماسة", "257 diamonds", 3.89],
    ["516 ألماسة", "516 diamonds", 7.48],
    ["706 ألماسة", "706 diamonds", 10.41],
  ];
  const card = (slug: string, nameAr: string, nameEn: string, icon: string, sortOrder: number, amounts: number[], featured = false): ProductSpec => ({
    slug,
    category: "gift-cards",
    nameAr,
    nameEn,
    summaryAr: `بطاقات ${amounts.map((a) => `$${a}`).join(" و")} للحساب الأمريكي — الكود يوصلك بصفحة الطلب.`,
    summaryEn: `${amounts.map((a) => `$${a}`).join(", ")} cards for US accounts — the code arrives on your order page.`,
    descriptionAr: `اختر قيمة البطاقة وادفع، وبعد تأكيد التحويل نرسل لك الكود في صفحة طلبك.${giftNote.ar}`,
    descriptionEn: `Choose the card value and pay; after the transfer is confirmed we send the code to your order page.${giftNote.en}`,
    icon,
    deliveryTimeAr: FAST_AR,
    deliveryTimeEn: FAST_EN,
    isFeatured: featured,
    sortOrder,
    mode: "package",
    packages: amounts.map((a) => pkg(`بطاقة $${a}`, `$${a} card`, fromUsd(a))),
    maxPackages: 5,
    fields: [],
  });
  const sub = (
    slug: string,
    nameAr: string,
    nameEn: string,
    icon: string,
    sortOrder: number,
    packages: Pkg[],
    email: [string, string],
    summary: [string, string],
  ): ProductSpec => ({
    slug,
    category: "subscriptions",
    nameAr,
    nameEn,
    summaryAr: summary[0],
    summaryEn: summary[1],
    descriptionAr: `اختر المدة وادفع.${subNote.ar}`,
    descriptionEn: `Choose the duration and pay.${subNote.en}`,
    icon,
    deliveryTimeAr: "من 10 دقائق إلى ساعة بعد تأكيد الدفع",
    deliveryTimeEn: "10 minutes to 1 hour after payment is confirmed",
    isFeatured: false,
    sortOrder,
    mode: "package",
    packages,
    maxPackages: 3,
    fields: [emailField(email[0], email[1])],
  });
  const manage = (slug: string, nameAr: string, nameEn: string, sortOrder: number, prices: [number, number, number], detail: [string, string, string, string, string, string]): ProductSpec => ({
    slug,
    category: "account-management",
    nameAr,
    nameEn,
    summaryAr: "باقات شهرية: أساسية، متقدمة، واحترافية — حسب نوع حسابك واحتياجك.",
    summaryEn: "Monthly packages: basic, advanced and pro — by your account type and needs.",
    descriptionAr:
      `الباقات شهرية وتشمل:\n• أساسية: ${detail[0]}\n• متقدمة: ${detail[1]}\n• احترافية: ${detail[2]}\n\nبعد تأكيد الدفع نتواصل معك لنتفق على الخطة والمحتوى، ونُضاف كمسؤول أو شريك من الأدوات الرسمية (مثل Meta Business Suite) — لا نطلب كلمة المرور. ميزانية الإعلانات الممولة غير مشمولة وتدفعها للمنصة مباشرة. لا نضمن أعداد متابعين؛ نضمن عملاً منتظماً وتقريراً واضحاً.`,
    descriptionEn:
      `Monthly packages include:\n• Basic: ${detail[3]}\n• Advanced: ${detail[4]}\n• Pro: ${detail[5]}\n\nAfter payment we contact you to agree on the plan and content, and we are added as a manager or partner with official tools (such as Meta Business Suite) — no password. Ad spend is not included; you pay it to the platform directly. We do not guarantee follower numbers; we guarantee consistent work and a clear report.`,
    icon: "briefcase",
    deliveryTimeAr: "نتواصل معك خلال 24 ساعة من تأكيد الدفع",
    deliveryTimeEn: "We contact you within 24 hours of payment",
    isFeatured: false,
    sortOrder,
    mode: "package",
    packages: [
      pkg("أساسية — شهر", "Basic — 1 month", prices[0]),
      pkg("متقدمة — شهر", "Advanced — 1 month", prices[1]),
      pkg("احترافية — شهر", "Pro — 1 month", prices[2]),
    ],
    maxPackages: 3,
    fields: [accountUrl, accountType, aboutField],
  });

  const products: ProductSpec[] = [
    {
      slug: "mobile-legends-diamonds",
      category: "gaming",
      nameAr: "ألماس موبايل ليجندز",
      nameEn: "Mobile Legends Diamonds",
      summaryAr: "شحن ألماس Mobile Legends: Bang Bang برقم اللاعب ورقم السيرفر فقط.",
      summaryEn: "Mobile Legends: Bang Bang diamonds with your player ID and Zone ID only.",
      descriptionAr:
        "اختر الباقة واكتب رقم اللاعب (ID) ورقم السيرفر (Zone ID) — تلكاهم بالضغط على صورتك داخل اللعبة.\n\nلا نطلب كلمة المرور أبداً. الشحن على رقم خاطئ قد لا يمكن استرجاعه، فتأكد من الرقمين.",
      descriptionEn:
        "Choose a package and enter your player ID and Zone ID — tap your profile picture in the game to see them.\n\nWe never ask for your password. A top-up to a wrong ID may not be refundable, so check both numbers.",
      icon: "gem",
      deliveryTimeAr: FAST_AR,
      deliveryTimeEn: FAST_EN,
      isFeatured: true,
      sortOrder: 15,
      mode: "package",
      packages: mlbb.map(([ar, en, usd]) => pkg(ar, en, fromUsd(usd))),
      maxPackages: 10,
      fields: [
        { key: "player_id", labelAr: "رقم اللاعب (ID)", labelEn: "Player ID", helpAr: "الرقم الأول قبل القوسين.", helpEn: "The first number, before the brackets.", type: "number", required: true, maxLength: 20 },
        { key: "zone_id", labelAr: "رقم السيرفر (Zone ID)", labelEn: "Zone ID", helpAr: "الرقم بين القوسين، بدون الأقواس.", helpEn: "The number in brackets, without the brackets.", type: "number", required: true, maxLength: 8 },
        { key: "player_name", labelAr: "اسم اللاعب (للتأكيد)", labelEn: "Player name (for confirmation)", helpAr: "", helpEn: "", type: "text", required: false, maxLength: 40 },
      ],
    },
    card("playstation-gift-card", "بطاقة بلايستيشن (PSN)", "PlayStation Gift Card (PSN)", "gamepad", 10, [10, 25, 50], true),
    card("steam-gift-card", "بطاقة ستيم (Steam)", "Steam Wallet Card", "gamepad", 20, [10, 20, 50]),
    card("google-play-gift-card", "بطاقة جوجل بلاي", "Google Play Gift Card", "gift", 30, [10, 25, 50]),
    card("app-store-gift-card", "بطاقة آب ستور وآيتونز", "App Store & iTunes Gift Card", "gift", 40, [10, 25, 50]),
    card("xbox-gift-card", "بطاقة إكس بوكس", "Xbox Gift Card", "gamepad", 50, [10, 25, 50]),
    // Shahid VIP: 4,999 IQD/month (Zain Iraq's official Shahid VIP offer).
    sub("shahid-vip", "اشتراك شاهد VIP", "Shahid VIP", "tv", 60, [pkg("شهر", "1 month", fromIqd(4999)), pkg("3 أشهر", "3 months", fromIqd(4999 * 3))], ["بريد حساب شاهد", "Shahid account email"], ["مسلسلات وأفلام وبرامج عربية حصرية بدون إعلانات.", "Exclusive Arabic series, films and shows without ads."]),
    // YouTube Premium: US$15.99/month (YouTube's published individual price; no IQD price published).
    sub("youtube-premium", "اشتراك يوتيوب بريميوم", "YouTube Premium", "tv", 70, [pkg("شهر", "1 month", fromUsd(15.99))], ["بريد حساب Google", "Google account email"], ["يوتيوب بدون إعلانات، تشغيل بالخلفية وتنزيل الفيديوهات.", "YouTube without ads, background play and downloads."]),
    // Spotify Premium Individual: IQD 4,900/month and IQD 49,000/year (spotify.com/iq).
    sub("spotify-premium", "اشتراك سبوتيفاي بريميوم", "Spotify Premium", "music", 80, [pkg("شهر", "1 month", fromIqd(4900)), pkg("سنة", "1 year", fromIqd(49000))], ["بريد حساب سبوتيفاي", "Spotify account email"], ["موسيقى بدون إعلانات وتنزيل للاستماع بدون إنترنت.", "Ad-free music and downloads for offline listening."]),
    // Netflix Iraq: Standard US$7.99, Premium US$9.99 per month.
    sub("netflix", "اشتراك نتفليكس", "Netflix", "tv", 90, [pkg("Standard — شهر", "Standard — 1 month", fromUsd(7.99)), pkg("Premium — شهر", "Premium — 1 month", fromUsd(9.99))], ["بريد حساب نتفليكس", "Netflix account email"], ["أفلام ومسلسلات بجودة عالية على حسابك الخاص.", "Films and series in high quality on your own account."]),
    // Canva Pro: US$18/month (Canva's published monthly price).
    sub("canva-pro", "اشتراك Canva Pro", "Canva Pro", "palette", 100, [pkg("شهر", "1 month", fromUsd(18))], ["بريد حساب Canva", "Canva account email"], ["كل قوالب وأدوات Canva المدفوعة للتصميم.", "All of Canva's premium templates and tools."]),
    // CapCut Pro: US$19.99/month (CapCut's US App Store price).
    sub("capcut-pro", "اشتراك CapCut Pro", "CapCut Pro", "tv", 110, [pkg("شهر", "1 month", fromUsd(19.99))], ["بريد حساب CapCut", "CapCut account email"], ["مونتاج احترافي بدون علامة مائية مع مؤثرات Pro.", "Pro editing without watermark and with Pro effects."]),
    // Design (owner's own work; prices set to suit the market).
    {
      slug: "logo-design",
      category: "design",
      nameAr: "تصميم شعار (لوگو)",
      nameEn: "Logo Design",
      summaryAr: "شعار احترافي لمشروعك مع ملفات جاهزة للطباعة والسوشل.",
      summaryEn: "A professional logo with files ready for print and social media.",
      descriptionAr: "• أساسي: مقترحين وتعديلين.\n• احترافي: 3 مقترحات، تعديلات أكثر، وملفات المصدر.\n• هوية مصغّرة: شعار + كرت أعمال + غلاف سوشل ميديا.",
      descriptionEn: "• Basic: 2 concepts and 2 revisions.\n• Pro: 3 concepts, more revisions and source files.\n• Mini identity: logo + business card + social media cover.",
      icon: "palette",
      deliveryTimeAr: "من 2 إلى 5 أيام",
      deliveryTimeEn: "2 to 5 days",
      isFeatured: false,
      sortOrder: 50,
      mode: "package",
      packages: [pkg("أساسي", "Basic", 50000), pkg("احترافي", "Pro", 100000), pkg("هوية مصغّرة", "Mini identity", 175000)],
      maxPackages: 3,
      fields: [
        { key: "brand_name", labelAr: "اسم المشروع", labelEn: "Business name", helpAr: "", helpEn: "", type: "text", required: true, maxLength: 80 },
        briefField("وصف الشعار المطلوب", "Describe the logo you want"),
        refField,
      ],
    },
    {
      slug: "menu-design",
      category: "design",
      nameAr: "تصميم منيو مطعم أو كافيه",
      nameEn: "Restaurant / Café Menu Design",
      summaryAr: "منيو مرتب وجذاب للطباعة أو للعرض على الشاشة والسوشل.",
      summaryEn: "A clear, attractive menu for print, screens or social media.",
      descriptionAr: "اكتب أسماء الأصناف والأسعار، أو أرسل رابط ملف فيه القائمة، ونصمم المنيو بألوان مشروعك.",
      descriptionEn: "Write the items and prices, or send a link to a file with the list, and we design the menu in your brand colours.",
      icon: "palette",
      deliveryTimeAr: "من 2 إلى 4 أيام",
      deliveryTimeEn: "2 to 4 days",
      isFeatured: false,
      sortOrder: 60,
      mode: "package",
      packages: [pkg("صفحة واحدة", "1 page", 25000), pkg("صفحتين", "2 pages", 40000), pkg("منيو كامل حتى 6 صفحات", "Full menu up to 6 pages", 90000)],
      maxPackages: 3,
      fields: [briefField("الأصناف والأسعار والملاحظات", "Items, prices and notes"), refField],
    },
    {
      slug: "business-card-design",
      category: "design",
      nameAr: "تصميم كرت أعمال (بزنس كارد)",
      nameEn: "Business Card Design",
      summaryAr: "كرت أعمال بوجهين جاهز للطباعة.",
      summaryEn: "A two-sided business card, print-ready.",
      descriptionAr: "اكتب الاسم والمسمّى وأرقام التواصل، ونسلّمك ملف جاهز للطباعة.",
      descriptionEn: "Send the name, title and contact details, and get a print-ready file.",
      icon: "palette",
      deliveryTimeAr: "من 1 إلى 3 أيام",
      deliveryTimeEn: "1 to 3 days",
      isFeatured: false,
      sortOrder: 70,
      mode: "unit",
      unitPrice: 15000,
      min: 1,
      max: 10,
      fields: [briefField("الاسم والمسمّى وبيانات التواصل", "Name, title and contact details"), refField],
    },
    {
      slug: "invitation-design",
      category: "design",
      nameAr: "تصميم دعوة (عرس أو مناسبة)",
      nameEn: "Invitation Design (wedding or event)",
      summaryAr: "دعوة صورة أو فيديو متحرك لإرسالها على واتساب والسوشل.",
      summaryEn: "An image or animated video invitation to share on WhatsApp and social media.",
      descriptionAr: "اكتب الأسماء والتاريخ والمكان وأي نص تحبه، واختر صورة أو فيديو متحرك.",
      descriptionEn: "Send the names, date, place and any wording you like, and choose an image or an animated video.",
      icon: "image",
      deliveryTimeAr: "من 1 إلى 3 أيام",
      deliveryTimeEn: "1 to 3 days",
      isFeatured: false,
      sortOrder: 80,
      mode: "package",
      packages: [pkg("دعوة صورة", "Image invitation", 15000), pkg("دعوة فيديو متحرك", "Animated video invitation", 35000)],
      maxPackages: 5,
      fields: [briefField("الأسماء والتاريخ والمكان والنص", "Names, date, place and wording"), refField],
    },
    // Video editing.
    {
      slug: "reels-montage",
      category: "montage",
      nameAr: "مونتاج ريلز وتيك توك",
      nameEn: "Reels & TikTok Editing",
      summaryAr: "مونتاج سريع ومرتب حتى 60 ثانية مع نصوص وموسيقى وانتقالات.",
      summaryEn: "Snappy edits up to 60 seconds with captions, music and transitions.",
      descriptionAr: "أرسل رابط الفيديوهات (مثل Google Drive) واكتب الفكرة والأسلوب. كل ريل حتى 60 ثانية مع تعديل واحد.",
      descriptionEn: "Send a link to your clips (e.g. Google Drive) and describe the idea and style. Each reel is up to 60 seconds with one revision.",
      icon: "tv",
      deliveryTimeAr: "من 1 إلى 3 أيام",
      deliveryTimeEn: "1 to 3 days",
      isFeatured: true,
      sortOrder: 10,
      mode: "package",
      packages: [pkg("ريل واحد", "1 reel", 15000), pkg("5 ريلز", "5 reels", 65000), pkg("10 ريلز", "10 reels", 120000), pkg("20 ريل", "20 reels", 220000)],
      maxPackages: 5,
      fields: [briefField("الفكرة والأسلوب", "Idea and style"), { ...refField, labelAr: "رابط الفيديوهات", labelEn: "Clips link", required: true }],
    },
    {
      slug: "ad-video-montage",
      category: "montage",
      nameAr: "مونتاج فيديو إعلاني",
      nameEn: "Ad Video Editing",
      summaryAr: "فيديو إعلاني لمشروعك مع نصوص وموسيقى وشعارك.",
      summaryEn: "A promotional video for your business with captions, music and your logo.",
      descriptionAr: "أرسل المواد المتوفرة (فيديوهات، صور، شعار) واكتب الرسالة الإعلانية. يشمل تعديلين.",
      descriptionEn: "Send the material you have (clips, photos, logo) and your ad message. Includes two revisions.",
      icon: "megaphone",
      deliveryTimeAr: "من 2 إلى 4 أيام",
      deliveryTimeEn: "2 to 4 days",
      isFeatured: false,
      sortOrder: 20,
      mode: "package",
      packages: [pkg("إعلان قصير حتى 30 ثانية", "Short ad up to 30 seconds", 30000), pkg("إعلان حتى دقيقتين", "Ad up to 2 minutes", 50000)],
      maxPackages: 3,
      fields: [briefField("الرسالة الإعلانية والتفاصيل", "Ad message and details"), { ...refField, labelAr: "رابط المواد", labelEn: "Material link", required: true }],
    },
    {
      slug: "youtube-montage",
      category: "montage",
      nameAr: "مونتاج فيديو يوتيوب",
      nameEn: "YouTube Video Editing",
      summaryAr: "قص وترتيب ونصوص وموسيقى لفيديوهات اليوتيوب.",
      summaryEn: "Cutting, pacing, captions and music for YouTube videos.",
      descriptionAr: "أرسل رابط التسجيل الخام واكتب طريقة المونتاج المطلوبة. يشمل تعديل واحد.",
      descriptionEn: "Send a link to the raw footage and describe the editing you want. Includes one revision.",
      icon: "tv",
      deliveryTimeAr: "من 2 إلى 5 أيام",
      deliveryTimeEn: "2 to 5 days",
      isFeatured: false,
      sortOrder: 30,
      mode: "package",
      packages: [pkg("حتى 10 دقائق", "Up to 10 minutes", 40000), pkg("حتى 20 دقيقة", "Up to 20 minutes", 70000)],
      maxPackages: 5,
      fields: [briefField("طريقة المونتاج المطلوبة", "Editing you want"), { ...refField, labelAr: "رابط التسجيل الخام", labelEn: "Raw footage link", required: true }],
    },
    // Account management (monthly).
    manage("manage-instagram", "إدارة حساب إنستغرام", "Instagram Account Management", 10, [125000, 200000, 350000], [
      "12 منشور شهرياً + الرد على التعليقات",
      "20 منشور + 10 ستوري + 4 ريلز + الرد على الرسائل",
      "30 منشور + 8 ريلز + ستوري يومي + إدارة إعلان + تقرير شهري",
      "12 posts a month + replying to comments",
      "20 posts + 10 stories + 4 reels + replying to messages",
      "30 posts + 8 reels + daily stories + ad management + monthly report",
    ]),
    manage("manage-tiktok", "إدارة حساب تيك توك", "TikTok Account Management", 20, [150000, 250000, 400000], [
      "8 فيديوهات شهرياً + اختيار الترندات",
      "15 فيديو + كتابة الأفكار + الرد على التعليقات",
      "30 فيديو + خطة محتوى + إدارة إعلان + تقرير شهري",
      "8 videos a month + trend selection",
      "15 videos + idea writing + replying to comments",
      "30 videos + content plan + ad management + monthly report",
    ]),
    manage("manage-facebook", "إدارة صفحة فيسبوك", "Facebook Page Management", 30, [100000, 175000, 300000], [
      "12 منشور شهرياً + الرد على التعليقات",
      "20 منشور + الرد على الرسائل + تحسين الصفحة",
      "30 منشور + إدارة إعلان + تقرير شهري",
      "12 posts a month + replying to comments",
      "20 posts + replying to messages + page optimisation",
      "30 posts + ad management + monthly report",
    ]),
    manage("manage-all-platforms", "إدارة متكاملة لكل المنصات", "All-Platform Management", 40, [300000, 500000, 800000], [
      "إنستغرام + فيسبوك: 12 منشور مشترك + الردود",
      "إنستغرام + فيسبوك + تيك توك: 20 منشور + 8 فيديو + الردود",
      "كل المنصات: محتوى يومي + ريلز + إدارة إعلانات + تقرير شهري",
      "Instagram + Facebook: 12 shared posts + replies",
      "Instagram + Facebook + TikTok: 20 posts + 8 videos + replies",
      "All platforms: daily content + reels + ad management + monthly report",
    ]),
    {
      slug: "manage-ad-campaigns",
      category: "account-management",
      nameAr: "إدارة الحملات الإعلانية الممولة",
      nameEn: "Paid Ad Campaign Management",
      summaryAr: "إعداد ومتابعة إعلاناتك على إنستغرام وفيسبوك وتيك توك — رسوم الإدارة فقط.",
      summaryEn: "Setting up and managing your Instagram, Facebook and TikTok ads — management fee only.",
      descriptionAr:
        "نختار الجمهور ونكتب الإعلان ونتابع النتائج ونحسّنها. ميزانية الإعلان غير مشمولة وتدفعها أنت للمنصة مباشرة من حسابك. نُضاف كشريك إعلاني — لا نطلب كلمة المرور.",
      descriptionEn:
        "We choose the audience, write the ad, track the results and improve them. Ad spend is not included; you pay it to the platform from your own account. We are added as an ad partner — no password.",
      icon: "megaphone",
      deliveryTimeAr: "نتواصل معك خلال 24 ساعة من تأكيد الدفع",
      deliveryTimeEn: "We contact you within 24 hours of payment",
      isFeatured: false,
      sortOrder: 50,
      mode: "package",
      packages: [pkg("حملة واحدة (إعداد + متابعة أسبوعين)", "One campaign (setup + 2 weeks)", 25000), pkg("إدارة شهرية حتى 4 حملات", "Monthly, up to 4 campaigns", 75000)],
      maxPackages: 3,
      fields: [accountUrl, accountType, aboutField],
    },
  ];
  await upsertProducts(tx, products);

  // Delivery times: game top-ups, gift cards and Telegram within 10–20 minutes of payment confirmation.
  const fast = ["pubg-mobile-uc", "ludo-star-diamonds", "ludo-star-gold", "free-fire-diamonds", "telegram-premium", "telegram-stars", "whatsapp-telegram-number"];
  await tx.update(schema.products).set({ deliveryTimeAr: FAST_AR, deliveryTimeEn: FAST_EN }).where(inArray(schema.products.slug, fast));
  const subs = ["chatgpt-plus", "chatgpt-go", "gemini", "claude", "iphone-plus-yearly", "design-tool-subscription"];
  await tx
    .update(schema.products)
    .set({ deliveryTimeAr: "من 10 دقائق إلى ساعة بعد تأكيد الدفع", deliveryTimeEn: "10 minutes to 1 hour after payment is confirmed" })
    .where(inArray(schema.products.slug, subs));
  const social = ["instagram-followers", "tiktok-followers", "telegram-members", "facebook-followers", "instagram-likes", "tiktok-likes", "tiktok-views"];
  await tx
    .update(schema.products)
    .set({ deliveryTimeAr: "يبدأ خلال 10 إلى 20 دقيقة من تأكيد الدفع ويكتمل خلال 48 ساعة كحد أقصى", deliveryTimeEn: "Starts within 10–20 minutes of payment; completes within 48 hours at most" })
    .where(inArray(schema.products.slug, social));
}

/**
 * Owner round 11 (2026-10-27): lower, reasonable margins instead of 75%.
 * - Game top-ups and gift cards: cost + 10%, rounded up to whole thousands
 *   (rounded down instead when rounding up would add more than 30%, as long as
 *   it stays at least 5% above cost).
 * - Other subscriptions: cost + 15%, rounded up to whole thousands.
 * - YouTube Premium and Canva: the owner's own prices.
 */
function reasonable(cost: number, margin: number) {
  const up = Math.ceil((cost * (1 + margin)) / 1000) * 1000;
  const down = Math.floor((cost * (1 + margin)) / 1000) * 1000;
  return up > cost * 1.3 && down >= cost * 1.05 ? down : up;
}
const usd = (x: number) => x * USD_IQD;

/** Replaces a product's packages in place (keeps package ids for carts and history when the count matches). */
async function setPackages(tx: Tx, slug: string, packs: Pkg[]) {
  const product = await tx.query.products.findFirst({ where: eq(schema.products.slug, slug), with: { packages: true } });
  if (!product) return null;
  const existing = [...product.packages].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
  for (let i = 0; i < packs.length; i++) {
    const row = { ...packs[i]!, compareAtPrice: null, isActive: true, sortOrder: i };
    const current = existing[i];
    if (current) await tx.update(schema.productPackages).set(row).where(eq(schema.productPackages.id, current.id));
    else await tx.insert(schema.productPackages).values({ ...row, productId: product.id });
  }
  for (const extra of existing.slice(packs.length)) await tx.delete(schema.productPackages).where(eq(schema.productPackages.id, extra.id));
  return product.id;
}

async function pricesV11(tx: Tx) {
  // Mobile Legends (same reference USD prices as round 10).
  await setPackages(tx, "mobile-legends-diamonds", [
    pkg("تذكرة الألماس الأسبوعية", "Weekly Diamond Pass", reasonable(usd(1.65), 0.1)),
    pkg("86 ألماسة", "86 diamonds", reasonable(usd(1.3), 0.1)),
    pkg("172 ألماسة", "172 diamonds", reasonable(usd(2.6), 0.1)),
    pkg("257 ألماسة", "257 diamonds", reasonable(usd(3.89), 0.1)),
    pkg("516 ألماسة", "516 diamonds", reasonable(usd(7.48), 0.1)),
    pkg("706 ألماسة", "706 diamonds", reasonable(usd(10.41), 0.1)),
  ]);

  // Gift cards: face value + 10%.
  const cards: [string, number[]][] = [
    ["playstation-gift-card", [10, 25, 50]],
    ["steam-gift-card", [10, 20, 50]],
    ["google-play-gift-card", [10, 25, 50]],
    ["app-store-gift-card", [10, 25, 50]],
    ["xbox-gift-card", [10, 25, 50]],
  ];
  for (const [slug, amounts] of cards) {
    await setPackages(tx, slug, amounts.map((a) => pkg(`بطاقة $${a}`, `$${a} card`, reasonable(usd(a), 0.1))));
  }

  // Subscriptions: cost + 15%.
  await setPackages(tx, "shahid-vip", [pkg("شهر", "1 month", reasonable(4999, 0.15)), pkg("3 أشهر", "3 months", reasonable(4999 * 3, 0.15))]);
  await setPackages(tx, "spotify-premium", [pkg("شهر", "1 month", reasonable(4900, 0.15)), pkg("سنة", "1 year", reasonable(49000, 0.15))]);
  await setPackages(tx, "netflix", [pkg("Standard — شهر", "Standard — 1 month", reasonable(usd(7.99), 0.15)), pkg("Premium — شهر", "Premium — 1 month", reasonable(usd(9.99), 0.15))]);
  await setPackages(tx, "capcut-pro", [pkg("شهر", "1 month", reasonable(usd(19.99), 0.15))]);

  // YouTube Premium — owner's prices.
  const yt = await setPackages(tx, "youtube-premium", [
    pkg("فردي — شهر", "Individual — 1 month", 10000),
    pkg("عائلي — شهر (حتى 5 أفراد)", "Family — 1 month (up to 5 members)", 15000),
    pkg("طالب — شهر", "Student — 1 month", 5000),
  ]);
  if (yt) {
    await tx
      .update(schema.products)
      .set({
        summaryAr: "فردي 10,000 · عائلي 15,000 (حتى 5 أفراد) · طالب 5,000 دينار شهرياً.",
        summaryEn: "Individual 10,000 · Family 15,000 (up to 5 members) · Student 5,000 IQD a month.",
        descriptionAr:
          "يوتيوب بدون إعلانات، تشغيل بالخلفية، وتنزيل الفيديوهات، ويشمل YouTube Music.\n\n• فردي: حساب واحد.\n• عائلي: تضيف حتى 5 أفراد من عائلتك، أعمارهم 13 سنة فما فوق، كل واحد بحسابه. اكتب إيميلاتهم بالخانة المخصصة.\n• طالب: حسب شروط يوتيوب لاشتراك الطلاب (قد يُطلب التحقق من أنك طالب)." +
          subNote.ar,
        descriptionEn:
          "YouTube without ads, background play and downloads, including YouTube Music.\n\n• Individual: one account.\n• Family: add up to 5 family members aged 13 or older, each with their own account. List their emails in the field provided.\n• Student: subject to YouTube's student-plan terms (student verification may be required)." +
          subNote.en,
      })
      .where(eq(schema.products.id, yt));
    await tx.delete(schema.productFields).where(eq(schema.productFields.productId, yt));
    await tx.insert(schema.productFields).values([
      { ...emailField("بريد حساب Google (صاحب الاشتراك)", "Google account email (subscription owner)"), productId: yt, sortOrder: 0 },
      {
        key: "family_emails",
        labelAr: "إيميلات أفراد العائلة (للباقة العائلية فقط)",
        labelEn: "Family members' emails (family plan only)",
        helpAr: "حتى 5 إيميلات، كل إيميل بسطر. أعمارهم 13 سنة فما فوق.",
        helpEn: "Up to 5 emails, one per line. Members must be 13 or older.",
        type: "textarea",
        required: false,
        maxLength: 600,
        productId: yt,
        sortOrder: 1,
      },
    ]);
  }

  // Canva — owner's prices for Pro and Business, monthly and yearly.
  const canva = await setPackages(tx, "canva-pro", [
    pkg("Pro — شهر", "Pro — 1 month", 30000),
    pkg("Pro — سنة", "Pro — 1 year", 225000),
    pkg("Business — شهر", "Business — 1 month", 42000),
    pkg("Business — سنة", "Business — 1 year", 400000),
  ]);
  if (canva) {
    await tx
      .update(schema.products)
      .set({
        nameAr: "اشتراك Canva (Pro و Business)",
        nameEn: "Canva subscription (Pro & Business)",
        summaryAr: "Pro: 30,000 شهرياً أو 225,000 سنوياً · Business: 42,000 شهرياً أو 400,000 سنوياً.",
        summaryEn: "Pro: 30,000 a month or 225,000 a year · Business: 42,000 a month or 400,000 a year.",
        descriptionAr:
          "كل قوالب وأدوات Canva المدفوعة للتصميم.\n\n• Pro: لشخص واحد.\n• Business: للفرق والشركات، مع أدوات الهوية التجارية والعمل الجماعي." + subNote.ar,
        descriptionEn: "All of Canva's premium templates and tools.\n\n• Pro: for one person.\n• Business: for teams and companies, with brand and collaboration tools." + subNote.en,
      })
      .where(eq(schema.products.id, canva));
  }
}

const UPDATES: { id: string; run: (tx: Tx) => Promise<void> }[] = [
  { id: "2026-10-26-catalog-v1", run: catalogV1 },
  { id: "2026-10-26-catalog-v2", run: catalogV2 },
  { id: "2026-10-26-catalog-v3", run: catalogV3 },
  { id: "2026-10-26-catalog-v4", run: catalogV4 },
  { id: "2026-10-26-catalog-v5", run: catalogV5 },
  { id: "2026-10-26-catalog-v6", run: catalogV6 },
  { id: "2026-10-26-policies-v7", run: catalogV7 },
  { id: "2026-10-27-privacy-v8", run: privacyV8 },
  { id: "2026-10-27-super-qi-v9", run: superQiV9 },
  { id: "2026-10-27-catalog-v10", run: catalogV10 },
  { id: "2026-10-27-prices-v11", run: pricesV11 },
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
