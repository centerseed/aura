import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
  spring,
  Sequence,
} from 'remotion';

export const ZentropyTagging: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // 動畫階段時間點（30 fps）
  // 0-60: 用戶輸入出現 (0-2秒)
  // 60-120: Gatekeeper 分析 (2-4秒)
  // 120-240: 標籤逐一出現 (4-8秒)
  // 240-300: 結束畫面 (8-10秒)

  const userInput = "明天下午要跟客戶開會討論新產品方案";

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#0f172a', // slate-900
        fontFamily: 'SF Pro Display, -apple-system, BlinkMacSystemFont, sans-serif',
      }}
    >
      {/* 背景裝飾網格 */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `
            linear-gradient(rgba(148, 163, 184, 0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(148, 163, 184, 0.05) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px',
        }}
      />

      {/* 標題 */}
      <Sequence from={0} durationInFrames={300}>
        <Logo frame={frame} />
      </Sequence>

      {/* 階段 1: 用戶輸入 */}
      <Sequence from={0} durationInFrames={90}>
        <UserInput text={userInput} frame={frame} fps={fps} />
      </Sequence>

      {/* 階段 2: Gatekeeper 分析動畫 */}
      <Sequence from={60} durationInFrames={90}>
        <GatekeeperProcessing frame={frame - 60} fps={fps} />
      </Sequence>

      {/* 階段 3: 標籤出現 */}
      <Sequence from={120} durationInFrames={180}>
        <TagsAppear frame={frame - 120} fps={fps} />
      </Sequence>
    </AbsoluteFill>
  );
};

// Logo 組件
const Logo: React.FC<{ frame: number }> = ({ frame }) => {
  const opacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <div
      style={{
        position: 'absolute',
        top: 60,
        left: 0,
        right: 0,
        textAlign: 'center',
        opacity,
      }}
    >
      <h1
        style={{
          fontSize: 48,
          fontWeight: 700,
          color: '#3b82f6', // blue-500
          margin: 0,
          letterSpacing: '-0.02em',
        }}
      >
        Zentropy
      </h1>
      <p
        style={{
          fontSize: 18,
          color: '#94a3b8', // slate-400
          margin: '8px 0 0 0',
        }}
      >
        讓一切井然有序
      </p>
    </div>
  );
};

// 用戶輸入組件
const UserInput: React.FC<{ text: string; frame: number; fps: number }> = ({
  text,
  frame,
  fps,
}) => {
  const scale = spring({
    frame,
    fps,
    config: { damping: 100, stiffness: 200 },
  });

  const opacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });

  // 打字機效果
  const charsToShow = Math.floor(interpolate(frame, [10, 50], [0, text.length], {
    extrapolateRight: 'clamp',
  }));

  return (
    <div
      style={{
        position: 'absolute',
        top: '35%',
        left: '50%',
        transform: `translateX(-50%) scale(${scale})`,
        opacity,
        width: '80%',
        maxWidth: 800,
      }}
    >
      <div
        style={{
          fontSize: 16,
          color: '#64748b', // slate-500
          marginBottom: 12,
          fontWeight: 500,
        }}
      >
        用戶輸入：
      </div>
      <div
        style={{
          backgroundColor: '#1e293b', // slate-800
          padding: '24px 32px',
          borderRadius: 16,
          border: '2px solid #334155', // slate-700
          fontSize: 24,
          color: '#f1f5f9', // slate-100
          lineHeight: 1.6,
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)',
        }}
      >
        {text.slice(0, charsToShow)}
        {charsToShow < text.length && (
          <span style={{ opacity: 0.5, animation: 'blink 1s infinite' }}>|</span>
        )}
      </div>
    </div>
  );
};

// Gatekeeper 處理動畫
const GatekeeperProcessing: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const opacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });
  const dotCount = Math.floor((frame / 10) % 4); // 0, 1, 2, 3

  return (
    <div
      style={{
        position: 'absolute',
        top: '55%',
        left: '50%',
        transform: 'translateX(-50%)',
        opacity,
        textAlign: 'center',
      }}
    >
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 16,
          backgroundColor: '#1e293b',
          padding: '16px 32px',
          borderRadius: 12,
          border: '2px solid #3b82f6',
          boxShadow: '0 0 30px rgba(59, 130, 246, 0.3)',
        }}
      >
        <div
          style={{
            width: 24,
            height: 24,
            borderRadius: '50%',
            border: '3px solid #3b82f6',
            borderTopColor: 'transparent',
            animation: 'spin 1s linear infinite',
          }}
        />
        <span
          style={{
            fontSize: 20,
            color: '#60a5fa', // blue-400
            fontWeight: 600,
          }}
        >
          Gatekeeper 分析中{'.'.repeat(dotCount)}
        </span>
      </div>
    </div>
  );
};

// 標籤出現組件
const TagsAppear: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const tags = [
    { label: 'Entity', value: 'Project', color: '#8b5cf6', delay: 0 }, // violet
    { label: 'Status', value: 'Active', color: '#10b981', delay: 20 }, // green
    { label: 'Type', value: 'Meeting', color: '#f59e0b', delay: 40 }, // amber
    { label: 'Priority', value: 'High', color: '#ef4444', delay: 60 }, // red
  ];

  return (
    <div
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '90%',
        maxWidth: 900,
      }}
    >
      <div
        style={{
          fontSize: 20,
          color: '#94a3b8',
          marginBottom: 24,
          textAlign: 'center',
          fontWeight: 600,
        }}
      >
        ✨ 自動標記完成
      </div>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 20,
          justifyContent: 'center',
        }}
      >
        {tags.map((tag, index) => (
          <Tag key={index} tag={tag} frame={frame} fps={fps} />
        ))}
      </div>
    </div>
  );
};

// 單一標籤組件
const Tag: React.FC<{
  tag: { label: string; value: string; color: string; delay: number };
  frame: number;
  fps: number;
}> = ({ tag, frame, fps }) => {
  const adjustedFrame = Math.max(0, frame - tag.delay);

  const scale = spring({
    frame: adjustedFrame,
    fps,
    config: { damping: 100, stiffness: 300 },
  });

  const opacity = interpolate(adjustedFrame, [0, 10], [0, 1], {
    extrapolateRight: 'clamp',
  });

  if (frame < tag.delay) return null;

  return (
    <div
      style={{
        transform: `scale(${scale})`,
        opacity,
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <div
        style={{
          fontSize: 14,
          color: '#94a3b8',
          fontWeight: 500,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        {tag.label}
      </div>
      <div
        style={{
          backgroundColor: tag.color,
          padding: '16px 32px',
          borderRadius: 12,
          fontSize: 28,
          fontWeight: 700,
          color: 'white',
          boxShadow: `0 8px 32px ${tag.color}40`,
          border: `2px solid ${tag.color}`,
        }}
      >
        {tag.value}
      </div>
    </div>
  );
};
