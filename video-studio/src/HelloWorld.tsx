import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
  spring,
} from 'remotion';

interface HelloWorldProps {
  titleText: string;
  titleColor: string;
}

export const HelloWorld: React.FC<HelloWorldProps> = ({
  titleText,
  titleColor,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scale = spring({
    frame,
    fps,
    config: {
      damping: 100,
    },
  });

  const opacity = interpolate(frame, [0, 30], [0, 1], {
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#f0f4f8',
        justifyContent: 'center',
        alignItems: 'center',
        fontFamily: 'SF Pro Display, -apple-system, BlinkMacSystemFont, sans-serif',
      }}
    >
      <div
        style={{
          transform: `scale(${scale})`,
          opacity,
        }}
      >
        <h1
          style={{
            fontSize: 120,
            fontWeight: 700,
            color: titleColor,
            textAlign: 'center',
            margin: 0,
          }}
        >
          {titleText}
        </h1>
        <p
          style={{
            fontSize: 40,
            color: '#64748b',
            textAlign: 'center',
            marginTop: 20,
          }}
        >
          讓一切井然有序
        </p>
      </div>
    </AbsoluteFill>
  );
};
