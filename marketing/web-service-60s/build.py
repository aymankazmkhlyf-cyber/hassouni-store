"""
Builds index.html for the 60 s "we build websites" promo (1080x1920, 30 fps).
Every timing lives here; sound cues are attached with data-sfx so the audio
composer reads them from the generated HTML.

    python3 build.py && node render.mjs ...
"""

ICONS = {
    "search": "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-4.6-4.6",
    "tooth": "M7 3C4.5 3 3 5 3 7.5c0 3 1.5 5 2 8.5.4 2.5 1 5 2.5 5 1.6 0 1.6-4 2.5-6 .5-1 1.5-1 2 0 .9 2 .9 6 2.5 6 1.5 0 2.1-2.5 2.5-5 .5-3.5 2-5.5 2-8.5C21 5 19.5 3 17 3c-2 0-3 1-5 1S9 3 7 3z",
    "food": "M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M17 3c-2 0-3 3-3 6s1 4 3 4v8",
    "scissors": "M6 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM20 4L8.1 15.9M14.5 14.5L20 20M8.1 8.1L12 12",
    "cart": "M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h8.2a2 2 0 0 0 2-1.5L21 8H6M9 21h.01M18 21h.01",
    "building": "M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16M16 9h3a1 1 0 0 1 1 1v11M8 7h4M8 11h4M8 15h4M3 21h18",
    "cap": "M2 9l10-5 10 5-10 5zM6 11v5c0 1.5 3 3 6 3s6-1.5 6-3v-5M22 9v6",
    "check": "M5 12.5l4.5 4.5L19 7.5",
    "globe": "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3",
    "phone": "M8 2h8a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM11 18h2",
    "dash": "M3 3h8v8H3zM13 3h8v5h-8zM13 10h8v11h-8zM3 13h8v8H3z",
    "card": "M3 6h18v12H3zM3 10h18M7 15h3",
    "chat": "M4 5h16v11H9l-5 4z",
    "shield": "M12 3l8 3v6c0 4.5-3.5 8-8 9-4.5-1-8-4.5-8-9V6zM9 12l2 2 4-4",
    "seo": "M4 19l5-6 4 3 7-9M15 7h5v5",
    "link": "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
    "bolt": "M13 2L4 14h7l-1 8 9-12h-7z",
    "send": "M22 2L11 13M22 2l-7 20-4-9-9-4z",
    "star": "M12 3.2l2.7 5.6 6.1.8-4.5 4.2 1.1 6-5.4-2.9-5.4 2.9 1.1-6L3.2 9.6l6.1-.8z",
    "wallet": "M4 7a2 2 0 0 1 2-2h11v4M4 7v11a2 2 0 0 0 2 2h13a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1H6a2 2 0 0 1-2-2zM16 14h.01",
    "bell": "M18 16V11a6 6 0 1 0-12 0v5l-2 2h16zM10 21h4",
    "ruler": "M3 17L17 3l4 4L7 21zM7 13l2 2M10 10l2 2M13 7l2 2",
    "calendar": "M4 6h16v15H4zM4 10h16M8 3v5M16 3v5",
    "qr": "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h3v3h-3zM18 18h3v3h-3z",
}


def icon(name, color="currentColor", sw=1.9, draw=None, extra=""):
    d = f' data-draw="{draw}" data-len="120"' if draw else ""
    return f'<svg viewBox="0 0 24 24" fill="none" stroke="{color}" stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round" {extra}><path d="{ICONS[name]}"{d}/></svg>'


def A(kind, t, d=0.6, out=None, o=None, od=None, sfx=None, cls="", style="", inner="", tag="div", extra=""):
    attrs = f'data-a="{kind}" data-t="{t}" data-d="{d}"'
    if o is not None:
        attrs += f' data-o="{o}"'
    if out:
        attrs += f' data-out="{out}"'
    if od:
        attrs += f' data-od="{od}"'
    if sfx:
        attrs += f' data-sfx="{sfx}"'
    return f'<{tag} class="{cls}" style="{style}" {attrs} {extra}>{inner}</{tag}>'


def mark(t, sfx=None, shake=None, flash=False):
    a = f'data-t="{t}"'
    if sfx:
        a += f' data-sfx="{sfx}"'
    if shake:
        a += f' data-shake="{shake}"'
    if flash:
        a += f' data-flash="{t}"'
    return f"<i {a} hidden></i>"


