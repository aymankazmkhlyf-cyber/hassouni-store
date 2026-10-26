import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import { Pool } from "pg";
import * as schema from "../src/lib/db/schema";
import { storeSettingsSchema } from "../src/lib/services/settings";

/*
 * Idempotent seed. Every insert uses ON CONFLICT DO NOTHING on a natural key
 * (slug / code / settings key), so re-running never duplicates rows and never
 * overwrites changes made from the admin dashboard.
 *
 * ALL PRODUCTS BELOW ARE SAMPLES (isSample = true). Their prices are
 * placeholders, not confirmed offers — the storefront labels them as such.
 * No admin account is created here; use `npm run admin:create`.
 */

type SeedField = Omit<typeof schema.productFields.$inferInsert, "productId">;
type SeedPackage = Omit<typeof schema.productPackages.$inferInsert, "productId">;
type SeedTier = Omit<typeof schema.priceTiers.$inferInsert, "productId">;
type SeedProduct = Omit<typeof schema.products.$inferInsert, "categoryId"> & {
  category: string;
  packages?: SeedPackage[];
  tiers?: SeedTier[];
  fields?: SeedField[];
};

const categories: (typeof schema.categories.$inferInsert)[] = [
  {
    slug: "social-media",
    nameAr: "خدمات السوشل ميديا",
    nameEn: "Social Media Services",
    descriptionAr: "متابعون، إعجابات، مشاهدات وخدمات أخرى لحساباتك.",
    descriptionEn: "Followers, likes, views and more for your accounts.",
    icon: "users",
    sortOrder: 10,
  },
  {
    slug: "gaming",
    nameAr: "الألعاب",
    nameEn: "Gaming",
    descriptionAr: "شحن شدات ببجي موبايل وألعاب أخرى برقم اللاعب فقط.",
    descriptionEn: "PUBG Mobile UC and other top-ups using your player ID only.",
    icon: "gamepad",
    sortOrder: 20,
  },
  {
    slug: "subscriptions",
    nameAr: "الاشتراكات الرقمية",
    nameEn: "Digital Subscriptions",
    descriptionAr: "اشتراكات تطبيقات وخدمات رقمية.",
    descriptionEn: "App and digital service subscriptions.",
    icon: "tv",
    sortOrder: 30,
  },
  {
    slug: "design",
    nameAr: "خدمات التصميم",
    nameEn: "Design Services",
    descriptionAr: "تصاميم سوشل ميديا، بنرات إعلانية، بوسترات وتصاميم حسب الطلب.",
    descriptionEn: "Social media designs, ad banners, posters and custom design.",
    icon: "palette",
    sortOrder: 40,
  },
  {
    slug: "accounts-numbers",
    nameAr: "الحسابات والأرقام الرقمية",
    nameEn: "Digital Accounts & Numbers",
    descriptionAr: "خدمات مشروعة ومصرّح بها فقط، مع توضيح كامل لشروط التسليم.",
    descriptionEn: "Lawful, authorized services only, with clear delivery conditions.",
    icon: "briefcase",
    sortOrder: 50,
  },
  {
    slug: "custom",
    nameAr: "خدمات خاصة",
    nameEn: "Custom Services",
    descriptionAr: "اطلب أي خدمة رقمية غير موجودة في المتجر وسنرد عليك بعرض.",
    descriptionEn: "Request any digital service not listed and we will reply with an offer.",
    icon: "wand",
    sortOrder: 60,
  },
];

const linkField = (key: string, ar: string, en: string): SeedField => ({
  key,
  labelAr: ar,
  labelEn: en,
  helpAr: "يجب أن يكون الحساب عاماً. لا نطلب كلمة المرور.",
  helpEn: "The account must be public. We never ask for your password.",
  type: "url",
  required: true,
  maxLength: 300,
  sortOrder: 0,
});

