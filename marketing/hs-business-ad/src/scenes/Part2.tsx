// Part 2: 0.0–12.0 s — hook (night city), office closed, the turn, HS reveal → agency homepage.
import React from 'react';
import { AbsoluteFill } from 'remotion';
import tl from '../timeline.json';
import { brief } from '../texts';
import { C, EASE_IN, F, H, W, glass, lerp, rand, ramp, sp } from '../theme';
import { NightCity3D } from '../three/Scenes3D';
import { Flare } from '../ui/Effects';
import { Icon, IconName } from '../ui/Icon';
import { Logo } from '../ui/Logo';
import { Phone } from '../ui/Phone';
import { CallScreen, HomeScreen } from './Screens';

// ───────────────────────────── shared backdrops
const Stars: React.FC<{ t: number; n?: number; top?: number; bottom?: number }> = ({ t, n = 70, top = 0, bottom = 900 }) => (
  <>
    {Array.from({ length: n }).map((_, i) => {
      const x = rand(i) * W;
      const y = top + rand(i + 300) * (bottom - top);
      const s = 1.5 + rand(i + 600) * 2.5;
      return <div key={i} style={{ position: 'absolute', left: x, top: y, width: s, height: s, borderRadius: '50%', background: '#fff', opacity: 0.25 + 0.5 * (0.5 + 0.5 * Math.sin(t * (1 + rand(i + 900) * 2) + i)) }} />;
    })}
  </>
);

export const Dust: React.FC<{ t: number; n?: number; color?: string; speed?: number }> = ({ t, n = 46, color = C.gold, speed = 30 }) => (
  <>
    {Array.from({ length: n }).map((_, i) => {
      const x = rand(i + 11) * W + Math.sin(t * 0.4 + i) * 20;
      const y = (((rand(i + 51) * H - t * speed * (0.5 + rand(i + 91))) % H) + H) % H;
      const s = 2 + rand(i + 71) * 4;
      return <div key={i} style={{ position: 'absolute', left: x, top: y, width: s, height: s, borderRadius: '50%', background: color, opacity: 0.15 + 0.35 * rand(i + 31), filter: s > 4.5 ? 'blur(1.5px)' : undefined }} />;
    })}
  </>
);

// ───────────────────────────── 0–3 s hook (also the loop tail, called with t − 60)
export const cityCam = (t: number) => ({
  pos: [Math.sin(t * 0.25) * 2, 92 - t * 2, 120 - t * 6] as [number, number, number],
  look: [0, -6 - t * 0.6, -170] as [number, number, number],
  fov: 44,
  roll: 0.012 * Math.sin(t * 0.6),
});

const Clock: React.FC<{ t: number; x: number; y: number; r: number }> = ({ t, x, y, r }) => {
  const tick = Math.floor((t + 1000) / 0.5);
  const local = (t + 1000) % 0.5;
  const settle = 1 - Math.exp(-local * 30) * Math.cos(local * 60);
  const sec = (tick - 1 + Math.min(1, settle)) * 6;
  return (
    <div style={{ position: 'absolute', left: x - r, top: y - r, width: r * 2, height: r * 2 }}>
      <div style={{ position: 'absolute', inset: -40, borderRadius: '50%', background: 'radial-gradient(circle, rgba(217,164,65,0.22), rgba(0,0,0,0) 65%)' }} />
      <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '3px solid rgba(217,164,65,0.85)', boxShadow: '0 0 30px rgba(217,164,65,0.45), inset 0 0 30px rgba(217,164,65,0.2)', background: 'rgba(11,23,38,0.55)' }} />
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} style={{ position: 'absolute', left: r - 2, top: 10, width: 4, height: i % 3 === 0 ? 20 : 11, borderRadius: 2, background: C.ivory, opacity: 0.8, transformOrigin: `2px ${r - 10}px`, transform: `rotate(${i * 30}deg)` }} />
      ))}
      {[
        { len: r * 0.5, w: 8, a: 60, c: C.ivory },
        { len: r * 0.75, w: 5, a: 0, c: C.ivory },
        { len: r * 0.85, w: 2.5, a: sec, c: C.gold },
      ].map((h, i) => (
        <div key={i} style={{ position: 'absolute', left: r - h.w / 2, top: r - h.len, width: h.w, height: h.len + 14, borderRadius: h.w, background: h.c, transformOrigin: `${h.w / 2}px ${h.len}px`, transform: `rotate(${h.a}deg)` }} />
      ))}
      <div style={{ position: 'absolute', left: r - 7, top: r - 7, width: 14, height: 14, borderRadius: '50%', background: C.gold }} />
    </div>
  );
};

