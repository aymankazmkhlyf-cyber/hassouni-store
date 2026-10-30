// Part 4: 28.0–44.0 s — 4/7 instant auto-reply, 5/7 reception → manager (rack focus), 6/7 one-tap call.
import React from 'react';
import { AbsoluteFill } from 'remotion';
import tl from '../timeline.json';
import { brief, ui } from '../texts';
import { C, F, IN_OUT, W, glass, lerp, ramp, sp } from '../theme';
import { LightSweep } from '../ui/Effects';
import { Icon, IconBadge, IconName } from '../ui/Icon';
import { Phone, Tap } from '../ui/Phone';
import type { Cam } from '../ui/Phone';
import { Dust } from './Part2';
import { Avatar, PAD, SW, Txt, rise } from './Screens';
import { screenToFrame } from './transitions';

const Backdrop: React.FC<{ t: number; tint?: string }> = ({ t, tint = 'rgba(14,110,115,0.35)' }) => (
  <AbsoluteFill style={{ background: `radial-gradient(ellipse 90% 60% at 50% 55%, #10283d 0%, ${C.navy} 55%, #050a12 100%)` }}>
    <AbsoluteFill style={{ background: `radial-gradient(circle at ${50 + Math.sin(t * 0.3) * 14}% ${50 + Math.cos(t * 0.27) * 10}%, ${tint}, rgba(0,0,0,0) 45%)` }} />
    <Dust t={t} n={30} />
  </AbsoluteFill>
);

// ───────────────────────────── chat building blocks
type Msg = { kind: 'client' | 'biz' | 'typing' | 'system' | 'chip'; text?: string; at: number; until?: number; h: number; label?: boolean };

const Bubble: React.FC<{ m: Msg; t: number; size?: number; maxW?: number }> = ({ m, t, size = 36, maxW }) => {
  if (m.kind === 'typing') {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-start', direction: 'rtl' }}>
        <div style={{ ...glass(0.1), borderRadius: 28, borderTopRightRadius: 8, padding: '22px 28px', display: 'flex', gap: 10 }}>
          {[0, 1, 2].map((k) => {
            const b = Math.max(0, Math.sin((t - m.at) * 10 - k * 0.9));
            return <div key={k} style={{ width: 15, height: 15, borderRadius: '50%', background: C.gold, opacity: 0.35 + 0.65 * b, transform: `translateY(${-5 * b}px)` }} />;
          })}
        </div>
      </div>
    );
  }
  if (m.kind === 'system') {
    return (
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <div style={{ padding: '4px 22px', borderRadius: 22, background: 'rgba(95,183,229,0.14)', border: '1.5px solid rgba(95,183,229,0.45)', direction: 'rtl' }}>
          <Txt size={size} weight={600} color={C.sky}>{m.text}</Txt>
        </div>
      </div>
    );
  }
  if (m.kind === 'chip') {
    const sel = ramp(t, tl.taps[2], 0.15);
    return (
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <div style={{ padding: '10px 26px', borderRadius: 30, border: `2.5px solid ${C.gold}`, background: `rgba(217,164,65,${0.08 + sel * 0.9})`, display: 'flex', alignItems: 'center', gap: 12, direction: 'rtl' }}>
          <Icon name="headset" size={34} color={sel > 0.5 ? C.navy : C.gold} />
          <Txt size={size} weight={600} color={sel > 0.5 ? C.navy : C.gold}>{m.text}</Txt>
        </div>
      </div>
    );
  }
  const own = m.kind === 'client';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: own ? 'flex-end' : 'flex-start', direction: 'rtl' }}>
      <div
        style={{
          padding: '14px 26px',
          borderRadius: 30,
          maxWidth: maxW,
          ...(own ? { background: `linear-gradient(135deg, ${C.teal}, #138a8f)`, borderTopLeftRadius: 8, boxShadow: '0 14px 28px -16px rgba(14,110,115,0.9)' } : { ...glass(0.12), borderTopRightRadius: 8 }),
        }}
      >
        <Txt size={size} weight={500} color={C.ivory} style={{ whiteSpace: 'pre', lineHeight: 1.45, display: 'block' }}>
          {m.text}
        </Txt>
      </div>
      {m.label && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, opacity: ramp(t, m.at + 0.3, 0.3), direction: 'rtl' }}>
          <Icon name="bolt" size={32} color={C.gold} t={t} drawAt={m.at + 0.3} />
          <Txt size={34} weight={600} color={C.gold}>{ui.autoReply}</Txt>
        </div>
      )}
    </div>
  );
};

