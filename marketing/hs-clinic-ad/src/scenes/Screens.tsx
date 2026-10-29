// The "clinic website" screens inside the phone mockup (fictional data, 466 × 944 px screen).
import React from 'react';
import tl from '../timeline.json';
import { brief, ui } from '../texts';
import { C, F, SCREEN, glass, lerp, ramp, sp } from '../theme';
import { Icon, IconName } from '../ui/Icon';
import { Tap } from '../ui/Phone';

const SW = SCREEN.w;
const PAD = 24;

const rise = (t: number, at: number, dist = 26): React.CSSProperties => {
  const p = sp(t, at, 22, 170);
  return { opacity: Math.min(1, ramp(t, at, 0.3)), transform: `translateY(${(1 - p) * dist}px)` };
};

const Abs: React.FC<{ x?: number; y: number; w?: number; h?: number; style?: React.CSSProperties; children?: React.ReactNode }> = ({ x = PAD, y, w = SW - PAD * 2, h, style, children }) => (
  <div style={{ position: 'absolute', left: x, top: y, width: w, height: h, ...style }}>{children}</div>
);

const Txt: React.FC<{ size: number; weight?: number; color?: string; font?: string; children: React.ReactNode; style?: React.CSSProperties }> = ({ size, weight = 500, color = C.navy, font = F.body, children, style }) => (
  <span dir="rtl" style={{ fontFamily: font, fontWeight: weight, fontSize: size, color, lineHeight: 1.35, whiteSpace: 'nowrap', ...style }}>
    {children}
  </span>
);

const TitleBar: React.FC<{ title: string; t: number; at: number }> = ({ title, t, at }) => (
  <Abs y={80} h={70} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', ...rise(t, at, 14) }}>
    <div style={{ position: 'absolute', right: 0, top: 9, width: 52, height: 52, borderRadius: 18, background: '#EAF3F5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Icon name="back" size={30} color={C.navy} />
    </div>
    <Txt size={42} weight={700} font={F.head}>{title}</Txt>
  </Abs>
);

const Avatar: React.FC<{ size: number; icon: IconName; from?: string; to?: string }> = ({ size, icon, from = C.aqua, to = C.teal }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: '50%',
      background: `linear-gradient(140deg, ${from}, ${to})`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: '0 12px 24px -12px rgba(11,110,110,0.6), inset 0 2px 0 rgba(255,255,255,0.35)',
      flexShrink: 0,
    }}
  >
    <Icon name={icon} size={size * 0.52} color="#fff" stroke={2} />
  </div>
);

