// Video B — "Behind the Edit": a generic dark editing interface (HS Studio) with the finished ad in the
// program monitor (frame-synced), a multi-track timeline, audio meters driven by the real mix, and
// an effect-controls strip with animated keyframe values. A camera glides over the interface.
import React from 'react';
import { AbsoluteFill, OffthreadVideo, staticFile, useCurrentFrame } from 'remotion';
import '../fonts';
import { HEADLINES } from '../headlines';
import tl from '../timeline.json';
import { studio } from '../texts';
import { C, F, FPS, IN_OUT, W, lerp, ramp } from '../theme';
import { Logo } from '../ui/Logo';
import levels from './levels.json';
import waves from './waves.json';

const BG = '#0d1117';
const PANEL = '#151b24';
const LINE = '#232c38';
const TXT = '#c9d3df';
const DIM = '#7d8a99';
const ACCENT = C.gold;
const SANS = "'Manrope', 'IBM Plex Sans Arabic', sans-serif";
const DUR = tl.duration;

// layout (all inside the safe area)
const TITLE = { y: 254, h: 46 };
const MON = { x: 60, y: 308, w: 960, h: 600 };
const VID = { w: 316, h: 562 };
const TLN = { x: 60, y: 918, w: 960, h: 352 };
const HEAD_W = 176;
const X0 = TLN.x + HEAD_W;
const XW = TLN.w - HEAD_W - 8;
const px = (s: number) => X0 + (s / DUR) * XW;
const BOT = { y: 1280, h: 212 };

type Clip = { a: number; b: number; label: string; color: string; thumb?: string; keys?: number[]; ramp?: boolean };

const scene = (id: string) => tl.scenes.find((s) => s.id === id)!;
const SCENE_COLORS: Record<string, string> = { hook: '#3b5b8c', hook2: '#5a4a7a', turn: '#2c2c3c', reveal: '#8c6a2c', f1: '#2c7a72', f2: '#2c6a8c', f3: '#7a5a2c', f4: '#2c7a72', f5: '#2c6a8c', f6: '#7a5a2c', f7: '#2c7a72', offer: '#8c6a2c', cta: '#8c3b33', loop: '#3b5b8c' };

const V1: Clip[] = tl.scenes.map((s) => ({ a: s.start, b: s.end, label: s.name, color: SCENE_COLORS[s.id], thumb: `studio/thumbs/${s.id}.jpg` }));
const V2: Clip[] = [
  { a: 0, b: 3, label: 'Night city 3D', color: '#4a6aa0', keys: [0.2, 1.4, 2.8] },
  { a: 18.1, b: 20.7, label: 'Globe 3D', color: '#4a6aa0', keys: [18.2, 19.3, 20.3], ramp: true },
  { a: 43.75, b: 45.4, label: 'Tower crane', color: '#4a6aa0', keys: [43.8, 45.3] },
  { a: 49.95, b: 51.2, label: 'Jet flyby', color: '#4a6aa0', keys: [50.0, 51.1] },
  { a: 59.5, b: 60, label: 'Night city', color: '#4a6aa0' },
];
const V3: Clip[] = [
  { a: 0, b: 5.5, label: 'Phone · call', color: '#2f8a7f', keys: [0.3, 2.5, 4.6] },
  { a: 8.4, b: 12, label: 'Phone · home', color: '#2f8a7f', keys: [8.5, 10.4, 11.6] },
  { a: 12, b: 17, label: 'Schedule', color: '#2f8a7f', keys: [12.4, 14.4, 15.7] },
  { a: 17, b: 18.1, label: 'Booking', color: '#2f8a7f', keys: [17.9] },
  { a: 20.4, b: 23, label: 'Boarding pass', color: '#2f8a7f', keys: [20.5, 21.0, 21.6] },
  { a: 23, b: 28, label: 'Capacity ring', color: '#2f8a7f', keys: [24.6, 26.0, 26.6] },
  { a: 28, b: 34, label: 'Chat · auto reply', color: '#2f8a7f', keys: [29.0, 30.4, 31.45, 33.6] },
  { a: 34, b: 40, label: 'Reception → manager', color: '#2f8a7f', keys: [34.8, 37.0, 38.4] },
  { a: 40, b: 44, label: 'Call card', color: '#2f8a7f', keys: [40.5, 42.0, 43.0], ramp: true },
  { a: 44.8, b: 50, label: 'Dashboard', color: '#2f8a7f', keys: [45.0, 46.2, 47.4, 48.0] },
  { a: 50.8, b: 55, label: 'Graph + price', color: '#2f8a7f', keys: [51.0, 52.6, 53.0] },
  { a: 55, b: 59.5, label: 'HS logo + CTA', color: '#2f8a7f', keys: [55.05, 56.2, 57.0] },
];
const V4: Clip[] = HEADLINES.map((h) => ({ a: h.start, b: h.end, label: h.text.split(' ').slice(0, 2).join(' '), color: '#9a6fb0' }));
const V5: Clip[] = [
  { a: 0, b: 60, label: 'Grain 2.5% · Vignette · Grade', color: '#555f6e' },
  { a: 6.0, b: 7.4, label: 'Flare', color: '#b08a3c' },
  { a: 22.7, b: 23.45, label: 'Leak', color: '#b0703c' },
  { a: 54.7, b: 55.5, label: 'Leak', color: '#b0703c' },
];

