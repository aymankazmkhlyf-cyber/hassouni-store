import React from 'react';
import { C, F, ramp, sp } from '../theme';
import { LightSweep } from './Effects';

/**
 * HS logo: a gold forward arrow (↗) inside a tilted orbit line with a small satellite dot,
 * next to a geometric "HS" wordmark (Manrope ExtraBold). Reveals with a light sweep.
 * `orbitOut` (0→1) lets the orbit grow away from the mark for the match cut into the phone.
 */
export const Logo: React.FC<{ t: number; start: number; size?: number; orbitOut?: number; showWord?: boolean }> = ({ t, start, size = 200, orbitOut = 0, showWord = true }) => {
  const orbit = ramp(t, start, 0.9);
  const arrow = sp(t, start + 0.35, 18, 170);
  const word = ramp(t, start + 0.55, 0.6);
  const sweep = ramp(t, start + 0.7, 1.0);
  const sat = (t - start) * 1.6;
  const rx = size * 0.62;
  const ry = size * 0.24;
  const satX = Math.cos(sat) * rx;
  const satY = Math.sin(sat) * ry;
  const grow = 1 + orbitOut * 5;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: size * 0.18, direction: 'ltr' }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} viewBox={`${-size / 2} ${-size / 2} ${size} ${size}`} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
          <defs>
            <linearGradient id="hsArrow" x1="0" y1="1" x2="1" y2="0">
              <stop offset="0" stopColor="#b9822a" />
              <stop offset="0.6" stopColor={C.gold} />
              <stop offset="1" stopColor="#f6d58f" />
            </linearGradient>
          </defs>
          <g transform={`rotate(-24) scale(${grow})`} opacity={1 - orbitOut * 0.6}>
            <ellipse cx={0} cy={0} rx={rx} ry={ry} fill="none" stroke={C.sky} strokeWidth={size * 0.028 / grow} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - orbit} strokeLinecap="round" opacity={0.9} />
            {orbit > 0.95 && <circle cx={satX} cy={satY} r={size * 0.04 / grow} fill={C.ivory} />}
          </g>
          <g transform={`scale(${arrow})`} opacity={Math.min(1, arrow * 1.4) * (1 - orbitOut)}>
            <path d={`M${-size * 0.2} ${size * 0.2} L${size * 0.17} ${-size * 0.17}`} stroke="url(#hsArrow)" strokeWidth={size * 0.11} strokeLinecap="round" />
            <path d={`M${-size * 0.06} ${-size * 0.2} L${size * 0.2} ${-size * 0.2} L${size * 0.2} ${size * 0.06}`} stroke="url(#hsArrow)" strokeWidth={size * 0.11} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </g>
        </svg>
      </div>
      {showWord && (
        <div style={{ position: 'relative', overflow: 'hidden', padding: '0 6px' }}>
          <span
            style={{
              display: 'block',
              fontFamily: F.logo,
              fontWeight: 800,
              fontSize: size * 0.78,
              lineHeight: 1.05,
              letterSpacing: '0.02em',
              color: C.ivory,
              opacity: word * (1 - orbitOut),
              clipPath: `inset(0 ${(1 - word) * 100}% 0 0)`,
            }}
          >
            HS
          </span>
          <LightSweep p={sweep} opacity={0.9} width={0.25} color="255,226,170" />
        </div>
      )}
    </div>
  );
};
