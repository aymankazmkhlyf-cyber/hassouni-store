import "dotenv/config";
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
    await tx.insert(schema.productFields).values(spec.fields.map((f, i) => ({ ...f, productId: id, sortOrder: i })));
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

const UPDATES: { id: string; run: (tx: Tx) => Promise<void> }[] = [
  { id: "2026-10-26-catalog-v1", run: catalogV1 },
  { id: "2026-10-26-catalog-v2", run: catalogV2 },
  { id: "2026-10-26-catalog-v3", run: catalogV3 },
  { id: "2026-10-26-catalog-v4", run: catalogV4 },
  { id: "2026-10-26-catalog-v5", run: catalogV5 },
  { id: "2026-10-26-catalog-v6", run: catalogV6 },
  { id: "2026-10-26-policies-v7", run: catalogV7 },
  { id: "2026-10-27-privacy-v8", run: privacyV8 },
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