# ------------------------------------------------------------------ scenes
def scene_hook():
    s, e = 0.0, 5.05
    res = [
        ("عيادة النخبة لطب الأسنان", "موقع رسمي • احجز موعدك أونلاين", "4.9"),
        ("مركز الابتسامة الطبي", "الأسعار والخدمات • احجز الآن", "4.8"),
        ("عيادة د. سارة للأسنان", "مواعيد اليوم متاحة", "4.7"),
    ]
    results = "".join(
        A("wipe", 2.65 + i * 0.16, 0.35, sfx="tick", cls="res", inner=f"<b>{n}</b><span><em>★ {r}</em> · {sub}</span>")
        for i, (n, sub, r) in enumerate(res)
    )
    return f"""
<section class="scene" data-s="{s}" data-e="{e}" data-push="0.05" data-zoomthru="4.72">
  {mark(0.08, sfx="boom", shake=1.0, flash=True)}
  <div class="abs" style="top:250px">
    {A("slam", 0.12, 0.5, cls="h1 glow", inner="زبونك", o=3.35, out="zoom", od=0.3)}
    <div class="line" style="margin-top:10px">{A("rise", 0.55, 0.55, cls="h3", inner="<span>يدوّر عليك هسه… <span class='grad'>بكوكل</span></span>", o=3.35, out="zoom", od=0.3, sfx="swish")}</div>
  </div>
  {A("pop", 1.0, 0.5, cls="search glass", sfx="pop", o=3.35, out="zoom", od=0.3, inner=f'''
    <div class="sbar">{icon("search", "#6d4dff", 2.4)}<span data-type="1.2,1.3" data-text="أفضل عيادة أسنان قريبة" data-sfx="type" data-t="1.2"></span><i class="caret" data-blink></i></div>
    {results}''')}
  {A("slam", 3.42, 0.35, cls="abs h1", style="top:640px", inner="<span class='line' data-glitch='3.42,0.42'>وإنت…</span>", sfx="glitch", o=4.25, out="up", od=0.25)}
  {A("slam", 3.62, 0.35, cls="abs h2", style="top:820px", inner="<span data-glitch='3.62,0.45'>ما عندك <span class='red'>موقع؟</span></span>", o=4.25, out="up", od=0.25)}
  {mark(3.42, shake=0.6)}
  {A("drop", 4.3, 0.35, cls="abs h2 red", style="top:1050px", inner="الزبون راح لغيرك.", sfx="hitlow")}
  {mark(4.3, shake=0.8)}
  {mark(4.72, sfx="zoomwhoosh")}
</section>"""