const TRACKS: { id: keyof typeof studio.tracks; kind: 'v' | 'a'; h: number }[] = [
  { id: 'V5', kind: 'v', h: 26 },
  { id: 'V4', kind: 'v', h: 30 },
  { id: 'V3', kind: 'v', h: 34 },
  { id: 'V2', kind: 'v', h: 34 },
  { id: 'V1', kind: 'v', h: 46 },
  { id: 'A1', kind: 'a', h: 40 },
  { id: 'A2', kind: 'a', h: 34 },
  { id: 'A3', kind: 'a', h: 30 },
  { id: 'A4', kind: 'a', h: 26 },
];
const RULER_H = 30;
const trackY = (() => {
  let y = TLN.y + RULER_H + 8;
  const out: Record<string, number> = {};
  for (const tr of TRACKS) {
    out[tr.id] = y;
    y += tr.h + 2;
  }
  return out;
})();

const SFX_EVENTS = [...tl.ticks, tl.door, ...tl.shimmer, ...tl.counter, ...tl.tonalHit, ...tl.taps, tl.ticket, ...tl.chat, tl.handoff, ...tl.callPulse, ...tl.dataBuild, ...tl.ctaPulse].sort((a, b) => a - b);
const IMPACTS = [tl.boom, tl.braam, tl.impact, ...tl.jet, tl.finalHit];

const tc = (t: number) => {
  const f = Math.min(DUR * FPS - 1, Math.round(t * FPS));
  const s = Math.floor(f / FPS);
  return `00:00:${String(s).padStart(2, '0')}:${String(f % FPS).padStart(2, '0')}`;
};

const Toggle: React.FC<{ ch: string; on?: boolean }> = ({ ch, on }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 18, height: 16, borderRadius: 3, border: `1px solid ${on ? ACCENT : '#3a4552'}`, color: on ? ACCENT : DIM, fontFamily: SANS, fontSize: 10, fontWeight: 800 }}>{ch}</span>
);

