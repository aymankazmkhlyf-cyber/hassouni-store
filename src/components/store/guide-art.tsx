/*
 * Original, simplified "phone screen" illustrations for the how-to guides.
 * They show where to tap and what to copy; they are not screenshots of any app.
 */

export type GuideArtVariant = "game-id" | "game-zone" | "social-link" | "telegram-username" | "scan-qr" | "wallet-transfer" | "gift-redeem" | "order-track";

type Labels = { title: string; a?: string; b?: string; c?: string };

const C = {
  frame: "var(--fg)",
  screen: "var(--bg-elevated, #fff)",
  muted: "var(--bg-muted, #eef0f7)",
  line: "var(--border-strong, #c9cbe0)",
  text: "var(--fg)",
  sub: "var(--fg-muted)",
  brand: "var(--brand)",
  hi: "#f59e0b",
};

function Phone({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <>
      <rect x="70" y="10" width="180" height="340" rx="26" fill={C.frame} />
      <rect x="78" y="18" width="164" height="324" rx="20" fill={C.screen} />
      <rect x="135" y="24" width="50" height="6" rx="3" fill={C.line} />
      <text x="160" y="50" textAnchor="middle" fontSize="11" fontWeight="700" fill={C.text}>{title}</text>
      {children}
    </>
  );
}

/** Dashed highlight + numbered badge. */
function Mark({ x, y, w, h, n, r = 10 }: { x: number; y: number; w: number; h: number; n: number; r?: number }) {
  const bx = x + w + 2;
  return (
    <g>
      <rect x={x - 3} y={y - 3} width={w + 6} height={h + 6} rx={r} fill="none" stroke={C.hi} strokeWidth="2.5" strokeDasharray="5 3" />
      <circle cx={bx > 250 ? x - 6 : bx} cy={y - 4} r="9" fill={C.hi} />
      <text x={bx > 250 ? x - 6 : bx} y={y - 0.5} textAnchor="middle" fontSize="10" fontWeight="800" fill="#1c1b29">{n}</text>
    </g>
  );
}

function Copy({ x, y }: { x: number; y: number }) {
  return (
    <g fill="none" stroke={C.brand} strokeWidth="1.6">
      <rect x={x} y={y + 3} width="8" height="9" rx="1.5" />
      <path d={`M${x + 3} ${y + 3}v-2.5h8v9h-3`} />
    </g>
  );
}