const products: SeedProduct[] = [
  {
    category: "social-media",
    slug: "instagram-followers",
    nameAr: "متابعين إنستغرام",
    nameEn: "Instagram Followers",
    summaryAr: "باقات متابعين لحساب إنستغرام العام.",
    summaryEn: "Follower packages for a public Instagram account.",
    descriptionAr: "اختر الباقة وأدخل رابط حسابك العام. يبدأ التنفيذ بعد تأكيد الدفع.\n\nلا نطلب كلمة المرور أو رمز التحقق.",
    descriptionEn: "Choose a package and enter your public profile link. Work starts after payment is confirmed.\n\nWe never ask for a password or verification code.",
    icon: "users",
    pricingMode: "package",
    deliveryTimeAr: "من 1 إلى 48 ساعة",
    deliveryTimeEn: "1 to 48 hours",
    isFeatured: true,
    sortOrder: 10,
    packages: [
      { labelAr: "500 متابع", labelEn: "500 followers", price: 3000, sortOrder: 0 },
      { labelAr: "1,000 متابع", labelEn: "1,000 followers", price: 5500, compareAtPrice: 6000, sortOrder: 1 },
      { labelAr: "5,000 متابع", labelEn: "5,000 followers", price: 25000, sortOrder: 2 },
    ],
    fields: [linkField("profile_url", "رابط الحساب", "Profile link")],
  },
  {
    category: "social-media",
    slug: "instagram-likes",
    nameAr: "إعجابات إنستغرام",
    nameEn: "Instagram Likes",
    summaryAr: "إعجابات لمنشور عام، السعر حسب الكمية.",
    summaryEn: "Likes for a public post, priced by quantity.",
    descriptionAr: "حدد عدد الإعجابات وأدخل رابط المنشور. سعر الوحدة يقل مع الكميات الأكبر.",
    descriptionEn: "Set the number of likes and enter the post link. The unit price drops for larger quantities.",
    icon: "heart",
    pricingMode: "unit",
    unitPrice: 10,
    minQuantity: 100,
    maxQuantity: 20000,
    deliveryTimeAr: "من 1 إلى 24 ساعة",
    deliveryTimeEn: "1 to 24 hours",
    isFeatured: true,
    sortOrder: 20,
    tiers: [
      { minQuantity: 1000, unitPrice: 8 },
      { minQuantity: 5000, unitPrice: 6 },
    ],
    fields: [linkField("post_url", "رابط المنشور", "Post link")],
  },
  {
    category: "social-media",
    slug: "tiktok-views",
    nameAr: "مشاهدات تيك توك",
    nameEn: "TikTok Views",
    summaryAr: "مشاهدات لفيديو تيك توك عام.",
    summaryEn: "Views for a public TikTok video.",
    descriptionAr: "حدد عدد المشاهدات وأدخل رابط الفيديو.",
    descriptionEn: "Set the number of views and enter the video link.",
    icon: "eye",
    pricingMode: "unit",
    unitPrice: 2,
    minQuantity: 1000,
    maxQuantity: 500000,
    deliveryTimeAr: "من 1 إلى 24 ساعة",
    deliveryTimeEn: "1 to 24 hours",
    sortOrder: 30,
    tiers: [{ minQuantity: 10000, unitPrice: 1 }],
    fields: [linkField("video_url", "رابط الفيديو", "Video link")],
  },
  {
    category: "gaming",
    slug: "pubg-mobile-uc",
    nameAr: "شدات ببجي موبايل (UC)",
    nameEn: "PUBG Mobile UC",
    summaryAr: "شحن شدات ببجي موبايل برقم اللاعب (ID).",
    summaryEn: "PUBG Mobile UC top-up using your player ID.",
    descriptionAr:
      "اختر الباقة وأدخل رقم اللاعب (Player ID) بدقة. لا نطلب كلمة مرور الحساب أو تسجيل الدخول.\n\nتأكد من رقم اللاعب قبل الطلب؛ الشحن لرقم خاطئ قد لا يكون قابلاً للاسترجاع.",
    descriptionEn:
      "Choose a package and enter your exact Player ID. We never ask for your account password or login.\n\nDouble-check the ID; top-ups sent to a wrong ID may not be refundable.",
    icon: "gamepad",
    pricingMode: "package",
    maxQuantity: 10,
    deliveryTimeAr: "من 15 دقيقة إلى 6 ساعات بعد تأكيد الدفع",
    deliveryTimeEn: "15 minutes to 6 hours after payment confirmation",
    isFeatured: true,
    sortOrder: 10,
    packages: [
      { labelAr: "60 شدة", labelEn: "60 UC", price: 1500, sortOrder: 0 },
      { labelAr: "325 شدة", labelEn: "325 UC", price: 7000, sortOrder: 1 },
      { labelAr: "660 شدة", labelEn: "660 UC", price: 14000, sortOrder: 2 },
      { labelAr: "1800 شدة", labelEn: "1800 UC", price: 35000, sortOrder: 3 },
    ],
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
        sortOrder: 0,
      },
      {
        key: "player_name",
        labelAr: "اسم اللاعب (للتأكيد)",
        labelEn: "Player name (for verification)",
        type: "text",
        required: false,
        maxLength: 40,
        sortOrder: 1,
      },
    ],
  },
  {
    category: "gaming",
    slug: "free-fire-diamonds",
    nameAr: "جواهر فري فاير",
    nameEn: "Free Fire Diamonds",
    summaryAr: "شحن جواهر فري فاير برقم اللاعب.",
    summaryEn: "Free Fire diamonds top-up using your player ID.",
    descriptionAr: "اختر الباقة وأدخل رقم اللاعب.",
    descriptionEn: "Choose a package and enter your player ID.",
    icon: "gem",
    pricingMode: "package",
    maxQuantity: 10,
    deliveryTimeAr: "من 15 دقيقة إلى 6 ساعات بعد تأكيد الدفع",
    deliveryTimeEn: "15 minutes to 6 hours after payment confirmation",
    sortOrder: 20,
    packages: [
      { labelAr: "100 جوهرة", labelEn: "100 diamonds", price: 2000, sortOrder: 0 },
      { labelAr: "520 جوهرة", labelEn: "520 diamonds", price: 9500, sortOrder: 1 },
    ],
    fields: [
      { key: "player_id", labelAr: "رقم اللاعب", labelEn: "Player ID", type: "number", required: true, maxLength: 20, sortOrder: 0 },
    ],
  },
  {
    category: "subscriptions",
    slug: "music-app-subscription",
    nameAr: "اشتراك تطبيق موسيقى — شهر",
    nameEn: "Music App Subscription — 1 Month",
    summaryAr: "اشتراك شهري يُفعّل على بريد حسابك.",
    summaryEn: "Monthly subscription activated on your account email.",
    descriptionAr: "نحتاج فقط البريد الإلكتروني المرتبط بحسابك لإرسال رابط/رمز التفعيل. لا نطلب كلمة المرور.",
    descriptionEn: "We only need the email linked to your account to send the activation link/code. We never ask for your password.",
    icon: "music",
    pricingMode: "package",
    maxQuantity: 3,
    deliveryTimeAr: "خلال 24 ساعة",
    deliveryTimeEn: "Within 24 hours",
    sortOrder: 10,
    packages: [
      { labelAr: "شهر واحد", labelEn: "1 month", price: 8000, sortOrder: 0 },
      { labelAr: "3 أشهر", labelEn: "3 months", price: 22000, sortOrder: 1 },
    ],
    fields: [
      { key: "account_email", labelAr: "بريد الحساب", labelEn: "Account email", type: "text", required: true, maxLength: 120, sortOrder: 0 },
    ],
  },
  {
    category: "subscriptions",
    slug: "design-tool-subscription",
    nameAr: "اشتراك أداة تصميم — شهر",
    nameEn: "Design Tool Subscription — 1 Month",
    summaryAr: "اشتراك شهري لأداة تصميم أونلاين.",
    summaryEn: "Monthly subscription for an online design tool.",
    descriptionAr: "يُفعّل عبر دعوة إلى بريدك الإلكتروني.",
    descriptionEn: "Activated through an invitation to your email.",
    icon: "spark",
    pricingMode: "unit",
    unitPrice: 10000,
    minQuantity: 1,
    maxQuantity: 12,
    deliveryTimeAr: "خلال 24 ساعة",
    deliveryTimeEn: "Within 24 hours",
    sortOrder: 20,
    fields: [
      { key: "account_email", labelAr: "البريد الإلكتروني", labelEn: "Email", type: "text", required: true, maxLength: 120, sortOrder: 0 },
    ],
  },
  {
    category: "design",
    slug: "social-post-design",
    nameAr: "تصميم منشور سوشل ميديا",
    nameEn: "Social Media Post Design",
    summaryAr: "تصميم احترافي لمنشورات إنستغرام وفيسبوك.",
    summaryEn: "Professional design for Instagram and Facebook posts.",
    descriptionAr: "اكتب وصفاً واضحاً لما تريده، وأرفق رابطاً مرجعياً إن وجد. يشمل التعديلات البسيطة.",
    descriptionEn: "Write a clear brief and add a reference link if you have one. Minor revisions included.",
    icon: "image",
    pricingMode: "unit",
    unitPrice: 15000,
    minQuantity: 1,
    maxQuantity: 30,
    deliveryTimeAr: "من 1 إلى 3 أيام",
    deliveryTimeEn: "1 to 3 days",
    isFeatured: true,
    sortOrder: 10,
    tiers: [{ minQuantity: 5, unitPrice: 12000 }],
    fields: [
      { key: "brief", labelAr: "وصف التصميم المطلوب", labelEn: "Design brief", type: "textarea", required: true, maxLength: 2000, sortOrder: 0 },
      { key: "brand_name", labelAr: "اسم النشاط/العلامة", labelEn: "Business / brand name", type: "text", required: false, maxLength: 80, sortOrder: 1 },
      { key: "reference_url", labelAr: "رابط مرجعي", labelEn: "Reference link", type: "url", required: false, maxLength: 300, sortOrder: 2 },
    ],
  },
  {
    category: "design",
    slug: "ad-banner-design",
    nameAr: "تصميم بنر إعلاني",
    nameEn: "Advertising Banner Design",
    summaryAr: "بنرات إعلانية للإعلانات الممولة والمتاجر.",
    summaryEn: "Banners for paid ads and online stores.",
    descriptionAr: "حدد المقاس والمنصة في الوصف.",
    descriptionEn: "Specify the size and platform in the brief.",
    icon: "megaphone",
    pricingMode: "package",
    maxQuantity: 5,
    deliveryTimeAr: "من 2 إلى 4 أيام",
    deliveryTimeEn: "2 to 4 days",
    sortOrder: 20,
    packages: [
      { labelAr: "بنر واحد", labelEn: "1 banner", price: 20000, sortOrder: 0 },
      { labelAr: "3 بنرات", labelEn: "3 banners", price: 50000, sortOrder: 1 },
    ],
    fields: [
      { key: "brief", labelAr: "وصف البنر والمقاس", labelEn: "Banner brief and size", type: "textarea", required: true, maxLength: 2000, sortOrder: 0 },
      { key: "reference_url", labelAr: "رابط مرجعي", labelEn: "Reference link", type: "url", required: false, maxLength: 300, sortOrder: 1 },
    ],
  },
  {
    category: "design",
    slug: "poster-design",
    nameAr: "تصميم بوستر ترويجي",
    nameEn: "Promotional Poster Design",
    summaryAr: "بوسترات للفعاليات والعروض.",
    summaryEn: "Posters for events and promotions.",
    descriptionAr: "اكتب تفاصيل الفعالية أو العرض والألوان المفضلة.",
    descriptionEn: "Describe the event or offer and your preferred colours.",
    icon: "palette",
    pricingMode: "unit",
    unitPrice: 25000,
    minQuantity: 1,
    maxQuantity: 10,
    deliveryTimeAr: "من 2 إلى 5 أيام",
    deliveryTimeEn: "2 to 5 days",
    sortOrder: 30,
    fields: [
      { key: "brief", labelAr: "تفاصيل البوستر", labelEn: "Poster details", type: "textarea", required: true, maxLength: 2000, sortOrder: 0 },
      {
        key: "format",
        labelAr: "الاستخدام",
        labelEn: "Usage",
        type: "select",
        required: true,
        maxLength: 40,
        sortOrder: 1,
        options: [
          { value: "print", labelAr: "طباعة", labelEn: "Print" },
          { value: "digital", labelAr: "رقمي", labelEn: "Digital" },
        ],
      },
    ],
  },
  {
    category: "accounts-numbers",
    slug: "business-profile-setup",
    nameAr: "إعداد حساب أعمال (واتساب بزنس / إنستغرام)",
    nameEn: "Business Profile Setup (WhatsApp Business / Instagram)",
    summaryAr: "نساعدك في إعداد حساب الأعمال الخاص بك وأنت المالك الوحيد له.",
    summaryEn: "We help you set up your own business profile — you remain its sole owner.",
    descriptionAr:
      "نرشدك خطوة بخطوة لإعداد ملف الأعمال (الوصف، ساعات العمل، الرسائل التلقائية) عبر مكالمة أو محادثة. الحساب ورقم الهاتف ملكك، ولا نطلب كلمة المرور أو رمز التحقق.",
    descriptionEn:
      "We guide you step by step to set up your business profile (bio, hours, automated replies) over a call or chat. The account and number are yours, and we never ask for a password or verification code.",
    icon: "briefcase",
    pricingMode: "unit",
    unitPrice: 20000,
    minQuantity: 1,
    maxQuantity: 1,
    deliveryTimeAr: "موعد خلال 48 ساعة",
    deliveryTimeEn: "Session scheduled within 48 hours",
    sortOrder: 10,
    fields: [
      { key: "business_name", labelAr: "اسم النشاط", labelEn: "Business name", type: "text", required: true, maxLength: 80, sortOrder: 0 },
      {
        key: "platform",
        labelAr: "المنصة",
        labelEn: "Platform",
        type: "select",
        required: true,
        maxLength: 40,
        sortOrder: 1,
        options: [
          { value: "whatsapp", labelAr: "واتساب بزنس", labelEn: "WhatsApp Business" },
          { value: "instagram", labelAr: "إنستغرام", labelEn: "Instagram" },
        ],
      },
    ],
  },
];