const ClipBox: React.FC<{ c: Clip; y: number; h: number; t: number; kind: 'v' | 'a'; wave?: number[] }> = ({ c, y, h, t, kind, wave }) => {
  const x = px(c.a);
  const w = Math.max(3, px(c.b) - px(c.a) - 1);
  const active = t >= c.a && t < c.b;
  return (
    <div style={{ position: 'absolute', left: x, top: y, width: w, height: h, borderRadius: 3, background: c.color, boxShadow: active ? '0 0 0 1.5px #fff' : 'inset 0 0 0 1px rgba(0,0,0,0.4)', overflow: 'hidden', opacity: active ? 1 : 0.85 }}>
      {c.thumb && w > 18 && <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: Math.min(w, h * 0.56 * 1), backgroundImage: `url(${staticFile(c.thumb)})`, backgroundSize: 'cover', backgroundPosition: 'center', opacity: 0.9 }} />}
      {w > 30 && <span style={{ position: 'absolute', left: c.thumb ? Math.min(w, h * 0.56) + 3 : 3, top: 1, fontFamily: SANS, fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.92)', whiteSpace: 'nowrap', direction: 'ltr' }}>{c.label}</span>}
      {c.keys?.map((k, i) => (
        <div key={i} style={{ position: 'absolute', left: px(k) - x - 3, bottom: 3, width: 6, height: 6, transform: 'rotate(45deg)', background: t >= k ? '#ffd27a' : 'rgba(255,255,255,0.7)' }} />
      ))}
      {c.ramp && (
        <svg width={w} height={h} style={{ position: 'absolute', inset: 0 }}>
          <path d={`M0 ${h * 0.25} C ${w * 0.3} ${h * 0.25}, ${w * 0.35} ${h * 0.8}, ${w * 0.6} ${h * 0.8} S ${w} ${h * 0.45}, ${w} ${h * 0.45}`} stroke="#fff" strokeWidth={1.4} fill="none" opacity={0.85} />
        </svg>
      )}
      {kind === 'a' && wave && (
        <svg width={w} height={h} style={{ position: 'absolute', inset: 0 }}>
          {wave.map((v, i) => {
            const sx = (i / wave.length) * XW + X0 - x;
            if (sx < 0 || sx > w) return null;
            const hh = Math.max(1, Math.min(1, v * 1.4) * (h - 6));
            return <rect key={i} x={sx} y={h / 2 - hh / 2} width={0.9} height={hh} fill="rgba(5,20,15,0.65)" />;
          })}
        </svg>
      )}
    </div>
  );
};

const Meter: React.FC<{ db: number; label: string; h: number }> = ({ db, label, h }) => {
  const v = Math.max(0, Math.min(1, (db + 60) / 60));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <div style={{ position: 'relative', width: 16, height: h, borderRadius: 3, background: '#0a0e14', overflow: 'hidden', border: '1px solid #232c38' }}>
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: `${v * 100}%`, background: 'linear-gradient(0deg, #2ec27e 0%, #2ec27e 65%, #e6c14a 82%, #e04b4b 100%)', backgroundSize: `100% ${h}px`, backgroundPosition: 'bottom' }} />
      </div>
      <span style={{ fontFamily: SANS, fontSize: 11, fontWeight: 700, color: DIM }}>{label}</span>
    </div>
  );
};

// Camera over the interface: close on the playhead → pull back → push into the monitor at 7.0 s →
// glide along the audio tracks → wide shot at the CTA.
const camera = (t: number) => {
  const head = px(t);
  const keys: { at: number; s: number; cx: number; cy: number }[] = [
    { at: 0, s: 2.3, cx: head, cy: TLN.y + 120 },
    { at: 2.6, s: 2.0, cx: head, cy: TLN.y + 130 },
    { at: 5.2, s: 1.0, cx: 540, cy: 960 },
    { at: 6.6, s: 1.0, cx: 540, cy: 960 },
    { at: 7.6, s: 1.55, cx: 540, cy: MON.y + MON.h / 2 },
    { at: 15.5, s: 1.45, cx: 540, cy: MON.y + MON.h / 2 + 20 },
    { at: 18.0, s: 1.05, cx: 540, cy: 900 },
    { at: 26.0, s: 1.1, cx: 560, cy: 960 },
    { at: 29.0, s: 1.9, cx: head, cy: trackY.A2 },
    { at: 38.0, s: 1.9, cx: head, cy: trackY.A3 },
    { at: 41.0, s: 1.2, cx: 540, cy: 1000 },
    { at: 49.0, s: 1.35, cx: 540, cy: MON.y + MON.h / 2 },
    { at: 54.4, s: 1.0, cx: 540, cy: 960 },
    { at: 60, s: 1.0, cx: 540, cy: 960 },
  ];
  let i = 0;
  while (i < keys.length - 2 && t >= keys[i + 1].at) i++;
  const a = keys[i];
  const b = keys[i + 1];
  const p = IN_OUT(Math.max(0, Math.min(1, (t - a.at) / (b.at - a.at))));
  // keep the playhead target live while gliding along tracks
  const cx = lerp(p, [0, 1], [a.cx, b.cx]);
  const cy = lerp(p, [0, 1], [a.cy, b.cy]);
  const s = lerp(p, [0, 1], [a.s, b.s]);
  const tx = Math.max(Math.min(540 - cx * s + 540 * (s - 1) + (cx - 540) * 0, 0), 0);
  return { s, cx: Math.min(Math.max(cx, 540 / s), W - 540 / s), cy: Math.min(Math.max(cy, 960 / s), 1920 - 960 / s), tx };
};