def scene_build():
    s, e = 5.05, 11.55
    wire = """
      <svg viewBox="0 0 920 576" style="position:absolute;left:0;top:64px;width:100%;height:576px" fill="none" stroke="#7b7cff" stroke-width="3" stroke-linecap="round">
        <rect x="40" y="30" width="840" height="64" rx="14" data-draw="6.55,0.6" data-len="1900"/>
        <rect x="40" y="120" width="500" height="190" rx="18" data-draw="6.75,0.7" data-len="1400"/>
        <rect x="570" y="120" width="310" height="190" rx="18" data-draw="6.9,0.7" data-len="1000"/>
        <rect x="40" y="340" width="260" height="200" rx="18" data-draw="7.05,0.6" data-len="920"/>
        <rect x="330" y="340" width="260" height="200" rx="18" data-draw="7.15,0.6" data-len="920"/>
        <rect x="620" y="340" width="260" height="200" rx="18" data-draw="7.25,0.6" data-len="920"/>
      </svg>"""

    def block(t, x, y, w, h, bg, inner="", r=18):
        return A("pop", t, 0.45, sfx="blip", style=f"position:absolute;left:{x}px;top:{64 + y}px;width:{w}px;height:{h}px;border-radius:{r}px;background:{bg};overflow:hidden", inner=inner)

    blocks = "".join([
        block(7.85, 40, 30, 840, 64, "linear-gradient(90deg,#2a2b5e,#1d1e45)", '<div style="display:flex;justify-content:space-between;align-items:center;height:100%;padding:0 26px;font-size:26px;font-weight:800"><span>مشروعك</span><span style="color:#9fa0d8;font-size:22px">الرئيسية · الخدمات · تواصل</span></div>'),
        block(8.05, 40, 120, 500, 190, "linear-gradient(135deg,#6d4dff,#22b8d6)", '<div style="padding:26px 30px"><div style="font-size:40px;font-weight:900;line-height:1.2">موقعك الجديد</div><div style="font-size:22px;opacity:.85;margin-top:8px">تصميم احترافي يليق بمشروعك</div><div style="margin-top:20px;display:inline-block;background:#fff;color:#3a24b8;border-radius:14px;padding:8px 22px;font-size:24px;font-weight:900">اطلب الآن</div></div>'),
        block(8.2, 570, 120, 310, 190, "linear-gradient(160deg,#ff7ab3,#ff9e45)", '<div style="display:grid;place-items:center;height:100%">' + icon("star", "#fff", 1.6, extra='style="width:110px;height:110px"') + "</div>"),
        block(8.35, 40, 340, 260, 200, "#1f2050", '<div style="padding:22px"><div style="height:90px;border-radius:12px;background:#33358a"></div><div style="height:16px;width:70%;background:#4a4cae;border-radius:8px;margin-top:16px"></div><div style="height:16px;width:45%;background:#3b3d92;border-radius:8px;margin-top:10px"></div></div>'),
        block(8.48, 330, 340, 260, 200, "#1f2050", '<div style="padding:22px"><div style="height:90px;border-radius:12px;background:#0f6f86"></div><div style="height:16px;width:70%;background:#4a4cae;border-radius:8px;margin-top:16px"></div><div style="height:16px;width:45%;background:#3b3d92;border-radius:8px;margin-top:10px"></div></div>'),
        block(8.61, 620, 340, 260, 200, "#1f2050", '<div style="padding:22px"><div style="height:90px;border-radius:12px;background:#8a2a5c"></div><div style="height:16px;width:70%;background:#4a4cae;border-radius:8px;margin-top:16px"></div><div style="height:16px;width:45%;background:#3b3d92;border-radius:8px;margin-top:10px"></div></div>'),
    ])
    cursor = '<svg class="cursor" data-path="9.0,700,620;9.55,260,330;10.3,260,330" viewBox="0 0 24 24"><path d="M4 3l7 17 2.5-7.5L21 10z" fill="#fff" stroke="#111" stroke-width="1.2"/></svg>'
    phone = f"""<div class="phone" style="left:610px;top:1030px;width:330px;height:660px;border-width:10px;border-radius:52px" data-a="flip" data-t="9.95" data-d="0.6" data-sfx="swoosh">
        <div class="notch" style="width:100px;height:26px;margin-left:-50px"></div>
        <div class="scr" style="background:#0f1024;padding:50px 18px 18px">
          <div style="height:44px;border-radius:12px;background:#2a2b5e"></div>
          <div style="height:200px;border-radius:18px;background:linear-gradient(135deg,#6d4dff,#22b8d6);margin-top:14px;padding:20px;font-size:30px;font-weight:900">موقعك الجديد</div>
          <div style="height:120px;border-radius:16px;background:#1f2050;margin-top:14px"></div>
          <div style="height:120px;border-radius:16px;background:#1f2050;margin-top:14px"></div>
        </div></div>"""
    return f"""
<section class="scene" data-s="{s}" data-e="{e}" data-push="0.035">
  {mark(5.05, sfx="riser")}
  <div class="abs" style="top:250px">
    <div class="line">{A("rise", 5.12, 0.5, cls="h2", inner="<span>نبنيلك موقع</span>")}</div>
    {A("slam", 5.45, 0.45, cls="h1 grad glow", inner="احترافي")}
  </div>
  {mark(6.0, sfx="drop", shake=1.0, flash=True)}
  {A("slam", 6.0, 0.4, cls="abs h3", style="top:600px", inner="حسب طلبك… <span class='gold'>من الصفر</span>")}
  <div class="browser" data-a="tilt" data-t="6.25" data-d="0.7" data-sfx="swoosh">
    <div class="bbar"><i style="background:#ff5f57"></i><i style="background:#febc2e"></i><i style="background:#28c840"></i><div class="url">your-project.com</div></div>
    {wire}{blocks}
    <div class="ripple" style="left:300px;top:395px" data-ripple="9.6"></div>
    {cursor}
  </div>
  {mark(9.6, sfx="click")}
  {phone}
  <div class="abs" style="top:1540px;display:flex;justify-content:center;gap:16px;flex-wrap:wrap;width:540px;left:50px;right:auto">
    {A("pop", 10.45, 0.4, cls="chip", inner=icon("ruler", "#b8a8ff") + "تصميم", sfx="blip")}
    {A("pop", 10.6, 0.4, cls="chip", inner=icon("dash", "#6ee7ff") + "برمجة", sfx="blip")}
    {A("pop", 10.75, 0.4, cls="chip", inner=icon("globe", "#ff9ac4") + "نشر", sfx="blip")}
  </div>
  <div class="leak" data-t="10.95"></div>
  {mark(11.25, sfx="whoosh")}
</section>"""


