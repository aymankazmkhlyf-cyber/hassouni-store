// Cover image: the hook line, big and high-contrast, over the night-city shot (no faces).
import React from 'react';
import { AbsoluteFill } from 'remotion';
import './fonts';
import { brief } from './texts';
import { C, F } from './theme';
import { HookShot } from './scenes/Part2';
import { Grade } from './ui/Effects';

export const Thumbnail: React.FC = () => {
  const [l1, l2] = brief.hook.split('… ');
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      <AbsoluteFill style={{ transform: 'scale(1.08) translateY(140px)' }}>
        <HookShot t={2.4} />
      </AbsoluteFill>
      <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(3,6,12,0.95) 0%, rgba(3,6,12,0.75) 34%, rgba(3,6,12,0) 58%)' }} />
      <div dir="rtl" style={{ position: 'absolute', left: 60, right: 60, top: 290, textAlign: 'center' }}>
        <div style={{ fontFamily: F.head, fontWeight: 700, fontSize: 112, lineHeight: 1.25, color: C.gold, textShadow: '0 8px 40px rgba(0,0,0,0.8)' }}>{l1}…</div>
        <div style={{ fontFamily: F.head, fontWeight: 700, fontSize: 96, lineHeight: 1.3, color: C.ivory, textShadow: '0 8px 40px rgba(0,0,0,0.8)' }}>{l2}</div>
      </div>
      <Grade frame={7} grain={0.05} />
    </AbsoluteFill>
  );
};
