import { Easing, interpolate, spring } from 'remotion';

export const W = 1080;
export const H = 1920;
export const FPS = 60;
export const DURATION = 60;

// Safe zones: no text or key UI outside this box.
export const SAFE = { top: 250, bottom: H - 420, left: 60, right: W - 60 };

export const C = {
  navy: '#0B1726',
  navy2: '#122339',
  teal: '#0E6E73',
  gold: '#D9A441',
  ivory: '#F4EFE6',
  sky: '#5FB7E5',
  coral: '#FF6B57', // CTA only
  ink: '#0B1726',
  muted: '#8FA3B5',
  line: 'rgba(244,239,230,0.14)',
  glass: 'rgba(244,239,230,0.08)',
  white: '#FFFFFF',
  red: '#E04B4B',
};

export const F = {
  head: "'Readex Pro', sans-serif",
  body: "'IBM Plex Sans Arabic', sans-serif",
  logo: "'Manrope', sans-serif",
};

// Layout shared by the scenes.
export const BADGE_Y = 258; // feature counter (١/٧ …) sits just under the top safe line
export const HEAD_Y = 418; // centre of the headline block (two lines fit between 322 and 514)
export const VIS_TOP = 545; // visual zone: 545 → 1490

export const EASE = Easing.bezier(0.22, 1, 0.36, 1);
export const EASE_IN = Easing.bezier(0.55, 0, 0.75, 0.2);
export const IN_OUT = Easing.bezier(0.65, 0, 0.35, 1);

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/** 0→1 between `start` and `start + dur` seconds, eased. */
export const ramp = (t: number, start: number, dur: number, ease: (x: number) => number = EASE) =>
  interpolate(t, [start, start + dur], [0, 1], { ...clamp, easing: ease });

/** Linear map with clamping. */
export const lerp = (t: number, inR: number[], outR: number[]) => interpolate(t, inR, outR, clamp);

export const mix = (a: number, b: number, p: number) => a + (b - a) * p;

/** Spring (damping 18–22) starting at `start` seconds. */
export const sp = (t: number, start: number, damping = 20, stiffness = 150) =>
  spring({ frame: Math.max(0, (t - start) * FPS), fps: FPS, config: { damping, stiffness, mass: 1 } });

/** Visible window: fade in at `a`, fade out ending at `b`. */
export const win = (t: number, a: number, b: number, fin = 0.3, fout = 0.3) => Math.min(ramp(t, a, fin), 1 - ramp(t, b - fout, fout));

/** Deterministic pseudo-random in [0,1). */
export const rand = (seed: number) => {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

export const glass = (alpha = 0.1, dark = true): React.CSSProperties =>
  dark
    ? {
        background: `linear-gradient(150deg, rgba(244,239,230,${alpha + 0.08}) 0%, rgba(244,239,230,${alpha}) 55%, rgba(95,183,229,${alpha * 0.6}) 100%)`,
        border: '1.5px solid rgba(244,239,230,0.22)',
        boxShadow: '0 40px 80px -30px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.18)',
      }
    : {
        background: `linear-gradient(150deg, rgba(255,255,255,0.96), rgba(244,239,230,0.9))`,
        border: '1.5px solid rgba(255,255,255,0.9)',
        boxShadow: '0 30px 60px -24px rgba(11,23,38,0.45)',
      };
