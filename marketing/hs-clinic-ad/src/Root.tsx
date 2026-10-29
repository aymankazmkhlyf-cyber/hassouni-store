import React from 'react';
import { Composition } from 'remotion';
import { Main } from './Main';
import { FPS, H, W } from './theme';

export const Root: React.FC = () => (
  <>
    <Composition id="HSClinicAd" component={Main} durationInFrames={60 * FPS} fps={FPS} width={W} height={H} defaultProps={{ guides: false }} />
  </>
);