// ───────────────────────────── Hook: outgoing call that hits a busy line
export const CallingScreen: React.FC<{ t: number }> = ({ t }) => {
  const busy = ramp(t, tl.busy[0], 0.2);
  const ringWave = (start: number) => {
    const p = ramp(t, start, 0.9);
    return p > 0 && p < 1 ? (
      <div
        style={{
          position: 'absolute',
          left: SW / 2 - 100,
          top: 250 - 100,
          width: 200,
          height: 200,
          borderRadius: '50%',
          border: '3px solid rgba(111,209,200,0.8)',
          transform: `scale(${1 + p * 0.9})`,
          opacity: 1 - p,
        }}
      />
    ) : null;
  };
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, #17323d 0%, #0e1f27 100%)' }}>
      {[0, 0.3, 0.65, 0.95, 1.25].map((s) => (
        <React.Fragment key={s}>{t < tl.busy[0] ? ringWave(s) : null}</React.Fragment>
      ))}
      <div style={{ position: 'absolute', left: SW / 2 - 100, top: 150, filter: busy ? `saturate(${1 - busy * 0.8})` : undefined }}>
        <Avatar size={200} icon="medic" />
      </div>
      <Abs y={384} style={{ textAlign: 'center' }}>
        <Txt size={44} weight={700} font={F.head} color="#fff">{ui.clinic}</Txt>
      </Abs>
      <Abs y={452} style={{ textAlign: 'center', opacity: 1 - busy }}>
        <Txt size={36} color="rgba(255,255,255,0.75)">{ui.calling}</Txt>
      </Abs>
      <Abs y={720} h={120} style={{ display: 'flex', justifyContent: 'space-between', padding: '0 30px' }}>
        {(['speaker', 'mic'] as IconName[]).map((n) => (
          <div key={n} style={{ width: 108, height: 108, borderRadius: '50%', background: 'rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={n} size={50} color="#fff" />
          </div>
        ))}
      </Abs>
      <div
        style={{
          position: 'absolute',
          left: SW / 2 - 54,
          top: 730,
          width: 108,
          height: 108,
          borderRadius: '50%',
          background: C.red,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transform: `rotate(135deg) scale(${1 + 0.06 * Math.sin(t * 9) * busy})`,
          boxShadow: `0 0 ${40 * busy}px rgba(214,69,69,${0.7 * busy})`,
        }}
      >
        <Icon name="phone" size={50} color="#fff" stroke={2.1} />
      </div>
    </div>
  );
};

// ───────────────────────────── Reveal: clinic home screen
export const HOME_HOURS_CARD = { x: PAD, y: 506, w: SW - PAD * 2, h: 100 };

const HomeCard: React.FC<{ icon: IconName; label: string; y: number; t: number; at: number; highlight?: number }> = ({ icon, label, y, t, at, highlight = 0 }) => (
  <Abs
    y={y}
    h={100}
    style={{
      ...glass(0.75),
      borderRadius: 28,
      display: 'flex',
      alignItems: 'center',
      gap: 18,
      padding: '0 22px',
      direction: 'rtl',
      boxSizing: 'border-box',
      outline: highlight ? `${3 * highlight}px solid rgba(11,110,110,${0.6 * highlight})` : undefined,
      ...rise(t, at),
    }}
  >
    <div style={{ width: 60, height: 60, borderRadius: 20, background: C.mint, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={icon} size={36} color={C.teal} />
    </div>
    <Txt size={36} weight={600}>{label}</Txt>
    <div style={{ marginRight: 'auto', transform: 'scaleX(-1)' }}>
      <Icon name="back" size={30} color={C.muted} />
    </div>
  </Abs>
);

export const HomeScreen: React.FC<{ t: number; at: number; tapAt: number }> = ({ t, at, tapAt }) => {
  const hl = ramp(t, tapAt, 0.15) * (1 - ramp(t, tapAt + 0.3, 0.3));
  return (
    <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, ${C.mint} 0%, ${C.bg} 40%)` }}>
      <div style={{ position: 'absolute', left: SW / 2 - 64, top: 92, ...rise(t, at) }}>
        <Avatar size={128} icon="medic" />
      </div>
      <Abs y={232} style={{ textAlign: 'center', ...rise(t, at + 0.08) }}>
        <Txt size={52} weight={700} font={F.head}>{brief.doctorName}</Txt>
      </Abs>
      <Abs y={306} style={{ textAlign: 'center', ...rise(t, at + 0.14) }}>
        <Txt size={36} color={C.muted}>{ui.specialty}</Txt>
      </Abs>
      <Abs
        y={384}
        h={98}
        style={{
          borderRadius: 30,
          background: `linear-gradient(135deg, ${C.teal}, #0f8282)`,
          boxShadow: '0 18px 30px -16px rgba(11,110,110,0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 14,
          ...rise(t, at + 0.22),
        }}
      >
        <Icon name="calendar" size={40} color="#fff" />
        <Txt size={38} weight={600} color="#fff">{ui.bookNow}</Txt>
      </Abs>
      <HomeCard icon="calendar" label={ui.hoursCard} y={HOME_HOURS_CARD.y} t={t} at={at + 0.3} highlight={hl} />
      <HomeCard icon="chat" label={ui.chatCard} y={622} t={t} at={at + 0.38} />
      <HomeCard icon="phone" label={ui.callCard} y={738} t={t} at={at + 0.46} />
      <Tap t={t} at={tapAt} x={SW / 2} y={HOME_HOURS_CARD.y + 50} />
    </div>
  );
};

// ───────────────────────────── Feature 1: weekly schedule
export const ScheduleScreen: React.FC<{ t: number; at: number; tapAt: number }> = ({ t, at, tapAt }) => {
  const hoursIn = sp(t, 15.85, 20, 170);
  const btnIn = sp(t, 16.3, 20, 170);
  const press = ramp(t, tapAt, 0.1) * (1 - ramp(t, tapAt + 0.15, 0.2));
  return (
    <div style={{ position: 'absolute', inset: 0, background: C.bg }}>
      <TitleBar title={ui.hoursCard} t={t} at={at} />
      {ui.days.map((d, i) => {
        const lit = ramp(t, tl.days[i], 0.3);
        const off = i === 6;
        return (
          <Abs
            key={d}
            y={166 + i * 76}
            h={68}
            style={{
              borderRadius: 22,
              direction: 'rtl',
              display: 'flex',
              alignItems: 'center',
              padding: '0 24px',
              boxSizing: 'border-box',
              background: off ? `rgba(234,239,242,${0.6 + lit * 0.4})` : `linear-gradient(90deg, rgba(232,246,244,${0.4 + lit * 0.6}), rgba(255,255,255,${0.5 + lit * 0.5}))`,
              border: `2px solid rgba(${off ? '200,212,218' : '111,209,200'},${0.2 + lit * 0.6})`,
              transform: `scale(${1 + 0.035 * Math.sin(lit * Math.PI)})`,
              ...{ opacity: Math.min(1, ramp(t, at + 0.05 + i * 0.04, 0.3)) },
            }}
          >
            <Txt size={36} weight={600} color={lit > 0.5 ? C.navy : C.muted}>{d}</Txt>
            <div style={{ marginRight: 'auto' }}>
              {off ? (
                <div style={{ padding: '0 16px', borderRadius: 16, background: '#E3E9EC', opacity: lit }}>
                  <Txt size={36} weight={600} color={C.muted}>{ui.dayOff}</Txt>
                </div>
              ) : (
                <div style={{ width: 46, height: 46, borderRadius: '50%', background: `rgba(11,110,110,${lit})`, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `2px solid rgba(11,110,110,${0.25 + lit * 0.75})` }}>
                  <Icon name="check" size={30} color="#fff" t={t} drawAt={tl.days[i]} stroke={2.6} />
                </div>
              )}
            </div>
          </Abs>
        );
      })}
      <Abs
        y={712}
        h={96}
        style={{
          ...glass(0.8),
          borderRadius: 28,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          opacity: Math.min(1, hoursIn * 1.4),
          transform: `translateY(${(1 - hoursIn) * 24}px) scale(${0.94 + 0.06 * hoursIn})`,
        }}
      >
        <Icon name="clock" size={42} color={C.teal} t={t} drawAt={15.85} />
        <Txt size={42} weight={700} font={F.head} color={C.teal}>{brief.f1Hours}</Txt>
      </Abs>
      <Abs
        y={826}
        h={92}
        style={{
          borderRadius: 30,
          background: `linear-gradient(135deg, ${C.teal}, #0f8282)`,
          boxShadow: '0 18px 30px -16px rgba(11,110,110,0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: Math.min(1, btnIn * 1.4),
          transform: `translateY(${(1 - btnIn) * 24}px) scale(${1 - press * 0.05})`,
        }}
      >
        <Txt size={38} weight={600} color="#fff">{ui.bookNow}</Txt>
      </Abs>
      <Tap t={t} at={tapAt} x={SW / 2} y={872} />
    </div>
  );
};

// ───────────────────────────── Feature 2: booking slots
export const SLOT_POS = (i: number) => {
  const col = i % 2; // 0 = right column (RTL)
  const row = Math.floor(i / 2);
  const w = (SW - PAD * 2 - 20) / 2;
  return { x: col === 0 ? SW - PAD - w : PAD, y: 356 + row * 116, w, h: 96 };
};
export const PICKED_SLOT = 3;

export const BookingScreen: React.FC<{ t: number; at: number; tapAt: number }> = ({ t, at, tapAt }) => {
  const picked = ramp(t, tapAt + 0.02, 0.18);
  return (
    <div style={{ position: 'absolute', inset: 0, background: C.bg }}>
      <TitleBar title={ui.bookNow} t={t} at={at} />
      <Abs y={172} h={76} style={{ display: 'flex', gap: 16, direction: 'rtl', ...rise(t, at + 0.08) }}>
        {[ui.today, ui.tomorrow].map((d, i) => (
          <div
            key={d}
            style={{
              flex: 1,
              borderRadius: 24,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: i === 1 ? C.navy : '#fff',
              border: i === 1 ? 'none' : `2px solid ${C.line}`,
            }}
          >
            <Txt size={36} weight={600} color={i === 1 ? '#fff' : C.muted}>{d}</Txt>
          </div>
        ))}
      </Abs>
      <Abs y={276} style={{ textAlign: 'right', ...rise(t, at + 0.14) }}>
        <Txt size={36} weight={500} color={C.muted}>{ui.freeSlots}</Txt>
      </Abs>
      {ui.slots.map((s, i) => {
        const pos = SLOT_POS(i);
        const taken = i === 1;
        const sel = i === PICKED_SLOT ? picked : 0;
        const press = i === PICKED_SLOT ? ramp(t, tapAt, 0.08) * (1 - ramp(t, tapAt + 0.12, 0.2)) : 0;
        return (
          <div
            key={s}
            style={{
              position: 'absolute',
              left: pos.x,
              top: pos.y,
              width: pos.w,
              height: pos.h,
              borderRadius: 26,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: sel ? `rgba(11,110,110,${sel})` : taken ? '#EEF2F4' : '#fff',
              border: `2px solid ${sel ? C.teal : taken ? '#E1E8EB' : 'rgba(111,209,200,0.6)'}`,
              boxShadow: taken ? 'none' : '0 10px 22px -16px rgba(16,36,46,0.5)',
              ...rise(t, at + 0.2 + i * 0.07),
              transform: `${rise(t, at + 0.2 + i * 0.07).transform} scale(${1 - press * 0.06})`,
            }}
          >
            <Txt size={38} weight={600} font={F.head} color={sel > 0.5 ? '#fff' : taken ? '#A9B7BE' : C.teal} style={{ textDecoration: taken ? 'line-through' : undefined }}>
              {s}
            </Txt>
          </div>
        );
      })}
      <Abs y={740} h={150} style={{ ...glass(0.8), borderRadius: 30, display: 'flex', alignItems: 'center', gap: 16, padding: '0 18px', boxSizing: 'border-box', direction: 'rtl', ...rise(t, at + 0.6) }}>
        <Avatar size={76} icon="medic" />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <Txt size={38} weight={700} font={F.head}>{brief.doctorName}</Txt>
          <Txt size={36} color={C.muted}>{ui.specialty}</Txt>
        </div>
      </Abs>
      <Tap t={t} at={tapAt} x={SLOT_POS(PICKED_SLOT).x + SLOT_POS(PICKED_SLOT).w / 2} y={SLOT_POS(PICKED_SLOT).y + 48} color="#fff" />
    </div>
  );
};

export const ConfirmScreen: React.FC<{ t: number; tickAt: number }> = ({ t, tickAt }) => {
  const circle = sp(t, tickAt - 0.3, 18, 170);
  const tick = ramp(t, tickAt - 0.25, 0.3);
  const detail = sp(t, tickAt + 0.4, 20, 170);
  return (
    <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(160deg, #13908a 0%, ${C.teal} 45%, ${C.blue} 130%)` }}>
      {[0, 1, 2].map((k) => {
        const p = ((t - tickAt + k * 0.9) % 2.7) / 2.7;
        return t > tickAt ? (
          <div key={k} style={{ position: 'absolute', left: SW / 2 - 120, top: 330 - 120, width: 240, height: 240, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.5)', transform: `scale(${1 + p * 1.2})`, opacity: (1 - p) * 0.6 }} />
        ) : null;
      })}
      <div
        style={{
          position: 'absolute',
          left: SW / 2 - 110,
          top: 220,
          width: 220,
          height: 220,
          borderRadius: '50%',
          background: '#fff',
          boxShadow: '0 30px 60px -20px rgba(0,0,0,0.35)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transform: `scale(${circle})`,
        }}
      >
        <svg width={130} height={130} viewBox="0 0 24 24">
          <path d="M5 12.5l4.5 4.5L19 7.5" pathLength={1} stroke={C.teal} strokeWidth={2.8} fill="none" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={1} strokeDashoffset={1 - tick} />
        </svg>
      </div>
      <Abs y={490} style={{ textAlign: 'center', ...rise(t, tickAt + 0.05) }}>
        <Txt size={64} weight={700} font={F.head} color="#fff">{brief.f2Done}</Txt>
      </Abs>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 600, display: 'flex', justifyContent: 'center', opacity: Math.min(1, detail * 1.4), transform: `translateY(${(1 - detail) * 20}px)` }}>
        <div style={{ padding: '10px 34px', borderRadius: 26, background: 'rgba(255,255,255,0.18)', border: '2px solid rgba(255,255,255,0.5)' }}>
          <Txt size={40} weight={600} color="#fff">{ui.bookedDetail}</Txt>
        </div>
      </div>
      <Abs y={700} style={{ textAlign: 'center', ...rise(t, tickAt + 0.6) }}>
        <Txt size={36} color="rgba(255,255,255,0.85)">{ui.clinic}</Txt>
      </Abs>
    </div>
  );
};

// ───────────────────────────── Feature 3: daily limit counter
export const CounterScreen: React.FC<{ t: number; at: number }> = ({ t, at }) => {
  const [c1, c2] = tl.counter;
  const n = t < c1 ? 28 : t < c2 ? 29 : 30;
  const fill = 28 + ramp(t, c1, 0.4) + ramp(t, c2, 0.4);
  const full = ramp(t, tl.full, 0.5);
  const R = 150;
  const circ = 2 * Math.PI * R;
  const lastAt = n === 28 ? -1 : n === 29 ? c1 : c2;
  const roll = lastAt > 0 ? ramp(t, lastAt, 0.35) : 1;
  const ringColor = full > 0 ? `rgb(${lerp(full, [0, 1], [11, 16])},${lerp(full, [0, 1], [110, 36])},${lerp(full, [0, 1], [110, 46])})` : C.teal;
  return (
    <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, ${C.bg} 0%, ${C.mint} 100%)` }}>
      <Abs y={84} style={{ textAlign: 'center', ...rise(t, at) }}>
        <Txt size={42} weight={700} font={F.head}>{ui.todaysBookings}</Txt>
      </Abs>
      <div style={{ position: 'absolute', left: SW / 2 - 190, top: 190, width: 380, height: 380, ...rise(t, at + 0.1) }}>
        <svg width={380} height={380} style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}>
          <circle cx={190} cy={190} r={R} stroke="#DCEBEE" strokeWidth={26} fill="none" />
          <circle cx={190} cy={190} r={R} stroke={ringColor} strokeWidth={26} fill="none" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ * (1 - fill / 30)} />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ height: 150, overflow: 'hidden', position: 'relative', width: 260, textAlign: 'center' }}>
            <div style={{ transform: `translateY(${(1 - roll) * 60}px)`, opacity: roll, filter: roll < 1 ? `blur(${(1 - roll) * 6}px)` : undefined }}>
              <Txt size={128} weight={700} font={F.head} color={n === 30 ? ringColor : C.navy} style={{ lineHeight: 1.15 }}>
                {['٢٨', '٢٩', '٣٠'][n - 28]}
              </Txt>
            </div>
          </div>
          <Txt size={36} color={C.muted}>{ui.ofTotal}</Txt>
        </div>
      </div>
      <div style={{ position: 'absolute', left: (SW - (10 * 28 + 9 * 12)) / 2, top: 610, width: 10 * 28 + 9 * 12, display: 'flex', flexWrap: 'wrap', gap: 12, direction: 'rtl' }}>
        {Array.from({ length: 30 }).map((_, i) => {
          const on = i < 28 ? ramp(t, at + 0.2 + i * 0.012, 0.25) : ramp(t, i === 28 ? c1 : c2, 0.25);
          const pop = i >= 28 ? sp(t, i === 28 ? c1 : c2, 18, 240) : 1;
          return (
            <div
              key={i}
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: on > 0 ? (i >= 28 ? `rgba(111,209,200,${on})` : `rgba(11,110,110,${0.2 + on * 0.8})`) : '#DCEBEE',
                border: '2px solid #DCEBEE',
                boxSizing: 'border-box',
                transform: `scale(${i >= 28 && on > 0 ? 0.7 + 0.3 * pop : 1})`,
                boxShadow: i >= 28 && on > 0 ? `0 0 ${14 * on}px rgba(111,209,200,0.9)` : undefined,
              }}
            />
          );
        })}
      </div>
    </div>
  );
};

// ───────────────────────────── Features 4–5: chat (auto reply → secretary → doctor)
type Msg = { kind: 'patient' | 'clinic' | 'system' | 'typing' | 'chip'; text?: string; at: number; until?: number; h: number; label?: boolean };

const B = tl.bubbles;
const TY = tl.typing;
export const CHIP_TAP = tl.taps[3];

const MESSAGES: Msg[] = [
  { kind: 'patient', text: brief.f4Question, at: B[0], h: 100 },
  { kind: 'typing', at: TY[0][0], until: TY[0][1], h: 92 },
  { kind: 'clinic', text: ui.reply, at: B[1], h: 210, label: true },
  { kind: 'chip', text: ui.talkToSecretary, at: 32.6, until: CHIP_TAP + 0.35, h: 96 },
  { kind: 'typing', at: TY[1][0], until: TY[1][1], h: 92 },
  { kind: 'clinic', text: ui.secretaryHello, at: B[2], h: 100 },
  { kind: 'patient', text: ui.patientAsk, at: B[3], h: 100 },
  { kind: 'system', text: ui.transferred, at: B[4], h: 84 },
  { kind: 'typing', at: TY[2][0], until: TY[2][1], h: 92 },
  { kind: 'clinic', text: ui.doctorHello, at: B[5], h: 100 },
];

const CHAT_BOTTOM = 820;

const Bubble: React.FC<{ m: Msg; t: number }> = ({ m, t }) => {
  const own = m.kind === 'patient';
  if (m.kind === 'typing') {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-start', direction: 'rtl' }}>
        <div style={{ ...glass(0.9), borderRadius: 28, borderTopRightRadius: 10, padding: '24px 30px', display: 'flex', gap: 10 }}>
          {[0, 1, 2].map((k) => (
            <div key={k} style={{ width: 16, height: 16, borderRadius: '50%', background: C.teal, opacity: 0.35 + 0.65 * Math.max(0, Math.sin((t - m.at) * 10 - k * 0.9)), transform: `translateY(${-5 * Math.max(0, Math.sin((t - m.at) * 10 - k * 0.9))}px)` }} />
          ))}
        </div>
      </div>
    );
  }
  if (m.kind === 'system') {
    return (
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <div style={{ padding: '4px 22px', borderRadius: 22, background: 'rgba(47,128,201,0.12)', border: '2px solid rgba(47,128,201,0.3)', direction: 'rtl' }}>
          <Txt size={36} weight={600} color={C.blue}>{m.text}</Txt>
        </div>
      </div>
    );
  }
  if (m.kind === 'chip') {
    const press = ramp(t, CHIP_TAP, 0.08) * (1 - ramp(t, CHIP_TAP + 0.12, 0.2));
    const sel = ramp(t, CHIP_TAP, 0.15);
    return (
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <div style={{ padding: '12px 30px', borderRadius: 30, border: `3px solid ${C.teal}`, background: sel ? `rgba(11,110,110,${sel})` : '#fff', transform: `scale(${1 - press * 0.06})`, display: 'flex', alignItems: 'center', gap: 12, direction: 'rtl' }}>
          <Icon name="headset" size={34} color={sel > 0.5 ? '#fff' : C.teal} />
          <Txt size={36} weight={600} color={sel > 0.5 ? '#fff' : C.teal}>{m.text}</Txt>
        </div>
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: own ? 'flex-end' : 'flex-start', direction: 'rtl' }}>
      <div
        style={{
          padding: '14px 26px',
          borderRadius: 30,
          ...(own
            ? { background: `linear-gradient(135deg, ${C.teal}, #138585)`, borderTopLeftRadius: 10, boxShadow: '0 12px 24px -16px rgba(11,110,110,0.9)' }
            : { ...glass(0.92), borderTopRightRadius: 10 }),
        }}
      >
        <Txt size={36} weight={500} color={own ? '#fff' : C.navy} style={{ whiteSpace: 'pre', lineHeight: 1.45, display: 'block' }}>
          {m.text}
        </Txt>
      </div>
      {m.label && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, opacity: ramp(t, m.at + 0.3, 0.3), direction: 'rtl' }}>
          <Icon name="bolt" size={32} color={C.teal} t={t} drawAt={m.at + 0.3} />
          <Txt size={36} weight={600} color={C.teal}>{ui.autoReply}</Txt>
        </div>
      )}
    </div>
  );
};

