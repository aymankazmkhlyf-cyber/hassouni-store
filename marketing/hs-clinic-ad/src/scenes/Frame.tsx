// Full-frame scenes and the phone track.
import React from 'react';
import tl from '../timeline.json';
import { brief, instagramHandle, ui } from '../texts';
import { C, EASE_IN, F, H, PHONE, SCREEN, W, glass, lerp, ramp, sp } from '../theme';
import { Icon } from '../ui/Icon';
import { LightSweep, WipeClip, wipeX } from '../ui/Effects';
import { Logo } from '../ui/Logo';
import { Phone, Tap, phoneTilt } from '../ui/Phone';
import {
  BookingScreen,
  CALL_ICON,
  CallScreen,
  CallingScreen,
  ChatScreen,
  ConfirmScreen,
  CounterScreen,
  HOME_HOURS_CARD,
  HomeScreen,
  PICKED_SLOT,
  SLOT_POS,
  ScheduleScreen,
} from './Screens';

const SW = SCREEN.w;
const SH = SCREEN.h;

// ───────────────────────────── 0–3 s: hook — ringing phone, busy line, heartbeat glow
export const HookVisual: React.FC<{ t: number }> = ({ t }) => {
  if (t >= 3) return null;
  const beat = Math.max(...tl.heartbeat.map((b) => (t >= b ? Math.exp(-(t - b) * 3.2) : 0) + (t >= b + 0.07 ? 0.7 * Math.exp(-(t - b - 0.07) * 3.6) : 0)));
  const ringing = tl.ring.some((r) => t >= r && t < r + 0.4);
  const shake = ringing ? Math.sin(t * 70) * 1.6 : 0;
  const busy = sp(t, tl.busy[0], 18, 220);
  const blink = t > tl.busy[0] ? 0.75 + 0.25 * Math.cos((t - tl.busy[0]) * Math.PI * 4) : 1;
  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: W / 2 - 520,
          top: 1000 - 520,
          width: 1040,
          height: 1040,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(214,69,69,0.30) 0%, rgba(255,111,97,0.10) 40%, rgba(255,255,255,0) 70%)',
          opacity: 0.35 + Math.min(1, beat) * 0.65,
          transform: `scale(${0.9 + Math.min(1, beat) * 0.12})`,
        }}
      />
      <Phone t={t} scale={0.9} dy={10} rotZ={shake} dark>
        <CallingScreen t={t} />
      </Phone>
      {t >= tl.busy[0] - 0.02 && (
        <div style={{ position: 'absolute', left: 0, right: 0, top: 1300, display: 'flex', justifyContent: 'center' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 18,
              direction: 'rtl',
              padding: '18px 42px',
              borderRadius: 32,
              background: `linear-gradient(135deg, #e25555, ${C.red})`,
              boxShadow: `0 24px 50px -18px rgba(214,69,69,0.75), 0 0 0 ${10 * (1 - blink)}px rgba(214,69,69,0.18)`,
              transform: `scale(${0.6 + 0.4 * busy})`,
              opacity: Math.min(1, busy * 2),
            }}
          >
            <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#fff', opacity: blink }} />
            <span dir="rtl" style={{ fontFamily: F.head, fontWeight: 700, fontSize: 52, color: '#fff', lineHeight: 1.3 }}>
              {brief.busyBadge}
            </span>
          </div>
        </div>
      )}
    </>
  );
};

// ───────────────────────────── 3–7 s: clock spins to night, lights dim, light burst → 24 h
export const hook2Dim = (t: number) => (t < 6 ? ramp(t, 3.3, 2.3) * 0.84 : 0.84 * (1 - ramp(t, 6.0, 0.2)));