SECTORS = [
    ("tooth", "linear-gradient(135deg,#22d3ee,#3b82f6)", "عيادات الأطباء", ["حجز مواعيد أونلاين", "ملف الطبيب والخدمات والأسعار"], "clinic"),
    ("food", "linear-gradient(135deg,#ff9e45,#ff3d7f)", "المطاعم والكافيهات", ["منيو إلكتروني بالـ QR", "طلبات وتوصيل من الموقع"], "food"),
    ("scissors", "linear-gradient(135deg,#f472b6,#a855f7)", "صالونات التجميل والحلاقة", ["حجز موعد بضغطة", "معرض لأعمالك"], "salon"),
    ("cart", "linear-gradient(135deg,#7b5cff,#22d3ee)", "المتاجر الإلكترونية", ["سلة ودفع زين كاش وسوبر كي", "لوحة تحكم كاملة"], "store"),
    ("building", "linear-gradient(135deg,#34d399,#0ea5e9)", "الشركات والمكاتب", ["تعريف احترافي بخدماتك", "نماذج تواصل وطلب عرض سعر"], "company"),
    ("cap", "linear-gradient(135deg,#fbbf24,#f97316)", "المدارس والمعاهد والدورات", ["تسجيل أونلاين", "جداول وإعلانات للطلاب"], "school"),
]


