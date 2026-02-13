import { Composition } from 'remotion';
import { HelloWorld } from './HelloWorld';
import { ZentropyTagging } from './ZentropyTagging';
import { ZentropyRealUI } from './ZentropyRealUI';

export const RemotionRoot: React.FC = () => {
  return (
    <>
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
