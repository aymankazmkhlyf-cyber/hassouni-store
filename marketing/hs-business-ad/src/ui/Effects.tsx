// Cinematic finishing layers: grade, vignette, grain, letterbox, flares, light leaks, flash,
// and a directional motion-blur + chromatic-aberration filter for fast moves.
import React from 'react';
import { AbsoluteFill, staticFile } from 'remotion';
import { C, H, W, rand } from '../theme';

/** Teal shadows / warm-gold highlights, soft vignette and 2–3 % film grain (also dithers gradients). */
export const Grade: React.FC<{ frame: number; vignette?: number; grain?: number }> = ({ frame, vignette = 0.55, grain = 0.085 }) => {
  const g = frame % 8;
  const ox = Math.floor(rand(frame) * 512);
  const oy = Math.floor(rand(frame + 77) * 512);
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {/* split-tone: teal in the lows, gold in the highs */}
      <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(217,164,65,0.22) 0%, rgba(14,110,115,0.0) 45%, rgba(14,110,115,0.28) 100%)', mixBlendMode: 'soft-light' }} />
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse 70% 55% at 50% 45%, rgba(0,0,0,0) 55%, rgba(4,10,18,1) 100%)', opacity: vignette }} />
      <AbsoluteFill
        style={{
          backgroundImage: `url(${staticFile(`grain/g${g}.png`)})`,
          backgroundSize: '512px 512px',
          backgroundPosition: `${ox}px ${oy}px`,
          mixBlendMode: 'overlay',
          opacity: grain,
        }}
      />
    </AbsoluteFill>
  );
};

/** Cinematic letterbox: `p` = 1 fully closed (2.39:1 feel), 0 = open. */
export const Letterbox: React.FC<{ p: number; size?: number }> = ({ p, size = 300 }) => {
  if (p <= 0.001) return null;
  const h = size * p;
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: h, background: '#000' }} />
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: h, background: '#000' }} />
    </AbsoluteFill>
  );
};

/** Anamorphic flare: long horizontal streak + soft core + a few ghosts. */
export const Flare: React.FC<{ x: number; y: number; intensity: number; length?: number; color?: string }> = ({ x, y, intensity, length = 1.6, color = C.sky }) => {
  if (intensity <= 0.01) return null;
  const L = W * length;
  return (
    <AbsoluteFill style={{ pointerEvents: 'none', mixBlendMode: 'screen' }}>
      <div style={{ position: 'absolute', left: x - L / 2, top: y - 3, width: L, height: 6, borderRadius: 6, background: `linear-gradient(90deg, rgba(0,0,0,0), ${color} 35%, #fff 50%, ${color} 65%, rgba(0,0,0,0))`, opacity: intensity, filter: 'blur(2px)' }} />
      <div style={{ position: 'absolute', left: x - L / 2, top: y - 24, width: L, height: 48, background: `linear-gradient(90deg, rgba(0,0,0,0), rgba(95,183,229,0.35) 40%, rgba(95,183,229,0.35) 60%, rgba(0,0,0,0))`, opacity: intensity * 0.8, filter: 'blur(14px)' }} />
      <div style={{ position: 'absolute', left: x - 160, top: y - 160, width: 320, height: 320, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(217,164,65,0.45) 25%, rgba(0,0,0,0) 65%)', opacity: intensity }} />
      {[0.35, -0.55, 0.8].map((k, i) => (
        <div key={i} style={{ position: 'absolute', left: x + (W / 2 - x) * k * 2 - 40 * (i + 1), top: y + (H / 2 - y) * k * 2 - 40 * (i + 1), width: 80 * (i + 1), height: 80 * (i + 1), borderRadius: '50%', border: `2px solid rgba(95,183,229,${0.25 * intensity})`, background: `radial-gradient(circle, rgba(95,183,229,${0.12 * intensity}), rgba(0,0,0,0) 70%)` }} />
      ))}
    </AbsoluteFill>
  );
};

/** Warm light leak sweeping across the frame. `p` 0→1. */
export const LightLeak: React.FC<{ p: number; strength?: number; from?: 'right' | 'left' }> = ({ p, strength = 0.85, from = 'right' }) => {
  if (p <= 0 || p >= 1) return null;
  const a = Math.sin(p * Math.PI) * strength;
  const x = from === 'right' ? W * (1.2 - p * 1.4) : W * (-0.2 + p * 1.4);
  return (
    <AbsoluteFill style={{ pointerEvents: 'none', mixBlendMode: 'screen' }}>
      <div style={{ position: 'absolute', left: x - 900, top: H * 0.35 - 900, width: 1800, height: 1800, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,190,110,0.95) 0%, rgba(217,120,65,0.55) 30%, rgba(0,0,0,0) 65%)', opacity: a }} />
      <div style={{ position: 'absolute', left: x - 500 + 300, top: H * 0.7 - 500, width: 1000, height: 1000, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,107,87,0.6) 0%, rgba(0,0,0,0) 60%)', opacity: a * 0.7 }} />
    </AbsoluteFill>
  );
};

export const Flash: React.FC<{ a: number; color?: string }> = ({ a, color = '#fff' }) => (a > 0.001 ? <AbsoluteFill style={{ background: color, opacity: a, pointerEvents: 'none' }} /> : null);

/** Diagonal light band sweeping across glass. `p` 0→1. */
export const LightSweep: React.FC<{ p: number; width?: number; opacity?: number; radius?: number; color?: string }> = ({ p, width = 0.3, opacity = 0.8, radius, color = '255,255,255' }) => {
  if (p <= 0 || p >= 1) return null;
  const pos = -40 + p * 180;
  return (
    <div style={{ position: 'absolute', inset: 0, borderRadius: radius, overflow: 'hidden', pointerEvents: 'none', mixBlendMode: 'screen' }}>
      <div style={{ position: 'absolute', inset: '-50%', background: `linear-gradient(115deg, rgba(${color},0) ${pos - width * 50}%, rgba(${color},${opacity}) ${pos}%, rgba(${color},0) ${pos + width * 50}%)` }} />
    </div>
  );
};

/**
 * Fast-move treatment (180°-shutter feel): directional blur along the motion plus a little
 * chromatic aberration. `amount` 0→1, `dir` = motion direction in degrees (0 = horizontal).
 */
export const MotionFX: React.FC<{ id: string; amount: number; dir?: 0 | 90; children: React.ReactNode }> = ({ id, amount, dir = 0, children }) => {
  if (amount < 0.02) return <>{children}</>;
  const b = 28 * amount;
  const ca = 7 * amount;
  const [bx, by] = dir === 0 ? [b, 0.001] : [0.001, b];
  const [ox, oy] = dir === 0 ? [ca, 0] : [0, ca];
  return (
    <>
      <svg width={0} height={0} style={{ position: 'absolute' }}>
        <filter id={id} x="-10%" y="-10%" width="120%" height="120%" colorInterpolationFilters="sRGB">
          <feGaussianBlur in="SourceGraphic" stdDeviation={`${bx} ${by}`} result="b" />
          <feColorMatrix in="b" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="r" />
          <feOffset in="r" dx={ox} dy={oy} result="ro" />
          <feColorMatrix in="b" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0" result="gb" />
          <feOffset in="gb" dx={-ox} dy={-oy} result="gbo" />
          <feBlend in="ro" in2="gbo" mode="screen" />
        </filter>
      </svg>
      <AbsoluteFill style={{ filter: `url(#${id})` }}>{children}</AbsoluteFill>
    </>
  );
};