const paymentMethods: (typeof schema.paymentMethods.$inferInsert)[] = [
  {
    code: "zain_cash",
    nameAr: "زين كاش",
    nameEn: "Zain Cash",
    instructionsAr: "حوّل المبلغ المطلوب إلى محفظة زين كاش الموضحة، ثم أرسل رقم العملية وصورة الإيصال من صفحة الطلب.",
    instructionsEn: "Transfer the amount due to the Zain Cash wallet shown, then send the transaction number and receipt from the order page.",
    accountDetails: "",
    requiresReference: true,
    allowsReceipt: true,
    isEnabled: true,
    sortOrder: 10,
  },
  {
    code: "asiacell",
    nameAr: "آسياسيل",
    nameEn: "AsiaCell",
    instructionsAr: "حوّل المبلغ عبر خدمة تحويل الرصيد/الدفع من آسياسيل إلى الرقم الموضح، ثم أرسل رقم العملية أو لقطة شاشة للتحويل.",
    instructionsEn: "Transfer the amount via AsiaCell credit transfer/payment to the number shown, then send the transaction number or a screenshot.",
    accountDetails: "",
    requiresReference: false,
    allowsReceipt: true,
    isEnabled: true,
    sortOrder: 20,
  },
  {
    code: "mastercard",
    nameAr: "ماستركارد",
    nameEn: "Mastercard",
    instructionsAr:
      "سيرسل لك فريق المتجر رابط دفع رسمي من مزوّد دفع مرخّص بعد إنشاء الطلب. لا تشارك رقم البطاقة أو CVV مع أي شخص، ولا ندخلها في هذا الموقع.",
    instructionsEn:
      "The store team will send you an official payment link from a licensed payment provider after the order is created. Never share your card number or CVV; they are never entered on this website.",
    accountDetails: "",
    requiresReference: false,
    allowsReceipt: true,
    // Disabled until the store has an agreement with a licensed provider.
    isEnabled: false,
    sortOrder: 30,
  },
  {
    code: "bank_transfer",
    nameAr: "تحويل بنكي",
    nameEn: "Bank transfer",
    instructionsAr: "حوّل المبلغ إلى الحساب البنكي الموضح واكتب رقم الطلب في ملاحظات التحويل.",
    instructionsEn: "Transfer the amount to the bank account shown and write the order reference in the transfer note.",
    accountDetails: "",
    requiresReference: true,
    allowsReceipt: true,
    isEnabled: false,
    sortOrder: 40,
  },
];

