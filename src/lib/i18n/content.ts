import type { Locale } from "./config";

export type FaqItem = { q: string; a: string };

export const faq: Record<Locale, FaqItem[]> = {
  ar: [
    {
      q: "كيف أدفع ثمن طلبي؟",
      a: "ندعم زين كاش وآسياسيل وماستر كارد. بعد إنشاء الطلب تظهر لك بيانات الدفع، ادفع المبلغ ثم أرسل رقم العملية أو صورة الإيصال من صفحة الطلب.",
    },
    {
      q: "هل يتم تأكيد الدفع تلقائياً؟",
      a: "لا. يراجع فريق المتجر كل عملية دفع يدوياً قبل بدء التنفيذ، وستتغير حالة الطلب إلى «مدفوع» بعد التحقق.",
    },
    {
      q: "هل تطلبون كلمة مرور حسابي؟",
      a: "أبداً. لا نطلب كلمات مرور حسابات السوشل ميديا أو الألعاب ولا رموز التحقق. إذا طلب منك أحد ذلك باسمنا فهو احتيال.",
    },
    {
      q: "كم يستغرق تنفيذ الطلب؟",
      a: "تختلف المدة حسب الخدمة، وتظهر المدة المتوقعة في صفحة كل خدمة. تبدأ المدة بعد تأكيد الدفع.",
    },
    {
      q: "كيف أتابع طلبي؟",
      a: "من صفحة «تتبع طلب» باستخدام رقم الطلب ورمز الوصول، أو من صفحة «حسابي» إذا كنت مسجّل الدخول.",
    },
    {
      q: "هل يمكنني إلغاء الطلب أو استرجاع المبلغ؟",
      a: "يمكن إلغاء الطلب قبل بدء التنفيذ. تفاصيل الاسترجاع موضحة في سياسة الاسترجاع والإلغاء.",
    },
    {
      q: "كيف أتواصل معكم بسرعة؟",
      a: "اضغط زر المحادثة 💬 في زاوية الموقع. يصلك رد تلقائي فوراً، ويرد عليك فريقنا في نفس المحادثة. ويمكنك أيضاً مراسلتنا على واتساب أو تلكرام أو إنستغرام.",
    },
    {
      q: "هل الخدمات التي لا أجدها في المتجر متوفرة؟",
      a: "اطلبها من صفحة «طلب خدمة خاصة» (مثل الترويج، تجهيز الحسابات، تبديل الرصيد، اشتراكات أخرى) ونرد عليك بالسعر.",
    },
  ],
  en: [
    {
      q: "How do I pay for my order?",
      a: "We accept Zain Cash, AsiaCell and Mastercard. After you place the order you will see the payment details; pay the amount, then send the transaction number or a receipt photo from the order page.",
    },
    {
      q: "Is payment confirmed automatically?",
      a: "No. The store team reviews every payment manually before starting work. The order status changes to “Paid” after verification.",
    },
    {
      q: "Do you ask for my account password?",
      a: "Never. We do not ask for social media or gaming passwords or verification codes. Anyone asking for them in our name is a scammer.",
    },
    {
      q: "How long does delivery take?",
      a: "It depends on the service; the estimated time is shown on each service page. It starts after payment is confirmed.",
    },
    {
      q: "How do I track my order?",
      a: "Use the “Track order” page with your order reference and access key, or the “My account” page if you are logged in.",
    },
    {
      q: "Can I cancel or get a refund?",
      a: "Orders can be cancelled before work starts. Refund details are explained in the refund and cancellation policy.",
    },
    {
      q: "How can I reach you quickly?",
      a: "Tap the chat button 💬 in the corner of the site. You get an instant auto-reply and our team answers in the same chat. You can also message us on WhatsApp, Telegram or Instagram.",
    },
    {
      q: "Can I order services that aren't listed?",
      a: "Yes — use the “Custom request” page (promotion, account setup, balance exchange, other subscriptions) and we will reply with a price.",
    },
  ],
};

/**
 * Default policy templates. They are starting points the store owner MUST
 * review (ideally with legal advice) and edit from Admin → Settings.
 */
