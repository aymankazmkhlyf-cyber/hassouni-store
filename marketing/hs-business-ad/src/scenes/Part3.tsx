// Part 3: 12.0–28.0 s — 1/7 hours, 2/7 booking (button → globe → boarding pass), 3/7 daily capacity.
import React from 'react';
import { AbsoluteFill } from 'remotion';
import * as THREE from 'three';
import tl from '../timeline.json';
import { arDigits, brief, ui } from '../texts';
import { C, EASE_IN, F, H, IN_OUT, W, glass, lerp, ramp, sp } from '../theme';
import { Globe3D, globeCity, makeCamera } from '../three/Scenes3D';
import { LightLeak, LightSweep } from '../ui/Effects';
import { Icon, IconBadge } from '../ui/Icon';
import { Phone } from '../ui/Phone';
import type { Cam } from '../ui/Phone';
import { Dust } from './Part2';
import { BOOK_BTN, BookingScreen, SW, ScheduleScreen } from './Screens';
import { screenToFrame } from './transitions';

const Backdrop: React.FC<{ t: number; hue?: 'teal' | 'gold' | 'sky' }> = ({ t, hue = 'teal' }) => {
  const c = hue === 'gold' ? 'rgba(217,164,65,0.20)' : hue === 'sky' ? 'rgba(95,183,229,0.18)' : 'rgba(14,110,115,0.35)';
  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse 90% 60% at 50% 55%, #10283d 0%, ${C.navy} 55%, #050a12 100%)` }}>
      <AbsoluteFill style={{ background: `radial-gradient(circle at ${50 + Math.sin(t * 0.3) * 12}% ${48 + Math.cos(t * 0.25) * 8}%, ${c}, rgba(0,0,0,0) 45%)` }} />
      <Dust t={t} n={34} />
    </AbsoluteFill>
  );
};

// ───────────────────────────── 1/7 working hours (12–17)
const F1_CUT = 14.4;

export const f1Cam = (t: number): Cam =>
  t < F1_CUT
    ? { y: 70, scale: 0.86 + 0.04 * ramp(t, 12, 2.4, (x) => x), ry: lerp(t, [12, F1_CUT], [16, 5]), rx: 6, rz: 0.5 }
    : { y: -20 - 30 * ramp(t, F1_CUT, 2.6, (x) => x), x: 20, scale: 1.1 + 0.05 * ramp(t, F1_CUT, 2.6, (x) => x), ry: lerp(t, [F1_CUT, 17], [-12, -4]), rx: 4, rz: -1 };

export const F1Shot: React.FC<{ t: number }> = ({ t }) => {
  const card = sp(t, 15.75, 19, 120);
  const cardOn = t >= 15.7;
  return (
    <AbsoluteFill>
      <Backdrop t={t} />
      <Phone cam={f1Cam(t)} glow={0.45}>
        <ScheduleScreen t={t} at={11.9} days={tl.days} hoursAt={15.6} hideHours={ramp(t, 15.7, 0.25)} />
      </Phone>
      {cardOn && (
        <div
          style={{
            position: 'absolute',
            left: 90,
            right: 90,
            top: 1290 - card * 30,
            height: 170,
            borderRadius: 40,
            ...glass(0.12),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 22,
            direction: 'rtl',
            opacity: Math.min(1, card * 1.5),
            transform: `perspective(1600px) rotateX(${(1 - card) * 30}deg) scale(${0.7 + 0.3 * card})`,
            boxShadow: '0 50px 90px -30px rgba(0,0,0,0.8), 0 0 60px rgba(217,164,65,0.25)',
            overflow: 'hidden',
          }}
        >
          <Icon name="clock" size={64} color={C.gold} t={t} drawAt={15.75} />
          <span dir="rtl" style={{ fontFamily: F.head, fontWeight: 700, fontSize: 64, color: C.gold }}>{brief.f1Hours}</span>
          <LightSweep p={ramp(t, 16.1, 0.8)} opacity={0.5} />
        </div>
      )}
      <IconBadge name="calendar" t={t} at={12.35} until={F1_CUT - 0.1} x={150} y={720} />
      <IconBadge name="clock" t={t} at={F1_CUT + 0.2} until={16.9} x={930} y={1120} />
    </AbsoluteFill>
  );
};

// ───────────────────────────── 2/7 booking: tap → globe → boarding pass (17–23)
const GLOBE_IN = 18.1;
const TICKET_IN = 20.4;