def mini(kind, T):
    if kind == "clinic":
        slots = "".join(
            A("pop", T + 0.9 + i * 0.06, 0.3, style=f"padding:14px 0;border-radius:14px;text-align:center;font-size:26px;font-weight:800;background:{'#6d4dff' if i == 4 else '#eef0fb'};color:{'#fff' if i == 4 else '#2a2a4a'}", inner=s)
            for i, s in enumerate(["9:00", "10:00", "11:30", "1:00", "4:30", "6:00"])
        )
        return f"""<div style="font-size:34px;font-weight:900">عيادة د. أحمد لطب الأسنان</div>
          <div style="font-size:24px;color:#6b6b85;margin-top:4px">اختر موعدك — الخميس</div>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:22px">{slots}</div>
          {A("up", T + 1.6, 0.4, sfx="success", style="margin-top:28px;padding:20px;border-radius:18px;background:#e7f8ef;color:#0f7a43;font-size:30px;font-weight:900;text-align:center", inner="✓ تم حجز موعدك الساعة 4:30")}"""
    if kind == "food":
        items = [("برگر لحم مشوي", "6,000"), ("بيتزا مارگريتا", "8,000"), ("عصير برتقال طبيعي", "2,000")]
        rows = "".join(
            A("wipe", T + 0.85 + i * 0.12, 0.35, style="display:flex;justify-content:space-between;align-items:center;padding:16px 0;border-bottom:2px solid #f0f0f6;font-size:30px;font-weight:800", inner=f'<span>{n}</span><span style="display:flex;gap:14px;align-items:center"><b style="color:#e1306c">{p} د.ع</b><b style="width:46px;height:46px;border-radius:12px;background:#ff3d7f;color:#fff;display:grid;place-items:center">+</b></span>')
            for i, (n, p) in enumerate(items)
        )
        return f"""<div style="display:flex;justify-content:space-between;align-items:center"><div style="font-size:34px;font-weight:900">منيو مطعم الذوق</div>{icon("qr", "#1d1d33", 2, extra='style="width:60px;height:60px"')}</div>
          {rows}
          {A("pop", T + 1.6, 0.35, sfx="success", style="margin-top:24px;padding:20px;border-radius:18px;background:#ff3d7f;color:#fff;font-size:32px;font-weight:900;text-align:center", inner="أكمل الطلب — 16,000 د.ع")}"""
    if kind == "salon":
        cols = ["#f9a8d4", "#c084fc", "#fda4af", "#a78bfa", "#f0abfc", "#fbcfe8"]
        tiles = "".join(A("pop", T + 0.8 + i * 0.07, 0.3, style=f"height:120px;border-radius:18px;background:linear-gradient(135deg,{c},#fff)") for i, c in enumerate(cols))
        return f"""<div style="font-size:34px;font-weight:900">صالون لمسة جمال</div>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:20px">{tiles}</div>
          {A("pop", T + 1.55, 0.35, sfx="success", style="margin-top:26px;padding:20px;border-radius:18px;background:#a855f7;color:#fff;font-size:32px;font-weight:900;text-align:center", inner="احجزي موعدك")}"""
    if kind == "store":
        cards = "".join(
            A("pop", T + 0.8 + i * 0.1, 0.35, style="border-radius:20px;background:#f3f2ff;padding:16px", inner=f'<div style="height:130px;border-radius:14px;background:{c}"></div><div style="font-size:26px;font-weight:800;margin-top:10px">{n}</div><div style="font-size:26px;font-weight:900;color:#6d4dff">{p}</div>')
            for i, (n, p, c) in enumerate([("ساعة ذكية", "35,000 د.ع", "linear-gradient(135deg,#7b5cff,#22d3ee)"), ("سماعة لاسلكية", "20,000 د.ع", "linear-gradient(135deg,#ff7ab3,#ff9e45)")])
        )
        return f"""<div style="display:flex;justify-content:space-between;align-items:center"><div style="font-size:34px;font-weight:900">متجرك الإلكتروني</div>
          <div style="position:relative">{icon("cart", "#1d1d33", 2, extra='style="width:56px;height:56px"')}{A("pop", T + 1.5, 0.3, sfx="blip", style="position:absolute;top:-10px;right:-12px;width:36px;height:36px;border-radius:50%;background:#ff3d7f;color:#fff;font-size:22px;font-weight:900;display:grid;place-items:center", inner="2")}</div></div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:20px">{cards}</div>
          <div style="display:flex;gap:12px;margin-top:20px">{A("pop", T + 1.7, 0.3, style="flex:1;padding:14px;border-radius:14px;background:#111;color:#fff;font-size:24px;font-weight:900;text-align:center", inner="زين كاش")}{A("pop", T + 1.8, 0.3, style="flex:1;padding:14px;border-radius:14px;background:#ffd400;color:#111;font-size:24px;font-weight:900;text-align:center", inner="سوبر كي")}</div>"""
    if kind == "company":
        svc = "".join(A("wipe", T + 0.9 + i * 0.12, 0.35, style="display:flex;align-items:center;gap:14px;padding:12px 0;font-size:28px;font-weight:800", inner=icon("check", "#10b981", 3, extra='style="width:36px;height:36px"') + n) for i, n in enumerate(["تصميم وتنفيذ", "إشراف هندسي", "صيانة دورية"]))
        return f"""<div style="height:150px;border-radius:20px;background:linear-gradient(135deg,#0ea5e9,#34d399);padding:22px;color:#fff"><div style="font-size:36px;font-weight:900">شركة الريادة للمقاولات</div><div style="font-size:24px;opacity:.9">خبرة وجودة بكل مشروع</div></div>
          {svc}
          {A("pop", T + 1.6, 0.35, sfx="success", style="margin-top:16px;padding:18px;border-radius:18px;background:#0ea5e9;color:#fff;font-size:30px;font-weight:900;text-align:center", inner="اطلب عرض سعر")}"""
    # school
    rows = "".join(
        A("wipe", T + 0.85 + i * 0.12, 0.35, style="display:flex;justify-content:space-between;align-items:center;padding:14px 18px;margin-top:12px;border-radius:16px;background:#fff7ea;font-size:28px;font-weight:800", inner=f'<span>{n}</span><b style="background:#f97316;color:#fff;border-radius:12px;padding:6px 16px;font-size:22px">سجّل الآن</b>')
        for i, n in enumerate(["دورة اللغة الإنكليزية", "دورة البرمجة للمبتدئين", "التقوية للسادس الإعدادي"])
    )
    return f"""<div style="font-size:34px;font-weight:900">معهد المستقبل</div><div style="font-size:24px;color:#6b6b85">الدورات المتاحة هذا الشهر</div>{rows}"""