/** Bottom-anchored message stack: each new message pushes the older ones up with a spring. */
const Stack: React.FC<{ t: number; msgs: Msg[]; bottom: number; top: number; left: number; right: number; size?: number; maxW?: number }> = ({ t, msgs, bottom, top, left, right, size, maxW }) => {
  const items = msgs.map((m) => {
    const g = sp(t, m.at, 22, 190);
    const s = m.until !== undefined ? ramp(t, m.until, 0.25) : 0;
    return { m, g, s, h: m.h * g * (1 - s) };
  });
  let y = bottom;
  const placed = [...items].reverse().map((it) => ({ ...it, y: (y -= it.h) })).reverse();
  return (
    <div style={{ position: 'absolute', left, right, top, height: bottom - top, overflow: 'hidden' }}>
      {placed.map(({ m, g, s, y: yy }, i) =>
        g > 0.01 && s < 0.99 ? (
          <div key={i} style={{ position: 'absolute', left: 0, right: 0, top: yy - top, opacity: Math.min(1, g * 1.6) * (1 - s), transform: `scale(${0.85 + 0.15 * Math.min(1, g)})`, transformOrigin: m.kind === 'client' ? 'left bottom' : 'right bottom' }}>
            <Bubble m={m} t={t} size={size} maxW={maxW} />
          </div>
        ) : null,
      )}
    </div>
  );
};

