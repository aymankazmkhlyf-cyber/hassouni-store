// Phone screens for the fictional businesses (446 × 916 px, dark premium theme).
import React from 'react';
import { brief, ui } from '../texts';
import { C, F, glass, ramp, sp } from '../theme';
import { Icon, IconName } from '../ui/Icon';
import { SCREEN, Tap } from '../ui/Phone';

export const SW = SCREEN.w;
export const SH = SCREEN.h;
export const PAD = 24;

export const rise = (t: number, at: number, dist = 26): React.CSSProperties => {
  const p = sp(t, at, 22, 170);
  return { opacity: Math.min(1, ramp(t, at, 0.3)), transform: `translateY(${(1 - p) * dist}px)` };
};

export const Abs: React.FC<{ x?: number; y: number; w?: number; h?: number; style?: React.CSSProperties; children?: React.ReactNode }> = ({ x = PAD, y, w = SW - PAD * 2, h, style, children }) => (
  <div style={{ position: 'absolute', left: x, top: y, width: w, height: h, ...style }}>{children}</div>
);

export const Txt: React.FC<{ size: number; weight?: number; color?: string; font?: string; children: React.ReactNode; style?: React.CSSProperties }> = ({ size, weight = 500, color = C.ivory, font = F.body, children, style }) => (
  <span dir="rtl" style={{ fontFamily: font, fontWeight: weight, fontSize: size, color, lineHeight: 1.35, whiteSpace: 'nowrap', ...style }}>
    {children}
  </span>
);