const f2Cam = (t: number): Cam => ({ y: 40, scale: 0.92 + 0.04 * ramp(t, 17, 1.1, (x) => x), ry: lerp(t, [17, 17.75], [-14, 0]), rx: lerp(t, [17, 17.75], [8, 2]) });

const BookingPhone: React.FC<{ t: number }> = ({ t }) => (
  <AbsoluteFill>
    <Backdrop t={t} hue="gold" />
    <Phone cam={f2Cam(t)} glow={0.5}>
      <BookingScreen t={t} at={16.75} tapAt={tl.taps[1]} />
    </Phone>
    <IconBadge name="plane" t={t} at={17.25} until={GLOBE_IN} x={150} y={700} />
  </AbsoluteFill>
);

// speed ramp: the globe arrives spinning fast and settles on the Middle East
const globeSpin = (t: number) => -2.23 + 1.6 * (1 - ramp(t, GLOBE_IN, 1.25, Easing3)) - (t - GLOBE_IN) * 0.03;
function Easing3(x: number) {
  return 1 - Math.pow(1 - x, 3);
}

const GlobeShot: React.FC<{ t: number }> = ({ t }) => {
  const spin = globeSpin(t);
  const target = globeCity('baghdad', spin).add(globeCity('istanbul', spin)).add(globeCity('dubai', spin)).multiplyScalar(1 / 3);
  const dist = lerp(t, [GLOBE_IN, GLOBE_IN + 1.3, TICKET_IN], [44, 30, 26]);
  const dir = target.clone().normalize();
  const cam = { pos: [dir.x * dist, dir.y * dist - 3, dir.z * dist] as [number, number, number], look: [target.x * 0.55, target.y * 0.55 + 2.2, target.z * 0.55] as [number, number, number], fov: 38 };
  const camera = makeCamera(cam);
  const arc1 = ramp(t, GLOBE_IN + 0.25, 1.3, IN_OUT);
  const arc2 = ramp(t, GLOBE_IN + 0.8, 1.2, IN_OUT);
  const label = (k: 'baghdad' | 'istanbul' | 'dubai', at: number, name: string) => {
    const p = globeCity(k, spin).clone().project(camera);
    const x = (p.x * 0.5 + 0.5) * W;
    const y = (-p.y * 0.5 + 0.5) * H;
    const a = ramp(t, at, 0.3);
    return (
      <div key={k} style={{ position: 'absolute', left: x - 200, width: 400, top: y - 92, textAlign: 'center', opacity: a, transform: `translateY(${(1 - a) * 12}px)` }}>
        <span dir="rtl" style={{ fontFamily: F.head, fontWeight: 700, fontSize: 42, color: C.ivory, padding: '4px 22px', borderRadius: 22, background: 'rgba(11,23,38,0.72)', border: '1.5px solid rgba(217,164,65,0.55)' }}>{name}</span>
      </div>
    );
  };
  return (
    <AbsoluteFill style={{ background: 'radial-gradient(ellipse at 50% 55%, #0f2a40 0%, #050a12 70%)' }}>
      <Dust t={t} n={40} color={C.sky} speed={8} />
      <Globe3D cam={cam} spin={spin} arcs={[{ from: 'baghdad', to: 'istanbul', p: arc1 }, { from: 'baghdad', to: 'dubai', p: arc2 * 0.999 }]} plane={{ arc: 0, p: ramp(t, GLOBE_IN + 0.35, 1.5, IN_OUT) }} />
      {label('baghdad', GLOBE_IN + 0.3, ui.cities.baghdad)}
      {label('istanbul', GLOBE_IN + 1.3, ui.cities.istanbul)}
      {label('dubai', GLOBE_IN + 1.7, ui.cities.dubai)}
      {/* jet passes the lens */}
      {t > tl.jet[0] - 0.25 && t < tl.jet[0] + 0.35 && (
        <div style={{ position: 'absolute', left: lerp(t, [tl.jet[0] - 0.25, tl.jet[0] + 0.35], [1250, -900]), top: 560 + (t - tl.jet[0]) * 160, transform: 'rotate(-100deg) scale(1)', filter: 'blur(5px)', opacity: 0.85 }}>
          <Icon name="plane" size={720} color="#dfe8f1" stroke={1.1} />
        </div>
      )}
    </AbsoluteFill>
  );
};

