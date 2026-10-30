import React from 'react';
import tl from '../timeline.json';
import { arDigits } from '../texts';
import { BADGE_Y, C, F, glass, ramp, sp } from '../theme';

/** Curiosity counter (١/٧ … ٧/٧) shown from 12.0 s until the dashboard ends. */
export const FeatureCounter: React.FC<{ t: number }> = ({ t }) => {
  const times = tl.counter;
  if (t < times[0] - 0.2 || t > 50.3) return null;
  let n = 0;
  times.forEach((c, i) => {
    if (t >= c) n = i + 1;
  });
  n = Math.max(1, n);
  const at = times[n - 1];
  const flip = ramp(t, at, 0.35);
  const pop = sp(t, at, 16, 260);
  const appear = ramp(t, times[0] - 0.2, 0.35) * (1 - ramp(t, 50.0, 0.3));
  return (
    <div style={{ position: 'absolute', left: 64, top: BADGE_Y, display: 'flex', alignItems: 'center', gap: 14, padding: '6px 20px 6px 16px', borderRadius: 26, ...glass(0.1), opacity: appear, transform: `scale(${1 + 0.08 * Math.sin(Math.min(1, pop) * Math.PI)})`, transformOrigin: 'left center', direction: 'ltr' }}>
      <div style={{ display: 'flex', gap: 5 }}>
        {times.map((_, i) => (
          <div key={i} style={{ width: 9, height: 9, borderRadius: '50%', background: i < n ? C.gold : 'rgba(244,239,230,0.25)', boxShadow: i === n - 1 ? `0 0 ${10 * (1 - flip) + 4}px ${C.gold}` : undefined }} />
        ))}
      </div>
      <div style={{ position: 'relative', height: 50, overflow: 'hidden' }}>
        <div dir="rtl" style={{ fontFamily: F.head, fontWeight: 700, fontSize: 38, color: C.ivory, lineHeight: '50px', transform: `translateY(${(1 - flip) * 28}px)`, opacity: flip }}>
          {arDigits(n)}/{arDigits(times.length)}
        </div>
      </div>
    </div>
  );
};