export const Hook2Visual: React.FC<{ t: number }> = ({ t }) => {
  if (t < 3 || t > 7.2) return null;
  const [s0, s1] = tl.clockSpin;
  const spin = ramp(t, s0, s1 - s0, EASE_IN);
  const minute = spin * 360 * 7;
  const hour = 120 + spin * 210; // 4 pm → 11 pm
  const dim = hook2Dim(t);
  const burst = ramp(t, tl.bloom, 0.55);
  const after = t >= tl.bloom;
  const ring = ramp(t, tl.bloom + 0.05, 0.7);
  const num = sp(t, tl.bloom + 0.1, 18, 170);
  const blurOut = ramp(t, 6.6, 0.5);
  const sky = ramp(t, 3.2, 2.4);
  const cx = W / 2;
  const cy = 1010;
  const R = 255;
  const arcA = Math.PI * (0.08 + sky * 0.84); // right → left (RTL)
  const skyX = cx + Math.cos(arcA) * 380;
  const skyY = 700 - Math.sin(arcA) * 90;
  const charge = ramp(t, tl.riser[0], tl.riser[1] - tl.riser[0], EASE_IN) * (1 - burst);
  return (
    <>
      {/* night */}
      <div style={{ position: 'absolute', inset: 0, background: `rgba(9,24,31,${dim})` }} />
      {[...Array(14)].map((_, i) => {
        const sx = 120 + ((i * 337) % 860);
        const sy = 560 + ((i * 211) % 300) + (i % 2) * 520;
        return <div key={i} style={{ position: 'absolute', left: sx, top: sy, width: 6, height: 6, borderRadius: '50%', background: '#fff', opacity: Math.max(0, dim - 0.35) * (0.5 + 0.5 * Math.sin(t * 3 + i)) }} />;
      })}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 1 - blurOut,
          filter: blurOut > 0 ? `blur(${blurOut * 18}px)` : undefined,
          transform: `scale(${1 + blurOut * 0.06})`,
        }}
      >
        {!after && (
          <div style={{ position: 'absolute', left: skyX - 50, top: skyY - 50, width: 100, height: 100 }}>
            <Icon name="sun" size={100} color="#f2b84b" style={{ position: 'absolute', opacity: 1 - ramp(t, 4.2, 0.6) }} />
            <Icon name="moon" size={92} color="#dfe9f2" style={{ position: 'absolute', left: 4, top: 4, opacity: ramp(t, 4.2, 0.6) }} />
          </div>
        )}
        <div
          style={{
            position: 'absolute',
            left: cx - R,
            top: cy - R,
            width: R * 2,
            height: R * 2,
            borderRadius: '50%',
            background: `linear-gradient(150deg, rgba(255,255,255,${0.9 - dim * 0.7}), rgba(232,246,244,${0.75 - dim * 0.6}))`,
            border: `3px solid rgba(255,255,255,${0.9 - dim * 0.6})`,
            boxShadow: `0 40px 90px -30px rgba(16,36,46,0.45), 0 0 ${120 * charge}px rgba(111,209,200,${0.9 * charge})`,
          }}
        >
          {!after &&
            [...Array(12)].map((_, i) => (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: R - 4,
                  top: 22,
                  width: 8,
                  height: i % 3 === 0 ? 34 : 20,
                  borderRadius: 4,
                  background: dim > 0.4 ? 'rgba(232,246,244,0.75)' : C.navy,
                  opacity: 0.8,
                  transformOrigin: `4px ${R - 22}px`,
                  transform: `rotate(${i * 30}deg)`,
                }}
              />
            ))}
          {!after && (
            <>
              <Hand len={R * 0.5} width={14} angle={hour} R={R} color={dim > 0.4 ? '#E8F6F4' : C.navy} />
              <Hand len={R * 0.75} width={9} angle={minute} R={R} color={dim > 0.4 ? C.aqua : C.teal} />
              <div style={{ position: 'absolute', left: R - 14, top: R - 14, width: 28, height: 28, borderRadius: '50%', background: C.aqua }} />
            </>
          )}
          {after && (
            <>
              <svg width={R * 2} height={R * 2} style={{ position: 'absolute', left: -3, top: -3, transform: 'rotate(-90deg)' }}>
                <circle cx={R} cy={R} r={R - 26} stroke={C.aqua} strokeWidth={18} fill="none" strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - ring} />
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${num})` }}>
                <span style={{ fontFamily: F.head, fontWeight: 700, fontSize: 210, color: C.teal, lineHeight: 1 }}>٢٤</span>
              </div>
            </>
          )}
        </div>
      </div>
      {/* light burst */}
      {burst > 0 && t < 7.1 && (
        <div
          style={{
            position: 'absolute',
            left: cx - 1500,
            top: cy - 1500,
            width: 3000,
            height: 3000,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(232,246,244,0.95) 25%, rgba(111,209,200,0.35) 45%, rgba(255,255,255,0) 65%)',
            transform: `scale(${0.05 + burst * 0.95})`,
            opacity: 1 - ramp(t, 6.25, 0.7),
          }}
        />
      )}
    </>
  );
};

const Hand: React.FC<{ len: number; width: number; angle: number; R: number; color: string }> = ({ len, width, angle, R, color }) => (
  <div
    style={{
      position: 'absolute',
      left: R - width / 2,
      top: R - len,
      width,
      height: len + 18,
      borderRadius: width,
      background: color,
      transformOrigin: `${width / 2}px ${len}px`,
      transform: `rotate(${angle}deg)`,
    }}
  />
);

// ───────────────────────────── 7–9.4 s: logo forms (blur-to-focus in), then hands over to the phone
export const RevealLogo: React.FC<{ t: number }> = ({ t }) => {
  if (t < 6.95 || t > 9.6) return null;
  const focus = ramp(t, 7.0, 0.55);
  const out = ramp(t, 8.85, 0.55);
  const size = 230;
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: 760,
        display: 'flex',
        justifyContent: 'center',
        opacity: Math.min(1, focus * 1.3) * (1 - out),
        filter: focus < 1 || out > 0 ? `blur(${(1 - focus) * 16 + out * 8}px)` : undefined,
        transform: `scale(${(1.06 - focus * 0.06) * (1 - out * 0.35)}) translateY(${out * 120}px)`,
      }}
    >
      <Logo t={t} start={7.0} size={size} shimmerAt={tl.shimmer[0]} />
    </div>
  );
};

// ───────────────────────────── 8.9–45.4 s: the phone with the clinic website
const MORPH = [11.55, 0.7] as const;
const SLIDE1 = [17.55, 0.8] as const;
const CIRCLE1 = [20.12, 0.78] as const;
const SWEEP1 = [23.6, 0.8] as const;
export const WIPE1 = 28.6;
const CIRCLE2 = [40.72, 0.6] as const;
export const SLIDE2 = [44.6, 0.8] as const;

const Morph: React.FC<{ t: number }> = ({ t }) => {
  const p = ramp(t, MORPH[0], MORPH[1]);
  const r = HOME_HOURS_CARD;
  const x = lerp(p, [0, 1], [r.x, 0]);
  const y = lerp(p, [0, 1], [r.y, 0]);
  const w = lerp(p, [0, 1], [r.w, SW]);
  const h = lerp(p, [0, 1], [r.h, SH]);
  return (
    <>
      <div style={{ position: 'absolute', inset: 0, opacity: 1 - ramp(t, MORPH[0], 0.3) }}>
        <HomeScreen t={t} at={9.1} tapAt={tl.taps[0]} />
      </div>
      <div style={{ position: 'absolute', left: x, top: y, width: w, height: h, borderRadius: lerp(p, [0, 1], [28, 66]), background: C.bg, overflow: 'hidden', boxShadow: '0 20px 40px -20px rgba(16,36,46,0.4)' }}>
        <div style={{ position: 'absolute', left: -x, top: -y, width: SW, height: SH, opacity: ramp(t, MORPH[0] + 0.15, 0.3) }}>
          <ScheduleScreen t={t} at={MORPH[0] + 0.1} tapAt={tl.taps[1]} />
        </div>
      </div>
    </>
  );
};

/** Screen content of the phone at time t (with the transitions that happen inside the phone). */
const screenAt = (t: number, force?: 'counter' | 'chat'): React.ReactNode => {
  if (force === 'counter' || (!force && t < WIPE1 && t >= SWEEP1[0] + SWEEP1[1] / 2)) return <CounterScreen t={t} at={23.75} />;
  if (force === 'chat') return <ChatScreen t={t} at={28.6} />;
  if (t < MORPH[0]) return <HomeScreen t={t} at={9.1} tapAt={tl.taps[0]} />;
  if (t < MORPH[0] + MORPH[1]) return <Morph t={t} />;
  if (t < SLIDE1[0]) return <ScheduleScreen t={t} at={MORPH[0] + 0.1} tapAt={tl.taps[1]} />;
  if (t < SLIDE1[0] + SLIDE1[1]) {
    const p = ramp(t, SLIDE1[0], SLIDE1[1]);
    return (
      <>
        <div style={{ position: 'absolute', inset: 0, transform: `translateX(${-p * SW * 0.6}px)`, opacity: 1 - p * 0.6 }}>
          <ScheduleScreen t={t} at={MORPH[0] + 0.1} tapAt={tl.taps[1]} />
        </div>
        <div style={{ position: 'absolute', inset: 0, transform: `translateX(${(1 - p) * SW}px)`, boxShadow: '-30px 0 60px -20px rgba(16,36,46,0.35)' }}>
          <BookingScreen t={t} at={SLIDE1[0] + 0.05} tapAt={tl.taps[2]} />
        </div>
      </>
    );
  }
  if (t < CIRCLE1[0]) return <BookingScreen t={t} at={SLIDE1[0] + 0.05} tapAt={tl.taps[2]} />;
  if (t < CIRCLE1[0] + CIRCLE1[1]) {
    const p = ramp(t, CIRCLE1[0], CIRCLE1[1]);
    const s = SLOT_POS(PICKED_SLOT);
    return (
      <>
        <BookingScreen t={t} at={SLIDE1[0] + 0.05} tapAt={tl.taps[2]} />
        <div style={{ position: 'absolute', inset: 0, clipPath: `circle(${p * 1100}px at ${s.x + s.w / 2}px ${s.y + s.h / 2}px)` }}>
          <ConfirmScreen t={t} tickAt={tl.chime} />
        </div>
      </>
    );
  }
  if (t < SWEEP1[0] + SWEEP1[1] / 2) {
    const fade = ramp(t, SWEEP1[0] + 0.15, 0.25);
    return (
      <>
        <ConfirmScreen t={t} tickAt={tl.chime} />
        <div style={{ position: 'absolute', inset: 0, opacity: fade }}>
          <CounterScreen t={t} at={23.75} />
        </div>
      </>
    );
  }
  if (t < CIRCLE2[0]) return <ChatScreen t={t} at={28.6} />;
  if (t < CIRCLE2[0] + CIRCLE2[1]) {
    const p = ramp(t, CIRCLE2[0], CIRCLE2[1]);
    return (
      <>
        <ChatScreen t={t} at={28.6} />
        <div style={{ position: 'absolute', inset: 0, clipPath: `circle(${p * 1100}px at ${CALL_ICON.x}px ${CALL_ICON.y}px)` }}>
          <CallScreen t={t} at={CIRCLE2[0] - 0.3} />
        </div>
      </>
    );
  }
  return <CallScreen t={t} at={CIRCLE2[0] - 0.3} />;
};

export const PhoneTrack: React.FC<{ t: number }> = ({ t }) => {
  if (t < 8.85 || t > SLIDE2[0] + SLIDE2[1]) return null;
  const assemble = sp(t, 8.9, 20, 120);
  const slideOut = ramp(t, SLIDE2[0], SLIDE2[1]);
  const common = { t, scale: 0.88 + 0.12 * assemble, dy: (1 - assemble) * 160, opacity: Math.min(1, ramp(t, 8.85, 0.35)), dx: -slideOut * (W + 200) };
  const sweep = ramp(t, SWEEP1[0], SWEEP1[1]);
  if (t >= WIPE1 && t <= WIPE1 + 0.8) {
    const x = wipeX(t, WIPE1);
    return (
      <>
        <WipeClip x={x} side="before">
          <Phone {...common}>{screenAt(t, 'counter')}</Phone>
        </WipeClip>
        <WipeClip x={x} side="after">
          <Phone {...common}>{screenAt(t, 'chat')}</Phone>
        </WipeClip>
      </>
    );
  }
  return (
    <Phone {...common}>
      {screenAt(t)}
      <LightSweep p={sweep} opacity={0.55} width={0.4} />
    </Phone>
  );
};

/** Floating pill over the phone when the day is fully booked. */
export const FullBadge: React.FC<{ t: number }> = ({ t }) => {
  if (t < tl.full - 0.05) return null;
  const p = sp(t, tl.full, 18, 200);
  const { dy } = phoneTilt(t);
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: 1290 + dy, display: 'flex', justifyContent: 'center' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          direction: 'rtl',
          padding: '20px 40px',
          borderRadius: 32,
          background: `linear-gradient(135deg, #12807e, ${C.teal} 50%, #0a5a66)`,
          boxShadow: '0 30px 60px -20px rgba(11,110,110,0.7), inset 0 1px 0 rgba(255,255,255,0.3)',
          transform: `scale(${0.6 + 0.4 * p})`,
          opacity: Math.min(1, p * 2),
        }}
      >
        <Icon name="lock" size={46} color="#fff" t={t} drawAt={tl.full} stroke={2.1} />
        <span dir="rtl" style={{ fontFamily: F.head, fontWeight: 600, fontSize: 44, color: '#fff', lineHeight: 1.3, whiteSpace: 'nowrap' }}>
          {brief.f3Full}
        </span>
      </div>
    </div>
  );
};