export const Avatar: React.FC<{ size: number; icon: IconName; from?: string; to?: string; color?: string }> = ({ size, icon, from = C.gold, to = '#a8741f', color = C.navy }) => (
  <div style={{ width: size, height: size, borderRadius: '50%', background: `linear-gradient(140deg, ${from}, ${to})`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 14px 30px -12px rgba(217,164,65,0.7), inset 0 2px 0 rgba(255,255,255,0.35)', flexShrink: 0 }}>
    <Icon name={icon} size={size * 0.52} color={color} stroke={2} />
  </div>
);

export const TitleBar: React.FC<{ title: string; t: number; at: number }> = ({ title, t, at }) => (
  <Abs y={78} h={70} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', ...rise(t, at, 14) }}>
    <div style={{ position: 'absolute', right: 0, top: 9, width: 52, height: 52, borderRadius: 18, background: 'rgba(244,239,230,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Icon name="back" size={30} color={C.ivory} />
    </div>
    <Txt size={40} weight={700} font={F.head}>{title}</Txt>
  </Abs>
);

const screenBg = `radial-gradient(ellipse 120% 70% at 50% 0%, #1b3550 0%, ${C.navy} 60%)`;

// ───────────────────────────── Hook: an outgoing call at 2 a.m. that nobody answers
export const CallScreen: React.FC<{ t: number; ringFrom?: number }> = ({ t, ringFrom = 0 }) => (
  <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, #13263c 0%, #060c15 100%)` }}>
    {[0, 0.6, 1.2].map((d) => {
      const p = (((t - ringFrom - d) % 1.8) + 1.8) % 1.8 / 1.8;
      return <div key={d} style={{ position: 'absolute', left: SW / 2 - 100, top: 250 - 100, width: 200, height: 200, borderRadius: '50%', border: '3px solid rgba(217,164,65,0.7)', transform: `scale(${1 + p * 1.1})`, opacity: (1 - p) * 0.8 }} />;
    })}
    <div style={{ position: 'absolute', left: SW / 2 - 100, top: 150 }}>
      <Avatar size={200} icon="plane" />
    </div>
    <Abs y={384} style={{ textAlign: 'center' }}>
      <Txt size={52} weight={700} font={F.head}>{brief.travelAgency}</Txt>
    </Abs>
    <Abs y={460} style={{ textAlign: 'center' }}>
      <Txt size={44} color="rgba(244,239,230,0.75)">{ui.calling}</Txt>
    </Abs>
    <div style={{ position: 'absolute', left: SW / 2 - 54, top: 720, width: 108, height: 108, borderRadius: '50%', background: C.red, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: 'rotate(135deg)', boxShadow: '0 0 40px rgba(224,75,75,0.5)' }}>
      <Icon name="phone" size={50} color="#fff" stroke={2.1} />
    </div>
  </div>
);

// ───────────────────────────── Reveal: travel agency homepage
export const HOME_HOURS = { y: 556, h: 96 };

const HomeRow: React.FC<{ icon: IconName; label: string; y: number; t: number; at: number; hl?: number }> = ({ icon, label, y, t, at, hl = 0 }) => (
  <Abs y={y} h={96} style={{ ...glass(0.07), borderRadius: 28, display: 'flex', alignItems: 'center', gap: 18, padding: '0 22px', boxSizing: 'border-box', direction: 'rtl', outline: hl ? `${3 * hl}px solid rgba(217,164,65,${hl})` : undefined, ...rise(t, at) }}>
    <div style={{ width: 58, height: 58, borderRadius: 20, background: 'rgba(217,164,65,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={icon} size={34} color={C.gold} />
    </div>
    <Txt size={36} weight={600}>{label}</Txt>
    <div style={{ marginRight: 'auto', transform: 'scaleX(-1)' }}>
      <Icon name="back" size={28} color={C.muted} />
    </div>
  </Abs>
);

export const HomeScreen: React.FC<{ t: number; at: number; tapAt?: number }> = ({ t, at, tapAt }) => {
  const hl = tapAt === undefined ? 0 : ramp(t, tapAt, 0.15);
  const sun = (t - at) * 0.05;
  return (
    <div style={{ position: 'absolute', inset: 0, background: screenBg }}>
      {/* hero */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 300, overflow: 'hidden', background: 'linear-gradient(180deg, #1f3c5c 0%, #d98a41 78%, #f2c26b 100%)', ...rise(t, at, 0) }}>
        <div style={{ position: 'absolute', left: SW / 2 - 90, top: 170 - sun * 40, width: 180, height: 180, borderRadius: '50%', background: 'radial-gradient(circle, #ffe2a3 0%, #f2b45a 55%, rgba(242,180,90,0) 72%)' }} />
        <svg width={SW} height={120} style={{ position: 'absolute', bottom: 0, left: 0 }}>
          <path d={`M0 120 L0 70 L40 70 L40 40 L70 40 L70 60 L110 60 L110 20 L130 20 L130 55 L170 55 L170 75 L220 75 L220 30 L240 10 L260 30 L260 70 L300 70 L300 45 L340 45 L340 80 L380 80 L380 50 L420 50 L420 90 L${SW} 90 L${SW} 120 Z`} fill="#0b1726" />
        </svg>
        <div style={{ position: 'absolute', left: 60 + (t - at) * 30, top: 96, transform: 'rotate(45deg)' }}>
          <Icon name="plane" size={46} color="#fff" stroke={1.6} />
        </div>
      </div>
      <Abs y={314} style={{ textAlign: 'center', ...rise(t, at + 0.1) }}>
        <Txt size={50} weight={700} font={F.head}>{brief.travelAgency}</Txt>
      </Abs>
      <Abs y={382} style={{ textAlign: 'center', ...rise(t, at + 0.16) }}>
        <Txt size={36} color={C.muted}>{ui.agencyTagline}</Txt>
      </Abs>
      <Abs y={448} h={88} style={{ borderRadius: 28, background: `linear-gradient(135deg, #f0c56a, ${C.gold} 55%, #b9822a)`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, boxShadow: '0 18px 30px -14px rgba(217,164,65,0.8)', ...rise(t, at + 0.22) }}>
        <Icon name="plane" size={36} color={C.navy} />
        <Txt size={38} weight={700} color={C.navy}>{ui.bookTrip}</Txt>
      </Abs>
      <HomeRow icon="calendar" label={ui.workHours} y={HOME_HOURS.y} t={t} at={at + 0.3} hl={hl} />
      <HomeRow icon="chat" label={ui.chatUs} y={664} t={t} at={at + 0.38} />
      <HomeRow icon="phone" label={ui.callUs} y={772} t={t} at={at + 0.46} />
      {tapAt !== undefined && <Tap t={t} at={tapAt} x={SW / 2} y={HOME_HOURS.y + HOME_HOURS.h / 2} />}
    </div>
  );
};

// ───────────────────────────── 1/7: weekly schedule
export const ScheduleScreen: React.FC<{ t: number; at: number; days: number[]; hoursAt: number; hideHours?: number }> = ({ t, at, days, hoursAt, hideHours = 0 }) => {
  const hours = sp(t, hoursAt, 19, 170);
  return (
    <div style={{ position: 'absolute', inset: 0, background: screenBg }}>
      <TitleBar title={ui.workHours} t={t} at={at} />
      {ui.days.map((d, i) => {
        const lit = ramp(t, days[i], 0.3);
        const off = i === 6;
        return (
          <Abs
            key={d}
            y={164 + i * 78}
            h={68}
            style={{
              borderRadius: 22,
              direction: 'rtl',
              display: 'flex',
              alignItems: 'center',
              padding: '0 22px',
              boxSizing: 'border-box',
              background: off ? `rgba(244,239,230,${0.04 + lit * 0.04})` : `linear-gradient(90deg, rgba(217,164,65,${0.06 + lit * 0.3}), rgba(217,164,65,${0.02 + lit * 0.1}))`,
              border: `1.5px solid rgba(${off ? '244,239,230' : '217,164,65'},${0.12 + lit * 0.5})`,
              boxShadow: !off && lit > 0 ? `0 0 ${26 * Math.sin(lit * Math.PI) + 8 * lit}px rgba(217,164,65,${0.35 * lit})` : undefined,
              opacity: Math.min(1, ramp(t, at + 0.05 + i * 0.04, 0.3)),
            }}
          >
            <Txt size={36} weight={600} color={lit > 0.5 ? C.ivory : C.muted}>{d}</Txt>
            <div style={{ marginRight: 'auto' }}>
              {off ? (
                <div style={{ padding: '0 16px', borderRadius: 16, background: 'rgba(244,239,230,0.08)', opacity: lit }}>
                  <Txt size={34} weight={600} color={C.muted}>{ui.dayOff}</Txt>
                </div>
              ) : (
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: `rgba(217,164,65,${lit})`, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `2px solid rgba(217,164,65,${0.3 + lit * 0.7})` }}>
                  <Icon name="check" size={28} color={C.navy} t={t} drawAt={days[i]} stroke={2.8} />
                </div>
              )}
            </div>
          </Abs>
        );
      })}
      <Abs y={724} h={104} style={{ ...glass(0.12), borderRadius: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, direction: 'rtl', opacity: Math.min(1, hours * 1.4) * (1 - hideHours), transform: `translateY(${(1 - hours) * 24}px) scale(${0.94 + 0.06 * hours})` }}>
        <Icon name="clock" size={44} color={C.gold} t={t} drawAt={hoursAt} />
        <Txt size={44} weight={700} font={F.head} color={C.gold}>{brief.f1Hours}</Txt>
      </Abs>
    </div>
  );
};

// ───────────────────────────── 2/7: trip booking
export const BOOK_BTN = { y: 760, h: 100 };

export const BookingScreen: React.FC<{ t: number; at: number; tapAt: number }> = ({ t, at, tapAt }) => {
  const press = ramp(t, tapAt, 0.08) * (1 - ramp(t, tapAt + 0.12, 0.2));
  return (
    <div style={{ position: 'absolute', inset: 0, background: screenBg }}>
      <TitleBar title={ui.bookTrip} t={t} at={at} />
      <Abs y={170} h={300} style={{ ...glass(0.08), borderRadius: 32, ...rise(t, at + 0.08) }}>
        {[
          { y: 30, icon: 'pin' as IconName, city: ui.cities.baghdad },
          { y: 170, icon: 'pin' as IconName, city: ui.cities.istanbul },
        ].map((r, i) => (
          <div key={i} style={{ position: 'absolute', right: 26, left: 26, top: r.y, height: 100, display: 'flex', alignItems: 'center', gap: 18, direction: 'rtl' }}>
            <div style={{ width: 64, height: 64, borderRadius: 22, background: i ? 'rgba(217,164,65,0.18)' : 'rgba(95,183,229,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={r.icon} size={38} color={i ? C.gold : C.sky} />
            </div>
            <Txt size={46} weight={700} font={F.head}>{r.city}</Txt>
          </div>
        ))}
        <div style={{ position: 'absolute', left: 40, top: 118, width: 64, height: 64, borderRadius: '50%', background: C.navy, border: `2px solid rgba(217,164,65,0.6)`, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `rotate(${180 + Math.sin((t - at) * 2) * 6}deg)` }}>
          <Icon name="plane" size={36} color={C.gold} />
        </div>
        <div style={{ position: 'absolute', right: 58, top: 138, width: 2, height: 30, background: 'rgba(244,239,230,0.25)' }} />
      </Abs>
      <Abs y={500} h={96} style={{ display: 'flex', gap: 16, direction: 'rtl', ...rise(t, at + 0.16) }}>
        {(
          [
            ['calendar', ui.flightDate],
            ['ticket', ui.seatNo],
          ] as [IconName, string][]
        ).map(([icon, v]) => (
          <div key={icon} style={{ flex: 1, ...glass(0.07), borderRadius: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, direction: 'rtl' }}>
            <Icon name={icon} size={36} color={C.gold} />
            <Txt size={40} weight={700} font={F.head}>{v}</Txt>
          </div>
        ))}
      </Abs>
      <Abs y={BOOK_BTN.y} h={BOOK_BTN.h} style={{ borderRadius: 32, background: `linear-gradient(135deg, #f0c56a, ${C.gold} 55%, #b9822a)`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, boxShadow: `0 20px 40px -14px rgba(217,164,65,0.9), 0 0 ${30 * ramp(t, tapAt - 0.1, 0.2)}px rgba(217,164,65,0.8)`, transform: `${rise(t, at + 0.24).transform} scale(${1 - press * 0.05})`, opacity: rise(t, at + 0.24).opacity }}>
        <Icon name="plane" size={40} color={C.navy} />
        <Txt size={42} weight={700} color={C.navy}>{ui.bookTrip}</Txt>
      </Abs>
      <Tap t={t} at={tapAt} x={SW / 2} y={BOOK_BTN.y + BOOK_BTN.h / 2} />
    </div>
  );
};
