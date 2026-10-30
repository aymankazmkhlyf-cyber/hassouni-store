// Video A — the 60 s cinematic ad. Picture layers per part, then headlines, counter and the finishing stack.
import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import './fonts';
import { FPS, H, SAFE, W, ramp } from './theme';
import { Flash, Grade, Letterbox } from './ui/Effects';
import { FeatureCounter } from './ui/Counter';
import { Headline } from './ui/Words';
import { Part2Picture } from './scenes/Part2';
import { HEADLINES } from './headlines';

export const letterbox = (t: number) => (t < 7 ? 1 : t < 59.5 ? 1 - ramp(t, 7.0, 0.6) : ramp(t, 59.5, 0.45));

const Picture: React.FC<{ t: number }> = ({ t }) => {
  if (t < 12) return <Part2Picture t={t} />;
  return <Part2Picture t={Math.min(t, 11.99)} />;
};

export const VideoA: React.FC<{ guides?: boolean }> = ({ guides = false }) => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const flash = t >= 7 ? 1 - ramp(t, 7.0, 0.4) : t >= 4.2 && t < 4.4 ? 0.35 * (1 - ramp(t, 4.2, 0.12)) : 0;
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      <Picture t={t} />
      <FeatureCounter t={t} />
      {HEADLINES.map((h, i) => (
        <Headline key={i} text={h.text} t={t} start={h.start} end={h.end} exit={h.exit ?? 0.25} y={h.y} size={h.size ?? 72} breakAfter={h.breakAfter} />
      ))}
      <Flash a={flash} color="#fff4dc" />
      <Grade frame={frame} />
      <Letterbox p={letterbox(t)} />
      {guides && <Guides />}
    </AbsoluteFill>
  );
};

const Guides: React.FC = () => (
  <AbsoluteFill style={{ pointerEvents: 'none' }}>
    {[
      { left: 0, right: 0, top: 0, height: SAFE.top },
      { left: 0, right: 0, top: SAFE.bottom, height: H - SAFE.bottom },
      { left: 0, top: 0, bottom: 0, width: SAFE.left },
      { left: SAFE.right, top: 0, bottom: 0, width: W - SAFE.right },
    ].map((s, i) => (
      <div key={i} style={{ position: 'absolute', background: 'rgba(255,0,80,0.22)', ...s }} />
    ))}
  </AbsoluteFill>
);