export const HookShot: React.FC<{ t: number }> = ({ t }) => {
  const rack = ramp(t, 1.4, 0.6);
  const cam = cityCam(t);
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ background: 'linear-gradient(180deg, #050a14 0%, #0B1726 45%, #10304a 75%, #1b3a52 100%)' }}>
        <Stars t={t} top={250} bottom={900} />
        <div style={{ position: 'absolute', left: 140, top: 560, width: 150, height: 150, borderRadius: '50%', background: 'radial-gradient(circle at 40% 40%, #fff6dc, #e9d7a8 55%, rgba(233,215,168,0) 72%)', opacity: 0.85, filter: `blur(${rack * 2}px)` }} />
      </AbsoluteFill>
      <AbsoluteFill style={{ filter: rack > 0.02 ? `blur(${rack * 3.2}px)` : undefined, transform: `scale(${1 + t * 0.012})` }}>
        <NightCity3D cam={cam} />
      </AbsoluteFill>
      <div style={{ filter: rack < 0.98 ? `blur(${(1 - rack) * 1.4}px)` : undefined, opacity: 0.55 + 0.45 * rack }}>
        <Clock t={t} x={850} y={650} r={104} />
      </div>
      <Phone cam={{ y: 80, scale: 0.82 + 0.07 * ramp(t, -0.5, 3.5, (x) => x), ry: -14 + t * 3, rx: 7, rz: 1.5 }} glow={0.6}>
        <CallScreen t={t} ringFrom={0.2} />
      </Phone>
    </AbsoluteFill>
  );
};