def scene_sectors():
    s, e = 11.55, 29.55
    cards = []
    for k, (ic, g, title, bullets, kind) in enumerate(SECTORS):
        T = round(11.55 + 3 * k, 2)
        last = k == len(SECTORS) - 1
        bl = "".join(
            A("wipe", T + 0.45 + j * 0.15, 0.35, sfx="tick", cls="sbul", inner=icon("check", "#6ee7ff", 2.6) + b) for j, b in enumerate(bullets)
        )
        cards.append(f"""
  <div class="sector glass" data-a="flip" data-t="{T}" data-d="0.5" data-o="{T + 2.72 if not last else 29.2}" data-out="flip" data-od="0.3" data-sfx="whoosh">
    <div style="display:flex;align-items:center;gap:30px">
      {A("pop", T + 0.2, 0.4, cls="sicon", style=f"background:{g}", inner=icon(ic, "#fff", 1.8))}
      <div style="font-size:34px;font-weight:800;color:#9e9cd6">0{k + 1} / 06</div>
    </div>
    {A("rise", T + 0.25, 0.45, cls="stitle line", inner=f"<span>{title}</span>")}
    {bl}
    <div class="mini" data-a="up" data-t="{T + 0.6}" data-d="0.45">{mini(kind, T)}</div>
  </div>""")
    return f"""
<section class="scene" data-s="{s}" data-e="{e}" data-push="0.02">
  <div class="abs" style="top:250px">
    <div class="line">{A("rise", 11.6, 0.5, cls="h3", inner="<span>لكل مشروع…</span>", sfx="swish")}</div>
    {A("slam", 11.95, 0.4, cls="h2 grad", inner="موقع يناسبه")}
  </div>
  {"".join(cards)}
  {mark(29.25, sfx="whoosh")}
</section>"""


FEATURES = [
    ("globe", "#b8a8ff", "عربي + إنكليزي", "يتحول بضغطة"),
    ("phone", "#6ee7ff", "يشتغل على التلفون", "ويتثبت مثل التطبيق"),
    ("dash", "#ff9ac4", "لوحة تحكم سهلة", "تدير كلشي بنفسك"),
    ("wallet", "#ffcc4d", "دفع محلي", "زين كاش • سوبر كي • آسياسيل"),
    ("chat", "#86efac", "محادثة مباشرة", "وإشعارات للطلبات"),
    ("shield", "#93c5fd", "حماية عالية", "وسرعة بالتحميل"),
    ("seo", "#fca5a5", "يظهر بكوكل", "تهيئة SEO كاملة"),
    ("link", "#c4b5fd", "دومين باسمك", "رابط خاص بمشروعك"),
]


