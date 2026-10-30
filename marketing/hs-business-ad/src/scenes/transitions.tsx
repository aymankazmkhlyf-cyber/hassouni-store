import React from 'react';
import { AbsoluteFill } from 'remotion';
import { H, IN_OUT, W, ramp } from '../theme';
import { MotionFX } from '../ui/Effects';
import { PHONE } from '../ui/Phone';
import type { Cam } from '../ui/Phone';

/**
 * Whip pan between two shots: A rushes out, B rushes in, with directional motion blur and a touch
 * of chromatic aberration at peak speed. `dir` 'x' = horizontal (right→left, RTL), 'y' = vertical (down→up).
 */
export const Whip: React.FC<{ t: number; at: number; half?: number; dir?: 'x' | 'y'; id: string; a: React.ReactNode; b: React.ReactNode }> = ({ t, at, half = 0.2, dir = 'x', id, a, b }) => {
  const p = ramp(t, at - half, half * 2, IN_OUT);
  const amount = Math.sin(p * Math.PI);
  const D = dir === 'x' ? W : H;
  const off = (v: number) => (dir === 'x' ? `translateX(${v}px)` : `translateY(${v}px)`);
  return (
    <MotionFX id={id} amount={amount} dir={dir === 'x' ? 0 : 90}>
      {t < at ? <AbsoluteFill style={{ transform: off(-p * 2 * D * 0.55) }}>{a}</AbsoluteFill> : <AbsoluteFill style={{ transform: off((1 - p) * 2 * D * 0.55) }}>{b}</AbsoluteFill>}
    </MotionFX>
  );
};

/** Screen point (inside the phone screen) → frame pixels, for a phone facing the camera. */
export const screenToFrame = (cam: Cam, sx: number, sy: number) => {
  const s = cam.scale ?? 1;
  return {
    x: 540 + (cam.x ?? 0) + (12 + sx - PHONE.w / 2) * s,
    y: 1015 + (cam.y ?? 0) + (12 + sy - PHONE.h / 2) * s,
  };
};
