import React from 'react';
import { Easing } from 'remotion';
import { C, H, W, ramp } from '../theme';

const IN_OUT = Easing.bezier(0.45, 0, 0.35, 1);

/** Diagonal light band sweeping across glass. `p` 0→1. */
export const LightSweep: React.FC<{ p: number; width?: number; opacity?: number; radius?: number }> = ({ p, width = 0.32, opacity = 0.85, radius }) => {
  if (p <= 0 || p >= 1) return null;
  const pos = -40 + p * 180;
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        borderRadius: radius,
        overflow: 'hidden',
        pointerEvents: 'none',
        mixBlendMode: 'screen',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: '-50%',
          background: `linear-gradient(115deg, rgba(255,255,255,0) ${pos - width * 50}%, rgba(255,255,255,${opacity}) ${pos}%, rgba(255,255,255,0) ${pos + width * 50}%)`,
        }}
      />
    </div>
  );
};

// Heartbeat path across the full width at y = 0 (scaled to `amp`).
const beat = (amp: number) => {
  const pts: string[] = [];
  const seg = 360;
  for (let x0 = -seg; x0 < W + seg; x0 += seg) {
    pts.push(`L${x0 + 0} 0`, `L${x0 + 120} 0`, `L${x0 + 145} ${-amp * 0.25}`, `L${x0 + 165} ${amp * 0.15}`, `L${x0 + 185} ${-amp}`, `L${x0 + 210} ${amp * 0.75}`, `L${x0 + 232} ${-amp * 0.18}`, `L${x0 + 250} 0`);
  }
  return 'M' + pts.join(' ').slice(1);
};

/** Head x of a pulse-line wipe (moves right → left). */
export const wipeX = (t: number, start: number, dur = 0.8) => W + 80 - ramp(t, start, dur, IN_OUT) * (W + 220);

/** Pulse-line wipe: a heartbeat line draws right → left; content right of the head is the next scene. */
export const PulseWipe: React.FC<{ t: number; start: number; dur?: number; y?: number }> = ({ t, start, dur = 0.8, y = H / 2 }) => {
  if (t < start || t > start + dur + 0.35) return null;
  const x = wipeX(t, start, dur);
  const fade = 1 - ramp(t, start + dur, 0.35);
  return (
    <svg width={W} height={H} style={{ position: 'absolute', inset: 0, opacity: fade, pointerEvents: 'none' }}>
      <defs>
        <linearGradient id={`pw${start}`} x1="0" x2="1">
          <stop offset="0" stopColor={C.aqua} stopOpacity="1" />
          <stop offset="0.25" stopColor={C.teal} stopOpacity="0.9" />
          <stop offset="1" stopColor={C.teal} stopOpacity="0" />
        </linearGradient>
        <clipPath id={`pc${start}`}>
          <rect x={x} y={0} width={W + 200} height={H} />
        </clipPath>
      </defs>
      <g clipPath={`url(#pc${start})`} transform={`translate(0 ${y})`}>
        <path d={beat(110)} stroke={C.aqua} strokeOpacity={0.35} strokeWidth={22} fill="none" strokeLinejoin="round" style={{ filter: 'blur(10px)' }} />
        <path d={beat(110)} stroke={`url(#pw${start})`} strokeWidth={6} fill="none" strokeLinejoin="round" strokeLinecap="round" transform={`translate(${x} 0) translate(${-x} 0)`} />
      </g>
      <circle cx={x} cy={y} r={14} fill="#fff" style={{ filter: 'drop-shadow(0 0 14px #6FD1C8)' }} />
    </svg>
  );
};

/** Clip a layer to the part of the frame on the right of `x` (after) or left of it (before). */
export const WipeClip: React.FC<{ x: number | null; side: 'before' | 'after'; children: React.ReactNode }> = ({ x, side, children }) => {
  if (x === null) return <>{children}</>;
  const clip = side === 'after' ? `inset(0 0 0 ${Math.max(0, x)}px)` : `inset(0 ${Math.max(0, W - x)}px 0 0)`;
  return <div style={{ position: 'absolute', inset: 0, clipPath: clip }}>{children}</div>;
};
