import React from 'react';
import { Composition } from 'remotion';
import { Part1Showcase } from './scenes/Part1Showcase';
import { VideoA } from './VideoA';
import { FPS, H, W } from './theme';

export const Root: React.FC = () => (
  <>
    <Composition id="VideoA" component={VideoA} durationInFrames={60 * FPS} fps={FPS} width={W} height={H} defaultProps={{ guides: false }} />
    <Composition id="Part1Showcase" component={Part1Showcase} durationInFrames={14 * FPS} fps={FPS} width={W} height={H} />
  </>
);