def scene_features():
    """Tiles appear exactly when the voice names each feature (voice_timing.json from voice.py)."""
    import json
    import os
    timing = json.load(open("voice_timing.json")) if os.path.exists("voice_timing.json") else None
    times = timing["tiles"] + [round(timing["tiles"][-1] + 0.45, 2)] if timing else [round(30.35 + i * 0.5, 2) for i in range(8)]
    P = timing["precision"] - 0.12 if timing else 35.6  # precision moment
    OUTT = round(P - 0.05, 2)
    s, e = 29.55, 40.0
    tiles = "".join(
        A("pop", t, 0.4, sfx="tick", cls="tile glass", o=OUTT, out="shrink", od=0.3,
          inner=icon(ic, c, 1.9, draw=f"{round(t + 0.08, 2)},0.5") + f"<b>{title}</b><span>{sub}</span>")
        for t, (ic, c, title, sub) in zip(times, FEATURES)
    )
    r = lambda x: round(P + x, 2)
    return f"""
<section class="scene" data-s="{s}" data-e="{e}" data-push="0.03">
  {mark(29.6, sfx="impact", shake=0.7, flash=True)}
  <div class="abs" style="top:250px">
    {A("slam", 29.6, 0.45, cls="h2", inner="كل اللي يحتاجه", o=OUTT, out="up", od=0.3)}
    {A("slam", 29.85, 0.45, cls="h2 grad glow", inner="موقعك", o=OUTT, out="up", od=0.3)}
  </div>
  <div class="tiles">{tiles}</div>
  {mark(OUTT, sfx="swish")}
  <!-- precision -->
  {A("slam", r(0.0), 0.4, cls="abs h2", style="top:300px", inner="دقة <span class='gold'>بكل تفصيلة</span>")}
  <div data-a="tilt" data-t="{r(0.08)}" data-d="0.5" data-sfx="swoosh" class="glass" style="position:absolute;left:120px;right:120px;top:640px;height:820px;padding:50px">
    <div style="height:110px;border-radius:24px;background:linear-gradient(90deg,#2a2b5e,#1d1e45)"></div>
    <div style="height:300px;border-radius:30px;background:linear-gradient(135deg,#6d4dff,#22b8d6);margin-top:40px;position:relative">
      <div class="measure" style="inset:-14px" data-a="fade" data-t="{r(0.4)}" data-d="0.25"></div>
      <div class="mtag" style="top:-56px;right:20px" data-a="pop" data-t="{r(0.55)}" data-d="0.3" data-sfx="blip">760 × 300</div>
    </div>
    <div style="display:flex;gap:40px;margin-top:40px;position:relative">
      <div style="flex:1;height:200px;border-radius:24px;background:#1f2050"></div>
      <div style="flex:1;height:200px;border-radius:24px;background:#1f2050"></div>
      <div class="mtag" style="top:80px;left:50%;transform:translateX(-50%)" data-a="pop" data-t="{r(0.85)}" data-d="0.3" data-sfx="blip">40px</div>
    </div>
    <svg viewBox="0 0 840 820" style="position:absolute;inset:0;width:100%;height:100%" fill="none" stroke="#ffcc4d" stroke-width="3" stroke-dasharray="10 8">
      <path d="M50 30 V790" data-draw="{r(0.2)},0.5" data-len="760"/><path d="M790 30 V790" data-draw="{r(0.25)},0.5" data-len="760"/>
      <path d="M20 160 H820" data-draw="{r(0.3)},0.5" data-len="800"/><path d="M20 500 H820" data-draw="{r(0.35)},0.5" data-len="800"/>
    </svg>
    <div style="position:absolute;left:0;right:0;height:6px;top:0;background:linear-gradient(90deg,transparent,#6ee7ff,transparent);box-shadow:0 0 30px #6ee7ff" data-scroll="{r(0.15)},1.4,-800"></div>
  </div>
  {A("up", r(0.7), 0.35, cls="abs p", style="top:1560px", inner="كل بكسل بمكانه — على التلفون والكمبيوتر")}
  {mark(39.65, sfx="tapestop")}
</section>"""


def scene_ready():
    s, e = 40.0, 50.0
    labels = [
        (42.3, "side", "right:40px;top:760px", "wallet", "#ffcc4d", "سلة ومحفظة للزبون"),
        (43.5, "sidel", "left:40px;top:980px", "card", "#6ee7ff", "دفع زين كاش • سوبر كي"),
        (44.7, "side", "right:40px;top:1200px", "star", "#ffcc4d", "تقييمات حقيقية"),
        (45.9, "sidel", "left:40px;top:1420px", "bell", "#ff9ac4", "إشعارات الطلبات"),
        (47.1, "side", "right:40px;top:860px", "dash", "#b8a8ff", "لوحة تحكم كاملة"),
    ]
    lab = "".join(
        A(kind, t, 0.45, sfx="pop", cls="label glass", style=st, inner=icon(ic, c, 2) + txt, o=48.1, out="fade", od=0.3)
        for t, kind, st, ic, c, txt in labels
    )
    return f"""
<section class="scene" data-s="{s}" data-e="{e}" data-push="0.03">
  {mark(40.15, sfx="hitlow", shake=0.5)}
  {A("slam", 40.15, 0.45, cls="abs h1", style="top:230px", inner="تريده أسرع؟", o=41.05, out="up", od=0.3)}
  <div class="abs" style="top:220px">
    <div class="line">{A("rise", 41.2, 0.5, cls="h3", inner="<span>عندنا <span class='gold'>متجر جاهز</span></span>", sfx="swish")}</div>
    <div class="line">{A("rise", 41.45, 0.5, cls="h3", inner="<span>مثل متجرنا… يشتغل خلال أيام</span>")}</div>
  </div>
  <div class="phone" style="left:305px;top:560px" data-a="tilt" data-t="41.6" data-d="0.8" data-sfx="swoosh">
    <div class="notch"></div>
    <div class="scr">
      <img src="shots/home.jpg" data-scroll="42.2,2.6,1500"/>
      <div style="position:absolute;inset:0" data-a="circle" data-t="45.0" data-d="0.6" data-sfx="whoosh"><img src="shots/pubg.jpg" data-scroll="45.6,1.5,700"/></div>
      <div style="position:absolute;inset:0" data-a="circle" data-t="47.0" data-d="0.6" data-sfx="whoosh"><img src="shots/gift.jpg" data-scroll="47.6,1.6,600"/></div>
    </div>
  </div>
  {lab}
  {A("up", 48.25, 0.45, cls="abs", style="top:1580px", inner="<span class='chip' style='font-size:42px'>" + icon("ruler", "#ffcc4d") + "يتعدّل باسمك وألوانك وخدماتك</span>")}
  {mark(48.4, sfx="snareroll")}
  {mark(49.9, flash=True)}
</section>"""


