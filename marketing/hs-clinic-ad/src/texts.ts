// Every Arabic string shown in the video. Components read text only from here.
//
// `brief` = the exact on-screen lines from the brief: copied verbatim, never edited.
// `ui`    = fictional demo-UI labels written for the clinic-website mockups
//           (not part of the brief's wording; listed separately for review).

export const brief = {
  hook: 'دكتور… كم مريضًا خسرت اليوم؟',
  busyBadge: 'الخط مشغول',
  hook2: 'الخط مشغول… والعيادة مغلقة',
  clinic24: 'عيادتك الآن تعمل ٢٤ ساعة',
  reveal: 'موقع خاص بعيادتك',
  doctorName: 'د. أحمد',
  f1: 'أيام الدوام وساعاته… واضحة للجميع',
  f1Hours: '٤:٠٠ م – ٩:٠٠ م',
  f2: 'حجز تلقائي… بدون اتصال',
  f2Done: 'تم الحجز',
  f3: 'عدد محدد من المراجعين يوميًا',
  f3Full: 'اكتمل الحجز لهذا اليوم',
  f4: 'ردٌّ تلقائي فوري على المراجعين',
  f4Question: 'متى دوام الدكتور؟',
  f5: 'تواصل مباشر مع السكرتير… وتحويل إلى الطبيب عند الحاجة',
  f5Secretary: 'السكرتير',
  f5Doctor: 'الطبيب',
  f6: 'رقم العيادة بضغطة واحدة',
  f7: 'لوحة تحكم للطبيب والسكرتير',
  offer: 'باشتراك شهري رمزي… ومراجعون أكثر',
  offerPrice: 'السعر عند الاستفسار',
  cta: 'راسلنا خاص على إنستغرام',
  ctaButton: 'اطلب موقع عيادتك الآن',
  // Left out of the video while it is still the placeholder.
  instagramHandle: '[INSTAGRAM_HANDLE]',
} as const;

export const ui = {
  clinic: 'عيادة د. أحمد',
  specialty: 'الأمراض الباطنية',
  calling: 'جارٍ الاتصال…',
  bookNow: 'احجز موعدك',
  hoursCard: 'أوقات الدوام',
  chatCard: 'راسلنا',
  callCard: 'اتصل بالعيادة',
  days: ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'],
  dayOff: 'عطلة',
  today: 'اليوم',
  tomorrow: 'غدًا',
  freeSlots: 'الأوقات المتاحة',
  slots: ['٤:٠٠ م', '٤:٣٠ م', '٥:٠٠ م', '٥:٣٠ م', '٦:٠٠ م', '٦:٣٠ م'],
  bookedDetail: 'غدًا • ٥:٣٠ م',
  todaysBookings: 'حجوزات اليوم',
  ofTotal: 'من ٣٠',
  autoReply: 'ردّ تلقائي',
  reply: 'الدوام: السبت – الخميس\n٤:٠٠ م – ٩:٠٠ م',
  talkToSecretary: 'التحدث مع السكرتير',
  secretaryHello: 'أهلًا بك، كيف أساعدك؟',
  patientAsk: 'عندي سؤال للطبيب',
  transferred: 'تم التحويل إلى الطبيب',
  doctorHello: 'أهلًا، تفضّل بسؤالك',
  clinicNumber: 'رقم العيادة',
  dashboard: 'لوحة التحكم',
  thisWeek: 'هذا الأسبوع',
  patients: [
    { name: 'علي حسن', time: '٤:٠٠ م' },
    { name: 'زينب كريم', time: '٤:٣٠ م' },
    { name: 'مصطفى جاسم', time: '٥:٠٠ م' },
  ],
  visitors: 'المراجعون',
  monthly: 'اشتراك شهري',
  statusTime: '٩:٤١',
} as const;

const isPlaceholder = (s: string) => /^\[.*\]$/.test(s.trim());
export const instagramHandle: string | null = isPlaceholder(brief.instagramHandle) ? null : brief.instagramHandle;

export const arDigits = (n: number | string) => String(n).replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);
