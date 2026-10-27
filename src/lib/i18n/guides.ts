import type { GuideArtVariant } from "@/components/store/guide-art";
import type { Locale } from "./config";

/*
 * How-to guides (public, indexable). Each guide explains one task customers
 * ask about, links to the services it helps with, and carries an original
 * illustration. Wording avoids promising anything the store does not do.
 */

type L10n = Record<Locale, string>;

export type Guide = {
  slug: string;
  title: L10n;
  description: L10n;
  art: { variant: GuideArtVariant; title: L10n; a?: L10n; b?: L10n };
  steps: Record<Locale, string[]>;
  tips: Record<Locale, string[]>;
  faq: Record<Locale, { q: string; a: string }[]>;
  /** Product slugs this guide helps with. */
  products: string[];
  updated: string;
};

const both = (ar: string, en: string): L10n => ({ ar, en });
const UPDATED = "2026-10-27";

export const GUIDES: Guide[] = [
  {
    slug: "pubg-mobile-player-id",
    title: both("شلون تلكى رقم اللاعب (ID) في ببجي موبايل", "How to find your PUBG Mobile player ID"),
    description: both(
      "خطوات بسيطة مع صورة توضيحية لمعرفة رقم ID في ببجي موبايل ونسخه، حتى تشحن شدات UC بأمان بدون كلمة المرور.",
      "Simple illustrated steps to find and copy your PUBG Mobile ID so you can top up UC safely — no password needed.",
    ),
    art: { variant: "game-id", title: both("PUBG MOBILE", "PUBG MOBILE"), a: both("اضغط أيقونة النسخ بجانب الرقم", "Tap the copy icon next to the number") },
    steps: {
      ar: [
        "افتح لعبة ببجي موبايل وانتظر حتى تظهر الشاشة الرئيسية (اللوبي).",
        "اضغط على صورتك الشخصية في أعلى زاوية الشاشة.",
        "يظهر رقمك (ID) تحت اسمك أو بجانبه. اضغط أيقونة النسخ بجانبه.",
        "الصق الرقم في خانة «رقم اللاعب» عند الطلب، وتأكد منه رقماً رقماً قبل الإرسال.",
      ],
      en: [
        "Open PUBG Mobile and wait for the main screen (lobby).",
        "Tap your profile picture in the top corner of the screen.",
        "Your ID appears under or next to your name. Tap the copy icon beside it.",
        "Paste it into the “Player ID” field when ordering and check it digit by digit before sending.",
      ],
    },
    tips: {
      ar: ["رقم ID أرقام فقط بدون حروف أو مسافات.", "لا نطلب كلمة المرور أو رمز التحقق أبداً — الرقم وحده يكفي.", "الشحن على رقم خاطئ قد لا يمكن استرجاعه، لذلك تأكد منه."],
      en: ["The ID is digits only, with no letters or spaces.", "We never ask for your password or a verification code — the ID is enough.", "A top-up sent to a wrong ID may not be refundable, so double-check it."],
    },
    faq: {
      ar: [
        { q: "كم يستغرق وصول الشدات؟", a: "عادةً من 10 إلى 20 دقيقة بعد تأكيد الدفع." },
        { q: "هل تحتاجون الدخول إلى حسابي؟", a: "لا. نحتاج رقم ID فقط، ويمكنك كتابة اسم اللاعب للتأكيد." },
      ],
      en: [
        { q: "How long does UC take to arrive?", a: "Usually 10–20 minutes after payment is confirmed." },
        { q: "Do you need to log in to my account?", a: "No. We only need your ID; you can add your player name for confirmation." },
      ],
    },
    products: ["pubg-mobile-uc"],
    updated: UPDATED,
  },
  {
    slug: "mobile-legends-id-zone",
    title: both("شلون تلكى ID و Zone ID في موبايل ليجندز", "How to find your Mobile Legends ID and Zone ID"),
    description: both(
      "تعرّف على مكان رقم اللاعب ورقم السيرفر (Zone ID) في Mobile Legends: Bang Bang حتى يوصلك شحن الألماس بدون أخطاء.",
      "Find your player ID and server (Zone) ID in Mobile Legends: Bang Bang so your diamond top-up arrives without mistakes.",
    ),
    art: { variant: "game-zone", title: both("MOBILE LEGENDS", "MOBILE LEGENDS"), a: both("الرقم بين القوسين هو Zone ID", "The number in brackets is the Zone ID") },
    steps: {
      ar: [
        "افتح اللعبة واضغط على صورتك الشخصية في أعلى زاوية الشاشة.",
        "يظهر رقمك وبعده رقم بين قوسين، مثل: 123456789 (1234).",
        "الرقم الأول هو ID، والرقم بين القوسين هو Zone ID (رقم السيرفر).",
        "اكتب كل رقم في خانته عند الطلب، بدون الأقواس.",
      ],
      en: [
        "Open the game and tap your profile picture in the top corner.",
        "You will see your number followed by a number in brackets, e.g. 123456789 (1234).",
        "The first number is your ID; the number in brackets is your Zone ID (server).",
        "Enter each number in its own field when ordering, without the brackets.",
      ],
    },
    tips: {
      ar: ["الاثنان مطلوبان: بدون Zone ID ما يمكن الشحن.", "لا نطلب كلمة المرور أبداً."],
      en: ["Both are required: the top-up cannot be sent without the Zone ID.", "We never ask for your password."],
    },
    faq: {
      ar: [{ q: "كم يستغرق وصول الألماس؟", a: "عادةً من 10 إلى 20 دقيقة بعد تأكيد الدفع." }],
      en: [{ q: "How long do diamonds take?", a: "Usually 10–20 minutes after payment is confirmed." }],
    },
    products: ["mobile-legends-diamonds"],
    updated: UPDATED,
  },
  {
    slug: "ludo-star-player-id",
    title: both("شلون تلكى رقم اللاعب في لودو ستار", "How to find your Ludo Star player ID"),
    description: both("خطوات معرفة رقم ID في لودو ستار لشحن الألماس والذهب.", "Steps to find your Ludo Star ID for diamond and gold top-ups."),
    art: { variant: "game-id", title: both("LUDO STAR", "LUDO STAR"), a: both("انسخ الرقم الظاهر في ملفك", "Copy the number shown in your profile") },
    steps: {
      ar: [
        "افتح لودو ستار من نفس الحساب اللي تريد تشحنه.",
        "اضغط على صورتك الشخصية لفتح ملفك.",
        "انسخ رقم ID الظاهر في الملف.",
        "الصقه في خانة «رقم اللاعب» عند الطلب.",
      ],
      en: [
        "Open Ludo Star on the account you want to top up.",
        "Tap your profile picture to open your profile.",
        "Copy the ID shown in the profile.",
        "Paste it into the “Player ID” field when ordering.",
      ],
    },
    tips: {
      ar: ["تأكد أنك في الحساب الصحيح إذا عندك أكثر من حساب.", "لا نطلب كلمة المرور أبداً."],
      en: ["Make sure you are on the right account if you have more than one.", "We never ask for your password."],
    },
    faq: {
      ar: [{ q: "كم يستغرق الشحن؟", a: "عادةً من 10 إلى 20 دقيقة بعد تأكيد الدفع." }],
      en: [{ q: "How long does it take?", a: "Usually 10–20 minutes after payment is confirmed." }],
    },
    products: ["ludo-star-diamonds", "ludo-star-gold"],
    updated: UPDATED,
  },
  {
    slug: "pay-with-super-qi",
    title: both("شلون تدفع بسوبر كي (كي كارد)", "How to pay with Super Qi (Qi Card)"),
    description: both(
      "ادفع طلبك أو اشحن محفظتك بتطبيق سوبر كي: امسح رمز QR أو حوّل إلى رقم البطاقة، ثم أرسل رقم العملية أو صورة الإيصال.",
      "Pay for an order or top up your wallet with the Super Qi app: scan the QR code or transfer to the card number, then send the transaction number or receipt.",
    ),
    art: { variant: "scan-qr", title: both("Super Qi", "Super Qi"), a: both("المبلغ المطلوب بالضبط", "The exact amount due"), b: both("تأكيد", "Confirm") },
    steps: {
      ar: [
        "اختر «كي كارد (سوبر كي)» عند إتمام الطلب أو عند شحن المحفظة.",
        "افتح تطبيق سوبر كي واختر مسح رمز QR، وامسح الرمز الظاهر في صفحة الطلب.",
        "إذا كنت تفتح الصفحة من نفس التلفون، احفظ صورة الرمز أو حوّل مباشرة إلى رقم البطاقة 2025988359 (باسم حسين رافد).",
        "اكتب المبلغ المطلوب بالضبط وأكّد العملية.",
        "انسخ رقم العملية أو صوّر الإيصال، وأرسله من صفحة الطلب.",
      ],
      en: [
        "Choose “Qi Card (Super Qi)” at checkout or when topping up your wallet.",
        "Open the Super Qi app, choose scan QR, and scan the code shown on the order page.",
        "If you are on the same phone, save the QR image or transfer directly to card number 2025988359 (name: Hussein Rafid).",
        "Enter the exact amount due and confirm.",
        "Copy the transaction number or take a screenshot of the receipt and send it from the order page.",
      ],
    },
    tips: {
      ar: ["لا تعطي رقم بطاقتك أو رمزك السري لأي أحد، حتى لو قال إنه من المتجر.", "يكفي رقم العملية أو صورة الإيصال — واحد منهم."],
      en: ["Never give your own card number or PIN to anyone, even if they say they are from the store.", "Either the transaction number or the receipt photo is enough."],
    },
    faq: {
      ar: [{ q: "متى يتأكد الدفع؟", a: "نراجع الإثبات يدوياً، وعادةً خلال 10 إلى 20 دقيقة في أوقات العمل." }],
      en: [{ q: "When is the payment confirmed?", a: "We check the proof manually, usually within 10–20 minutes during working hours." }],
    },
    products: [],
    updated: UPDATED,
  },
  {
    slug: "pay-with-zain-cash",
    title: both("شلون تدفع بزين كاش", "How to pay with Zain Cash"),
    description: both("خطوات التحويل بزين كاش إلى المتجر وإرسال رقم العملية لتأكيد طلبك.", "Steps to transfer with Zain Cash and send the transaction number to confirm your order."),
    art: { variant: "wallet-transfer", title: both("Zain Cash", "Zain Cash"), a: both("تحويل", "Send"), b: both("رقم العملية", "Transaction no.") },
    steps: {
      ar: [
        "افتح تطبيق زين كاش واختر تحويل الأموال.",
        "اكتب رقم المتجر 07757382822.",
        "اكتب المبلغ المطلوب بالضبط وأكّد برمزك السري (لا تعطيه لأحد).",
        "بعد التحويل يظهر إيصال فيه رقم العملية: انسخه أو صوّر الشاشة.",
        "أرسل رقم العملية أو الصورة من صفحة الطلب.",
      ],
      en: [
        "Open the Zain Cash app and choose money transfer.",
        "Enter the store number 07757382822.",
        "Enter the exact amount due and confirm with your PIN (never share it).",
        "A receipt with the transaction number appears: copy it or take a screenshot.",
        "Send the transaction number or the screenshot from the order page.",
      ],
    },
    tips: {
      ar: ["حوّل المبلغ بالضبط حتى يتأكد الطلب بسرعة."],
      en: ["Transfer the exact amount so the order can be confirmed quickly."],
    },
    faq: {
      ar: [{ q: "حوّلت مبلغ أقل أو أكثر، شنو أسوي؟", a: "تواصل معنا من صفحة الطلب ونرتب الفرق." }],
      en: [{ q: "I sent a different amount — what now?", a: "Contact us from the order page and we will sort out the difference." }],
    },
    products: [],
    updated: UPDATED,
  },
  {
    slug: "pay-with-asiacell",
    title: both("شلون تدفع برصيد آسياسيل", "How to pay with AsiaCell credit"),
    description: both("ادفع بتحويل رصيد آسياسيل إلى رقم المتجر، ثم أرسل لقطة شاشة رسالة التأكيد.", "Pay by transferring AsiaCell credit to the store number, then send a screenshot of the confirmation."),
    art: { variant: "wallet-transfer", title: both("AsiaCell", "AsiaCell"), a: both("تحويل الرصيد", "Transfer credit"), b: both("رسالة التأكيد", "Confirmation") },
    steps: {
      ar: [
        "استخدم خدمة تحويل الرصيد الرسمية من آسياسيل (من التطبيق أو كود الخدمة).",
        "حوّل المبلغ المطلوب بالضبط إلى الرقم 07757382822.",
        "صوّر رسالة تأكيد التحويل.",
        "أرسل الصورة من صفحة الطلب.",
      ],
      en: [
        "Use AsiaCell's official credit-transfer service (from the app or the service code).",
        "Transfer the exact amount due to 07757382822.",
        "Take a screenshot of the transfer confirmation.",
        "Send the screenshot from the order page.",
      ],
    },
    tips: {
      ar: ["إذا آسياسيل تخصم أجور تحويل، تأكد أن المبلغ الواصل يساوي المطلوب."],
      en: ["If AsiaCell charges a transfer fee, make sure the amount received equals the amount due."],
    },
    faq: { ar: [], en: [] },
    products: [],
    updated: UPDATED,
  },
  {
    slug: "wallet-top-up",
    title: both("شلون تشحن محفظتك في متجر حسوني وتدفع منها", "How to top up your Hassouni wallet and pay with it"),
    description: both("أنشئ حساباً باسم مستخدم، اشحن رصيدك مرة وحدة، وادفع طلباتك بضغطة بدون إيصال لكل طلب.", "Create an account with a username, top up once, and pay for orders in one tap without a receipt each time."),
    art: { variant: "scan-qr", title: both("محفظتي", "My wallet"), a: both("مبلغ الشحن", "Top-up amount"), b: both("أرسل طلب الشحن", "Send request") },
    steps: {
      ar: [
        "أنشئ حساباً واختر اسم مستخدم (هذا هو معرّف محفظتك).",
        "من «حسابي» افتح «محفظتي» واضغط «اشحن رصيدك».",
        "اختر المبلغ وطريقة الدفع، وحوّل المبلغ بالضبط إلى الرقم الظاهر أو امسح رمز QR.",
        "أرسل رقم العملية أو صورة الإيصال. نراجعه ونضيف الرصيد خلال 10 إلى 20 دقيقة.",
        "عند إتمام أي طلب اختر «رصيد المحفظة» ويتأكد الدفع فوراً.",
      ],
      en: [
        "Create an account and choose a username (this is your wallet ID).",
        "From “My account”, open “My wallet” and press “Top up”.",
        "Choose the amount and payment method, then transfer the exact amount or scan the QR code.",
        "Send the transaction number or receipt. We review it and add the balance within 10–20 minutes.",
        "At checkout choose “Wallet balance” and the payment is confirmed instantly.",
      ],
    },
    tips: {
      ar: ["إذا انرجع مبلغ طلب مدفوع من المحفظة، يرجع لمحفظتك تلقائياً.", "اسم المستخدم ما يتغير، فاختره بعناية."],
      en: ["If an order paid from the wallet is refunded, the money returns to your wallet automatically.", "Your username cannot be changed, so choose it carefully."],
    },
    faq: {
      ar: [{ q: "هل الرصيد يروح إذا حذفت الحساب؟", a: "ما نسمح بحذف حساب فيه رصيد. تواصل معنا لاسترجاع رصيدك أولاً." }],
      en: [{ q: "Is my balance lost if I delete my account?", a: "Accounts with a balance cannot be deleted. Contact us to get your balance back first." }],
    },
    products: [],
    updated: UPDATED,
  },
  {
    slug: "redeem-gift-cards",
    title: both("شلون تفعّل بطاقات بلايستيشن وستيم وجوجل بلاي وآب ستور وإكس بوكس", "How to redeem PlayStation, Steam, Google Play, App Store and Xbox gift cards"),
    description: both(
      "خطوات استبدال كود البطاقة في كل متجر، مع تنبيه مهم عن منطقة الحساب (أمريكي).",
      "How to redeem the card code in each store, with an important note about the account region (US).",
    ),
    art: { variant: "gift-redeem", title: both("Store", "Store"), a: both("استبدال كود", "Redeem code"), b: both("استبدال", "Redeem") },
    steps: {
      ar: [
        "بلايستيشن: من موقع متجر بلايستيشن سجّل دخولك ← صورة حسابك ← «استبدال الرموز»، أو من الجهاز: PlayStation Store ← «…» ← استبدال الرمز.",
        "ستيم: من برنامج Steam اختر Games ← Redeem a Steam Wallet Code، أو من صفحة استبدال رصيد المحفظة في موقع Steam.",
        "جوجل بلاي: افتح Play Store ← صورة حسابك ← الدفعات والاشتراكات ← استخدام رمز هدية.",
        "آب ستور: افتح App Store ← صورة حسابك ← «استرداد بطاقة هدايا أو رمز».",
        "إكس بوكس: من متجر مايكروسوفت أو موقع redeem.microsoft.com ← اكتب الكود.",
      ],
      en: [
        "PlayStation: on the PlayStation Store website sign in → your avatar → “Redeem codes”, or on the console: PlayStation Store → “…” → Redeem code.",
        "Steam: in the Steam app choose Games → Redeem a Steam Wallet Code, or use the wallet-code page on the Steam website.",
        "Google Play: open Play Store → your profile picture → Payments & subscriptions → Redeem gift code.",
        "App Store: open App Store → your profile picture → “Redeem Gift Card or Code”.",
        "Xbox: in the Microsoft Store or at redeem.microsoft.com → enter the code.",
      ],
    },
    tips: {
      ar: [
        "بطاقاتنا للحساب الأمريكي (US). الكود يشتغل فقط على حساب منطقته أمريكا.",
        "يصلك الكود في صفحة طلبك (قسم «تفاصيل التسليم») بعد تأكيد التحويل.",
        "لا تشارك الكود مع أحد قبل ما تستخدمه.",
      ],
      en: [
        "Our cards are for US accounts. The code only works on an account whose region is the United States.",
        "You receive the code on your order page (“Delivery details”) after the transfer is confirmed.",
        "Do not share the code with anyone before you use it.",
      ],
    },
    faq: {
      ar: [{ q: "كم يستغرق وصول الكود؟", a: "عادةً من 10 إلى 20 دقيقة بعد تأكيد الدفع." }],
      en: [{ q: "How long until I get the code?", a: "Usually 10–20 minutes after payment is confirmed." }],
    },
    products: ["playstation-gift-card", "steam-gift-card", "google-play-gift-card", "app-store-gift-card", "xbox-gift-card"],
    updated: UPDATED,
  },
  {
    slug: "telegram-premium-stars",
    title: both("شلون تشتري تلكرام بريميوم ونجوم تلكرام بدون كلمة مرور", "How to get Telegram Premium and Stars without sharing a password"),
    description: both("نحتاج فقط اسم المستخدم في تلكرام. هنا شلون تلكاه وتنسخه.", "We only need your Telegram username. Here is how to find and copy it."),
    art: { variant: "telegram-username", title: both("Telegram", "Telegram"), a: both("اسم المستخدم", "Username") },
    steps: {
      ar: [
        "افتح تلكرام واذهب إلى الإعدادات.",
        "اضغط على «اسم المستخدم» وانسخه (يبدأ بـ @).",
        "إذا ما عندك اسم مستخدم، أنشئ واحداً من نفس المكان.",
        "الصق اسم المستخدم في خانة الطلب.",
      ],
      en: [
        "Open Telegram and go to Settings.",
        "Tap “Username” and copy it (it starts with @).",
        "If you do not have a username, create one in the same place.",
        "Paste the username into the order field.",
      ],
    },
    tips: {
      ar: ["لا نطلب رقم هاتفك أو رمز تسجيل الدخول أبداً. لا تعطي رمز تلكرام لأي أحد."],
      en: ["We never ask for your phone number or login code. Never give a Telegram code to anyone."],
    },
    faq: { ar: [], en: [] },
    products: ["telegram-premium", "telegram-stars"],
    updated: UPDATED,
  },
  {
    slug: "copy-profile-or-post-link",
    title: both("شلون تنسخ رابط حسابك أو منشورك (إنستغرام، تيك توك، فيسبوك)", "How to copy your profile or post link (Instagram, TikTok, Facebook)"),
    description: both("خطوات نسخ الرابط الصحيح من كل منصة حتى يوصل طلبك للحساب أو المنشور الصحيح.", "Steps to copy the right link from each platform so your order reaches the right account or post."),
    art: { variant: "social-link", title: both("Profile", "Profile"), a: both("نسخ الرابط", "Copy link") },
    steps: {
      ar: [
        "إنستغرام (الحساب): افتح ملفك ← «مشاركة الملف الشخصي» ← «نسخ الرابط».",
        "إنستغرام (منشور أو ريلز): افتح المنشور ← زر المشاركة أو «…» ← «نسخ الرابط».",
        "تيك توك: افتح الفيديو أو ملفك ← زر المشاركة ← «نسخ الرابط».",
        "فيسبوك: افتح الصفحة أو الملف ← «…» ← «نسخ الرابط».",
        "الصق الرابط في خانة الطلب كما هو.",
      ],
      en: [
        "Instagram (account): open your profile → “Share profile” → “Copy link”.",
        "Instagram (post or reel): open it → the share button or “…” → “Copy link”.",
        "TikTok: open the video or your profile → share button → “Copy link”.",
        "Facebook: open the page or profile → “…” → “Copy link”.",
        "Paste the link into the order field as it is.",
      ],
    },
    tips: {
      ar: ["لازم يكون الحساب عاماً (مو خاص) طول فترة التنفيذ.", "لا نطلب كلمة المرور أبداً."],
      en: ["The account must stay public while the order is being delivered.", "We never ask for your password."],
    },
    faq: { ar: [], en: [] },
    products: ["instagram-followers", "instagram-likes", "tiktok-followers", "tiktok-likes", "tiktok-views", "facebook-followers"],
    updated: UPDATED,
  },
  {
    slug: "track-order-and-notifications",
    title: both("شلون تتابع طلبك وتفعّل الإشعارات", "How to track your order and turn on notifications"),
    description: both("تابع حالة طلبك برقم الطلب ورمز الوصول، وفعّل الإشعارات حتى يوصلك تنبيه عند كل تحديث.", "Track your order with its reference and access key, and turn on notifications for every update."),
    art: { variant: "order-track", title: both("الطلب", "Order"), a: both("رقم الطلب", "Order reference"), b: both("الإشعارات", "Notifications") },
    steps: {
      ar: [
        "بعد الطلب تظهر صفحة فيها رقم الطلب ورمز الوصول: احفظهم أو احفظ رابط الصفحة.",
        "من «تتبع طلب» اكتب الرقم والرمز لفتح الطلب في أي وقت.",
        "في صفحة الطلب اضغط «فعّل إشعارات هذا الطلب» حتى يوصلك تنبيه عند تأكيد الدفع والتنفيذ والتسليم.",
        "على آيفون: ثبّت التطبيق على الشاشة الرئيسية أولاً حتى تشتغل الإشعارات.",
      ],
      en: [
        "After ordering you get a page with the order reference and access key: save them or bookmark the page.",
        "Use “Track order” with the reference and key to open the order any time.",
        "On the order page press “Notify me about this order” to get alerts when payment is confirmed, work starts and it is delivered.",
        "On iPhone: install the app to your home screen first so notifications work.",
      ],
    },
    tips: {
      ar: ["إذا سجلت دخول، تلكى كل طلباتك في «حسابي» بدون رمز."],
      en: ["If you are logged in, all your orders are in “My account” with no key needed."],
    },
    faq: { ar: [], en: [] },
    products: [],
    updated: UPDATED,
  },
  {
    slug: "social-media-account-management",
    title: both("إدارة حسابات السوشل ميديا: شنو تشمل وشلون نشتغل بأمان", "Social media account management: what is included and how we work safely"),
    description: both(
      "الفرق بين الباقات، شنو نحتاج منك، وشلون نضاف كمسؤول على صفحتك بدون ما تعطينا كلمة المرور.",
      "The difference between packages, what we need from you, and how we are added as a manager without your password.",
    ),
    art: { variant: "social-link", title: both("Business Suite", "Business Suite"), a: both("إضافة شريك / مسؤول", "Add partner / admin") },
    steps: {
      ar: [
        "اختر المنصة ونوع الحساب (شخصي، تجاري، متجر) والباقة المناسبة.",
        "اكتب رابط الحساب ونبذة عن نشاطك والجمهور اللي تستهدفه.",
        "بعد تأكيد الدفع نتواصل وياك لنتفق على الخطة والمحتوى.",
        "نضاف كمسؤول أو شريك من Meta Business Suite (إنستغرام وفيسبوك)، أو كمحرر في الأدوات الرسمية — بدون كلمة المرور.",
        "نرسل لك تقرير شهري بالنتائج حسب الباقة.",
      ],
      en: [
        "Choose the platform, account type (personal, business, store) and package.",
        "Add the account link and a short description of your business and audience.",
        "After payment is confirmed we contact you to agree on the plan and content.",
        "We are added as a manager or partner in Meta Business Suite (Instagram & Facebook), or as an editor in official tools — no password.",
        "You get a monthly report according to your package.",
      ],
    },
    tips: {
      ar: ["ميزانية الإعلانات الممولة غير مشمولة بسعر الإدارة وتدفعها أنت للمنصة مباشرة.", "تقدر تلغي صلاحيتنا من إعدادات حسابك بأي وقت."],
      en: ["Ad spend is not included in the management fee; you pay it to the platform directly.", "You can remove our access from your account settings at any time."],
    },
    faq: {
      ar: [{ q: "هل تضمنون عدد متابعين معين؟", a: "لا. الإدارة تعني محتوى منتظم وتفاعل وإعلانات مدروسة؛ النتائج تختلف حسب نشاطك وجمهورك." }],
      en: [{ q: "Do you guarantee a number of followers?", a: "No. Management means consistent content, engagement and well-planned ads; results depend on your business and audience." }],
    },
    products: ["manage-instagram", "manage-tiktok", "manage-facebook", "manage-all-platforms", "manage-ad-campaigns"],
    updated: UPDATED,
  },
];

export function getGuide(slug: string): Guide | undefined {
  return GUIDES.find((g) => g.slug === slug);
}

/** Guide shown as "Where do I find this?" on a product page. */
export function guideForProduct(productSlug: string): Guide | undefined {
  return GUIDES.find((g) => g.products.includes(productSlug));
}

/** Payment how-to per payment method code. */
export const PAYMENT_GUIDES: Record<string, string> = {
  mastercard: "pay-with-super-qi",
  zain_cash: "pay-with-zain-cash",
  asiacell: "pay-with-asiacell",
};