export function GuideArt({ variant, labels, className }: { variant: GuideArtVariant; labels: Labels; className?: string }) {
  const L = labels;
  return (
    <svg viewBox="0 0 320 360" className={className} role="img" aria-label={L.title} fontFamily="inherit">
      <rect width="320" height="360" rx="20" fill={C.muted} />
      {variant === "game-id" || variant === "game-zone" ? (
        <Phone title={L.title}>
          {/* lobby with avatar at the top corner */}
          <rect x="88" y="62" width="144" height="120" rx="12" fill={C.muted} />
          <circle cx="104" cy="78" r="11" fill={C.brand} />
          <circle cx="104" cy="75" r="4" fill="#fff" />
          <path d="M97 85a7 5 0 0 1 14 0" fill="#fff" />
          <rect x="120" y="72" width="44" height="6" rx="3" fill={C.line} />
          <Mark x={92} y={66} w={24} h={24} n={1} r={14} />
          <path d="M108 100 L130 196" stroke={C.hi} strokeWidth="2" strokeDasharray="4 3" markerEnd="url(#arrow)" />
          {/* profile card */}
          <rect x="92" y="200" width="136" height="96" rx="12" fill={C.screen} stroke={C.line} />
          <circle cx="114" cy="224" r="12" fill={C.brand} />
          <rect x="132" y="216" width="70" height="7" rx="3.5" fill={C.text} opacity="0.75" />
          <text x="102" y="262" fontSize="12" fontWeight="800" fill={C.text} direction="ltr">
            {variant === "game-zone" ? "ID: 123456789 (1234)" : "ID: 5123456789"}
          </text>
          <Copy x={208} y={252} />
          <Mark x={98} y={250} w={124} h={18} n={2} r={6} />
          {variant === "game-zone" ? (
            <text x="160" y="288" textAnchor="middle" fontSize="9.5" fill={C.sub}>{L.a}</text>
          ) : (
            <text x="160" y="288" textAnchor="middle" fontSize="9.5" fill={C.sub}>{L.a}</text>
          )}
        </Phone>
      ) : null}

      {variant === "social-link" ? (
        <Phone title={L.title}>
          <circle cx="160" cy="88" r="22" fill={C.brand} />
          <rect x="125" y="118" width="70" height="7" rx="3.5" fill={C.text} opacity="0.75" />
          <rect x="96" y="136" width="56" height="20" rx="8" fill={C.muted} />
          <rect x="168" y="136" width="56" height="20" rx="8" fill={C.muted} />
          <g fill={C.text}>
            <circle cx="214" cy="68" r="2.2" />
            <circle cx="221" cy="68" r="2.2" />
            <circle cx="228" cy="68" r="2.2" />
          </g>
          <Mark x={206} y={60} w={28} h={16} n={1} r={8} />
          {/* share sheet */}
          <rect x="84" y="206" width="152" height="124" rx="16" fill={C.screen} stroke={C.line} />
          <rect x="140" y="214" width="40" height="4" rx="2" fill={C.line} />
          <rect x="96" y="230" width="128" height="24" rx="8" fill={C.muted} />
          <text x="160" y="246" textAnchor="middle" fontSize="11" fontWeight="700" fill={C.text}>{L.a}</text>
          <Mark x={96} y={230} w={128} h={24} n={2} r={8} />
          <rect x="96" y="262" width="128" height="24" rx="8" fill={C.muted} opacity="0.6" />
          <rect x="96" y="294" width="128" height="24" rx="8" fill={C.muted} opacity="0.6" />
          <text x="160" y="190" textAnchor="middle" fontSize="9.5" fill={C.sub} direction="ltr">instagram.com/your.account</text>
        </Phone>
      ) : null}

      {variant === "telegram-username" ? (
        <Phone title={L.title}>
          <circle cx="160" cy="86" r="20" fill={C.brand} />
          <rect x="126" y="114" width="68" height="7" rx="3.5" fill={C.text} opacity="0.75" />
          {[0, 1, 2, 3].map((i) => (
            <rect key={i} x="92" y={140 + i * 40} width="136" height="30" rx="8" fill={C.muted} />
          ))}
          <text x="102" y="203" fontSize="9" fill={C.sub}>{L.a}</text>
          <text x="102" y="215" fontSize="12" fontWeight="800" fill={C.text} direction="ltr">@your_username</text>
          <Mark x={92} y={180} w={136} h={30} n={1} r={8} />
        </Phone>
      ) : null}

      {variant === "scan-qr" ? (
        <Phone title={L.title}>
          <rect x="100" y="70" width="120" height="120" rx="12" fill={C.muted} />
          {/* viewfinder corners */}
          <g stroke={C.brand} strokeWidth="4" fill="none" strokeLinecap="round">
            <path d="M108 96v-18h18M212 96v-18h-18M108 164v18h18M212 164v18h-18" />
          </g>
          {/* stylised QR */}
          <g fill={C.text}>
            <rect x="130" y="100" width="18" height="18" />
            <rect x="172" y="100" width="18" height="18" />
            <rect x="130" y="142" width="18" height="18" />
            <rect x="154" y="124" width="8" height="8" />
            <rect x="166" y="136" width="8" height="8" />
            <rect x="178" y="150" width="10" height="10" />
            <rect x="154" y="148" width="8" height="12" />
          </g>
          <Mark x={100} y={70} w={120} h={120} n={1} r={12} />
          <text x="160" y="216" textAnchor="middle" fontSize="10" fill={C.sub}>{L.a}</text>
          <rect x="92" y="228" width="136" height="30" rx="8" fill={C.muted} />
          <text x="160" y="248" textAnchor="middle" fontSize="13" fontWeight="800" fill={C.text} direction="ltr">25,000 IQD</text>
          <Mark x={92} y={228} w={136} h={30} n={2} r={8} />
          <rect x="92" y="272" width="136" height="30" rx="10" fill={C.brand} />
          <text x="160" y="292" textAnchor="middle" fontSize="11" fontWeight="800" fill="#fff">{L.b}</text>
          <Mark x={92} y={272} w={136} h={30} n={3} r={10} />
        </Phone>
      ) : null}

      {variant === "wallet-transfer" ? (
        <Phone title={L.title}>
          <rect x="92" y="66" width="136" height="30" rx="8" fill={C.muted} />
          <text x="160" y="86" textAnchor="middle" fontSize="12" fontWeight="800" fill={C.text} direction="ltr">07757382822</text>
          <Mark x={92} y={66} w={136} h={30} n={1} r={8} />
          <rect x="92" y="108" width="136" height="30" rx="8" fill={C.muted} />
          <text x="160" y="128" textAnchor="middle" fontSize="12" fontWeight="800" fill={C.text} direction="ltr">25,000 IQD</text>
          <Mark x={92} y={108} w={136} h={30} n={2} r={8} />
          <rect x="92" y="150" width="136" height="28" rx="10" fill={C.brand} />
          <text x="160" y="168" textAnchor="middle" fontSize="11" fontWeight="800" fill="#fff">{L.a}</text>
          {/* receipt */}
          <rect x="92" y="196" width="136" height="128" rx="12" fill={C.screen} stroke={C.line} />
          <circle cx="160" cy="222" r="12" fill="#16a34a" />
          <path d="M154 222l4 4 8-8" stroke="#fff" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <rect x="108" y="244" width="104" height="6" rx="3" fill={C.line} />
          <text x="160" y="276" textAnchor="middle" fontSize="9" fill={C.sub}>{L.b}</text>
          <text x="160" y="292" textAnchor="middle" fontSize="12" fontWeight="800" fill={C.text} direction="ltr">TXN 4839201746</text>
          <Mark x={104} y={266} w={112} h={32} n={3} r={6} />
        </Phone>
      ) : null}

      {variant === "gift-redeem" ? (
        <Phone title={L.title}>
          <circle cx="216" cy="66" r="10" fill={C.brand} />
          <Mark x={204} y={54} w={24} h={24} n={1} r={12} />
          <rect x="92" y="96" width="136" height="26" rx="8" fill={C.muted} opacity="0.6" />
          <rect x="92" y="130" width="136" height="26" rx="8" fill={C.muted} />
          <text x="160" y="147" textAnchor="middle" fontSize="11" fontWeight="700" fill={C.text}>{L.a}</text>
          <Mark x={92} y={130} w={136} h={26} n={2} r={8} />
          <rect x="92" y="164" width="136" height="26" rx="8" fill={C.muted} opacity="0.6" />
          <rect x="92" y="214" width="136" height="34" rx="8" fill={C.screen} stroke={C.line} />
          <text x="160" y="236" textAnchor="middle" fontSize="12.5" fontWeight="800" fill={C.text} direction="ltr" letterSpacing="1">XXXX-XXXX-XXXX</text>
          <Mark x={92} y={214} w={136} h={34} n={3} r={8} />
          <rect x="92" y="262" width="136" height="30" rx="10" fill={C.brand} />
          <text x="160" y="282" textAnchor="middle" fontSize="11" fontWeight="800" fill="#fff">{L.b}</text>
        </Phone>
      ) : null}

      {variant === "order-track" ? (
        <Phone title={L.title}>
          <rect x="92" y="66" width="136" height="44" rx="10" fill={C.muted} />
          <text x="102" y="84" fontSize="9" fill={C.sub}>{L.a}</text>
          <text x="102" y="100" fontSize="11.5" fontWeight="800" fill={C.text} direction="ltr">HDS-7K2M-Q9XD-4T</text>
          <Mark x={92} y={66} w={136} h={44} n={1} r={10} />
          {[0, 1, 2].map((i) => (
            <g key={i}>
              <circle cx="106" cy={140 + i * 34} r="7" fill={i < 2 ? C.brand : C.line} />
              <rect x="122" y={136 + i * 34} width={80 - i * 10} height="8" rx="4" fill={C.line} />
            </g>
          ))}
          <path d="M106 147v20M106 181v20" stroke={C.brand} strokeWidth="2" />
          <rect x="92" y="250" width="136" height="32" rx="10" fill={C.brand} />
          <path d="M112 260a6 6 0 0 1 12 0v6l2 2h-16l2-2z" fill="#fff" />
          <text x="170" y="270" textAnchor="middle" fontSize="10.5" fontWeight="800" fill="#fff">{L.b}</text>
          <Mark x={92} y={250} w={136} h={32} n={2} r={10} />
        </Phone>
      ) : null}

      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0 0L10 5L0 10z" fill={C.hi} />
        </marker>
      </defs>
    </svg>
  );
}