const BoardingPass: React.FC<{ t: number }> = ({ t }) => {
  const print = ramp(t, TICKET_IN + 0.05, 0.55, IN_OUT);
  const stamp = sp(t, tl.ticket, 16, 260);
  const orbit = ramp(t, 21.2, 1.8, (x) => x);
  const sweep = ramp(t, 21.6, 1.0);
  const w = 880;
  const h = 470;
  return (
    <AbsoluteFill>
      <Backdrop t={t} hue="gold" />
      {/* printer slot */}
      <div style={{ position: 'absolute', left: 70, right: 70, top: 690, height: 26, borderRadius: 13, background: '#04080e', boxShadow: '0 0 0 2px rgba(217,164,65,0.35), 0 10px 30px rgba(0,0,0,0.6)', opacity: 1 - ramp(t, 21.1, 0.4) }} />
      <div style={{ position: 'absolute', left: (W - w) / 2, top: 703, width: w, height: h + 40, overflow: 'hidden', clipPath: `inset(0 0 ${(1 - print) * 100}% 0)` }}>
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 20 - (1 - print) * h,
            width: w,
            height: h,
            borderRadius: 36,
            background: 'linear-gradient(160deg, #fffaf0, #f4efe6 60%, #e8dcc5)',
            boxShadow: '0 50px 90px -30px rgba(0,0,0,0.85)',
            transform: `perspective(1800px) rotateY(${lerp(orbit, [0, 1], [-10, 9])}deg) rotateX(${4 - orbit * 3}deg)`,
            overflow: 'hidden',
            direction: 'rtl',
          }}
        >
          <div style={{ position: 'absolute', right: 0, left: 0, top: 0, height: 92, background: `linear-gradient(135deg, ${C.navy}, ${C.teal})`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 34px' }}>
            <span style={{ fontFamily: F.head, fontWeight: 700, fontSize: 40, color: C.ivory }}>{ui.boarding}</span>
            <span style={{ fontFamily: F.head, fontWeight: 600, fontSize: 36, color: C.gold }}>{brief.travelAgency}</span>
          </div>
          <div style={{ position: 'absolute', right: 40, left: 40, top: 120, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: F.head, fontWeight: 700, fontSize: 64, color: C.navy }}>{ui.cities.baghdad}</span>
            <div style={{ flex: 1, margin: '0 22px', height: 3, background: 'repeating-linear-gradient(90deg, rgba(11,23,38,0.5) 0 12px, transparent 12px 22px)', position: 'relative' }}>
              <div style={{ position: 'absolute', left: '50%', top: -26, marginLeft: -26, transform: 'rotate(-90deg)' }}>
                <Icon name="plane" size={52} color={C.gold} stroke={2} />
              </div>
            </div>
            <span style={{ fontFamily: F.head, fontWeight: 700, fontSize: 64, color: C.navy }}>{ui.cities.istanbul}</span>
          </div>
          <div style={{ position: 'absolute', right: 40, left: 40, top: 270, height: 2, background: 'repeating-linear-gradient(90deg, rgba(11,23,38,0.25) 0 10px, transparent 10px 18px)' }} />
          <div style={{ position: 'absolute', right: 40, left: 40, top: 300, display: 'flex', justifyContent: 'space-between' }}>
            {[
              [ui.flight, ui.flightNo],
              [ui.date, ui.flightDate],
              [ui.seat, ui.seatNo],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontFamily: F.body, fontWeight: 500, fontSize: 36, color: '#5d6b78' }}>{k}</span>
                <span style={{ fontFamily: F.head, fontWeight: 700, fontSize: 46, color: C.navy, direction: 'ltr', textAlign: 'right' }}>{v}</span>
              </div>
            ))}
          </div>
          <LightSweep p={sweep} opacity={0.7} />
        </div>
      </div>
      {/* stamp */}
      {t >= tl.ticket - 0.05 && (
        <div style={{ position: 'absolute', left: 0, right: 0, top: 1240, display: 'flex', justifyContent: 'center', transform: `scale(${1.8 - 0.8 * Math.min(1, stamp)}) rotate(-6deg)`, opacity: Math.min(1, stamp * 2) }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 44px', borderRadius: 30, border: `5px solid ${C.gold}`, background: 'rgba(11,23,38,0.85)', boxShadow: '0 0 50px rgba(217,164,65,0.45)', direction: 'rtl' }}>
            <Icon name="check" size={58} color={C.gold} stroke={3} t={t} drawAt={tl.ticket} />
            <span style={{ fontFamily: F.head, fontWeight: 700, fontSize: 62, color: C.gold }}>{brief.f2Done}</span>
          </div>
        </div>
      )}
      <IconBadge name="ticket" t={t} at={TICKET_IN + 0.3} until={22.9} x={930} y={640} />
    </AbsoluteFill>
  );
};