export async function seed(url: string) {
  const pool = new Pool({ connectionString: url, max: 1 });
  const db = drizzle({ client: pool, schema });
  try {
    await db.transaction(async (tx) => {
      await tx.insert(schema.categories).values(categories).onConflictDoNothing({ target: schema.categories.slug });
      const cats = await tx.select({ id: schema.categories.id, slug: schema.categories.slug }).from(schema.categories);
      const catId = new Map(cats.map((c) => [c.slug, c.id]));

      let created = 0;
      for (const { category, packages, tiers, fields, ...p } of products) {
        const categoryId = catId.get(category);
        if (!categoryId) continue;
        const [row] = await tx
          .insert(schema.products)
          .values({ ...p, categoryId, isSample: true })
          .onConflictDoNothing({ target: schema.products.slug })
          .returning({ id: schema.products.id });
        if (!row) continue; // already exists — leave admin edits untouched
        created++;
        if (packages?.length) await tx.insert(schema.productPackages).values(packages.map((x) => ({ ...x, productId: row.id })));
        if (tiers?.length) await tx.insert(schema.priceTiers).values(tiers.map((x) => ({ ...x, productId: row.id })));
        if (fields?.length) await tx.insert(schema.productFields).values(fields.map((x) => ({ ...x, productId: row.id })));
      }

      await tx.insert(schema.paymentMethods).values(paymentMethods).onConflictDoNothing({ target: schema.paymentMethods.code });

      const existing = await tx.query.storeSettings.findFirst({ where: eq(schema.storeSettings.key, "store") });
      if (!existing) await tx.insert(schema.storeSettings).values({ key: "store", value: storeSettingsSchema.parse({}) });

      console.log(`Seed complete: ${created} new sample products (${products.length - created} already present).`);
    });
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
  seed(url).catch((e) => {
    console.error("Seed failed:", e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
