// Every Arabic string shown in the videos. Components read text only from here.
//
// `brief` = the exact on-screen lines from the brief: copied verbatim, never edited.
// `ui`    = fictional demo-UI labels for the website mockups (not the brief's wording).
// `studio`= labels for Video B ("behind the edit").

export const brief = {
  hook: 'الساعة ٢:٠٠ فجرًا… عميل يريد حجز رحلته',
  hook2: 'مكتبك مغلق… فذهب إلى غيرك',
  turn: 'إلا إذا كان موقعك يعمل عنك',
  reveal1: 'موقع احترافي لشركتك ومكتبك',
  reveal2: '٧ مزايا تعمل عنك على مدار الساعة',
  f1: 'أيام الدوام وساعاته… واضحة لكل عميل',
  f1Hours: '٩:٠٠ ص – ٥:٠٠ م',
  f2: 'حجز تلقائي للمواعيد والرحلات',
  f2Done: 'تم الحجز',
  f3: 'عدد محدد من الحجوزات يوميًا… بلا زحام',
  f3Full: 'اكتملت حجوزات اليوم',
  f4: 'ردٌّ تلقائي فوري على كل استفسار',
  f4Question: 'هل توجد رحلات إلى دبي؟',
  f5: 'تواصل مباشر مع الاستقبال… وتحويل إلى المدير عند الحاجة',
  f5Reception: 'الاستقبال',
  f5Manager: 'المدير',
  f6: 'رقم مكتبك بضغطة واحدة',
  f7: 'لوحة تحكم خاصة بالإدارة والموظفين',
  offer: 'باشتراك شهري رمزي… وعملاء أكثر',
  offerPrice: 'السعر عند الاستفسار',
  cta1: 'اكتب «موقع» في التعليقات',
  cta2: 'أو راسلنا خاص على إنستغرام',
  ctaButton: 'اطلب موقع شركتك الآن',
  travelAgency: 'سفريات الأفق',
  office: 'مكتب الريادة',
  // Left out of the video while it is still the placeholder.
  instagramHandle: '[INSTAGRAM_HANDLE]',
} as const;

export const ui = {
  agencyTagline: 'رحلات • فنادق • تأشيرات',
  bookTrip: 'احجز رحلتك',
  workHours: 'أوقات الدوام',
  chatUs: 'راسلنا',
  callUs: 'اتصل بنا',
  days: ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'],
  dayOff: 'عطلة',
  cities: { baghdad: 'بغداد', istanbul: 'إسطنبول', dubai: 'دبي' },
  boarding: 'بطاقة الصعود',
  flight: 'الرحلة',
  date: 'التاريخ',
  seat: 'المقعد',
  flightNo: 'HZ ٢١٤',
  flightDate: '١٢ / ١١',
  seatNo: '١٤A',
  todaysBookings: 'حجوزات اليوم',
  ofTotal: 'من ٢٠',
  reply: 'نعم، رحلات يومية إلى دبي\nبأسعار تبدأ من ٢٥٠٬٠٠٠ د.ع',
  autoReply: 'ردّ تلقائي',
  receptionHello: 'أهلًا بك، كيف نخدمك؟',
  clientAsk: 'أريد عرضًا لشركتنا',
  transferred: 'تم التحويل إلى المدير',
  managerHello: 'أهلًا، سأرسل لك العرض الآن',
  officeNumber: 'رقم المكتب',
  calling: 'جارٍ الاتصال…',
  dashboard: 'لوحة التحكم',
  bookings: 'الحجوزات',
  staff: 'الموظفون',
  thisMonth: 'هذا الشهر',
  staffList: [
    { name: 'سارة علي', role: 'الاستقبال' },
    { name: 'حسين كريم', role: 'المبيعات' },
    { name: 'نور جاسم', role: 'الحسابات' },
  ],
  clients: 'العملاء',
  monthly: 'اشتراك شهري',
  statusTime: '٢:٠٠',
} as const;

export const studio = {
  title: 'HS Studio',
  project: 'HS_Business_Ad',
  tracks: {
    V5: 'Light Leaks & Grain',
    V4: 'Text',
    V3: 'UI & Icons',
    V2: '3D Shots',
    V1: 'Backgrounds',
    A1: 'Score',
    A2: 'SFX',
    A3: 'Impacts',
    A4: 'Whooshes',
  },
  markers: { hook: 'HOOK', reveal: 'REVEAL', cta: 'CTA' },
} as const;

const isPlaceholder = (s: string) => /^\[.*\]$/.test(s.trim());
export const instagramHandle: string | null = isPlaceholder(brief.instagramHandle) ? null : brief.instagramHandle;

export const arDigits = (n: number | string) => String(n).replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);
