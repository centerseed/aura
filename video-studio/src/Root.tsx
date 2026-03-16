import { Composition } from 'remotion';
import { HelloWorld } from './HelloWorld';
import { ZentropyTagging } from './ZentropyTagging';
import { ZentropyRealUI } from './ZentropyRealUI';
import { ZentropyCapture } from './ZentropyCapture';
import { ZentropyBrainDump } from './ZentropyBrainDump';
import { ZentropyScheduling } from './ZentropyScheduling';
import { PacerizNewFeatures } from './PacerizNewFeatures';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="PacerizNewFeatures"
        component={PacerizNewFeatures}
        durationInFrames={900}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="ZentropyCapture"
        component={ZentropyCapture}
        durationInFrames={900}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="ZentropyBrainDump"
        component={ZentropyBrainDump}
        durationInFrames={900}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="ZentropyScheduling"
        component={ZentropyScheduling}
        durationInFrames={900}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="HelloWorld"
        component={HelloWorld}
        durationInFrames={150}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          titleText: 'Naruvia Demo',
          titleColor: '#000000',
        }}
      />
      <Composition
        id="ZentropyTagging"
        component={ZentropyTagging}
        durationInFrames={300}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="ZentropyRealUI"
        component={ZentropyRealUI}
        durationInFrames={300}
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};
