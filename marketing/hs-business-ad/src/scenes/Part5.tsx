// Part 5: 44.0–60.0 s — 7/7 dashboard in a glass tower, offer (airplane + rising graph), CTA, loop.
import React from 'react';
import { AbsoluteFill } from 'remotion';
import tl from '../timeline.json';
import { arDigits, brief, instagramHandle, ui } from '../texts';
import { C, EASE_IN, F, H, IN_OUT, W, glass, lerp, rand, ramp, sp } from '../theme';
import { Airplane3D, Tower3D } from '../three/Scenes3D';
import { Flare, LightLeak, LightSweep } from '../ui/Effects';
import { Icon, IconBadge } from '../ui/Icon';
import { Logo } from '../ui/Logo';
import { Dust, HookShot } from './Part2';
import { Txt } from './Screens';

const D = tl.dataBuild;

// ───────────────────────────── 7/7 dashboard (44–50)
const towerCam = (t: number) => {
  const c = ramp(t, 43.75, 1.6, IN_OUT);
  return { pos: [lerp(c, [0, 1], [30, 34]), lerp(c, [0, 1], [175, 62]), lerp(c, [0, 1], [70, 58])] as [number, number, number], look: [0, lerp(c, [0, 1], [150, 48]), 0] as [number, number, number], fov: 42 };
};

