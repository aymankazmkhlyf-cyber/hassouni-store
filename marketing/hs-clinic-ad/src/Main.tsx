import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import './fonts';
import tl from './timeline.json';
import { brief } from './texts';
import { C, FPS, H, SAFE, W, lerp, ramp } from './theme';
import { Background } from './ui/Background';
import { LightSweep, PulseWipe, WipeClip, wipeX } from './ui/Effects';
import { IconBadge } from './ui/Icon';
import { Headline } from './ui/Words';
import { CTA, FullBadge, Hook2Visual, HookVisual, Laptop, Offer, PhoneTrack, RevealLogo, SLIDE2, WIPE1, hook2Dim } from './scenes/Frame';

const WIPE2 = 50.6;

export const Main: React.FC<{ guides?: boolean }> = ({ guides = false }) => {
  const t = useCurrentFrame() / FPS;
  const slide1 = ramp(t, 17.55, 0.8);
  const slide2 = ramp(t, SLIDE2[0], SLIDE2[1]);
  const x1 = t >= WIPE1 && t <= WIPE1 + 0.8 ? wipeX(t, WIPE1) : null;
  const x2 = t >= WIPE2 && t <= WIPE2 + 0.8 ? wipeX(t, WIPE2) : null;
  const dim = hook2Dim(t);
  const nightK = lerp(dim, [0.38, 0.5], [0, 1]);
  const nightText = `rgb(${lerp(nightK, [0, 1], [16, 234])},${lerp(nightK, [0, 1], [36, 246])},${lerp(nightK, [0, 1], [46, 245])})`;

  return (
    <AbsoluteFill style={{ backgroundColor: C.bg }}>
      <Background t={t} shift={-(slide1 + slide2) * 160} />

      <HookVisual t={t} />
      <Hook2Visual t={t} />
      <RevealLogo t={t} />
      <PhoneTrack t={t} />

      {/* feature icon badges */}
      <IconBadge name="calendar" t={t} at={12.35} until={17.6} x={168} y={720} dx={-slide1 * 900} />
      <IconBadge name="clock" t={t} at={15.85} until={17.6} x={912} y={1150} dx={-slide1 * 900} />
      <IconBadge name="bookingCheck" t={t} at={18.45} until={23.7} x={912} y={760} />
      {t < 24.05 && <LightSweep p={ramp(t, 23.6, 0.8)} opacity={0.35} width={0.5} />}

      <WipeClip x={x1} side="before">
        {t < WIPE1 + 0.8 && (
          <>
            <IconBadge name="users" t={t} at={24.35} until={WIPE1 + 0.8} x={168} y={720} />
            <FullBadge t={t} />
            <Headline text={brief.f3} t={t} start={24.1} end={WIPE1 + 0.8} exit={0} breakAfter={2} />
          </>
        )}
      </WipeClip>
      <WipeClip x={x1} side="after">
        <IconBadge name="chat" t={t} at={29.3} until={34.8} x={912} y={760} />
        <Headline text={brief.f4} t={t} start={29.05} end={34.8} breakAfter={2} />
      </WipeClip>

      <IconBadge name="handoff" t={t} at={35.3} until={40.8} x={168} y={740} />
      <IconBadge name="phone" t={t} at={41.35} until={44.75} x={912} y={760} dx={-slide2 * 1300} />

      <WipeClip x={x2} side="before">
        {t < WIPE2 + 0.8 && (
          <>
            <Laptop t={t} />
            <IconBadge name="dashboard" t={t} at={45.45} until={WIPE2 + 0.8} x={900} y={590} />
            <Headline text={brief.f7} t={t} start={45.15} end={WIPE2 + 0.8} exit={0} />
          </>
        )}
      </WipeClip>
      <WipeClip x={x2} side="after">
        <Offer t={t} />
        <Headline text={brief.offer} t={t} start={50.95} end={55.85} />
      </WipeClip>
      {t > 55.6 && t < 56.6 && <LightSweep p={ramp(t, 55.7, 0.8)} opacity={0.45} width={0.5} />}
      <CTA t={t} />

      {/* headlines */}
      <Headline text={brief.hook} t={t} start={0} end={3} exit={0} />
      <Headline text={brief.hook2} t={t} start={3.05} end={6.05} exit={0.2} color={nightText} />
      <Headline text={brief.clinic24} t={t} start={6.05} end={8.6} />
      <Headline text={brief.reveal} t={t} start={8.65} end={11.85} />
      <Headline text={brief.f1} t={t} start={12.1} end={17.75} />
      <Headline text={brief.f2} t={t} start={18.1} end={23.8} />
      <Headline text={brief.f5} t={t} start={35.05} end={40.8} size={68} />
      <Headline text={brief.f6} t={t} start={41.1} end={44.75} />
      <Headline text={brief.cta} t={t} start={56.0} end={60.1} exit={0} />

      <PulseWipe t={t} start={WIPE1} y={1000} />
      <PulseWipe t={t} start={WIPE2} y={1000} />

      {guides && <Guides />}
    </AbsoluteFill>
  );
};

/** QA overlay: the safe zones (not part of the final render). */
const Guides: React.FC = () => (
  <AbsoluteFill style={{ pointerEvents: 'none' }}>
    <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: SAFE.top, background: 'rgba(255,0,80,0.18)' }} />
    <div style={{ position: 'absolute', left: 0, right: 0, top: SAFE.bottom, height: H - SAFE.bottom, background: 'rgba(255,0,80,0.18)' }} />
    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: SAFE.left, background: 'rgba(255,0,80,0.18)' }} />
    <div style={{ position: 'absolute', left: SAFE.right, top: 0, bottom: 0, width: W - SAFE.right, background: 'rgba(255,0,80,0.18)' }} />
  </AbsoluteFill>
);

export const SCENES = tl.scenes;
