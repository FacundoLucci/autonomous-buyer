import {Composition} from 'remotion';
import {Film} from './Film';
import {defaultProps, DURATION_FRAMES, FPS, HEIGHT, WIDTH} from './manifest';

export const Root = () => (
  <>
    <Composition id="BuyHardSilent" component={Film} durationInFrames={DURATION_FRAMES}
      fps={FPS} width={WIDTH} height={HEIGHT} defaultProps={defaultProps} />
    <Composition id="BuyHardCues" component={Film} durationInFrames={DURATION_FRAMES}
      fps={FPS} width={WIDTH} height={HEIGHT} defaultProps={{...defaultProps, cues: true}} />
  </>
);
