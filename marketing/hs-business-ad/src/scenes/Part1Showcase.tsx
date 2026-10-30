// Part 1 preview: the design system on one reel (3D shots, logo, icons, counter, phone, grade).
import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import '../fonts';
import { brief } from '../texts';
import { C, F, FPS, glass, ramp } from '../theme';
import { Airplane3D, Globe3D, NightCity3D, Tower3D } from '../three/Scenes3D';
import { Flare, Grade, Letterbox, LightLeak, MotionFX } from '../ui/Effects';
import { ICONS, IconBadge, IconName } from '../ui/Icon';
import { Logo } from '../ui/Logo';
import { Phone } from '../ui/Phone';
import { Headline } from '../ui/Words';

export const Part1Showcase: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const seg = Math.floor(t / 2);
  const lt = t - seg * 2;
  return (
    <AbsoluteFill style={{ background: C.navy }}>
      {seg === 0 && <NightCity3D cam={{ pos: [0, 12, 40 - lt * 6], look: [0, 16, -80], fov: 42 }} />}
      {seg === 1 && <Globe3D cam={{ pos: [0, 0, 34], look: [0, 0, 0], fov: 38 }} spin={-0.9 - lt * 0.2} arcs={[{ from: 'baghdad', to: 'istanbul', p: ramp(lt, 0, 1.6) }, { from: 'baghdad', to: 'dubai', p: ramp(lt, 0.4, 1.4) }]} plane={{ arc: 0, p: ramp(lt, 0.2, 1.6) }} />}
      {seg === 2 && <Tower3D cam={{ pos: [26, 120 - lt * 50, 60], look: [0, 100 - lt * 50, 0], fov: 40 }} />}
      {seg === 3 && <Airplane3D cam={{ pos: [0, 0, 12], look: [0, 0, 0], fov: 45 }} pos={[-30 + lt * 30, 1 - lt, -40 + lt * 46]} rot={[0.1, -0.7, 0.05]} />}
      {seg === 4 && (
        <MotionFX id="p1whip" amount={Math.sin(ramp(lt, 0, 1.2) * Math.PI)}>
          <AbsoluteFill style={{ transform: `translateX(${(0.5 - ramp(lt, 0, 1.2)) * 200}px)` }}>
            <Phone cam={{ ry: -22 + lt * 22, rx: 6, scale: 0.9 }}>
              <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(170deg, ${C.navy2}, ${C.teal})` }} />
              <div dir="rtl" style={{ position: 'absolute', top: 120, left: 0, right: 0, textAlign: 'center', fontFamily: F.head, fontWeight: 700, fontSize: 48, color: C.ivory }}>{brief.travelAgency}</div>
            </Phone>
          </AbsoluteFill>
        </MotionFX>
      )}
      {seg === 5 && (
        <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
          <Logo t={lt} start={0} size={200} />
        </AbsoluteFill>
      )}
      {seg === 6 && (
        <div style={{ position: 'absolute', left: 90, right: 90, top: 600, display: 'flex', flexWrap: 'wrap', gap: 26, justifyContent: 'center' }}>
          {(Object.keys(ICONS) as IconName[]).map((n, i) => (
            <div key={n} style={{ position: 'relative', width: 128, height: 128 }}>
              <IconBadge name={n} t={lt} at={i * 0.05} until={99} x={64} y={64} />
            </div>
          ))}
        </div>
      )}
      <Headline text={seg < 3 ? brief.hook : seg < 5 ? brief.reveal1 : brief.reveal2} t={lt} start={0.05} end={2.1} exit={0.2} />
      <div style={{ position: 'absolute', left: 64, top: 258, padding: '6px 20px', borderRadius: 26, ...glass(0.1) }}>
        <span style={{ fontFamily: F.head, fontWeight: 700, fontSize: 38, color: C.ivory }}>١/٧</span>
      </div>
      <Flare x={540} y={1000} intensity={seg === 5 ? Math.sin(ramp(lt, 0.2, 1.4) * Math.PI) : 0} />
      <LightLeak p={seg === 3 ? ramp(lt, 0.2, 1.6) : 0} />
      <Grade frame={frame} />
      <Letterbox p={seg === 0 ? 1 - ramp(lt, 1.2, 0.6) : 0} />
    </AbsoluteFill>
  );
};