export const Studio: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const head = px(t);
  const cam = camera(t);
  const lv = (k: keyof typeof levels) => (levels[k] as number[])[Math.min(frame, (levels[k] as number[]).length - 1)] ?? -90;
  const effScale = 100 + 6 * Math.sin(t * 0.7) + (t > 7 && t < 8 ? 20 * (1 - ramp(t, 7, 1)) : 0);
  const effPosY = Math.round(960 + 40 * Math.sin(t * 0.45));
  const effBlur = t > 33.75 && t < 34.25 ? 18 * Math.sin(ramp(t, 33.75, 0.5) * Math.PI) : 0;
  const effOpacity = Math.round(100 * (t > 59.5 ? 1 - ramp(t, 59.5, 0.4) : 1));
  const props: [string, string, number[]][] = [
    ['Scale', `${effScale.toFixed(1)} %`, [7.0, 12.0, 17.0, 28.0]],
    ['Position Y', `${effPosY}`, [3.0, 18.1, 44.0, 50.0]],
    ['Blur', `${effBlur.toFixed(1)}`, [33.75, 34.25]],
    ['Opacity', `${effOpacity} %`, [54.8, 59.5]],
  ];
  return (
    <AbsoluteFill style={{ background: '#05070a', overflow: 'hidden' }}>
      <AbsoluteFill style={{ transformOrigin: '0 0', transform: `translate(${540 - cam.cx * cam.s}px, ${960 - cam.cy * cam.s}px) scale(${cam.s})` }}>
        <AbsoluteFill style={{ background: BG }} />
        {/* title bar */}
        <div style={{ position: 'absolute', left: 60, right: 60, top: TITLE.y, height: TITLE.h, display: 'flex', alignItems: 'center', gap: 14, direction: 'ltr', borderBottom: `1px solid ${LINE}` }}>
          <div style={{ transform: 'scale(0.22)', transformOrigin: 'left center', width: 66, height: 46, display: 'flex', alignItems: 'center' }}>
            <Logo t={10} start={0} size={150} />
          </div>
          <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: 22, color: '#fff', marginLeft: 46 }}>{studio.title}</span>
          <span style={{ fontFamily: SANS, fontSize: 16, color: DIM }}>— {studio.project}</span>
          <span style={{ marginLeft: 'auto', fontFamily: SANS, fontSize: 14, color: DIM }}>1080 × 1920 · 60 fps</span>
        </div>
        {/* program monitor */}
        <div style={{ position: 'absolute', left: MON.x, top: MON.y, width: MON.w, height: MON.h, background: PANEL, borderRadius: 10, border: `1px solid ${LINE}` }} />
        <div style={{ position: 'absolute', left: MON.x + 14, top: MON.y + 10, fontFamily: SANS, fontSize: 14, fontWeight: 700, color: DIM, direction: 'ltr' }}>PROGRAM</div>
        <div style={{ position: 'absolute', left: 540 - VID.w / 2, top: MON.y + 18, width: VID.w, height: VID.h, background: '#000', overflow: 'hidden', borderRadius: 4, boxShadow: '0 0 0 1px #2a3442' }}>
          <OffthreadVideo src={staticFile('studio/videoA.mp4')} muted style={{ width: VID.w, height: VID.h }} />
        </div>
        <div style={{ position: 'absolute', left: MON.x + 18, top: MON.y + 260, fontFamily: SANS, fontSize: 30, fontWeight: 800, color: ACCENT, direction: 'ltr' }}>{tc(t)}</div>
        <div style={{ position: 'absolute', left: MON.x + 18, top: MON.y + 302, fontFamily: SANS, fontSize: 15, color: DIM, direction: 'ltr' }}>{(tl.scenes.find((s) => t >= s.start && t < s.end) ?? tl.scenes[0]).name}</div>
        <div style={{ position: 'absolute', right: MON.x + 18, top: MON.y + 260, textAlign: 'right', direction: 'ltr' }}>
          <div style={{ fontFamily: SANS, fontSize: 14, color: DIM }}>Next transition</div>
          <div style={{ fontFamily: SANS, fontSize: 18, fontWeight: 700, color: TXT }}>{(tl.transitions.find((x) => x.at > t) ?? tl.transitions[tl.transitions.length - 1]).type}</div>
        </div>
        {/* timeline panel */}
        <div style={{ position: 'absolute', left: TLN.x, top: TLN.y, width: TLN.w, height: TLN.h, background: PANEL, borderRadius: 10, border: `1px solid ${LINE}` }} />
        {Array.from({ length: 13 }).map((_, i) => (
          <React.Fragment key={i}>
            <div style={{ position: 'absolute', left: px(i * 5), top: TLN.y + 16, width: 1, height: 14, background: '#4a5563' }} />
            {i % 2 === 0 && <div style={{ position: 'absolute', left: px(i * 5) + 3, top: TLN.y + 3, fontFamily: SANS, fontSize: 10, color: DIM, direction: 'ltr' }}>{`00:00:${String(i * 5).padStart(2, '0')}:00`}</div>}
          </React.Fragment>
        ))}
        {Array.from({ length: 61 }).map((_, i) => (i % 5 ? <div key={`m${i}`} style={{ position: 'absolute', left: px(i), top: TLN.y + 23, width: 1, height: 7, background: '#323c49' }} /> : null))}
        {/* markers */}
        {[
          [0, studio.markers.hook],
          [7, studio.markers.reveal],
          [55, studio.markers.cta],
        ].map(([at, name]) => (
          <div key={String(name)} style={{ position: 'absolute', left: px(Number(at)), top: TLN.y + 2, display: 'flex', alignItems: 'center', gap: 3, direction: 'ltr' }}>
            <div style={{ width: 10, height: 12, background: ACCENT, clipPath: 'polygon(0 0, 100% 0, 100% 70%, 50% 100%, 0 70%)' }} />
            <span style={{ fontFamily: SANS, fontSize: 10, fontWeight: 800, color: ACCENT }}>{name}</span>
          </div>
        ))}
        {TRACKS.map((tr) => (
          <React.Fragment key={tr.id}>
            <div style={{ position: 'absolute', left: TLN.x + 6, top: trackY[tr.id], width: HEAD_W - 12, height: tr.h, background: '#1b222d', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 4, padding: '0 5px', boxSizing: 'border-box', direction: 'ltr', overflow: 'hidden' }}>
              <span style={{ fontFamily: SANS, fontSize: 11, fontWeight: 800, color: tr.kind === 'v' ? '#9cc1ff' : '#7fe0b0', width: 20 }}>{tr.id}</span>
              <span style={{ fontFamily: SANS, fontSize: 9.5, color: TXT, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{studio.tracks[tr.id]}</span>
              {tr.kind === 'v' ? <Toggle ch="◉" on /> : <><Toggle ch="M" /><Toggle ch="S" on={tr.id === 'A1' && t > 50} /></>}
              <Toggle ch="L" />
            </div>
            <div style={{ position: 'absolute', left: X0, top: trackY[tr.id], width: XW, height: tr.h, background: '#10151d', borderTop: `1px solid ${LINE}` }} />
          </React.Fragment>
        ))}
        {V5.map((c, i) => <ClipBox key={`5${i}`} c={c} y={trackY.V5} h={26} t={t} kind="v" />)}
        {V4.map((c, i) => <ClipBox key={`4${i}`} c={c} y={trackY.V4} h={30} t={t} kind="v" />)}
        {V3.map((c, i) => <ClipBox key={`3${i}`} c={c} y={trackY.V3} h={34} t={t} kind="v" />)}
        {V2.map((c, i) => <ClipBox key={`2${i}`} c={c} y={trackY.V2} h={34} t={t} kind="v" />)}
        {V1.map((c, i) => <ClipBox key={`1${i}`} c={c} y={trackY.V1} h={46} t={t} kind="v" />)}
        {/* transition handles on V1 */}
        {tl.transitions.map((x, i) => (
          <div key={`tr${i}`} style={{ position: 'absolute', left: px(x.at) - 4, top: trackY.V1 + 2, width: 8, height: 42, borderRadius: 2, background: 'repeating-linear-gradient(135deg, #fff 0 2px, #8a96a6 2px 4px)', opacity: 0.9 }} />
        ))}
        <ClipBox c={{ a: 0, b: 60, label: 'score.wav', color: '#2f8a5f' }} y={trackY.A1} h={40} t={t} kind="a" wave={waves.A1 as number[]} />
        {SFX_EVENTS.map((s, i) => <ClipBox key={`a2${i}`} c={{ a: s, b: s + 0.45, label: '', color: '#3a9a6a' }} y={trackY.A2} h={34} t={t} kind="a" wave={waves.A2 as number[]} />)}
        {IMPACTS.map((s, i) => <ClipBox key={`a3${i}`} c={{ a: s - 0.1, b: s + 2.4, label: 'impact', color: '#9a6a3a' }} y={trackY.A3} h={30} t={t} kind="a" wave={waves.A3 as number[]} />)}
        {tl.whoosh.map((s, i) => <ClipBox key={`a4${i}`} c={{ a: s - 0.48, b: s + 0.35, label: '', color: '#3a7a9a' }} y={trackY.A4} h={26} t={t} kind="a" wave={waves.A4 as number[]} />)}
        {/* playhead */}
        <div style={{ position: 'absolute', left: head - 1, top: TLN.y + 8, width: 2, height: TLN.h - 16, background: '#ff5f57', boxShadow: '0 0 8px rgba(255,95,87,0.7)' }} />
        <div style={{ position: 'absolute', left: head - 7, top: TLN.y + 2, width: 14, height: 12, background: '#ff5f57', clipPath: 'polygon(0 0, 100% 0, 100% 55%, 50% 100%, 0 55%)' }} />
        {/* bottom strip: meters + effect controls */}
        <div style={{ position: 'absolute', left: 60, top: BOT.y, width: 960, height: BOT.h, background: PANEL, borderRadius: 10, border: `1px solid ${LINE}` }} />
        <div style={{ position: 'absolute', left: 78, top: BOT.y + 12, display: 'flex', gap: 10, alignItems: 'flex-end', direction: 'ltr' }}>
          <Meter db={lv('L')} label="L" h={160} />
          <Meter db={lv('R')} label="R" h={160} />
          <div style={{ width: 10 }} />
          {(['A1', 'A2', 'A3', 'A4'] as const).map((k) => (
            <Meter key={k} db={lv(k)} label={k} h={160} />
          ))}
        </div>
        <div style={{ position: 'absolute', left: 300, top: BOT.y + 12, right: 78, direction: 'ltr' }}>
          <div style={{ fontFamily: SANS, fontSize: 14, fontWeight: 800, color: DIM, marginBottom: 8 }}>EFFECT CONTROLS · V3</div>
          {props.map(([name, val, keys]) => (
            <div key={name} style={{ position: 'relative', height: 40, display: 'flex', alignItems: 'center', borderTop: `1px solid ${LINE}` }}>
              <span style={{ fontFamily: SANS, fontSize: 15, color: TXT, width: 110 }}>{name}</span>
              <span style={{ fontFamily: SANS, fontSize: 15, fontWeight: 800, color: '#7fb8ff', width: 100 }}>{val}</span>
              <div style={{ position: 'relative', flex: 1, height: 2, background: '#2a3442' }}>
                {keys.map((k, i) => (
                  <div key={i} style={{ position: 'absolute', left: `${(k / DUR) * 100}%`, top: -5, width: 10, height: 10, marginLeft: -5, transform: 'rotate(45deg)', background: t >= k ? ACCENT : '#5a6675' }} />
                ))}
                <div style={{ position: 'absolute', left: `${(t / DUR) * 100}%`, top: -12, width: 2, height: 26, background: '#ff5f57' }} />
              </div>
            </div>
          ))}
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 50%, rgba(0,0,0,0) 60%, rgba(0,0,0,0.55) 100%)', pointerEvents: 'none' }} />
    </AbsoluteFill>
  );
};

export { F };