const HEADER_PHASES: { at: number; name: string; icon: IconName; from: string; to: string }[] = [
  { at: -1, name: ui.clinic, icon: 'medic', from: C.aqua, to: C.teal },
  { at: 35.0, name: brief.f5Secretary, icon: 'headset', from: '#7cc0f0', to: C.blue },
  { at: tl.handoff, name: brief.f5Doctor, icon: 'medic', from: C.aqua, to: C.teal },
];

export const CALL_ICON = { x: 30 + 34, y: 80 + 46 };

const ChatHeader: React.FC<{ t: number; at: number }> = ({ t, at }) => {
  const callTap = tl.taps[4];
  const pulse = t > callTap - 1 && t < callTap ? 0.5 + 0.5 * Math.sin((t - callTap + 1) * 12) : 0;
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: 64, height: 128, borderBottom: `2px solid ${C.line}`, background: 'rgba(255,255,255,0.85)', ...rise(t, at, 12) }}>
      {HEADER_PHASES.map((ph, i) => {
        const next = HEADER_PHASES[i + 1];
        const pin = ph.at < 0 ? 1 : ramp(t, ph.at, 0.5);
        const pout = next ? ramp(t, next.at, 0.5) : 0;
        if (pin <= 0 || pout >= 1) return null;
        const x = (1 - pin) * 120 - pout * 120; // R→L handoff
        return (
          <div key={i} style={{ position: 'absolute', right: 26, top: 22, display: 'flex', alignItems: 'center', gap: 16, direction: 'rtl', opacity: Math.min(pin, 1 - pout), transform: `translateX(${x}px)`, filter: pin < 1 || pout > 0 ? `blur(${(1 - pin + pout) * 5}px)` : undefined }}>
            <Avatar size={80} icon={ph.icon} from={ph.from} to={ph.to} />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <Txt size={38} weight={700} font={F.head}>{ph.name}</Txt>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#27b47e' }} />
              </div>
            </div>
          </div>
        );
      })}
      <div
        style={{
          position: 'absolute',
          left: CALL_ICON.x - 34,
          top: CALL_ICON.y - 64 - 34,
          width: 68,
          height: 68,
          borderRadius: 22,
          background: C.mint,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: pulse ? `0 0 0 ${8 * pulse}px rgba(111,209,200,${0.4 * pulse})` : undefined,
        }}
      >
        <Icon name="phone" size={36} color={C.teal} />
      </div>
    </div>
  );
};