VALUES = [("أسعار تنافسية", "#86efac"), ("احترافية عالية", "#b8a8ff"), ("دقة في التنفيذ", "#6ee7ff"), ("دعم بعد التسليم", "#ffcc4d")]


def scene_values():
    s, e = 50.0, 55.55
    rows = []
    for i, (txt, c) in enumerate(VALUES):
        t = round(50.1 + i * 1.3, 2)
        rows.append(mark(t, sfx="impact" if i == 0 else "hit", shake=0.9 if i == 0 else 0.5))
        rows.append(A("slam", t, 0.4, cls="vline", style=f"position:absolute;left:0;right:0;top:{560 + i * 240}px", inner=icon("check", c, 2.6) + f"<span>{txt}</span>"))
    return f"""
<section class="scene" data-s="{s}" data-e="{e}" data-push="0.04" data-zoomthru="55.2">
  <div class="abs" style="top:260px">{A("fade", 50.05, 0.4, cls="p", inner="ليش تختارنا؟")}</div>
  {"".join(rows)}
  {mark(55.2, sfx="zoomwhoosh")}
</section>"""


def scene_cta():
    s, e = 55.55, 60.0
    return f"""
<section class="scene" data-s="{s}" data-e="{e}" data-push="0.03">
  <div class="ring" style="top:560px" data-spin="18"></div>
  <div class="ring" style="top:560px;width:760px;height:760px;margin:-380px 0 0 -380px;border-style:dashed;opacity:.5" data-spin="-12"></div>
  <div class="abs" style="top:360px">{A("pop", 55.65, 0.55, cls="logo", inner="ح", sfx="shimmer")}</div>
  {A("up", 56.05, 0.45, cls="abs h3", style="top:640px", inner="حسوني <span class='grad'>لتصميم وبرمجة المواقع</span>")}
  <div class="abs" style="top:880px"><div class="line">{A("rise", 56.5, 0.5, cls="h2", inner="<span>للطلب والاستفسار</span>")}</div></div>
  {mark(57.0, sfx="impact", shake=0.6)}
  <div class="abs" style="top:1100px">{A("slam", 57.0, 0.45, cls="cta", inner=icon("send", "#120b2e", 2.4) + "<span>راسلنا خاص</span>", extra='data-pulse="57.6"')}</div>
  {A("up", 57.8, 0.45, cls="abs p", style="top:1370px", inner="الاستفسار مجاني • نرد عليك بأسرع وقت")}
  <div class="leak" data-t="58.3"></div>
  {mark(59.3, sfx="boomtail")}
</section>"""


def build():
    particles = "".join('<i class="pt"></i>' for _ in range(36))
    body = "".join([scene_hook(), scene_build(), scene_sectors(), scene_features(), scene_ready(), scene_values(), scene_cta()])
    html = f"""<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>حسوني — تصميم وبرمجة المواقع</title><link rel="stylesheet" href="style.css"></head>
<body data-dur="60">
<div id="world">
  <div id="bg"></div><div class="orb" id="orb1"></div><div class="orb" id="orb2"></div><div class="orb" id="orb3"></div>
  <div id="gridbg"></div>{particles}
  <div id="stage">{body}</div>
  <div id="vignette"></div><div id="grain"></div><div id="flash"></div><div id="fade"></div>
</div>
<script src="engine.js"></script>
</body></html>"""
    open("index.html", "w").write(html)


if __name__ == "__main__":
    build()
    print("index.html written")
