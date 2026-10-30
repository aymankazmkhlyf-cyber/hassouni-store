import React from 'react';
import { Composition } from 'remotion';
import { Main } from './Main';
import { Split } from './split/Split';
import { Premiere } from './split/Premiere';
import { FPS, H, W } from './theme';

export const Root: React.FC = () => (
  <>
    <Composition id="HSClinicAd" component={Main} durationInFrames={60 * FPS} fps={FPS} width={W} height={H} defaultProps={{ guides: false }} />
    <Composition id="HSClinicPremiere" component={Premiere} durationInFrames={60 * FPS} fps={FPS} width={W} height={H} />
    <Composition id="HSClinicSplit" component={Split} durationInFrames={60 * FPS} fps={FPS} width={W} height={H} />
  </>
);
