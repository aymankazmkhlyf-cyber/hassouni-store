import React from 'react';
import { C, F, ramp, sp } from '../theme';
import { LightSweep } from './Effects';

/**
 * HS logo: a rounded teal→blue badge with a white medical cross, crossed by a pulse line,
 * over a geometric "HS" wordmark (Manrope ExtraBold). `start` = when it begins forming.
 */
export const Logo: React.FC<{ t: number; start: number; size?: number; shimmerAt?: number }> = ({ t, start, size = 230, shimmerAt }) => {
  const badge = sp(t, start, 18, 160);
  const cross = sp(t, start + 0.22, 19, 180);
  const line = ramp(t, start + 0.1, 0.75);
  const letters = [0, 1].map((i) => ramp(t, start + 0.5 + i * 0.09, 0.5));
  const lineW = size * 2.3;
  // Pulse "leads" on both sides of the badge, and a small heartbeat across the cross's horizontal arm.
  const bl = (lineW - size) / 2;
  const mid = size / 2;
  const leadL = `M0 ${mid} H${bl - size * 0.08}`;
  const leadR = `M${bl + size * 1.08} ${mid} H${lineW}`;
  const spike = `M${size * 0.24} ${mid} H${size * 0.38} L${size * 0.44} ${mid - size * 0.08} L${size * 0.5} ${mid + size * 0.08} L${size * 0.56} ${mid - size * 0.08} L${size * 0.6} ${mid} H${size * 0.76}`;
  const spikeP = ramp(t, start + 0.55, 0.45);
  const badgeLeft = bl;
  return (
    <div style={{ position: 'relative', width: lineW, height: size * 1.95, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ position: 'relative', width: lineW, height: size }}>
        <div
          style={{
            position: 'absolute',
            left: badgeLeft,
            top: 0,
            width: size,
            height: size,
            borderRadius: size * 0.3,
            background: `linear-gradient(140deg, ${C.aqua} -20%, ${C.teal} 45%, ${C.blue} 120%)`,
            boxShadow: `0 ${size * 0.16}px ${size * 0.3}px -${size * 0.1}px rgba(11,110,110,0.5), inset 0 2px 0 rgba(255,255,255,0.35)`,
            transform: `scale(${badge})`,
            overflow: 'hidden',
          }}
        >
          {/* cross */}
          <div style={{ position: 'absolute', inset: 0, transform: `scale(${cross})`, opacity: Math.min(1, cross * 1.5) }}>
            <div style={{ position: 'absolute', left: size * 0.39, top: size * 0.2, width: size * 0.22, height: size * 0.6, borderRadius: size * 0.06, background: 'rgba(255,255,255,0.96)' }} />
            <div style={{ position: 'absolute', left: size * 0.2, top: size * 0.39, width: size * 0.6, height: size * 0.22, borderRadius: size * 0.06, background: 'rgba(255,255,255,0.96)' }} />
          </div>
          <svg width={size} height={size} style={{ position: 'absolute', inset: 0 }}>
            <path d={spike} pathLength={1} fill="none" stroke={C.teal} strokeWidth={size * 0.045} strokeLinejoin="round" strokeLinecap="round" strokeDasharray={1} strokeDashoffset={1 - spikeP} />
          </svg>
          {shimmerAt !== undefined && <LightSweep p={ramp(t, shimmerAt, 0.8)} opacity={0.75} />}
        </div>
        {/* pulse leads either side of the mark */}
        <svg width={lineW} height={size} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
          <defs>
            <linearGradient id="hsLeadL" gradientUnits="userSpaceOnUse" x1={0} x2={bl} y1={0} y2={0}>
              <stop offset="0" stopColor={C.aqua} stopOpacity="0" />
              <stop offset="1" stopColor={C.teal} />
            </linearGradient>
            <linearGradient id="hsLeadR" gradientUnits="userSpaceOnUse" x1={bl + size} x2={lineW} y1={0} y2={0}>
              <stop offset="0" stopColor={C.blue} />
              <stop offset="1" stopColor={C.blue} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={leadR} pathLength={1} fill="none" stroke="url(#hsLeadR)" strokeWidth={size * 0.035} strokeLinecap="round" strokeDasharray={1} strokeDashoffset={-(1 - line)} />
          <path d={leadL} pathLength={1} fill="none" stroke="url(#hsLeadL)" strokeWidth={size * 0.035} strokeLinecap="round" strokeDasharray={1} strokeDashoffset={1 - line} />
        </svg>
      </div>
      <div style={{ display: 'flex', gap: size * 0.02, marginTop: size * 0.12, direction: 'ltr' }}>
        {['H', 'S'].map((ch, i) => (
          <span
            key={ch}
            style={{
              fontFamily: F.logo,
              fontWeight: 800,
              fontSize: size * 0.6,
              lineHeight: 1,
              letterSpacing: '0.02em',
              color: C.navy,
              opacity: letters[i],
              transform: `translateY(${(1 - letters[i]) * 18}px)`,
              filter: letters[i] < 1 ? `blur(${(1 - letters[i]) * 6}px)` : undefined,
            }}
          >
            {ch}
          </span>
        ))}
      </div>
    </div>
  );
};
