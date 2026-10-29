import { Easing, interpolate, spring } from 'remotion';

export const W = 1080;
export const H = 1920;
export const FPS = 60;

// Safe zones: nothing readable or key UI outside this box.
export const SAFE = { top: 250, bottom: H - 420, left: 60, right: W - 60 };

export const C = {
  bg: '#F7FBFC',
  mint: '#E8F6F4',
  teal: '#0B6E6E',
  blue: '#2F80C9',
  aqua: '#6FD1C8',
  coral: '#FF6F61',
  navy: '#10242E',
  muted: '#5C7480',
  line: '#D9E8EC',
  red: '#D64545',
  white: '#FFFFFF',
};

export const F = {
  head: "'Readex Pro', sans-serif",
  body: "'IBM Plex Sans Arabic', sans-serif",
  logo: "'Manrope', sans-serif",
};

// Layout shared by the scenes.
export const HEAD_Y = 385; // centre of the headline block (two lines fit between 280 and 490)
export const PHONE = { cx: W / 2, top: 522, w: 490, h: 968, bezel: 12 };
export const SCREEN = { w: PHONE.w - PHONE.bezel * 2, h: PHONE.h - PHONE.bezel * 2 };

export const EASE = Easing.bezier(0.22, 1, 0.36, 1);
export const EASE_IN = Easing.bezier(0.55, 0, 0.75, 0.2);

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/** 0→1 between `start` and `start + dur` seconds, eased. */
export const ramp = (t: number, start: number, dur: number, ease = EASE) =>
  interpolate(t, [start, start + dur], [0, 1], { ...clamp, easing: ease });

/** Linear map with clamping. */
export const lerp = (t: number, inR: number[], outR: number[]) => interpolate(t, inR, outR, clamp);

/** Spring (damping 18–22) starting at `start` seconds. */
export const sp = (t: number, start: number, damping = 20, stiffness = 150) =>
  spring({ frame: Math.max(0, (t - start) * FPS), fps: FPS, config: { damping, stiffness, mass: 1 } });

/** Visible window helper: fade in at `a`, fade out ending at `b`. */
export const win = (t: number, a: number, b: number, fin = 0.3, fout = 0.3) =>
  Math.min(ramp(t, a, fin), 1 - ramp(t, b - fout, fout));

export const glass = (alpha = 0.62): React.CSSProperties => ({
  background: `linear-gradient(150deg, rgba(255,255,255,${alpha + 0.2}) 0%, rgba(255,255,255,${alpha}) 55%, rgba(232,246,244,${alpha}) 100%)`,
  border: '2px solid rgba(255,255,255,0.9)',
  boxShadow: '0 30px 60px -24px rgba(16,36,46,0.22), 0 8px 18px -10px rgba(16,36,46,0.14), inset 0 1px 0 rgba(255,255,255,0.9)',
});