// ───────────────────────────── 45–51 s: laptop dashboard
const D = tl.dashboard;

export const Laptop: React.FC<{ t: number }> = ({ t }) => {
  if (t < SLIDE2[0] || t > 51.5) return null;
  const inP = ramp(t, SLIDE2[0], SLIDE2[1]);
  const dx = (1 - inP) * (W + 200);
  const ry = 3 * Math.sin((2 * Math.PI * t) / 9.5);
  const drift = 5 * Math.sin((2 * Math.PI * t) / 7);
  const lid = { x: 90, y: 690, w: 900, h: 590 };
  const pop = (at: number): React.CSSProperties => {
    const p = sp(t, at, 20, 170);
    return { opacity: Math.min(1, ramp(t, at, 0.3)), transform: `translateY(${(1 - p) * 26}px) scale(${0.96 + 0.04 * p})` };
  };
  const chartP = ramp(t, D[2] + 0.1, 1.2);
  const bars = [0.42, 0.55, 0.5, 0.68, 0.62, 0.8, 0.92];
  const pts = bars.map((b, i) => `${20 + i * 66} ${150 - b * 120}`).join(' L');
  const live = t > 49.6 ? 0.5 + 0.5 * Math.sin((t - 49.6) * 5) : 0;
  return (
    <div style={{ position: 'absolute', inset: 0, transform: `translateX(${dx}px) translateY(${drift}px)` }}>
      <div style={{ position: 'absolute', left: lid.x, top: lid.y, width: lid.w, height: lid.h, transform: `perspective(2600px) rotateY(${ry}deg) rotateX(4deg)`, transformOrigin: '50% 100%' }}>
        <div style={{ position: 'absolute', inset: 0, borderRadius: 34, background: 'linear-gradient(150deg, #29434f, #10242E 50%, #0a1a21)', boxShadow: '0 60px 100px -40px rgba(16,36,46,0.55)' }} />
        <div dir="rtl" style={{ position: 'absolute', left: 20, top: 20, right: 20, bottom: 20, borderRadius: 18, overflow: 'hidden', background: `linear-gradient(180deg, ${C.bg}, ${C.mint})` }}>
          {/* skeleton placeholders, replaced by each widget as it builds */}
          {[
            { r: 22, l: 22, top: 16, h: 80, at: D[0] },
            { r: 22, w: 330, top: 112, h: 200, at: D[1] },
            { l: 22, w: 460, top: 112, h: 200, at: D[2] },
            ...[0, 1, 2].map((i) => ({ r: 22, l: 22, top: 330 + i * 66, h: 58, at: D[3 + i] })),
          ].map((b, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                right: b.r,
                left: b.l,
                width: (b as { w?: number }).w,
                top: b.top,
                height: b.h,
                borderRadius: 22,
                background: `linear-gradient(100deg, #E3EDF0 30%, #F1F7F8 ${45 + ((t * 60) % 40)}%, #E3EDF0 70%)`,
                opacity: 0.8 * (1 - ramp(t, b.at, 0.3)),
              }}
            />
          ))}
          {/* top bar */}
          <div style={{ position: 'absolute', right: 22, left: 22, top: 16, height: 80, display: 'flex', alignItems: 'center', justifyContent: 'space-between', ...pop(D[0]) }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 54, height: 54, borderRadius: 16, background: `linear-gradient(140deg, ${C.aqua}, ${C.teal})`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="dashboard" size={32} color="#fff" />
              </div>
              <span style={{ fontFamily: F.head, fontWeight: 700, fontSize: 40, color: C.navy }}>{ui.dashboard}</span>
            </div>
            <div style={{ display: 'flex', gap: 12, ...pop(D[6]) }}>
              {[brief.f5Doctor, brief.f5Secretary].map((r, i) => (
                <div key={r} style={{ padding: '2px 22px', borderRadius: 22, background: i === 0 ? C.navy : '#fff', border: `2px solid ${i === 0 ? C.navy : C.line}` }}>
                  <span style={{ fontFamily: F.body, fontWeight: 600, fontSize: 36, color: i === 0 ? '#fff' : C.muted }}>{r}</span>
                </div>
              ))}
            </div>
          </div>
          {/* stat */}
          <div style={{ position: 'absolute', right: 22, top: 112, width: 330, height: 200, borderRadius: 26, ...glass(0.8), padding: '18px 24px', boxSizing: 'border-box', ...pop(D[1]) }}>
            <span style={{ fontFamily: F.body, fontWeight: 600, fontSize: 36, color: C.muted }}>{ui.todaysBookings}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 6 }}>
              <span style={{ fontFamily: F.head, fontWeight: 700, fontSize: 92, color: C.teal, lineHeight: 1.1 }}>٢٤</span>
              <Icon name="users" size={54} color={C.aqua} t={t} drawAt={D[1]} />
            </div>
          </div>
          {/* chart */}
          <div style={{ position: 'absolute', left: 22, top: 112, width: 460, height: 200, borderRadius: 26, ...glass(0.8), padding: '14px 22px', boxSizing: 'border-box', ...pop(D[2]) }}>
            <span style={{ fontFamily: F.body, fontWeight: 600, fontSize: 36, color: C.muted }}>{ui.thisWeek}</span>
            <svg width={440} height={170} style={{ position: 'absolute', left: 8, top: 40 }}>
              <defs>
                <linearGradient id="dashArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor={C.aqua} stopOpacity="0.55" />
                  <stop offset="1" stopColor={C.aqua} stopOpacity="0" />
                </linearGradient>
                <clipPath id="dashClip">
                  <rect x={0} y={0} width={20 + chartP * 420} height={170} />
                </clipPath>
              </defs>
              <g clipPath="url(#dashClip)">
                <path d={`M${pts} L416 160 L20 160 Z`} fill="url(#dashArea)" />
                <path d={`M${pts}`} stroke={C.teal} strokeWidth={5} fill="none" strokeLinejoin="round" strokeLinecap="round" />
              </g>
              {chartP >= 1 && <circle cx={416} cy={150 - 0.92 * 120} r={9 + live * 4} fill={C.teal} stroke="#fff" strokeWidth={4} />}
            </svg>
          </div>
          {/* patient list */}
          {ui.patients.map((p, i) => (
            <div
              key={p.name}
              style={{
                position: 'absolute',
                right: 22,
                left: 22,
                top: 330 + i * 66,
                height: 58,
                borderRadius: 20,
                background: i === 0 && live ? `rgba(111,209,200,${0.15 + live * 0.2})` : 'rgba(255,255,255,0.85)',
                border: `2px solid ${C.line}`,
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                padding: '0 16px',
                boxSizing: 'border-box',
                ...pop(D[3 + i]),
              }}
            >
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: [C.aqua, '#9cc8ee', '#8fd9b6'][i] }} />
              <span style={{ fontFamily: F.body, fontWeight: 600, fontSize: 36, color: C.navy, lineHeight: 1.2 }}>{p.name}</span>
              <span style={{ marginRight: 'auto', fontFamily: F.head, fontWeight: 600, fontSize: 36, color: C.teal, lineHeight: 1.2 }}>{p.time}</span>
            </div>
          ))}
        </div>
      </div>
      {/* base */}
      <div style={{ position: 'absolute', left: 60, top: lid.y + lid.h - 4, width: 960, height: 34, borderRadius: '6px 6px 30px 30px', background: 'linear-gradient(180deg, #d9e3e7, #b9c8ce)', boxShadow: '0 30px 40px -24px rgba(16,36,46,0.5)' }}>
        <div style={{ position: 'absolute', left: 420, top: 0, width: 120, height: 10, borderRadius: '0 0 10px 10px', background: '#a8b8bf' }} />
      </div>
    </div>
  );
};