export const ChatScreen: React.FC<{ t: number; at: number }> = ({ t, at }) => {
  // Bottom-anchored stack: each visible message pushes the earlier ones up with a spring.
  const items = MESSAGES.map((m) => {
    const grow = sp(t, m.at, 22, 190);
    const shrink = m.until !== undefined ? ramp(t, m.until, 0.25) : 0;
    return { m, grow, shrink, h: m.h * grow * (1 - shrink) };
  });
  let y = CHAT_BOTTOM;
  const placed = [...items]
    .reverse()
    .map((it) => {
      y -= it.h;
      return { ...it, y };
    })
    .reverse();
  return (
    <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, ${C.bg} 0%, #EEF8F7 100%)` }}>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 192, bottom: SCREEN.h - CHAT_BOTTOM - 6, overflow: 'hidden' }}>
        {placed.map(({ m, grow, shrink, y: top }, i) =>
          grow > 0.01 && shrink < 0.99 ? (
            <div key={i} style={{ position: 'absolute', left: PAD, right: PAD, top: top - 192, opacity: Math.min(1, grow * 1.6) * (1 - shrink), transform: `scale(${0.85 + 0.15 * Math.min(1, grow)})`, transformOrigin: m.kind === 'patient' ? 'left bottom' : 'right bottom' }}>
              <Bubble m={m} t={t} />
            </div>
          ) : null,
        )}
      </div>
      <ChatHeader t={t} at={at} />
      <Abs y={846} h={78} style={{ ...glass(0.9), borderRadius: 40, display: 'flex', alignItems: 'center', padding: '0 12px', boxSizing: 'border-box', ...rise(t, at + 0.15, 12) }}>
        <div style={{ width: 58, height: 58, borderRadius: '50%', background: C.teal, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="send" size={30} color="#fff" />
        </div>
      </Abs>
      <Tap t={t} at={CHIP_TAP} x={SW / 2} y={CHAT_BOTTOM - 48} />
      <Tap t={t} at={tl.taps[4]} x={CALL_ICON.x} y={CALL_ICON.y} />
    </div>
  );
};

// ───────────────────────────── Feature 6: one-tap call
export const CALL_BTN = { y: 600, h: 120 };

export const CallScreen: React.FC<{ t: number; at: number }> = ({ t, at }) => {
  const tapAt = tl.taps[5];
  const calling = ramp(t, tapAt + 0.1, 0.3);
  const pulses = tl.callPulse.map((p) => (t >= p && t < p + 0.7 ? Math.sin(((t - p) / 0.7) * Math.PI) : 0));
  const pulse = Math.max(...pulses);
  const press = ramp(t, tapAt, 0.08) * (1 - ramp(t, tapAt + 0.12, 0.2));
  return (
    <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, ${C.mint} 0%, ${C.bg} 55%)` }}>
      <div style={{ position: 'absolute', left: SW / 2 - 90, top: 120, ...rise(t, at) }}>
        <Avatar size={180} icon="medic" />
      </div>
      <Abs y={330} style={{ textAlign: 'center', ...rise(t, at + 0.08) }}>
        <Txt size={48} weight={700} font={F.head}>{ui.clinic}</Txt>
      </Abs>
      <Abs y={404} style={{ textAlign: 'center', ...rise(t, at + 0.14) }}>
        <Txt size={36} color={C.muted}>{ui.clinicNumber}</Txt>
      </Abs>
      {tl.callPulse.map((p, k) => {
        const q = ramp(t, p, 0.9, (x) => x);
        return q > 0 && q < 1 ? (
          <Abs key={k} y={CALL_BTN.y} h={CALL_BTN.h} style={{ borderRadius: 40, border: `3px solid ${C.aqua}`, opacity: (1 - q) * 0.8, transform: `scale(${1 + q * 0.18}, ${1 + q * 0.5})` }} />
        ) : null;
      })}
      <Abs
        y={CALL_BTN.y}
        h={CALL_BTN.h}
        style={{
          borderRadius: 40,
          background: `linear-gradient(135deg, #12928c, ${C.teal})`,
          boxShadow: `0 20px 40px -18px rgba(11,110,110,0.9), 0 0 ${30 * pulse}px rgba(111,209,200,${0.6 * pulse})`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 18,
          direction: 'rtl',
          ...rise(t, at + 0.22),
          transform: `${rise(t, at + 0.22).transform} scale(${1 + pulse * 0.035 - press * 0.06})`,
        }}
      >
        <Icon name="phone" size={48} color="#fff" stroke={2.2} style={{ transform: `rotate(${Math.sin(t * 30) * 8 * calling}deg)` }} />
        <div style={{ position: 'relative', height: 56, width: 260 }}>
          <div style={{ position: 'absolute', inset: 0, textAlign: 'center', opacity: 1 - calling }}>
            <Txt size={40} weight={600} color="#fff">{ui.callCard}</Txt>
          </div>
          <div style={{ position: 'absolute', inset: 0, textAlign: 'center', opacity: calling }}>
            <Txt size={40} weight={600} color="#fff">{ui.calling}</Txt>
          </div>
        </div>
      </Abs>
      <Abs y={770} h={110} style={{ display: 'flex', gap: 20, ...rise(t, at + 0.3) }}>
        {(['chat', 'calendar'] as IconName[]).map((n) => (
          <div key={n} style={{ flex: 1, ...glass(0.85), borderRadius: 30, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={n} size={46} color={C.teal} />
          </div>
        ))}
      </Abs>
      <Tap t={t} at={tapAt} x={SW / 2} y={CALL_BTN.y + CALL_BTN.h / 2} color="#fff" />
    </div>
  );
};
