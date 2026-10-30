// Private test version: the top half mimics an Adobe Premiere Pro timeline (not for publishing).
// The finished ad is composited into SLOT afterwards with ffmpeg (finish-split.sh).
import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import '../fonts';
import tl from '../timeline.json';
import { brief, split } from '../texts';
import { F, FPS } from '../theme';
import { SLOT } from './Split';
import wave from './wave.json';

const BG = '#151515';
const PANEL_BG = '#1d1d1d';
const LINE = '#2c2c2c';
const TEXT = '#c8c8c8';
const DIM = '#8a8a8a';
const BLUE = '#2d8ceb';
const YELLOW = '#e6c14a';
const VIOLET = '#9a8ad8';
const ROSE = '#d77fb6';
const GREEN = '#3fae8e';
const SANS = "'Manrope', 'IBM Plex Sans Arabic', sans-serif";

const P = { x: 24, y: 60, w: 1032, h: 612 };
const HEAD_W = 150; // track header column
const X0 = P.x + HEAD_W + 8;
const XW = P.w - HEAD_W - 24;
const DUR = tl.duration;
const px = (s: number) => X0 + (s / DUR) * XW;

const TRACKS = [
  { id: 'V2', kind: 'v', y: 268, h: 58 },
  { id: 'V1', kind: 'v', y: 332, h: 78 },
  { id: 'A1', kind: 'a', y: 430, h: 92 },
  { id: 'A2', kind: 'a', y: 528, h: 62 },
] as const;

const tc = (t: number) => {
  const f = Math.min(DUR * FPS - 1, Math.round(t * FPS));
  const s = Math.floor(f / FPS);
  const fr = f % FPS;
  return `00:00:${String(s).padStart(2, '0')}:${String(fr).padStart(2, '0')}`;
};

// Headline clips on V2 (same windows as in the ad).
const TITLES: { a: number; b: number; text: string }[] = [
  { a: 0, b: 3, text: brief.hook },
  { a: 3.05, b: 6.05, text: brief.hook2 },
  { a: 6.05, b: 8.6, text: brief.clinic24 },
  { a: 8.65, b: 11.85, text: brief.reveal },
  { a: 12.1, b: 17.75, text: brief.f1 },
  { a: 18.1, b: 23.8, text: brief.f2 },
  { a: 24.1, b: 29.4, text: brief.f3 },
  { a: 29.05, b: 34.8, text: brief.f4 },
  { a: 35.05, b: 40.8, text: brief.f5 },
  { a: 41.1, b: 44.75, text: brief.f6 },
  { a: 45.15, b: 51.4, text: brief.f7 },
  { a: 50.95, b: 55.85, text: brief.offer },
  { a: 56.0, b: 60, text: brief.cta },
];

const SFX_TIMES = [
  ...tl.heartbeat, ...tl.ring.slice(0, 1), tl.busy[0], tl.clockSpin[0], tl.riser[0], tl.bloom, ...tl.shimmer, ...tl.taps,
  ...tl.whoosh.map((w) => w - 0.2), ...tl.days, tl.chime, ...tl.counter, tl.full, ...tl.bubbles, ...tl.typing.map((x) => x[0]),
  tl.handoff - 0.48, ...tl.callPulse, ...tl.dashboard, tl.graph[0], ...tl.ctaPulse,
].sort((a, b) => a - b);

const Eye: React.FC = () => (
  <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={DIM} strokeWidth={2}>
    <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z" />
    <circle cx={12} cy={12} r={3} />
  </svg>
);
const Lock: React.FC = () => (
  <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={DIM} strokeWidth={2}>
    <rect x={5} y={11} width={14} height={10} rx={2} />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </svg>
);

const Clip: React.FC<{ a: number; b: number; y: number; h: number; color: string; label?: string; rtl?: boolean; fx?: boolean; children?: React.ReactNode; active?: boolean }> = ({ a, b, y, h, color, label, rtl, fx, children, active }) => (
  <div
    style={{
      position: 'absolute',
      left: px(a) + 1,
      top: y + 3,
      width: Math.max(4, px(b) - px(a) - 2),
      height: h - 6,
      borderRadius: 3,
      background: color,
      opacity: active === false ? 0.82 : 1,
      boxShadow: active ? 'inset 0 0 0 2px #fff' : 'inset 0 0 0 1px rgba(0,0,0,0.35)',
      overflow: 'hidden',
    }}
  >
    <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 20, background: 'rgba(0,0,0,0.18)', display: 'flex', alignItems: 'center', gap: 4, padding: '0 5px', direction: rtl ? 'rtl' : 'ltr' }}>
      {fx && <span style={{ fontFamily: SANS, fontSize: 13, fontWeight: 800, color: '#ffe36e', direction: 'ltr' }}>fx</span>}
      {label && <span style={{ fontFamily: rtl ? F.body : SANS, fontSize: 15, fontWeight: 600, color: '#111', whiteSpace: 'nowrap' }}>{label}</span>}
    </div>
    {children}
  </div>
);