const Laptop: React.FC<{ t: number }> = ({ t }) => {
  const inP = sp(t, 44.85, 20, 110);
  const orbit = ramp(t, 47.4, 2.4, IN_OUT);
  const ry = lerp(orbit, [0, 1], [-12, 10]);
  const pop = (at: number): React.CSSProperties => {
    const p = sp(t, at, 20, 170);
    return { opacity: Math.min(1, ramp(t, at, 0.25)), transform: `translateY(${(1 - p) * 22}px) scale(${0.95 + 0.05 * p})` };
  };
  const chart = ramp(t, D[2] + 0.1, 1.2);
  const pts = [0.3, 0.42, 0.38, 0.55, 0.5, 0.68, 0.62, 0.8, 0.92];
  const path = pts.map((v, i) => `${i ? 'L' : 'M'}${14 + i * 60} ${150 - v * 120}`).join(' ');
  const lid = { x: 90, y: 700, w: 900, h: 580 };
  return (
    <div style={{ position: 'absolute', inset: 0, opacity: Math.min(1, inP * 1.4), transform: `translateY(${(1 - inP) * 120}px) scale(${0.82 + 0.18 * inP})` }}>
      <div style={{ position: 'absolute', left: lid.x, top: lid.y, width: lid.w, height: lid.h, transform: `perspective(2400px) rotateY(${ry}deg) rotateX(6deg)`, transformOrigin: '50% 100%' }}>
        <div style={{ position: 'absolute', inset: 0, borderRadius: 30, background: 'linear-gradient(150deg, #3a4a5c, #141e2b 45%, #0a0f17)', boxShadow: '0 70px 120px -40px rgba(0,0,0,0.9), 0 0 80px rgba(95,183,229,0.15)' }} />
        <div dir="rtl" style={{ position: 'absolute', left: 20, top: 20, right: 20, bottom: 20, borderRadius: 16, overflow: 'hidden', background: `radial-gradient(ellipse 120% 80% at 50% 0%, #1b3550, ${C.navy} 70%)` }}>
          <div style={{ position: 'absolute', right: 22, left: 22, top: 16, height: 74, display: 'flex', alignItems: 'center', justifyContent: 'space-between', ...pop(D[0]) }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 52, height: 52, borderRadius: 16, background: `linear-gradient(140deg, ${C.gold}, #a8741f)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="dashboard" size={30} color={C.navy} />
              </div>
              <Txt size={40} weight={700} font={F.head}>{ui.dashboard}</Txt>
            </div>
            <Txt size={36} weight={600} color={C.gold}>{brief.travelAgency}</Txt>
          </div>
          <div style={{ position: 'absolute', right: 22, top: 104, width: 300, height: 180, borderRadius: 24, ...glass(0.08), padding: '14px 22px', boxSizing: 'border-box', ...pop(D[1]) }}>
            <Txt size={36} weight={600} color={C.muted}>{ui.bookings}</Txt>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontFamily: F.head, fontWeight: 700, fontSize: 84, color: C.gold, lineHeight: 1.15 }}>{arDigits(Math.round(lerp(t, [D[1], D[1] + 1.2], [96, 128])))}</span>
              <Icon name="ticket" size={48} color={C.sky} t={t} drawAt={D[1]} />
            </div>
          </div>
          <div style={{ position: 'absolute', left: 22, top: 104, width: 520, height: 180, borderRadius: 24, ...glass(0.08), padding: '12px 20px', boxSizing: 'border-box', ...pop(D[2]) }}>
            <Txt size={36} weight={600} color={C.muted}>{ui.thisMonth}</Txt>
            <svg width={500} height={150} style={{ position: 'absolute', left: 0, top: 30 }}>
              <defs>
                <linearGradient id="dashA" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor={C.gold} stopOpacity="0.45" />
                  <stop offset="1" stopColor={C.gold} stopOpacity="0" />
                </linearGradient>
                <clipPath id="dashC">
                  <rect x={0} y={0} width={14 + chart * 480} height={150} />
                </clipPath>
              </defs>
              <g clipPath="url(#dashC)">
                <path d={`${path} L494 150 L14 150 Z`} fill="url(#dashA)" />
                <path d={path} stroke={C.gold} strokeWidth={5} fill="none" strokeLinejoin="round" strokeLinecap="round" />
              </g>
            </svg>
          </div>
          <div style={{ position: 'absolute', right: 22, left: 22, top: 300, display: 'flex', alignItems: 'center', gap: 10, ...pop(D[3] - 0.1) }}>
            <Icon name="users" size={34} color={C.gold} />
            <Txt size={36} weight={700} font={F.head}>{ui.staff}</Txt>
          </div>
          {ui.staffList.map((p, i) => (
            <div key={p.name} style={{ position: 'absolute', right: 22, left: 22, top: 352 + i * 60, height: 52, borderRadius: 18, background: 'rgba(244,239,230,0.05)', border: '1.5px solid rgba(244,239,230,0.1)', display: 'flex', alignItems: 'center', gap: 14, padding: '0 16px', boxSizing: 'border-box', ...pop(D[3 + i]) }}>
              <div style={{ width: 34, height: 34, borderRadius: '50%', background: [C.gold, C.sky, C.teal][i] }} />
              <Txt size={34} weight={600}>{p.name}</Txt>
              <span style={{ marginRight: 'auto' }}>
                <Txt size={32} color={C.muted}>{p.role}</Txt>
              </span>
            </div>
          ))}
          <LightSweep p={ramp(t, 48.2, 1.0)} opacity={0.35} />
        </div>
      </div>
      <div style={{ position: 'absolute', left: 60, top: lid.y + lid.h - 4, width: 960, height: 34, borderRadius: '6px 6px 30px 30px', background: 'linear-gradient(180deg, #3a4a5c, #141e2b)', boxShadow: '0 40px 50px -24px rgba(0,0,0,0.8)' }} />
    </div>
  );
};

const F7Shot: React.FC<{ t: number }> = ({ t }) => {
  const behind = ramp(t, 44.9, 0.6);
  return (
    <AbsoluteFill style={{ background: `linear-gradient(180deg, #03070d, ${C.navy} 60%, #0b1c2c)` }}>
      <AbsoluteFill style={{ filter: behind > 0.02 ? `blur(${behind * 11}px) brightness(${1 - behind * 0.55})` : undefined, transform: `scale(${1 + behind * 0.06})` }}>
        <Tower3D cam={towerCam(t)} />
      </AbsoluteFill>
      <Laptop t={t} />
      <IconBadge name="dashboard" t={t} at={45.1} until={49.7} x={150} y={600} />
      <IconBadge name="users" t={t} at={46.8} until={49.7} x={930} y={600} />
    </AbsoluteFill>
  );
};

// ───────────────────────────── offer (50–55)
const Sky: React.FC<{ t: number }> = ({ t }) => (
  <AbsoluteFill style={{ background: 'linear-gradient(180deg, #071224 0%, #10304a 40%, #6b4a3a 72%, #d99a52 88%, #f2c26b 100%)' }}>
    {Array.from({ length: 9 }).map((_, i) => (
      <div key={i} style={{ position: 'absolute', left: ((rand(i + 3) * 1600 - (t - 50) * (60 + i * 12)) % 1700) - 300, top: 900 + rand(i + 9) * 700, width: 500 + rand(i) * 400, height: 90 + rand(i + 1) * 60, borderRadius: '50%', background: 'rgba(255,220,180,0.18)', filter: 'blur(26px)' }} />
    ))}
  </AbsoluteFill>
);

const OfferShot: React.FC<{ t: number }> = ({ t }) => {
  const fly = ramp(t, 49.95, 1.25, (x) => x);
  const planePos: [number, number, number] = [lerp(fly, [0, 1], [-15, 9]), lerp(fly, [0, 1], [-3.2, 2.2]), lerp(fly, [0, 1], [-34, 11])];
  const [g0, g1] = tl.graph;
  const g = ramp(t, g0, g1 - g0, IN_OUT);
  const card = sp(t, 50.85, 20, 140);
  const price = sp(t, 52.6, 18, 170);
  const push = ramp(t, 53.5, 1.5, (x) => x);
  const vals = [0.16, 0.22, 0.2, 0.32, 0.4, 0.37, 0.52, 0.6, 0.7, 0.82, 0.95];
  const cw = 800;
  const ch = 300;
  const pts = vals.map((v, i) => [10 + (i * (cw - 20)) / (vals.length - 1), ch - 10 - v * (ch - 40)] as const);
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ');
  const e = g * (vals.length - 1);
  const i0 = Math.min(vals.length - 2, Math.floor(e));
  const f = e - i0;
  const ex = pts[i0][0] + (pts[i0 + 1][0] - pts[i0][0]) * f;
  const ey = pts[i0][1] + (pts[i0 + 1][1] - pts[i0][1]) * f;
  return (
    <AbsoluteFill>
      <Sky t={t} />
      {fly > 0 && fly < 1 && (
        <AbsoluteFill style={{ filter: fly > 0.75 ? `blur(${(fly - 0.75) * 16}px)` : undefined }}>
          <Airplane3D cam={{ pos: [0, 0, 14], look: [0, 0, 0], fov: 46 }} pos={planePos} rot={[0.38 + fly * 0.1, -0.55 - fly * 0.3, 0.08 + fly * 0.15]} />
        </AbsoluteFill>
      )}
      <AbsoluteFill style={{ transform: `scale(${1 + push * 0.05})` }}>
        <div style={{ position: 'absolute', left: 90, top: 600, width: 900, height: 470, borderRadius: 40, ...glass(0.1), background: 'linear-gradient(160deg, rgba(20,38,60,0.88), rgba(11,23,38,0.92))', opacity: Math.min(1, card * 1.4), transform: `translateY(${(1 - card) * 50 + Math.sin(t * 1.2) * 6}px)` }}>
          <div style={{ position: 'absolute', right: 40, top: 30, display: 'flex', alignItems: 'center', gap: 16, direction: 'rtl' }}>
            <div style={{ width: 70, height: 70, borderRadius: 22, background: 'rgba(217,164,65,0.16)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="trend" size={44} color={C.gold} t={t} drawAt={50.9} />
            </div>
            <Txt size={42} weight={700} font={F.head}>{ui.clients}</Txt>
          </div>
          <svg width={cw} height={ch} style={{ position: 'absolute', left: 50, top: 140, overflow: 'visible' }}>
            <defs>
              <linearGradient id="offA" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={C.gold} stopOpacity="0.5" />
                <stop offset="1" stopColor={C.gold} stopOpacity="0" />
              </linearGradient>
              <clipPath id="offC">
                <rect x={0} y={-40} width={ex} height={ch + 80} />
              </clipPath>
            </defs>
            {[0, 1, 2, 3].map((k) => (
              <line key={k} x1={0} x2={cw} y1={30 + k * 85} y2={30 + k * 85} stroke="rgba(244,239,230,0.12)" strokeWidth={2} strokeDasharray="6 10" />
            ))}
            <g clipPath="url(#offC)">
              <path d={`${line} L${cw - 10} ${ch} L10 ${ch} Z`} fill="url(#offA)" />
              <path d={line} stroke="#f2c26b" strokeWidth={8} fill="none" strokeLinejoin="round" strokeLinecap="round" style={{ filter: 'drop-shadow(0 0 10px rgba(217,164,65,0.8))' }} />
            </g>
            {g > 0 && (
              <>
                <circle cx={ex} cy={ey} r={28 + 8 * Math.sin(t * 6)} fill={C.gold} opacity={0.25} />
                <circle cx={ex} cy={ey} r={13} fill="#fff" stroke={C.gold} strokeWidth={6} />
              </>
            )}
          </svg>
        </div>
        {t >= 52.55 && (
          <div style={{ position: 'absolute', left: 130, top: 1130, width: 820, height: 280, borderRadius: 40, ...glass(0.12), background: 'linear-gradient(160deg, rgba(28,50,74,0.95), rgba(11,23,38,0.95))', overflow: 'hidden', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: Math.min(1, price * 1.5), transform: `translateY(${(1 - price) * 60}px) scale(${0.9 + 0.1 * price})`, boxShadow: '0 50px 90px -30px rgba(0,0,0,0.85), 0 0 70px rgba(217,164,65,0.25)' }}>
            <div style={{ padding: '2px 24px', borderRadius: 20, background: 'rgba(217,164,65,0.16)' }}>
              <Txt size={38} weight={600} color={C.gold}>{ui.monthly}</Txt>
            </div>
            <span dir="rtl" style={{ fontFamily: F.head, fontWeight: 700, fontSize: 68, color: C.ivory, lineHeight: 1.35 }}>{brief.offerPrice}</span>
            <LightSweep p={ramp(t, 53.1, 1.0)} opacity={0.8} color="255,226,170" />
          </div>
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ───────────────────────────── CTA (55–59.5)
export const CTAShot: React.FC<{ t: number }> = ({ t }) => {
  const field = sp(t, 55.6, 20, 160);
  const typed = Math.floor(ramp(t, 55.9, 0.6, (x) => x) * ui.commentKeyword.length);
  const word = ui.commentKeyword;
  const btn = sp(t, 56.2, 19, 150);
  const pulse = Math.max(...tl.ctaPulse.map((p) => (t >= p && t < p + 0.8 ? Math.sin(((t - p) / 0.8) * Math.PI) : 0)));
  const hit = t >= tl.finalHit ? Math.exp(-(t - tl.finalHit) * 3) : 0;
  const caret = Math.floor(t * 2.5) % 2 === 0;
  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse 90% 60% at 50% 50%, #133a52 0%, ${C.navy} 55%, #04080f 100%)`, transform: `scale(${1 + hit * 0.03})` }}>
      <AbsoluteFill style={{ background: `conic-gradient(from ${(t - 55) * 10}deg at 50% 45%, rgba(217,164,65,0.08), rgba(0,0,0,0) 10%, rgba(95,183,229,0.06) 20%, rgba(0,0,0,0) 32%, rgba(217,164,65,0.07) 50%, rgba(0,0,0,0) 62%, rgba(95,183,229,0.05) 80%, rgba(0,0,0,0) 90%)` }} />
      <Dust t={t} n={60} />
      <div style={{ position: 'absolute', left: 0, right: 0, top: 545, display: 'flex', justifyContent: 'center', transform: `translateY(${Math.sin(t * 1.3) * 5}px)` }}>
        <Logo t={t} start={55.05} size={170} />
      </div>
      {/* comment field: the viewer types the keyword */}
      <div style={{ position: 'absolute', left: 150, right: 150, top: 820, height: 112, borderRadius: 56, ...glass(0.12), display: 'flex', alignItems: 'center', gap: 18, padding: '0 34px', direction: 'rtl', opacity: Math.min(1, field * 1.5), transform: `scale(${0.85 + 0.15 * field})` }}>
        <Icon name="comment" size={52} color={C.gold} t={t} drawAt={55.6} />
        <span style={{ fontFamily: F.head, fontWeight: 700, fontSize: 52, color: C.ivory }}>{word.slice(0, typed)}</span>
        <div style={{ width: 4, height: 52, background: C.gold, opacity: caret ? 1 : 0, marginRight: -10 }} />
        <div style={{ marginRight: 'auto', width: 70, height: 70, borderRadius: '50%', background: typed >= ui.commentKeyword.length ? C.gold : 'rgba(244,239,230,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="send" size={34} color={typed >= ui.commentKeyword.length ? C.navy : C.muted} />
        </div>
      </div>
      {/* CTA button (coral = CTA only) */}
      {tl.ctaPulse.map((p, k) => {
        const q = ramp(t, p, 1.0, (x) => x);
        return q > 0 && q < 1 ? <div key={k} style={{ position: 'absolute', left: 110, top: 1010, width: 860, height: 150, borderRadius: 52, border: `4px solid ${C.coral}`, opacity: (1 - q) * 0.6, transform: `scale(${1 + q * 0.08}, ${1 + q * 0.35})` }} /> : null;
      })}
      <div style={{ position: 'absolute', left: 110, top: 1010, width: 860, height: 150, borderRadius: 52, background: `linear-gradient(135deg, #ff8a74, ${C.coral} 50%, #ec4f3b)`, boxShadow: `0 34px 70px -24px rgba(255,107,87,0.9), 0 0 ${44 * pulse}px rgba(255,107,87,${0.55 * pulse})`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, direction: 'rtl', overflow: 'hidden', opacity: Math.min(1, btn * 1.5), transform: `translateY(${(1 - btn) * 40}px) scale(${(0.9 + 0.1 * btn) * (1 + pulse * 0.04)})` }}>
        <span dir="rtl" style={{ fontFamily: F.head, fontWeight: 700, fontSize: 56, color: '#fff', whiteSpace: 'nowrap' }}>{brief.ctaButton}</span>
        <LightSweep p={ramp(t, 57.1, 1.0)} opacity={0.55} />
      </div>
      {/* DM line */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: 1215, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 18, direction: 'rtl', opacity: ramp(t, 56.4, 0.4) }}>
        <div style={{ width: 92, height: 92, borderRadius: 30, ...glass(0.12), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="dm" size={54} color={C.gold} t={t} drawAt={56.45} />
        </div>
      </div>
      {instagramHandle && (
        <div style={{ position: 'absolute', left: 0, right: 0, top: 1440, textAlign: 'center', opacity: ramp(t, 57.2, 0.4) }}>
          <span style={{ fontFamily: F.body, fontWeight: 600, fontSize: 38, color: C.ivory, direction: 'ltr' }}>{instagramHandle}</span>
        </div>
      )}
      <Flare x={540} y={660} intensity={Math.max(hit * 0.9, Math.sin(ramp(t, 55.0, 1.0) * Math.PI) * 0.8)} />
    </AbsoluteFill>
  );
};

/** Picture for 44–60 s (the crane in at 44.0 is handled here, the whip at 50.0 in VideoA). */
export const Part5Picture: React.FC<{ t: number }> = ({ t }) => {
  if (t < 50) return <F7Shot t={t} />;
  if (t < 54.8) return <OfferShot t={t} />;
  if (t < 55.3) {
    const p = ramp(t, 54.8, 0.5, IN_OUT);
    return (
      <AbsoluteFill>
        <AbsoluteFill style={{ opacity: 1 - p }}>
          <OfferShot t={t} />
        </AbsoluteFill>
        <AbsoluteFill style={{ opacity: p }}>
          <CTAShot t={t} />
        </AbsoluteFill>
        <LightLeak p={ramp(t, 54.7, 0.8)} strength={1} from="left" />
      </AbsoluteFill>
    );
  }
  if (t < 59.5) return <CTAShot t={t} />;
  // 59.5–60.0 loop: fade-match into the opening night-city shot (same clock tick)
  const p = ramp(t, 59.5, 0.4, EASE_IN);
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ opacity: 1 - p }}>
        <CTAShot t={t} />
      </AbsoluteFill>
      <AbsoluteFill style={{ opacity: p }}>
        <HookShot t={t - 60} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export { H, W };
