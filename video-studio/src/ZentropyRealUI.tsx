import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
  spring,
  Sequence,
} from 'remotion';

/**
 * 基於真實 Zentropy UI 設計的動畫
 *
 * 設計系統來源：
 * - web/app/globals.css（配色、陰影）
 * - web/app/dashboard/page.tsx（狀態標籤）
 * - web/components/quick-capture.tsx（輸入框）
 */

export const ZentropyRealUI: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // 真實配色（從 globals.css）
  const colors = {
    background: 'hsl(222.2, 84%, 4.9%)',      // --background (dark)
    foreground: 'hsl(210, 40%, 98%)',         // --foreground
    cardBg: 'hsla(0, 0%, 100%, 0.1)',         // bg-white/10
    cardBorder: 'hsla(0, 0%, 100%, 0.1)',     // border-white/10
    inputBg: 'hsla(0, 0%, 100%, 0.1)',        // bg-white/10
    inputBorder: 'hsla(0, 0%, 100%, 0.3)',    // border-white/30
    textMuted: 'hsla(0, 0%, 100%, 0.6)',      // text-white/60

    // 狀態標籤（從 dashboard/page.tsx）
    inbox: '#f59e0b',      // text-amber-500
    active: '#3b82f6',     // text-blue-500
    maintain: '#6366f1',   // text-indigo-500
    reference: '#10b981',  // text-green-500
  };

  return (
    <AbsoluteFill style={{ backgroundColor: colors.background }}>
      {/* 步驟 1: 輸入框出現 (0-60 幀) */}
      <Sequence from={0} durationInFrames={300}>
        <InputBox frame={frame} fps={fps} colors={colors} />
      </Sequence>

      {/* 步驟 2: AI 處理動畫 (60-120 幀) */}
      <Sequence from={60} durationInFrames={90}>
        <AIProcessing frame={frame - 60} fps={fps} colors={colors} />
      </Sequence>

      {/* 步驟 3: 標籤出現 (120-300 幀) */}
      <Sequence from={120} durationInFrames={180}>
        <TagsResult frame={frame - 120} fps={fps} colors={colors} />
      </Sequence>
    </AbsoluteFill>
  );
};

// 輸入框組件（模擬 QuickCapture）
const InputBox: React.FC<{ frame: number; fps: number; colors: any }> = ({
  frame,
  fps,
  colors,
}) => {
  const opacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });

  const scale = spring({
    frame,
    fps,
    config: { damping: 100, stiffness: 200 },
  });

  // 打字機效果
  const text = '明天下午要跟客戶開會討論新產品方案';
  const charsToShow = Math.floor(
    interpolate(frame, [10, 50], [0, text.length], { extrapolateRight: 'clamp' })
  );

  return (
    <div
      style={{
        position: 'absolute',
        top: '30%',
        left: '50%',
        transform: `translateX(-50%) scale(${scale})`,
        opacity,
        width: '80%',
        maxWidth: 800,
      }}
    >
      {/* 輸入框（真實樣式）*/}
      <div
        style={{
          backgroundColor: colors.inputBg,
          border: `1px solid ${colors.inputBorder}`,
          borderRadius: 12,
          padding: '16px 20px',
          boxShadow: '0 8px 30px -8px rgba(0,0,0,0.4), 0 4px 12px -4px rgba(0,0,0,0.25)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <textarea
          readOnly
          value={text.slice(0, charsToShow)}
          style={{
            width: '100%',
            backgroundColor: 'transparent',
            border: 'none',
            color: colors.foreground,
            fontSize: 18,
            fontFamily: 'SF Pro Display, -apple-system, sans-serif',
            resize: 'none',
            outline: 'none',
            lineHeight: 1.6,
          }}
          rows={2}
        />
        {charsToShow < text.length && (
          <span
            style={{
              color: colors.textMuted,
              animation: 'blink 1s infinite',
            }}
          >
            |
          </span>
        )}
      </div>

      {/* 提示文字 */}
      <div
        style={{
          marginTop: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          color: colors.textMuted,
          fontSize: 14,
        }}
      >
        <SparklesIcon />
        <span>AI 正在理解你的輸入...</span>
      </div>
    </div>
  );
};

// AI 處理動畫
const AIProcessing: React.FC<{ frame: number; fps: number; colors: any }> = ({
  frame,
  fps,
  colors,
}) => {
  const opacity = interpolate(frame, [0, 15], [0, 1]);
  const rotation = (frame * 6) % 360;

  return (
    <div
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        opacity,
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          border: `3px solid ${colors.active}`,
          borderTopColor: 'transparent',
          borderRadius: '50%',
          margin: '0 auto 16px',
          transform: `rotate(${rotation}deg)`,
        }}
      />
      <div style={{ color: colors.foreground, fontSize: 16 }}>
        Gatekeeper 分析中...
      </div>
    </div>
  );
};

// 標籤結果組件
const TagsResult: React.FC<{ frame: number; fps: number; colors: any }> = ({
  frame,
  fps,
  colors,
}) => {
  const tags = [
    { label: 'Area', value: 'Naruvia', color: colors.reference, delay: 0 },
    { label: 'Product', value: '新產品開發', color: colors.active, delay: 20 },
    { label: 'Status', value: '進行中', color: colors.active, delay: 40 },
    { label: 'Topic', value: '客戶會議', color: colors.inbox, delay: 60 },
  ];

  return (
    <div
      style={{
        position: 'absolute',
        top: '40%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '90%',
        maxWidth: 900,
      }}
    >
      <div
        style={{
          color: colors.foreground,
          fontSize: 24,
          fontWeight: 600,
          marginBottom: 32,
          textAlign: 'center',
        }}
      >
        ✨ 自動標記完成
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 24,
        }}
      >
        {tags.map((tag, index) => (
          <Tag key={index} tag={tag} frame={frame} fps={fps} colors={colors} />
        ))}
      </div>
    </div>
  );
};

// 單一標籤
const Tag: React.FC<{
  tag: { label: string; value: string; color: string; delay: number };
  frame: number;
  fps: number;
  colors: any;
}> = ({ tag, frame, fps, colors }) => {
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
        backgroundColor: colors.cardBg,
        border: `1px solid ${colors.cardBorder}`,
        borderRadius: 12,
        padding: '20px 24px',
        backdropFilter: 'blur(12px)',
        boxShadow: '0 8px 30px -8px rgba(0,0,0,0.4)',
      }}
    >
      <div
        style={{
          fontSize: 12,
          color: colors.textMuted,
          fontWeight: 500,
          marginBottom: 8,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        {tag.label}
      </div>
      <div
        style={{
          fontSize: 20,
          fontWeight: 600,
          color: tag.color,
        }}
      >
        {tag.value}
      </div>
    </div>
  );
};

// Sparkles Icon
const SparklesIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6L5.6 18.4" />
  </svg>
);