const F2Shot: React.FC<{ t: number }> = ({ t }) => {
  if (t < GLOBE_IN) return <BookingPhone t={t} />;
  if (t < GLOBE_IN + 0.38) {
    // match cut: the tapped button opens into the globe
    const p = ramp(t, GLOBE_IN, 0.38, EASE_IN);
    const c = screenToFrame(f2Cam(t), SW / 2, BOOK_BTN.y + BOOK_BTN.h / 2);
    return (
      <AbsoluteFill>
        <BookingPhone t={t} />
        <AbsoluteFill style={{ clipPath: `circle(${40 + p * 1500}px at ${c.x}px ${c.y}px)` }}>
          <GlobeShot t={t} />
        </AbsoluteFill>
      </AbsoluteFill>
    );
  }
  if (t < TICKET_IN) return <GlobeShot t={t} />;
  if (t < TICKET_IN + 0.3) {
    // match cut: the globe collapses into the boarding pass
    const p = ramp(t, TICKET_IN, 0.3, IN_OUT);
    return (
      <AbsoluteFill>
        <BoardingPass t={t} />
        <AbsoluteFill style={{ clipPath: `circle(${(1 - p) * 1500}px at 50% 50%)`, opacity: 1 - p * 0.3 }}>
          <GlobeShot t={t} />
        </AbsoluteFill>
      </AbsoluteFill>
    );
  }
  return <BoardingPass t={t} />;
};