// ───────────────────────────── 51–56 s: offer
export const Offer: React.FC<{ t: number }> = ({ t }) => {
  if (t < 50.6 || t > 56.5) return null;
  const out = ramp(t, 55.6, 0.4);
  const [g0, g1] = tl.graph;
  const g = ramp(t, g0, g1 - g0);
  const card = sp(t, 50.75, 20, 140);
  const price = sp(t, 53.3, 19, 160);
  const vals = [0.18, 0.24, 0.22, 0.34, 0.4, 0.38, 0.52, 0.6, 0.66, 0.8, 0.92];
  const cw = 800;
  const ch = 300;
  const pts = vals.map((v, i) => [10 + (i * (cw - 20)) / (vals.length - 1), ch - 10 - v * (ch - 40)] as const);
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ');
  const endIdx = g * (vals.length - 1);
  const ei = Math.min(vals.length - 2, Math.floor(endIdx));
  const ef = endIdx - ei;
  const ex = pts[ei][0] + (pts[ei + 1][0] - pts[ei][0]) * ef;
  const ey = pts[ei][1] + (pts[ei + 1][1] - pts[ei][1]) * ef;
  return (
    <div style={{ position: 'absolute', inset: 0, opacity: 1 - out, filter: out > 0 ? `blur(${out * 10}px)` : undefined, transform: `scale(${1 + out * 0.04})` }}>
      <div
        style={{
          position: 'absolute',
          left: 90,
          top: 560,
          width: 900,
          height: 500,
          borderRadius: 32,
          ...glass(0.66),
          opacity: Math.min(1, card * 1.4),
          transform: `translateY(${(1 - card) * 40 + Math.sin(t * 1.3) * 5}px)`,
        }}
      >
        <div style={{ position: 'absolute', right: 40, top: 34, display: 'flex', alignItems: 'center', gap: 16, direction: 'rtl' }}>
          <div style={{ width: 70, height: 70, borderRadius: 22, background: C.mint, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="trend" size={44} color={C.teal} t={t} drawAt={51.0} />
          </div>
          <span style={{ fontFamily: F.body, fontWeight: 600, fontSize: 40, color: C.navy }}>{ui.visitors}</span>
        </div>
        <svg width={cw} height={ch} style={{ position: 'absolute', left: 50, top: 150, overflow: 'visible' }}>
          <defs>
            <linearGradient id="offerArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={C.aqua} stopOpacity="0.5" />
              <stop offset="1" stopColor={C.aqua} stopOpacity="0" />
            </linearGradient>
            <linearGradient id="offerLine" x1="0" x2="1">
              <stop offset="0" stopColor={C.blue} />
              <stop offset="1" stopColor={C.teal} />
            </linearGradient>
            <clipPath id="offerClip">
              <rect x={0} y={-30} width={ex} height={ch + 60} />
            </clipPath>
          </defs>
          {[0, 1, 2, 3].map((k) => (
            <line key={k} x1={0} x2={cw} y1={30 + k * 85} y2={30 + k * 85} stroke={C.line} strokeWidth={2} strokeDasharray="6 10" />
          ))}
          <g clipPath="url(#offerClip)">
            <path d={`${line} L${cw - 10} ${ch} L10 ${ch} Z`} fill="url(#offerArea)" />
            <path d={line} stroke="url(#offerLine)" strokeWidth={8} fill="none" strokeLinejoin="round" strokeLinecap="round" />
          </g>
          {g > 0 && (
            <>
              <circle cx={ex} cy={ey} r={26 + 8 * Math.sin(t * 5)} fill={C.aqua} opacity={0.25} />
              <circle cx={ex} cy={ey} r={13} fill="#fff" stroke={C.teal} strokeWidth={6} />
            </>
          )}
        </svg>
      </div>
      <div
        style={{
          position: 'absolute',
          left: 150,
          top: 1110,
          width: 780,
          height: 270,
          borderRadius: 32,
          ...glass(0.78),
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          opacity: Math.min(1, price * 1.5),
          transform: `translateY(${(1 - price) * 50 + Math.sin(t * 1.1 + 1) * 5}px) scale(${0.92 + 0.08 * price})`,
        }}
      >
        <div style={{ padding: '2px 24px', borderRadius: 20, background: C.mint }}>
          <span dir="rtl" style={{ fontFamily: F.body, fontWeight: 600, fontSize: 36, color: C.teal }}>{ui.monthly}</span>
        </div>
        <span dir="rtl" style={{ fontFamily: F.head, fontWeight: 700, fontSize: 64, color: C.navy, lineHeight: 1.35 }}>
          {brief.offerPrice}
        </span>
        <LightSweep p={ramp(t, 54.1, 0.9)} opacity={0.9} />
      </div>
    </div>
  );
};

// ───────────────────────────── 56–60 s: call to action
export const CTA: React.FC<{ t: number }> = ({ t }) => {
  if (t < 55.7) return null;
  const inP = ramp(t, 55.7, 0.4);
  const dm = sp(t, 56.4, 18, 180);
  const btn = sp(t, 56.55, 20, 150);
  const pulse = Math.max(...tl.ctaPulse.map((p) => (t >= p && t < p + 0.8 ? Math.sin(((t - p) / 0.8) * Math.PI) : 0)));
  return (
    <div style={{ position: 'absolute', inset: 0, opacity: inP, filter: inP < 1 ? `blur(${(1 - inP) * 12}px)` : undefined }}>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 545, display: 'flex', justifyContent: 'center', transform: `translateY(${Math.sin(t * 1.4) * 5}px)` }}>
        <Logo t={t} start={55.8} size={190} shimmerAt={tl.shimmer[1]} />
      </div>
      <div
        style={{
          position: 'absolute',
          left: W / 2 - 62,
          top: 975,
          width: 124,
          height: 124,
          borderRadius: 38,
          ...glass(0.8),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: Math.min(1, dm * 1.5),
          transform: `scale(${0.7 + 0.3 * dm})`,
        }}
      >
        <Icon name="dm" size={66} color={C.teal} t={t} drawAt={56.4} />
      </div>
      {tl.ctaPulse.map((p, k) => {
        const q = ramp(t, p, 1.0, (x) => x);
        return q > 0 && q < 1 ? (
          <div key={k} style={{ position: 'absolute', left: 130, top: 1165, width: 820, height: 140, borderRadius: 48, border: `4px solid ${C.coral}`, opacity: (1 - q) * 0.6, transform: `scale(${1 + q * 0.08}, ${1 + q * 0.35})` }} />
        ) : null;
      })}
      <div
        style={{
          position: 'absolute',
          left: 130,
          top: 1165,
          width: 820,
          height: 140,
          borderRadius: 48,
          background: `linear-gradient(135deg, #ff8a7a, ${C.coral} 50%, #f25a4c)`,
          boxShadow: `0 30px 60px -24px rgba(255,111,97,0.85), 0 0 ${40 * pulse}px rgba(255,111,97,${0.5 * pulse})`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 18,
          direction: 'rtl',
          opacity: Math.min(1, btn * 1.5),
          transform: `translateY(${(1 - btn) * 40}px) scale(${(0.9 + 0.1 * btn) * (1 + pulse * 0.04)})`,
          overflow: 'hidden',
        }}
      >
        <span dir="rtl" style={{ fontFamily: F.head, fontWeight: 700, fontSize: 52, color: '#fff', lineHeight: 1.3, whiteSpace: 'nowrap' }}>
          {brief.ctaButton}
        </span>
        <LightSweep p={ramp(t, 57.6, 1.0)} opacity={0.5} />
      </div>
      {instagramHandle && (
        <div style={{ position: 'absolute', left: 0, right: 0, top: 1340, textAlign: 'center', opacity: ramp(t, 57.4, 0.4) }}>
          <span style={{ fontFamily: F.body, fontWeight: 500, fontSize: 38, color: C.navy, direction: 'ltr' }}>{instagramHandle}</span>
        </div>
      )}
    </div>
  );
};

export { H };
