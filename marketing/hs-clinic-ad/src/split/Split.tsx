// Split-screen "behind the scenes" version: an editing timeline on top; the finished ad is
// composited into SLOT afterwards with ffmpeg (see finish-split.sh), so the ad itself is not re-rendered.
import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import '../fonts';
import tl from '../timeline.json';
import { arDigits, split } from '../texts';
import { C, F, FPS, ramp } from '../theme';
import wave from './wave.json';

export const SLOT = { x: 227, y: 700, w: 626, h: 777 };
const BG = '#0B1A21';
const PANEL = { x: 60, y: 262, w: 960, h: 410 };
const LANE_X0 = PANEL.x + 34;
const LANE_W = PANEL.w - 68;
const DUR = tl.duration;
const px = (sec: number) => LANE_X0 + (sec / DUR) * LANE_W;

type Ev = { at: number; key: keyof typeof split.sfx };
const EVENTS: Ev[] = [
  ...tl.heartbeat.map((at) => ({ at, key: 'heartbeat' as const })),
  ...tl.ring.slice(0, 1).map((at) => ({ at, key: 'ring' as const })),
  ...tl.busy.slice(0, 1).map((at) => ({ at, key: 'busy' as const })),
  { at: tl.clockSpin[0], key: 'clock' as const },
  { at: tl.riser[0], key: 'riser' as const },
  { at: tl.bloom, key: 'bloom' as const },
  ...tl.shimmer.map((at) => ({ at, key: 'shimmer' as const })),
  ...tl.taps.map((at) => ({ at, key: 'tap' as const })),
  ...tl.whoosh.map((at) => ({ at: at - 0.05, key: 'whoosh' as const })),
  ...tl.days.map((at) => ({ at, key: 'day' as const })),
  { at: tl.chime, key: 'chime' as const },
  ...tl.counter.map((at) => ({ at, key: 'counter' as const })),
  { at: tl.full, key: 'full' as const },
  ...tl.bubbles.map((at) => ({ at, key: 'bubble' as const })),
  ...tl.typing.map(([at]) => ({ at, key: 'typing' as const })),
  { at: tl.handoff, key: 'handoff' as const },
  ...tl.callPulse.map((at) => ({ at, key: 'callPulse' as const })),
  ...tl.dashboard.map((at) => ({ at, key: 'dashboard' as const })),
  { at: tl.graph[0], key: 'graph' as const },
  ...tl.ctaPulse.map((at) => ({ at, key: 'ctaPulse' as const })),
].sort((a, b) => a.at - b.at);

const SCENE_COLORS = ['#1d8f8a', '#2F80C9', '#0B6E6E', '#3a9ad9', '#14837f', '#2a6fb0'];

const timecode = (t: number) => {
  const s = Math.floor(t);
  const cs = Math.floor((t - s) * 100);
  return arDigits(`00:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`);
};