// ───────────────────────────── 3/7 daily capacity (23–28)
const CapacityShot: React.FC<{ t: number }> = ({ t }) => {
  const [s1, s2] = tl.capacitySteps;
  const n = t < s1 ? 18 : t < s2 ? 19 : 20;
  const fill = 18 + ramp(t, s1, 0.5) + ramp(t, s2, 0.5);
  const full = ramp(t, tl.full, 0.4);
  const pill = sp(t, tl.full, 17, 220);
  const lastAt = n === 18 ? -1 : n === 19 ? s1 : s2;
  const roll = lastAt > 0 ? ramp(t, lastAt, 0.35) : 1;
  const push = ramp(t, 23, 3.6, (x) => x);
  const punch = t >= tl.full ? Math.exp(-(t - tl.full) * 6) : 0;
  const tilt = ramp(t, 27.1, 0.9, (x) => x);
  const R = 250;
  const cx = 540;
  const cy = 990;
  return (
    <AbsoluteFill>
      <Backdrop t={t} hue={full > 0.5 ? 'gold' : 'teal'} />
      <AbsoluteFill style={{ transform: `perspective(2000px) scale(${1 + push * 0.07 + punch * 0.06}) rotateX(${tilt * 10}deg) rotateZ(${tilt * -2}deg)` }}>
        <div style={{ position: 'absolute', left: cx - R - 60, top: cy - R - 60, width: (R + 60) * 2, height: (R + 60) * 2, borderRadius: '50%', ...glass(0.08) }} />
        <svg width={W} height={H} style={{ position: 'absolute', inset: 0 }}>
          <defs>
            <linearGradient id="capGold" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#f6d58f" />
              <stop offset="1" stopColor="#b9822a" />
            </linearGradient>
          </defs>
          {Array.from({ length: 20 }).map((_, i) => {
            const a = (i / 20) * Math.PI * 2 - Math.PI / 2;
            const on = i < Math.floor(fill + 0.001);
            const isNew = i === 18 || i === 19;
            const pop = isNew ? sp(t, i === 18 ? s1 : s2, 15, 260) : 1;
            const x = cx + Math.cos(a) * (R + 34);
            const y = cy + Math.sin(a) * (R + 34);
            return <circle key={i} cx={x} cy={y} r={on ? 11 * (isNew ? 0.6 + 0.4 * pop : 1) : 8} fill={on ? (isNew ? '#f6d58f' : C.gold) : 'rgba(244,239,230,0.18)'} style={{ filter: on && isNew ? 'drop-shadow(0 0 10px #D9A441)' : undefined }} />;
          })}
          <circle cx={cx} cy={cy} r={R} fill="none" stroke="rgba(244,239,230,0.1)" strokeWidth={26} />
          <circle cx={cx} cy={cy} r={R} fill="none" stroke="url(#capGold)" strokeWidth={26} strokeLinecap="round" strokeDasharray={2 * Math.PI * R} strokeDashoffset={2 * Math.PI * R * (1 - fill / 20)} transform={`rotate(-90 ${cx} ${cy})`} style={{ filter: `drop-shadow(0 0 ${12 + full * 20}px rgba(217,164,65,0.7))` }} />
        </svg>
        <div style={{ position: 'absolute', left: cx - 220, top: cy - 150, width: 440, height: 300, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <span dir="rtl" style={{ fontFamily: F.body, fontWeight: 600, fontSize: 38, color: C.muted }}>{ui.todaysBookings}</span>
          <div style={{ height: 190, overflow: 'hidden' }}>
            <div style={{ fontFamily: F.head, fontWeight: 700, fontSize: 170, lineHeight: '190px', color: n === 20 ? C.gold : C.ivory, transform: `translateY(${(1 - roll) * 80}px)`, opacity: roll, filter: roll < 1 ? `blur(${(1 - roll) * 8}px)` : undefined, textShadow: n === 20 ? '0 0 40px rgba(217,164,65,0.6)' : undefined }}>
              {arDigits(n)}
            </div>
          </div>
          <span dir="rtl" style={{ fontFamily: F.body, fontWeight: 600, fontSize: 40, color: C.ivory }}>{ui.ofTotal}</span>
        </div>
      </AbsoluteFill>
      {t >= tl.full - 0.05 && (
        <div style={{ position: 'absolute', left: 0, right: 0, top: 1335, display: 'flex', justifyContent: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '18px 40px', borderRadius: 34, background: `linear-gradient(135deg, #f0c56a, ${C.gold} 50%, #b9822a)`, boxShadow: '0 30px 60px -20px rgba(217,164,65,0.8)', transform: `scale(${0.6 + 0.4 * pill})`, opacity: Math.min(1, pill * 2), direction: 'rtl', overflow: 'hidden', position: 'relative' }}>
            <Icon name="lock" size={50} color={C.navy} t={t} drawAt={tl.full} stroke={2.2} />
            <span style={{ fontFamily: F.head, fontWeight: 700, fontSize: 50, color: C.navy, whiteSpace: 'nowrap' }}>{brief.f3Full}</span>
            <LightSweep p={ramp(t, tl.full + 0.3, 0.9)} opacity={0.7} />
          </div>
        </div>
      )}
      <IconBadge name="gauge" t={t} at={23.3} until={27.9} x={150} y={640} />
      <IconBadge name="users" t={t} at={24.0} until={27.9} x={930} y={640} />
    </AbsoluteFill>
  );
};

/** Picture for 12–28 s (the whip at 12.0 is handled in VideoA). */
export const Part3Picture: React.FC<{ t: number }> = ({ t }) => {
  // 17.0 push-through zoom: F1 rushes into the lens, F2 lands from it
  if (t < 16.85) return <F1Shot t={t} />;
  if (t < 17.0) {
    const p = ramp(t, 16.85, 0.15, EASE_IN);
    return (
      <AbsoluteFill style={{ transform: `scale(${1 + p * 1.8})`, filter: `blur(${p * 14}px)`, opacity: 1 - p * 0.4 }}>
        <F1Shot t={t} />
      </AbsoluteFill>
    );
  }
  if (t < 17.3) {
    const p = ramp(t, 17.0, 0.3);
    return (
      <AbsoluteFill style={{ transform: `scale(${1.6 - 0.6 * p})`, filter: p < 1 ? `blur(${(1 - p) * 12}px)` : undefined }}>
        <F2Shot t={t} />
      </AbsoluteFill>
    );
  }
  // 23.0 light-leak dissolve
  if (t < 22.85) return <F2Shot t={t} />;
  if (t < 23.25) {
    const p = ramp(t, 22.85, 0.4, IN_OUT);
    return (
      <AbsoluteFill>
        <F2Shot t={t} />
        <AbsoluteFill style={{ opacity: p }}>
          <CapacityShot t={t} />
        </AbsoluteFill>
        <LightLeak p={ramp(t, 22.7, 0.75)} strength={1} />
      </AbsoluteFill>
    );
  }
  return <CapacityShot t={t} />;
};

export { THREE };