// ───────────────────────────── 3.0–4.2 s office door closes
const DoorShot: React.FC<{ t: number }> = ({ t }) => {
  const close = ramp(t, 3.0, tl.door - 3.0, EASE_IN);
  const angle = -72 * (1 - close);
  const slam = t >= tl.door ? Math.exp(-(t - tl.door) * 18) * Math.sin((t - tl.door) * 90) : 0;
  const push = 1 + ramp(t, 3.0, 1.3) * 0.07;
  const gap = 1 - close;
  const fx = { x: 360, y: 640, w: 360, h: 720 };
  return (
    <AbsoluteFill style={{ background: 'linear-gradient(180deg, #070d17 0%, #0d1828 60%, #050910 100%)', transform: `scale(${push}) translate(${slam * 6}px, ${slam * 4}px)` }}>
      {/* floor */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: 1360, bottom: 0, background: 'linear-gradient(180deg, #0a1422, #04070c)' }} />
      {/* light wedge on the floor */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: 1360, height: 560, background: `linear-gradient(180deg, rgba(255,196,120,${0.55 * gap}), rgba(255,196,120,0))`, clipPath: `polygon(${fx.x}px 0, ${fx.x + fx.w * gap}px 0, ${fx.x + fx.w * gap + 420 * gap}px 100%, ${fx.x - 220}px 100%)` }} />
      {/* plaque */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: 560, textAlign: 'center' }}>
        <span dir="rtl" style={{ fontFamily: F.head, fontWeight: 600, fontSize: 40, color: C.gold, padding: '6px 26px', border: `2px solid rgba(217,164,65,0.5)`, borderRadius: 12, background: 'rgba(11,23,38,0.6)' }}>{brief.office}</span>
      </div>
      {/* frame + lit interior */}
      <div style={{ position: 'absolute', left: fx.x - 18, top: fx.y - 18, width: fx.w + 36, height: fx.h + 18, background: '#1a2636', borderRadius: '6px 6px 0 0' }} />
      <div style={{ position: 'absolute', left: fx.x, top: fx.y, width: fx.w, height: fx.h, background: 'linear-gradient(180deg, #ffd9a0, #e09a52 70%, #9b5a28)', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: 60, top: 380, width: 240, height: 120, background: 'rgba(60,30,10,0.45)', borderRadius: 6 }} />
      </div>
      {/* door panel, hinged on the left */}
      <div style={{ position: 'absolute', left: fx.x, top: fx.y, width: fx.w, height: fx.h, transformOrigin: 'left center', transform: `perspective(1400px) rotateY(${angle}deg)`, background: 'linear-gradient(90deg, #1d2b3d, #13202f 60%, #0e1825)', boxShadow: 'inset 0 0 0 3px rgba(255,255,255,0.05)' }}>
        <div style={{ position: 'absolute', left: 40, right: 40, top: 60, height: 260, borderRadius: 6, background: 'linear-gradient(160deg, rgba(95,183,229,0.25), rgba(11,23,38,0.6))', border: '2px solid rgba(255,255,255,0.08)' }} />
        <div style={{ position: 'absolute', right: 34, top: 380, width: 16, height: 70, borderRadius: 8, background: C.gold }} />
      </div>
      {/* light leaking under the closed door */}
      {t >= tl.door && <div style={{ position: 'absolute', left: fx.x, top: fx.y + fx.h - 4, width: fx.w, height: 6, background: '#ffcf8a', opacity: Math.max(0, 0.9 - (t - tl.door) * 1.4), filter: 'blur(3px)' }} />}
      {t >= tl.door + 0.1 && (
        <div style={{ position: 'absolute', left: fx.x + fx.w - 90, top: fx.y + 330, opacity: ramp(t, tl.door + 0.1, 0.3) }}>
          <Icon name="lock" size={54} color={C.red} t={t} drawAt={tl.door + 0.1} stroke={2} />
        </div>
      )}
    </AbsoluteFill>
  );
};

// ───────────────────────────── 4.2–5.5 s smash cut: the phone goes dark
const DarkPhoneShot: React.FC<{ t: number }> = ({ t }) => {
  const dark = ramp(t, tl.phoneDark, 0.18);
  const drift = t - 4.2;
  const out = ramp(t, 5.25, 0.25);
  return (
    <AbsoluteFill style={{ background: '#03060b', opacity: 1 - out }}>
      {Array.from({ length: 14 }).map((_, i) => (
        <div key={i} style={{ position: 'absolute', left: rand(i + 5) * W - 60, top: 300 + rand(i + 15) * 1200, width: 120 + rand(i) * 120, height: 120 + rand(i) * 120, borderRadius: '50%', background: i % 2 ? 'rgba(255,190,110,0.35)' : 'rgba(95,183,229,0.3)', filter: 'blur(26px)', opacity: 1 - dark * 0.6 }} />
      ))}
      <Phone cam={{ y: 90, scale: 1.18 + drift * 0.05, rz: -7 + drift * 1.5, ry: 12 - drift * 4, rx: 4 }} glow={0.8} dim={dark}>
        <CallScreen t={t} ringFrom={0.2} />
      </Phone>
    </AbsoluteFill>
  );
};