export const Premiere: React.FC = () => {
  const t = useCurrentFrame() / FPS;
  const head = px(t);
  const sceneIdx = Math.max(0, tl.scenes.findIndex((s) => t >= s.start && t < s.end));
  const curTitle = TITLES.filter((c) => t >= c.a && t < c.b).pop();

  return (
    <AbsoluteFill style={{ background: BG, overflow: 'hidden' }}>
      {/* app title bar */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 52, background: '#0f0f0f', borderBottom: `1px solid ${LINE}`, display: 'flex', alignItems: 'center', gap: 14, padding: '0 22px', direction: 'ltr' }}>
        <div style={{ width: 34, height: 34, borderRadius: 7, background: '#00005b', border: '2px solid #9999ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: 17, color: '#9999ff', letterSpacing: '-0.02em' }}>Pr</span>
        </div>
        <span style={{ fontFamily: SANS, fontSize: 19, fontWeight: 600, color: TEXT }}>Adobe Premiere Pro</span>
        <span style={{ fontFamily: SANS, fontSize: 17, color: DIM }}>— HS_Clinic_Ad.prproj</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
          {['#5a5a5a', '#5a5a5a', '#c94f4f'].map((c, i) => (
            <div key={i} style={{ width: 13, height: 13, borderRadius: '50%', background: c }} />
          ))}
        </div>
      </div>

      {/* timeline panel */}
      <div style={{ position: 'absolute', left: P.x, top: P.y + 8, width: P.w, height: P.h, background: PANEL_BG, borderRadius: 8, border: `1px solid ${LINE}` }} />
      {/* panel tab */}
      <div style={{ position: 'absolute', left: P.x + 16, top: P.y + 18, display: 'flex', alignItems: 'center', gap: 10, direction: 'ltr' }}>
        <span style={{ fontFamily: SANS, fontSize: 18, color: DIM }}>×</span>
        <span style={{ fontFamily: SANS, fontSize: 20, fontWeight: 700, color: '#e8e8e8' }}>HS_Clinic_Ad</span>
        <span style={{ fontFamily: SANS, fontSize: 20, color: DIM }}>≡</span>
      </div>
      <div style={{ position: 'absolute', left: P.x + 16, top: P.y + 48, width: 210, height: 3, background: BLUE, borderRadius: 2 }} />

      {/* current time + sequence info */}
      <div style={{ position: 'absolute', left: P.x + 16, top: P.y + 62, fontFamily: SANS, fontSize: 40, fontWeight: 700, color: YELLOW, letterSpacing: '0.02em', direction: 'ltr' }}>{tc(t)}</div>
      <div dir="rtl" style={{ position: 'absolute', right: P.x + 22, top: P.y + 66, textAlign: 'right' }}>
        <div style={{ fontFamily: F.head, fontWeight: 600, fontSize: 30, color: '#fff' }}>
          {split.scene} {sceneIdx + 1}: {split.sceneNames[sceneIdx]}
        </div>
      </div>
      <div style={{ position: 'absolute', left: P.x + 18, top: P.y + 118, fontFamily: SANS, fontSize: 16, color: DIM, direction: 'ltr' }}>1080 × 1920 · 60 fps · Rec.709</div>

      {/* ruler */}
      <div style={{ position: 'absolute', left: X0, top: 208, width: XW, height: 44, borderBottom: `1px solid ${LINE}` }} />
      {Array.from({ length: 61 }).map((_, i) => (
        <div key={i} style={{ position: 'absolute', left: px(i), top: i % 10 === 0 ? 230 : i % 5 === 0 ? 238 : 244, width: 1, height: i % 10 === 0 ? 22 : i % 5 === 0 ? 14 : 8, background: i % 5 === 0 ? '#777' : '#4a4a4a' }} />
      ))}
      {[0, 10, 20, 30, 40, 50].map((s) => (
        <div key={s} style={{ position: 'absolute', left: px(s) + 4, top: 210, fontFamily: SANS, fontSize: 14, color: DIM, direction: 'ltr' }}>{`00:00:${String(s).padStart(2, '0')}:00`}</div>
      ))}

      {/* track headers + lanes */}
      {TRACKS.map((tr) => (
        <React.Fragment key={tr.id}>
          <div style={{ position: 'absolute', left: P.x + 8, top: tr.y, width: HEAD_W - 8, height: tr.h, background: '#232323', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 8, padding: '0 8px', boxSizing: 'border-box', direction: 'ltr' }}>
            <div style={{ width: 30, height: 24, borderRadius: 3, background: tr.id === 'V1' || tr.id === 'A1' ? BLUE : '#3a3a3a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontFamily: SANS, fontSize: 14, fontWeight: 700, color: '#fff' }}>{tr.id}</span>
            </div>
            <Lock />
            {tr.kind === 'v' ? (
              <Eye />
            ) : (
              <>
                <span style={{ fontFamily: SANS, fontSize: 14, fontWeight: 700, color: DIM, border: `1px solid #555`, borderRadius: 3, padding: '0 4px' }}>M</span>
                <span style={{ fontFamily: SANS, fontSize: 14, fontWeight: 700, color: DIM, border: `1px solid #555`, borderRadius: 3, padding: '0 4px' }}>S</span>
              </>
            )}
          </div>
          <div style={{ position: 'absolute', left: X0, top: tr.y, width: XW, height: tr.h, background: '#1a1a1a', borderTop: `1px solid ${LINE}`, borderBottom: `1px solid ${LINE}` }} />
        </React.Fragment>
      ))}

      {/* V2: headline titles */}
      {TITLES.map((c, i) => (
        <Clip key={i} a={c.a} b={c.b} y={TRACKS[0].y} h={TRACKS[0].h} color={ROSE} label={c.text.split(' ')[0]} rtl active={curTitle === c} />
      ))}

      {/* V1: scenes */}
      {tl.scenes.map((s, i) => (
        <Clip key={s.id} a={s.start} b={s.end} y={TRACKS[1].y} h={TRACKS[1].h} color={VIOLET} label={split.sceneNames[i]} rtl fx active={i === sceneIdx}>
          <div style={{ position: 'absolute', left: 4, right: 4, top: 26, bottom: 6, borderRadius: 2, background: 'repeating-linear-gradient(90deg, rgba(255,255,255,0.18) 0 34px, rgba(255,255,255,0.06) 34px 38px)' }} />
        </Clip>
      ))}
      {/* transitions on the cuts */}
      {split.transitions.map((x, i) => (
        <div key={i} style={{ position: 'absolute', left: px(x.at) - 9, top: TRACKS[1].y + 4, width: 18, height: 22, borderRadius: 2, background: 'repeating-linear-gradient(135deg, #e9e2ff 0 3px, #a99ce8 3px 6px)', boxShadow: '0 0 0 1px rgba(0,0,0,0.5)' }} />
      ))}

      {/* A1: music with waveform */}
      <Clip a={0} b={60} y={TRACKS[2].y} h={TRACKS[2].h} color={GREEN} label="music.wav" fx>
        <svg width={XW} height={70} style={{ position: 'absolute', left: 0, top: 20 }}>
          {wave.map((v, i) => {
            const h = Math.max(1, v * 62);
            return <rect key={i} x={(i / wave.length) * XW} y={35 - h / 2} width={1.3} height={h} fill="rgba(10,40,30,0.75)" />;
          })}
        </svg>
      </Clip>

      {/* A2: SFX clips */}
      {SFX_TIMES.map((s, i) => (
        <div key={i} style={{ position: 'absolute', left: px(s), top: TRACKS[3].y + 6, width: Math.max(5, (0.35 / DUR) * XW), height: TRACKS[3].h - 12, borderRadius: 2, background: t >= s && t < s + 0.4 ? '#7fe0c0' : GREEN, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.35)' }} />
      ))}

      {/* zoom bar */}
      <div style={{ position: 'absolute', left: X0, top: 606, width: XW, height: 14, borderRadius: 7, background: '#2a2a2a' }} />
      <div style={{ position: 'absolute', left: X0 + 4, top: 609, width: XW - 8, height: 8, borderRadius: 4, background: '#555' }} />

      {/* playhead */}
      <div style={{ position: 'absolute', left: head - 1, top: 222, width: 2, height: 380, background: BLUE }} />
      <div style={{ position: 'absolute', left: head - 10, top: 214, width: 20, height: 18, background: BLUE, clipPath: 'polygon(0 0, 100% 0, 100% 55%, 50% 100%, 0 55%)' }} />

      {/* ad slot frame (video overlaid by ffmpeg) */}
      <div style={{ position: 'absolute', left: SLOT.x - 5, top: SLOT.y - 5, width: SLOT.w + 10, height: SLOT.h + 10, borderRadius: 33, background: '#2c2c2c' }} />
      <div style={{ position: 'absolute', left: SLOT.x, top: SLOT.y, width: SLOT.w, height: SLOT.h, borderRadius: 28, background: '#000' }} />
      <div style={{ position: 'absolute', left: SLOT.x, top: SLOT.y + SLOT.h + 18, width: SLOT.w, textAlign: 'center', fontFamily: SANS, fontSize: 18, color: DIM, direction: 'ltr' }}>Program: HS_Clinic_Ad</div>
    </AbsoluteFill>
  );
};