const ChatHeader: React.FC<{ name: string; icon: IconName; from?: string; to?: string; width: number; size?: number; callPulse?: number; style?: React.CSSProperties }> = ({ name, icon, from, to, width, size = 40, callPulse = 0, style }) => (
  <div style={{ position: 'absolute', left: 0, top: 0, width, height: 128, display: 'flex', alignItems: 'center', gap: 16, padding: '0 26px', boxSizing: 'border-box', direction: 'rtl', borderBottom: '1.5px solid rgba(244,239,230,0.12)', ...style }}>
    <Avatar size={78} icon={icon} from={from} to={to} />
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <Txt size={size} weight={700} font={F.head}>{name}</Txt>
      <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#2ec27e' }} />
    </div>
    <div style={{ marginRight: 'auto', width: 66, height: 66, borderRadius: 22, background: 'rgba(217,164,65,0.16)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: callPulse ? `0 0 0 ${10 * callPulse}px rgba(217,164,65,${0.35 * callPulse})` : undefined }}>
      <Icon name="phone" size={36} color={C.gold} />
    </div>
  </div>
);

// ───────────────────────────── 4/7 auto-reply (28–34)
const CH = tl.chat;
const TY = tl.typing;

const F4_MSGS: Msg[] = [
  { kind: 'client', text: brief.f4Question, at: CH[0], h: 100 },
  { kind: 'typing', at: TY[0][0], until: TY[0][1], h: 90 },
  { kind: 'biz', text: ui.reply, at: CH[1], h: 196, label: true },
  { kind: 'chip', text: ui.talkToReception, at: 32.7, until: tl.taps[2] + 0.3, h: 92 },
];

export const f4Cam = (t: number): Cam => {
  const orbit = ramp(t, 32.6, 1.4, IN_OUT);
  return { y: 60 + ramp(t, 31.4, 0.8, IN_OUT) * 40, scale: 0.94 + 0.04 * ramp(t, 28, 3.4, (x) => x) - ramp(t, 31.4, 0.8, IN_OUT) * 0.08, ry: lerp(t, [28, 31], [-16, -5]) + orbit * 16, rx: 5 };
};

const F4Shot: React.FC<{ t: number }> = ({ t }) => {
  const pop = sp(t, 31.45, 19, 130);
  const popOn = t >= 31.4;
  return (
    <AbsoluteFill>
      <Backdrop t={t} />
      <Phone cam={{ ...f4Cam(t), blur: popOn ? Math.min(1, pop) * 2.5 * (1 - ramp(t, 32.8, 0.5)) : 0 }} glow={0.45}>
        <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, #13263c, ${C.navy})` }}>
          <div style={{ position: 'absolute', left: 0, right: 0, top: 58 }}>
            <ChatHeader name={brief.travelAgency} icon="plane" width={SW} />
          </div>
          <Stack t={t} msgs={F4_MSGS} top={190} bottom={820} left={PAD} right={PAD} />
          <div style={{ position: 'absolute', left: PAD, right: PAD, top: 840, height: 72, borderRadius: 36, ...glass(0.08), display: 'flex', alignItems: 'center', padding: '0 10px', ...rise(t, 28.2, 10) }}>
            <div style={{ width: 54, height: 54, borderRadius: '50%', background: C.gold, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="send" size={28} color={C.navy} />
            </div>
          </div>
          <Tap t={t} at={tl.taps[2]} x={SW / 2} y={820 - 46} />
        </div>
      </Phone>
      {/* the instant reply is lifted out of the phone toward the lens */}
      {popOn && t < 33.3 && (
        <div style={{ position: 'absolute', left: 80, right: 80, top: 1240 - pop * 60, opacity: Math.min(1, pop * 1.5) * (1 - ramp(t, 32.9, 0.4)), transform: `perspective(1600px) rotateX(${(1 - pop) * 25}deg) scale(${0.75 + 0.25 * pop})` }}>
          <div style={{ ...glass(0.14), background: 'linear-gradient(160deg, rgba(28,50,74,0.97), rgba(11,23,38,0.97))', borderRadius: 40, padding: '26px 34px', direction: 'rtl', boxShadow: '0 50px 90px -30px rgba(0,0,0,0.85), 0 0 60px rgba(217,164,65,0.18)', position: 'relative', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <Icon name="bolt" size={40} color={C.gold} />
              <Txt size={38} weight={700} color={C.gold}>{ui.autoReply}</Txt>
            </div>
            <Txt size={44} weight={600} style={{ whiteSpace: 'pre', display: 'block', lineHeight: 1.5 }}>{ui.reply}</Txt>
            <LightSweep p={ramp(t, 31.8, 0.9)} opacity={0.5} />
          </div>
        </div>
      )}
      <IconBadge name="chat" t={t} at={28.3} until={33.8} x={150} y={680} />
      <IconBadge name="bolt" t={t} at={30.7} until={33.8} x={930} y={680} />
    </AbsoluteFill>
  );
};

// ───────────────────────────── 5/7 reception → manager with a rack focus between glass cards (34–40)
const HANDOFF = tl.handoff;
const CARD = { w: 800, h: 690 };

const RECEPTION_MSGS: Msg[] = [
  { kind: 'typing', at: TY[1][0], until: TY[1][1], h: 90 },
  { kind: 'biz', text: ui.receptionHello, at: CH[2], h: 106 },
  { kind: 'client', text: ui.clientAsk, at: CH[3], h: 106 },
];
const MANAGER_MSGS: Msg[] = [
  { kind: 'client', text: ui.clientAsk, at: 0, h: 106 },
  { kind: 'system', text: ui.transferred, at: CH[4], h: 88 },
  { kind: 'typing', at: TY[2][0], until: TY[2][1], h: 90 },
  { kind: 'biz', text: ui.managerHello, at: CH[5], h: 106 },
];

export const MANAGER_CALL = { x: 0, y: 0 }; // filled per frame below (call icon on the manager card)

const GlassChat: React.FC<{ t: number; name: string; icon: IconName; from?: string; to?: string; msgs: Msg[]; callPulse?: number; morph?: { to: string; icon: IconName; p: number } }> = ({ t, name, icon, from, to, msgs, callPulse, morph }) => (
  <div style={{ position: 'relative', width: CARD.w, height: CARD.h, borderRadius: 48, ...glass(0.1), overflow: 'hidden', background: 'linear-gradient(160deg, rgba(24,44,66,0.92), rgba(11,23,38,0.94))' }}>
    {morph ? (
      <>
        <ChatHeader name={name} icon={icon} width={CARD.w} style={{ opacity: 1 - morph.p, transform: `translateX(${-morph.p * 120}px)`, filter: morph.p > 0 ? `blur(${morph.p * 6}px)` : undefined }} />
        <ChatHeader name={morph.to} icon={morph.icon} from={C.sky} to="#2f6f99" width={CARD.w} style={{ opacity: morph.p, transform: `translateX(${(1 - morph.p) * 120}px)`, filter: morph.p < 1 ? `blur(${(1 - morph.p) * 6}px)` : undefined }} />
      </>
    ) : (
      <ChatHeader name={name} icon={icon} from={from} to={to} width={CARD.w} callPulse={callPulse} />
    )}
    <Stack t={t} msgs={msgs} top={150} bottom={CARD.h - 40} left={34} right={34} size={40} />
  </div>
);

const F5Shot: React.FC<{ t: number }> = ({ t }) => {
  const rack = ramp(t, HANDOFF, 0.6, IN_OUT);
  const drift = Math.sin(t * 0.7) * 10;
  const pulse = t > 39.0 ? 0.5 + 0.5 * Math.sin((t - 39) * 9) : 0;
  const front = { x: lerp(rack, [0, 1], [0, -150]), y: lerp(rack, [0, 1], [0, -90]), s: lerp(rack, [0, 1], [1, 0.84]), blur: rack * 9, o: 1 - rack * 0.35 };
  const back = { x: lerp(rack, [0, 1], [150, 0]), y: lerp(rack, [0, 1], [-90, 0]), s: lerp(rack, [0, 1], [0.84, 1]), blur: (1 - rack) * 9, o: 0.65 + rack * 0.35 };
  const place = (p: { x: number; y: number; s: number; blur: number; o: number }, z: number): React.CSSProperties => ({
    position: 'absolute',
    left: 540 - CARD.w / 2 + p.x,
    top: 1030 - CARD.h / 2 + p.y + drift,
    zIndex: z,
    transform: `perspective(2200px) rotateY(${-6 + Math.sin(t * 0.5) * 3}deg) scale(${p.s})`,
    filter: p.blur > 0.1 ? `blur(${p.blur}px)` : undefined,
    opacity: p.o,
  });
  const morph = ramp(t, HANDOFF, 0.5);
  return (
    <AbsoluteFill>
      <Backdrop t={t} tint="rgba(95,183,229,0.22)" />
      <div style={place(back, rack > 0.5 ? 2 : 1)}>
        <GlassChat t={t} name={brief.f5Manager} icon="briefcase" from={C.sky} to="#2f6f99" msgs={MANAGER_MSGS} callPulse={pulse} />
      </div>
      <div style={place(front, rack > 0.5 ? 1 : 2)}>
        <GlassChat t={t} name={brief.f5Reception} icon="headset" msgs={RECEPTION_MSGS} morph={{ to: brief.f5Manager, icon: 'briefcase', p: morph }} />
      </div>
      <IconBadge name="handoff" t={t} at={34.3} until={39.8} x={150} y={600} />
    </AbsoluteFill>
  );
};

/** Frame position of the call icon on the manager card (for the iris into 6/7). */
export const managerCallPoint = (t: number) => ({ x: 540 - CARD.w / 2 + 26 + 33, y: 1030 - CARD.h / 2 + 64 + Math.sin(t * 0.7) * 10 });

// ───────────────────────────── 6/7 one-tap call with a slow-motion tap (40–44)
const SLOW_TAP = tl.taps[3];

export const f6Cam = (t: number): Cam => ({ y: 40, scale: 0.98 + 0.05 * ramp(t, 40, 3.7, (x) => x), ry: lerp(t, [40, 44], [10, -6]), rx: -4 });

const CallCard: React.FC<{ t: number }> = ({ t }) => {
  const calling = ramp(t, SLOW_TAP + 0.3, 0.3);
  const pulses = tl.callPulse.map((p) => (t >= p && t < p + 0.7 ? Math.sin(((t - p) / 0.7) * Math.PI) : 0));
  const pulse = Math.max(...pulses);
  const press = ramp(t, SLOW_TAP, 0.2) * (1 - ramp(t, SLOW_TAP + 0.3, 0.4));
  const btn = { y: 600, h: 128 };
  return (
    <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse 120% 70% at 50% 0%, #1b3550 0%, ${C.navy} 60%)` }}>
      <div style={{ position: 'absolute', left: SW / 2 - 92, top: 120, ...rise(t, 39.9) }}>
        <Avatar size={184} icon="building" />
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 330, textAlign: 'center', ...rise(t, 40.0) }}>
        <Txt size={54} weight={700} font={F.head}>{brief.office}</Txt>
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 404, textAlign: 'center', ...rise(t, 40.06) }}>
        <Txt size={38} color={C.muted}>{ui.officeNumber}</Txt>
      </div>
      {tl.callPulse.map((p, k) => {
        const q = ramp(t, p, 0.9, (x) => x);
        return q > 0 && q < 1 ? <div key={k} style={{ position: 'absolute', left: PAD, right: PAD, top: btn.y, height: btn.h, borderRadius: 44, border: `3px solid ${C.gold}`, opacity: (1 - q) * 0.8, transform: `scale(${1 + q * 0.16}, ${1 + q * 0.5})` }} /> : null;
      })}
      <div
        style={{
          position: 'absolute',
          left: PAD,
          right: PAD,
          top: btn.y,
          height: btn.h,
          borderRadius: 44,
          background: `linear-gradient(135deg, #f0c56a, ${C.gold} 55%, #b9822a)`,
          boxShadow: `0 24px 44px -16px rgba(217,164,65,0.9), 0 0 ${36 * pulse}px rgba(217,164,65,${0.7 * pulse})`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 18,
          direction: 'rtl',
          transform: `scale(${1 + pulse * 0.035 - press * 0.07})`,
          ...{ opacity: rise(t, 40.12).opacity },
        }}
      >
        <Icon name="phone" size={52} color={C.navy} stroke={2.2} style={{ transform: `rotate(${Math.sin(t * 28) * 9 * calling}deg)` }} />
        <div style={{ position: 'relative', width: 280, height: 62 }}>
          <div style={{ position: 'absolute', inset: 0, textAlign: 'center', opacity: 1 - calling }}>
            <Txt size={44} weight={700} color={C.navy}>{ui.callUs}</Txt>
          </div>
          <div style={{ position: 'absolute', inset: 0, textAlign: 'center', opacity: calling }}>
            <Txt size={42} weight={700} color={C.navy}>{ui.calling}</Txt>
          </div>
        </div>
      </div>
      <Tap t={t} at={SLOW_TAP} x={SW / 2} y={btn.y + btn.h / 2} slow={2.6} color={C.ivory} />
    </div>
  );
};

const F6Shot: React.FC<{ t: number }> = ({ t }) => (
  <AbsoluteFill>
    <Backdrop t={t} tint="rgba(217,164,65,0.2)" />
    <Phone cam={f6Cam(t)} glow={0.55}>
      <CallCard t={t} />
    </Phone>
    <IconBadge name="phone" t={t} at={40.3} until={43.75} x={930} y={640} />
  </AbsoluteFill>
);

/** Picture for 28–44 s (the vertical whip at 28.0 is handled in VideoA). */
export const Part4Picture: React.FC<{ t: number }> = ({ t }) => {
  // 34.0 rack-focus dissolve: F4 defocuses while the glass cards come into focus
  if (t < 33.75) return <F4Shot t={t} />;
  if (t < 34.25) {
    const p = ramp(t, 33.75, 0.5, IN_OUT);
    return (
      <AbsoluteFill>
        <AbsoluteFill style={{ filter: `blur(${p * 18}px)`, opacity: 1 - p }}>
          <F4Shot t={t} />
        </AbsoluteFill>
        <AbsoluteFill style={{ filter: `blur(${(1 - p) * 18}px)`, opacity: p }}>
          <F5Shot t={t} />
        </AbsoluteFill>
      </AbsoluteFill>
    );
  }
  // 40.0 iris from the manager card's call button into 6/7
  if (t < 39.82) return <F5Shot t={t} />;
  if (t < 40.25) {
    const p = ramp(t, 39.82, 0.43, IN_OUT);
    const c = managerCallPoint(t);
    return (
      <AbsoluteFill>
        <F5Shot t={t} />
        <AbsoluteFill style={{ clipPath: `circle(${20 + p * 1550}px at ${c.x}px ${c.y}px)` }}>
          <F6Shot t={t} />
        </AbsoluteFill>
      </AbsoluteFill>
    );
  }
  return <F6Shot t={t} />;
};

export { W, screenToFrame };