// ───────────────────────────── 5.5–7.0 s the turn: silence, a flare builds
const TurnShot: React.FC<{ t: number }> = ({ t }) => {
  const build = ramp(t, tl.reverseRiser[0] - 0.1, tl.impact - tl.reverseRiser[0] + 0.1, EASE_IN);
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      <AbsoluteFill style={{ background: `radial-gradient(ellipse 60% 30% at 50% 52%, rgba(14,110,115,${0.25 * build}), rgba(0,0,0,0) 70%)` }} />
      <Dust t={t} n={26} color={C.gold} speed={12} />
      <Flare x={540} y={1000} intensity={build} length={0.4 + build * 1.4} />
    </AbsoluteFill>
  );
};

// ───────────────────────────── 7.0–12.0 s reveal
const MATCH = 8.3;

export const RevealShot: React.FC<{ t: number }> = ({ t }) => {
  const orbitOut = ramp(t, MATCH, 0.6);
  const logoOut = ramp(t, MATCH + 0.15, 0.45);
  const ph = sp(t, MATCH + 0.15, 20, 110);
  const orbit = ramp(t, MATCH + 0.15, 2.4);
  const push = ramp(t, 10.4, 1.4);
  const cards = sp(t, 10.35, 19, 120);
  const rays = (t - 7) * 4;
  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse 90% 60% at 50% 55%, #123a52 0%, ${C.navy} 55%, #050a12 100%)` }}>
      <AbsoluteFill style={{ background: `conic-gradient(from ${rays}deg at 50% 52%, rgba(217,164,65,0.07), rgba(0,0,0,0) 8%, rgba(95,183,229,0.06) 16%, rgba(0,0,0,0) 26%, rgba(217,164,65,0.06) 40%, rgba(0,0,0,0) 52%, rgba(95,183,229,0.05) 66%, rgba(0,0,0,0) 78%)` }} />
      <Dust t={t} n={50} />
      {/* logo → orbit ring grows into the phone (match cut) */}
      {logoOut < 1 && (
        <div style={{ position: 'absolute', left: 0, right: 0, top: 960 - 110, display: 'flex', justifyContent: 'center', opacity: 1 - logoOut, transform: `scale(${1 + orbitOut * 0.25})` }}>
          <Logo t={t} start={7.05} size={210} orbitOut={orbitOut} />
        </div>
      )}
      {t >= MATCH + 0.1 && (
        <>
          {/* floating glass cards pulled out of the homepage */}
          {(
            [
              ['plane', -330, -170, 0.9],
              ['building', 330, 40, 1.1],
              ['ticket', -320, 260, 1.25],
            ] as [IconName, number, number, number][]
          ).map(([icon, dx, dy, depth], i) => (
            <div
              key={icon}
              style={{
                position: 'absolute',
                left: 540 - 70 + dx * cards + Math.sin(t * 1.2 + i) * 8,
                top: 1100 - 70 + dy * cards - push * 40 * depth,
                width: 140,
                height: 140,
                borderRadius: 40,
                ...glass(0.1),
                opacity: Math.min(1, cards * 1.5),
                transform: `scale(${(0.6 + 0.4 * cards) * depth * 0.9})`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name={icon} size={70} color={C.gold} t={t} drawAt={10.4 + i * 0.08} />
            </div>
          ))}
          <Phone cam={{ y: 95 - push * 20, scale: (0.55 + 0.29 * ph) * (1 + push * 0.06), ry: lerp(orbit, [0, 1], [38, -6]) + push * 4, rx: 8 - orbit * 4, opacity: Math.min(1, ph * 1.6) }} glow={0.5}>
            <HomeScreen t={t} at={MATCH + 0.35} tapAt={tl.taps[0]} />
          </Phone>
        </>
      )}
    </AbsoluteFill>
  );
};

/** Picture for 0–12 s. */
export const Part2Picture: React.FC<{ t: number }> = ({ t }) => {
  if (t < 3) return <HookShot t={t} />;
  if (t < 4.2) return <DoorShot t={t} />;
  if (t < 5.5) return <DarkPhoneShot t={t} />;
  if (t < 7) return <TurnShot t={t} />;
  return <RevealShot t={t} />;
};

export { H };
