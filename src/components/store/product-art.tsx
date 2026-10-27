import type { IconName } from "@/components/ui/icon";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/components/ui/cn";

/*
 * Original, code-drawn artwork per product (no third-party logos, no image files).
 * Each platform gets a recognisable colour theme, a large glyph, a short chip and
 * decorative shapes. An uploaded product image always takes precedence.
 */

type Theme = {
  bg: string;
  label: string;
  chip: string;
  icon: IconName;
  /** Colour of the floating decorations. */
  glow: string;
};

const THEMES: { match: RegExp; theme: Theme }[] = [
  { match: /^instagram-followers/, theme: { bg: "linear-gradient(135deg,#feda75 0%,#fa7e1e 25%,#d62976 55%,#962fbf 80%,#4f5bd5 100%)", label: "Instagram", chip: "+1K", icon: "users", glow: "#ffe1f0" } },
  { match: /^instagram-likes/, theme: { bg: "linear-gradient(135deg,#fa7e1e 0%,#d62976 50%,#962fbf 100%)", label: "Instagram", chip: "❤ 1K", icon: "heart", glow: "#ffd1e6" } },
  { match: /^tiktok-followers/, theme: { bg: "radial-gradient(120% 120% at 0% 0%,#25f4ee55 0%,transparent 45%),radial-gradient(120% 120% at 100% 100%,#fe2c5566 0%,transparent 45%),#0b0b0f", label: "TikTok", chip: "+1K", icon: "users", glow: "#25f4ee" } },
  { match: /^tiktok-likes/, theme: { bg: "radial-gradient(120% 120% at 100% 0%,#fe2c5577 0%,transparent 50%),radial-gradient(120% 120% at 0% 100%,#25f4ee44 0%,transparent 45%),#0b0b0f", label: "TikTok", chip: "❤ 1K", icon: "heart", glow: "#fe2c55" } },
  { match: /^tiktok-views/, theme: { bg: "radial-gradient(120% 120% at 50% 0%,#25f4ee55 0%,transparent 50%),radial-gradient(120% 120% at 50% 100%,#fe2c5555 0%,transparent 50%),#0b0b0f", label: "TikTok", chip: "▶ 1K", icon: "eye", glow: "#25f4ee" } },
  { match: /^facebook/, theme: { bg: "linear-gradient(135deg,#3b8bff 0%,#1877f2 45%,#0b4fb3 100%)", label: "Facebook", chip: "+1K", icon: "users", glow: "#cfe2ff" } },
  { match: /^telegram-premium/, theme: { bg: "linear-gradient(135deg,#a78bfa 0%,#8b5cf6 40%,#ec4899 100%)", label: "Telegram Premium", chip: "★", icon: "spark", glow: "#fde68a" } },
  { match: /^telegram-stars/, theme: { bg: "linear-gradient(135deg,#fbbf24 0%,#f59e0b 45%,#ea580c 100%)", label: "Telegram Stars", chip: "★ 100", icon: "spark", glow: "#fff7cc" } },
  { match: /^telegram/, theme: { bg: "linear-gradient(135deg,#5ac8fa 0%,#2aabee 45%,#1c8acb 100%)", label: "Telegram", chip: "+1K", icon: "chat", glow: "#e0f4ff" } },
  { match: /^pubg/, theme: { bg: "radial-gradient(110% 110% at 100% 0%,#ffcc3355 0%,transparent 55%),linear-gradient(160deg,#2a2418 0%,#111 70%)", label: "PUBG MOBILE", chip: "UC", icon: "gamepad", glow: "#f2a900" } },
  { match: /^ludo-star-diamonds/, theme: { bg: "linear-gradient(135deg,#22d3ee 0%,#3b82f6 50%,#6366f1 100%)", label: "Ludo Star", chip: "💎", icon: "gem", glow: "#e0fbff" } },
  { match: /^ludo-star-gold/, theme: { bg: "linear-gradient(135deg,#fde047 0%,#f59e0b 50%,#b45309 100%)", label: "Ludo Star", chip: "🪙", icon: "spark", glow: "#fff6c2" } },
  { match: /^mobile-legends/, theme: { bg: "radial-gradient(110% 110% at 0% 0%,#facc1566 0%,transparent 50%),linear-gradient(160deg,#1e3a8a 0%,#0b1640 70%)", label: "Mobile Legends", chip: "💎", icon: "gem", glow: "#93c5fd" } },
  { match: /^playstation/, theme: { bg: "linear-gradient(135deg,#0070d1 0%,#003791 60%,#001b4d 100%)", label: "PlayStation", chip: "$", icon: "gamepad", glow: "#bfdcff" } },
  { match: /^steam/, theme: { bg: "linear-gradient(160deg,#2a475e 0%,#1b2838 55%,#0e141b 100%)", label: "Steam", chip: "$", icon: "gamepad", glow: "#66c0f4" } },
  { match: /^google-play/, theme: { bg: "linear-gradient(135deg,#00c853 0%,#00b0ff 35%,#ffd600 70%,#ff3d00 100%)", label: "Google Play", chip: "$", icon: "gift", glow: "#ffffff" } },
  { match: /^app-store/, theme: { bg: "linear-gradient(135deg,#5ac8fa 0%,#007aff 50%,#5856d6 100%)", label: "App Store", chip: "$", icon: "gift", glow: "#e0f0ff" } },
  { match: /^xbox/, theme: { bg: "radial-gradient(120% 120% at 100% 0%,#9bf00b44 0%,transparent 50%),linear-gradient(160deg,#107c10 0%,#0b4f0b 60%,#052905 100%)", label: "Xbox", chip: "$", icon: "gamepad", glow: "#c7f9a8" } },
  { match: /^shahid/, theme: { bg: "linear-gradient(135deg,#00c2a8 0%,#00897b 50%,#004d40 100%)", label: "Shahid VIP", chip: "VIP", icon: "tv", glow: "#ccfbf1" } },
  { match: /^youtube-premium/, theme: { bg: "linear-gradient(135deg,#ff4e45 0%,#ff0000 50%,#a30000 100%)", label: "YouTube Premium", chip: "▶", icon: "tv", glow: "#ffe0e0" } },
  { match: /^spotify/, theme: { bg: "radial-gradient(120% 120% at 0% 0%,#1ed76055 0%,transparent 55%),linear-gradient(160deg,#191414 0%,#0a0a0a 100%)", label: "Spotify Premium", chip: "♪", icon: "music", glow: "#1ed760" } },
  { match: /^netflix/, theme: { bg: "radial-gradient(120% 120% at 50% 0%,#e5091455 0%,transparent 55%),linear-gradient(160deg,#141414 0%,#000 100%)", label: "Netflix", chip: "4K", icon: "tv", glow: "#e50914" } },
  { match: /^canva/, theme: { bg: "linear-gradient(135deg,#00c4cc 0%,#7d2ae8 100%)", label: "Canva Pro", chip: "PRO", icon: "palette", glow: "#e0fbff" } },
  { match: /^capcut/, theme: { bg: "linear-gradient(160deg,#27272a 0%,#09090b 100%)", label: "CapCut Pro", chip: "PRO", icon: "tv", glow: "#ffffff" } },
  { match: /montage$/, theme: { bg: "radial-gradient(120% 120% at 100% 0%,#f472b655 0%,transparent 55%),linear-gradient(160deg,#4c1d95 0%,#1e1b4b 100%)", label: "Montage", chip: "▶", icon: "tv", glow: "#f5d0fe" } },
  { match: /^manage-ad/, theme: { bg: "linear-gradient(135deg,#fb923c 0%,#f97316 45%,#e11d48 100%)", label: "Ads Manager", chip: "📣", icon: "megaphone", glow: "#ffedd5" } },
  { match: /^manage-/, theme: { bg: "linear-gradient(135deg,#6366f1 0%,#4338ca 55%,#1e1b4b 100%)", label: "Management", chip: "PRO", icon: "briefcase", glow: "#e0e7ff" } },
  { match: /^chatgpt-plus/, theme: { bg: "linear-gradient(135deg,#19c37d 0%,#10a37f 45%,#0b6e55 100%)", label: "ChatGPT Plus", chip: "PLUS", icon: "chat", glow: "#d1fae5" } },
  { match: /^chatgpt-go/, theme: { bg: "linear-gradient(135deg,#34d399 0%,#10a37f 60%,#0f766e 100%)", label: "ChatGPT Go", chip: "GO", icon: "chat", glow: "#d1fae5" } },
  { match: /^gemini/, theme: { bg: "linear-gradient(135deg,#4285f4 0%,#9b72cb 55%,#d96570 100%)", label: "Gemini", chip: "AI", icon: "spark", glow: "#e8ecff" } },
  { match: /^claude/, theme: { bg: "linear-gradient(135deg,#f0a27f 0%,#d97757 50%,#a9533a 100%)", label: "Claude", chip: "AI", icon: "spark", glow: "#ffe9dd" } },
  { match: /^iphone/, theme: { bg: "linear-gradient(160deg,#3f3f46 0%,#18181b 60%,#09090b 100%)", label: "iPhone Plus", chip: "1Y", icon: "phone", glow: "#e4e4e7" } },
  { match: /^procession/, theme: { bg: "radial-gradient(120% 120% at 100% 0%,#d4a85355 0%,transparent 55%),linear-gradient(160deg,#064e3b 0%,#022c22 60%,#000 100%)", label: "مواكب وحسينيات", chip: "✦", icon: "image", glow: "#d4a853" } },
  { match: /design$|^poster|^ad-banner/, theme: { bg: "linear-gradient(135deg,#f9a8d4 0%,#c084fc 50%,#6366f1 100%)", label: "Design", chip: "✦", icon: "palette", glow: "#fff0fb" } },
  { match: /number/, theme: { bg: "linear-gradient(135deg,#4ade80 0%,#16a34a 50%,#0f766e 100%)", label: "WhatsApp · Telegram", chip: "+964", icon: "phone", glow: "#dcfce7" } },
  { match: /promotion/, theme: { bg: "linear-gradient(135deg,#fb923c 0%,#f97316 45%,#e11d48 100%)", label: "Ads", chip: "📣", icon: "megaphone", glow: "#ffedd5" } },
];

