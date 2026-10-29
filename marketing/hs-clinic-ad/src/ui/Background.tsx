import React from 'react';
import { AbsoluteFill } from 'remotion';
import { C, H, W } from '../theme';

/** Clinical white → soft mint, slow drifting light blobs and a faint pulse-line motif. `shift` = parallax offset (px). */
export const Background: React.FC<{ t: number; shift: number }> = ({ t, shift }) => {
  const blob = (x: number, y: number, r: number, color: string, a: number, sx: number, sy: number, ph: number) => (
    <div
      style={{
        position: 'absolute',
        left: x + Math.sin(t * sx + ph) * 60 + shift * 0.35 - r,
        top: y + Math.cos(t * sy + ph) * 50 - r,
        width: r * 2,
        height: r * 2,
        borderRadius: '50%',
        background: `radial-gradient(circle, ${color} 0%, rgba(255,255,255,0) 68%)`,
        opacity: a,
      }}
    />
  );
  const lineX = ((-t * 40 + shift * 0.6) % 720) - 720;
  return (
    <AbsoluteFill style={{ background: `linear-gradient(170deg, ${C.bg} 0%, #F1FAF9 45%, ${C.mint} 100%)`, overflow: 'hidden' }}>
      {blob(900, 380, 620, 'rgba(111,209,200,0.55)', 0.7, 0.21, 0.17, 0)}
      {blob(120, 1250, 720, 'rgba(47,128,201,0.22)', 0.8, 0.15, 0.19, 1.7)}
      {blob(760, 1650, 560, 'rgba(11,110,110,0.18)', 0.9, 0.18, 0.13, 3.1)}
      {blob(250, 520, 420, 'rgba(232,246,244,1)', 0.9, 0.12, 0.2, 4.2)}
      <svg width={W * 3} height={160} style={{ position: 'absolute', left: lineX, top: H - 250, opacity: 0.22 }}>
        <path
          d={Array.from({ length: 9 })
            .map((_, i) => {
              const x = i * 360;
              return `M${x} 80 H${x + 140} L${x + 160} 62 L${x + 178} 96 L${x + 198} 28 L${x + 222} 128 L${x + 242} 70 L${x + 258} 80 H${x + 360}`;
            })
            .join(' ')}
          stroke={C.teal}
          strokeWidth={3}
          fill="none"
          strokeLinejoin="round"
        />
      </svg>
    </AbsoluteFill>
  );
};