export const defaultPolicies = {
  termsAr: `## مقدمة
باستخدامك لموقع متجر حسوني لخدمات السوشل ميديا وإنشائك طلباً، فإنك توافق على هذه الشروط.

## الطلبات والدفع
- الأسعار بالدينار العراقي، ويُحسب المجموع النهائي من قبل المتجر عند إنشاء الطلب.
- يتم التحقق من الدفع يدوياً، ولا يبدأ التنفيذ قبل تأكيد الدفع.
- إرسال إيصال الدفع لا يعني تأكيد الطلب.

## مسؤولية العميل
- يلتزم العميل بإدخال بيانات صحيحة (مثل رقم اللاعب أو رابط الحساب).
- لا يطلب المتجر كلمات المرور أو رموز التحقق، ويجب عدم مشاركتها مع أي جهة.

## الخدمات
- نقدم فقط الخدمات المشروعة والمصرح بها. يحق للمتجر رفض أي طلب مخالف.
- مدد التنفيذ تقديرية وقد تختلف.

## التواصل
للاستفسار تواصل معنا عبر القنوات الموضحة في صفحة «تواصل معنا».

## شروط خاصة بكل خدمة
- شحن الألعاب (ببجي، لودو...): يتم برقم اللاعب فقط. الشحن لرقم لاعب خاطئ أدخله العميل لا يمكن استرجاعه.
- المتابعين واللايكات والمشاهدات: يجب أن يكون الحساب أو المنشور عاماً طوال فترة التنفيذ. قد يحدث نقص طبيعي بمرور الوقت بسبب سياسات المنصات، ولا يتحمل المتجر إجراءات المنصات على الحسابات.
- الاشتراكات الرقمية: تُفعّل بالتنسيق مع الدعم بعد تأكيد الدفع، ولا نطلب كلمة المرور أو رمز التحقق أبداً.
- الأرقام: للاستخدام المشروع فقط. يُمنع استخدامها في الاحتيال أو الإزعاج أو انتحال الشخصية، ويحق للمتجر رفض أي طلب.
- تبديل الرصيد: يتم فقط بعد استلام المبلغ والتحقق منه، ويحق للمتجر رفض أو إيقاف أي عملية مشبوهة.
- التصاميم: تشمل تعديلات بسيطة على التصميم المتفق عليه؛ التغييرات الكبيرة تُعامل كطلب جديد.

## الدعم
يمكنك التواصل معنا عبر المحادثة المباشرة داخل الموقع أو واتساب أو تلكرام أو إنستغرام.`,
  termsEn: `## Introduction
By using the Hassouni Digital Services website and placing an order, you agree to these terms.

## Orders and payment
- Prices are in Iraqi Dinar; the final total is calculated by the store when the order is created.
- Payments are verified manually and work does not start before payment is confirmed.
- Sending a payment receipt does not by itself confirm the order.

## Customer responsibilities
- You must provide accurate details (such as a player ID or profile link).
- The store never asks for passwords or verification codes; do not share them with anyone.

## Services
- We offer only lawful, authorized services and may refuse any order that is not.
- Delivery times are estimates and may vary.

## Contact
For questions, reach us through the channels listed on the Contact page.

## Service-specific terms
- Game top-ups (PUBG, Ludo...): delivered using the player ID only. Top-ups sent to a wrong player ID entered by the customer cannot be refunded.
- Followers, likes and views: the account or post must stay public during delivery. Natural drops may happen over time due to platform policies; the store is not responsible for actions platforms take on accounts.
- Digital subscriptions: activated with support after payment is confirmed. We never ask for passwords or verification codes.
- Numbers: lawful use only. Fraud, spam or impersonation is forbidden and the store may refuse any order.
- Balance exchange: carried out only after the amount is received and verified; the store may refuse or stop any suspicious transaction.
- Design: includes minor revisions of the agreed design; major changes are treated as a new request.

## Support
Reach us through the live chat on the site, WhatsApp, Telegram or Instagram.`,
  privacyAr: `## البيانات التي نجمعها
نجمع فقط ما نحتاجه لتنفيذ طلبك: الاسم، رقم الهاتف، البريد الإلكتروني (اختياري)، بيانات الخدمة المطلوبة، ومعلومات إثبات الدفع.

## ما لا نجمعه
لا نطلب ولا نخزن كلمات مرور الحسابات أو أرقام البطاقات المصرفية أو رمز CVV أو الرمز السري.

## استخدام البيانات
نستخدم بياناتك لتنفيذ الطلب والتواصل معك بخصوصه فقط، ولا نبيعها لأي طرف.

## الاحتفاظ بالبيانات
نحتفظ بالبيانات الشخصية للطلبات المنتهية لمدة محددة ثم نحذفها، ونحتفظ بالبيانات المالية غير الشخصية للسجلات.

## حقوقك
يمكنك طلب حذف حسابك وبياناتك عبر التواصل معنا أو من صفحة حسابك.

## التقييمات
عند تقييم طلب مكتمل يظهر للجميع التقييم والتعليق والاسم الذي تختاره فقط، مع علامة «مشتري موثّق». لا يظهر رقم هاتفك أو بريدك أو تفاصيل طلبك.

## الإشعارات
إذا فعّلت إشعارات الطلب نحفظ عنوان الإشعارات الخاص بمتصفحك لهذا الطلب فقط، ونستخدمه لإرسال تحديثات حالته، ونحذفه مع بيانات الطلب. يمكنك إيقافها في أي وقت من صفحة الطلب.`,
  privacyEn: `## Data we collect
We collect only what we need to fulfil your order: name, phone number, optional email, the service details you provide, and payment proof information.

## What we never collect
We never ask for or store account passwords, card numbers, CVV codes or PINs.

## How we use data
Your data is used only to fulfil and communicate about your order. We do not sell it.

## Retention
Personal data on finished orders is kept for a limited period and then erased. Non-personal financial records are kept for bookkeeping.

## Your rights
You can request deletion of your account and data by contacting us or from your account page.

## Reviews
When you review a completed order, only the rating, your comment and the display name you choose are shown publicly, marked “Verified buyer”. Your phone, email and order details are never shown.

## Notifications
If you turn on order notifications, we store your browser's push address for that order only, use it to send status updates, and delete it with the order data. You can turn them off at any time from the order page.`,
  refundAr: `## الإلغاء
يمكن إلغاء الطلب قبل تأكيد الدفع أو قبل بدء التنفيذ بالتواصل مع الدعم.

## الاسترجاع
- إذا تعذّر تنفيذ الخدمة لسبب يعود للمتجر، يُعاد المبلغ المدفوع.
- لا يمكن استرجاع المبلغ بعد اكتمال تنفيذ الخدمة الرقمية، إلا إذا كانت الخدمة غير مطابقة للوصف.
- الأخطاء في البيانات التي يدخلها العميل (مثل رقم لاعب خاطئ) قد لا تكون قابلة للاسترجاع.
- الاشتراكات والأرقام بعد تفعيلها أو تسليمها لا يمكن استرجاعها إلا إذا كانت لا تعمل كما هو موصوف.
- عند الاسترجاع يُعاد المبلغ بنفس طريقة الدفع قدر الإمكان.

## المدة
تتم مراجعة طلبات الاسترجاع يدوياً، ويتم الرد عليها في أقرب وقت ممكن.`,
  refundEn: `## Cancellation
You can cancel an order before payment is confirmed or before work starts by contacting support.

## Refunds
- If the store cannot deliver the service, the amount paid is refunded.
- Completed digital services cannot be refunded unless they did not match the description.
- Mistakes in details provided by the customer (such as a wrong player ID) may not be refundable.
- Subscriptions and numbers cannot be refunded once activated or delivered, unless they do not work as described.
- Refunds are returned through the original payment method where possible.

## Timing
Refund requests are reviewed manually and answered as soon as possible.`,
} as const;

/** Policy sections added after launch; appended to stored policies by a one-time content update. */
export const privacyAdditions = {
  ar: `

## التقييمات
عند تقييم طلب مكتمل يظهر للجميع التقييم والتعليق والاسم الذي تختاره فقط، مع علامة «مشتري موثّق». لا يظهر رقم هاتفك أو بريدك أو تفاصيل طلبك.

## الإشعارات
إذا فعّلت إشعارات الطلب نحفظ عنوان الإشعارات الخاص بمتصفحك لهذا الطلب فقط، ونستخدمه لإرسال تحديثات حالته، ونحذفه مع بيانات الطلب. يمكنك إيقافها في أي وقت من صفحة الطلب.`,
  en: `

## Reviews
When you review a completed order, only the rating, your comment and the display name you choose are shown publicly, marked “Verified buyer”. Your phone, email and order details are never shown.

## Notifications
If you turn on order notifications, we store your browser's push address for that order only, use it to send status updates, and delete it with the order data. You can turn them off at any time from the order page.`,
} as const;