const FALLBACK: Theme = { bg: "linear-gradient(135deg,var(--hero-from),var(--hero-to))", label: "", chip: "", icon: "spark", glow: "#ffffff" };

export function themeFor(slug: string, icon?: string): Theme {
  const t = THEMES.find((x) => x.match.test(slug))?.theme;
  return t ?? { ...FALLBACK, icon: (icon as IconName) ?? "spark" };
}

export function ProductArt({ slug, icon, size = "card", className }: { slug: string; icon?: string; size?: "card" | "hero"; className?: string }) {
  const t = themeFor(slug, icon);
  const hero = size === "hero";
  return (
    <div className={cn("product-art relative size-full overflow-hidden", className)} style={{ background: t.bg }} aria-hidden="true">
      {/* soft decorative shapes */}
      <span className="art-float absolute -top-6 -end-6 size-28 rounded-full opacity-30 blur-md" style={{ background: t.glow }} />
      <span className="art-float-slow absolute -bottom-8 -start-4 size-32 rounded-full opacity-20 blur-lg" style={{ background: t.glow }} />
      <span className="absolute inset-0 opacity-[0.12]" style={{ backgroundImage: "radial-gradient(#fff 1px, transparent 1px)", backgroundSize: "18px 18px" }} />

      {/* platform label */}
      {t.label ? (
        // Position is set on the outer span (page direction); only the text is forced LTR.
        <span className={cn("absolute start-3 rounded-full bg-black/25 px-2.5 py-1 font-bold tracking-wide text-white ring-1 ring-white/25 backdrop-blur-sm", hero ? "top-3 text-sm" : "bottom-3 text-[0.68rem]")}>
          <span dir="ltr">{t.label}</span>
        </span>
      ) : null}

      {/* main glyph */}
      <span className="absolute inset-0 grid place-items-center">
        <span className={cn("art-pop relative grid place-items-center rounded-[1.6rem] bg-white/15 text-white shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)] ring-1 ring-white/30 backdrop-blur-md", hero ? "size-32" : "size-20")}>
          <Icon name={t.icon} className={hero ? "size-16" : "size-10"} />
          {t.chip ? (
            <span className={cn("absolute -bottom-3 -end-4 rounded-full bg-white px-2.5 py-0.5 font-black text-[#1b1035] shadow-lg", hero ? "text-base" : "text-xs")}>
              <span dir="ltr">{t.chip}</span>
            </span>
          ) : null}
        </span>
      </span>

      {/* hover light sweep */}
      <span className="art-shine pointer-events-none absolute inset-y-0 -start-full w-1/2 skew-x-[-20deg] bg-gradient-to-r from-transparent via-white/35 to-transparent" />
    </div>
  );
}