export const Split: React.FC = () => {
  const t = useCurrentFrame() / FPS;
  const sceneIdx = Math.max(0, tl.scenes.findIndex((s) => t >= s.start && t < s.end));
  const scene = tl.scenes[sceneIdx === -1 ? tl.scenes.length - 1 : sceneIdx];
  const sceneIn = ramp(t, scene.start, 0.35);
  const trans = [...split.transitions].reverse().find((x) => t >= x.at - 0.1);
  const lastEv = [...EVENTS].reverse().find((e) => t >= e.at);
  const evAge = lastEv ? t - lastEv.at : 99;
  const head = px(t);
  const lanes = { scenes: PANEL.y + 168, trans: PANEL.y + 232, sfx: PANEL.y + 276, audio: PANEL.y + 312 };

  return (
    <AbsoluteFill style={{ background: BG, overflow: 'hidden' }}>
      {/* soft glow */}
      <div style={{ position: 'absolute', left: -300, top: -200, width: 1100, height: 1100, borderRadius: '50%', background: 'radial-gradient(circle, rgba(111,209,200,0.16), rgba(0,0,0,0) 65%)', transform: `translate(${Math.sin(t * 0.3) * 40}px, ${Math.cos(t * 0.25) * 30}px)` }} />
      <div style={{ position: 'absolute', right: -400, top: 900, width: 1200, height: 1200, borderRadius: '50%', background: 'radial-gradient(circle, rgba(47,128,201,0.16), rgba(0,0,0,0) 65%)' }} />

      {/* editor panel */}
      <div style={{ position: 'absolute', left: PANEL.x, top: PANEL.y, width: PANEL.w, height: PANEL.h, borderRadius: 32, background: 'linear-gradient(160deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03))', border: '2px solid rgba(255,255,255,0.10)', boxShadow: '0 40px 80px -40px rgba(0,0,0,0.6)' }} />

      {/* scene title + timecode */}
      <div dir="rtl" style={{ position: 'absolute', right: PANEL.x + 34, top: PANEL.y + 22, display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ padding: '2px 18px', borderRadius: 18, background: 'rgba(111,209,200,0.16)', border: '2px solid rgba(111,209,200,0.4)' }}>
          <span style={{ fontFamily: F.body, fontWeight: 600, fontSize: 32, color: C.aqua }}>
            {split.scene} {arDigits(sceneIdx + 1)} {split.of} {arDigits(tl.scenes.length)}
          </span>
        </div>
        <span style={{ fontFamily: F.head, fontWeight: 700, fontSize: 46, color: '#fff', opacity: sceneIn, transform: `translateY(${(1 - sceneIn) * 10}px)`, display: 'inline-block' }}>
          {split.sceneNames[sceneIdx]}
        </span>
      </div>
      <div style={{ position: 'absolute', left: PANEL.x + 34, top: PANEL.y + 26, fontFamily: F.head, fontWeight: 600, fontSize: 40, color: C.aqua, direction: 'ltr' }}>{timecode(t)}</div>

      {/* current transition + latest sound */}
      <div dir="rtl" style={{ position: 'absolute', right: PANEL.x + 34, left: PANEL.x + 34, top: PANEL.y + 92, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: F.body, fontWeight: 500, fontSize: 32, color: 'rgba(255,255,255,0.75)' }}>
          {split.transition}: <span style={{ color: '#fff', fontWeight: 600 }}>{trans ? trans.name : '—'}</span>
        </span>
        {lastEv && evAge < 1.2 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '2px 16px', borderRadius: 16, background: `rgba(255,255,255,${0.14 * (1 - ramp(t, lastEv.at + 0.6, 0.6))})`, opacity: 1 - ramp(t, lastEv.at + 0.6, 0.6), transform: `scale(${1 + 0.08 * (1 - ramp(t, lastEv.at, 0.2))})` }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: C.aqua, boxShadow: `0 0 12px ${C.aqua}` }} />
            <span style={{ fontFamily: F.body, fontWeight: 600, fontSize: 32, color: '#fff' }}>{split.sfx[lastEv.key]}</span>
          </div>
        )}
      </div>

      {/* ruler */}
      {Array.from({ length: 13 }).map((_, i) => (
        <React.Fragment key={i}>
          <div style={{ position: 'absolute', left: px(i * 5), top: PANEL.y + 146, width: 2, height: 12, background: 'rgba(255,255,255,0.3)' }} />
        </React.Fragment>
      ))}

      {/* scene blocks */}
      {tl.scenes.map((s, i) => {
        const active = i === sceneIdx;
        const done = t >= s.end;
        return (
          <div
            key={s.id}
            style={{
              position: 'absolute',
              left: px(s.start) + 1.5,
              top: lanes.scenes,
              width: px(s.end) - px(s.start) - 3,
              height: 52,
              borderRadius: 10,
              background: SCENE_COLORS[i % SCENE_COLORS.length],
              opacity: active ? 1 : done ? 0.75 : 0.35,
              boxShadow: active ? `0 0 0 3px #fff, 0 0 24px rgba(111,209,200,0.6)` : undefined,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span style={{ fontFamily: F.head, fontWeight: 600, fontSize: 24, color: '#fff' }}>{arDigits(i + 1)}</span>
          </div>
        );
      })}

      {/* transitions */}
      {split.transitions.map((x, i) => (
        <div key={i} style={{ position: 'absolute', left: px(x.at) - 11, top: lanes.trans, width: 22, height: 22, transform: 'rotate(45deg)', borderRadius: 4, background: t >= x.at ? C.aqua : 'rgba(255,255,255,0.25)', boxShadow: t >= x.at && t < x.at + 0.6 ? `0 0 18px ${C.aqua}` : undefined }} />
      ))}

      {/* SFX ticks */}
      {EVENTS.map((e, i) => {
        const hit = t >= e.at;
        const flash = hit ? 1 - ramp(t, e.at, 0.4) : 0;
        return <div key={i} style={{ position: 'absolute', left: px(e.at) - 2, top: lanes.sfx - flash * 6, width: 4, height: 24 + flash * 12, borderRadius: 2, background: hit ? `rgba(111,209,200,${0.55 + flash * 0.45})` : 'rgba(255,255,255,0.22)' }} />;
      })}

      {/* waveform */}
      <svg width={1080} height={80} style={{ position: 'absolute', left: 0, top: lanes.audio }}>
        {wave.map((v, i) => {
          const x = LANE_X0 + (i / wave.length) * LANE_W;
          const h = Math.max(2, v * 70);
          const played = (i / wave.length) * DUR <= t;
          return <rect key={i} x={x} y={40 - h / 2} width={1.4} height={h} rx={0.7} fill={played ? C.aqua : 'rgba(255,255,255,0.25)'} />;
        })}
      </svg>

      {/* playhead */}
      <div style={{ position: 'absolute', left: head - 1.5, top: lanes.scenes - 22, width: 3, height: lanes.audio + 86 - (lanes.scenes - 22), background: '#fff', boxShadow: '0 0 12px rgba(255,255,255,0.8)' }} />
      <div style={{ position: 'absolute', left: head - 11, top: lanes.scenes - 34, width: 22, height: 22, borderRadius: '50% 50% 50% 0', transform: 'rotate(-45deg)', background: '#fff' }} />

      {/* ad slot frame (the video is overlaid here by ffmpeg) */}
      <div style={{ position: 'absolute', left: SLOT.x - 6, top: SLOT.y - 6, width: SLOT.w + 12, height: SLOT.h + 12, borderRadius: 34, background: 'linear-gradient(160deg, rgba(111,209,200,0.6), rgba(47,128,201,0.5))', boxShadow: '0 40px 80px -30px rgba(0,0,0,0.7)' }} />
      <div style={{ position: 'absolute', left: SLOT.x, top: SLOT.y, width: SLOT.w, height: SLOT.h, borderRadius: 28, background: '#000' }} />
    </AbsoluteFill>
  );
};
