import {
  AbsoluteFill,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
} from 'remotion';
import React from 'react';

// ─── Timeline (30fps = 30s = 900 frames) ─────────────────────────────────────
// S1 Hook           0  -  90  (3s)   Pattern Interrupt — 大字衝擊
// S2 Feature A     90  - 390  (10s)  補充訓練卡片動畫展示
// S3 Feature B    390  - 660  (9s)   動作圖示指引 bottom sheet
// S4 BugFix       660  - 780  (4s)   課表流程修復說明
// S5 CTA          780  - 900  (4s)   Paceriz 品牌 + CTA
// TOTAL: 900 frames = 30s

const T = {
  S1_IN: 0,
  S2_IN: 90,
  S2_CARD: 110,
  S2_BADGE: 180,
  S2_EXERCISES: 220,
  S2_EX1: 240,
  S2_EX2: 270,
  S2_EX3: 300,
  S2_EX4: 330,
  S2_CAPTION: 360,
  S3_IN: 390,
  S3_HIGHLIGHT: 430,
  S3_SHEET: 460,
  S3_IMG: 490,
  S3_DESC: 540,
  S3_CAPTION: 580,
  S4_IN: 660,
  S4_CHECK: 690,
  S4_ITEM1: 710,
  S4_ITEM2: 735,
  S4_ITEM3: 760,
  S5_IN: 780,
  S5_LOGO: 800,
  S5_TAG: 840,
  S5_URL: 870,
  TOTAL: 900,
};

// ─── Paceriz Color System ────────────────────────────────────────────────────
const C = {
  pageBg: '#080E1B',
  card: '#111C32',
  cardDark: '#0D1626',
  cardBorder: '#1E3358',
  white: '#FFFFFF',
  dim: '#94A3B8',
  muted: '#4B5A72',
  orange: '#F97316',
  orangeBg: 'rgba(249,115,22,0.12)',
  orangeBorder: 'rgba(249,115,22,0.3)',
  purple: '#818CF8',
  purpleBg: 'rgba(129,140,248,0.12)',
  green: '#10B981',
  greenBg: 'rgba(16,185,129,0.12)',
  blue: '#3B82F6',
  blueBg: 'rgba(59,130,246,0.12)',
  teal: '#22D3EE',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fi = (frame: number, a: number, b: number, from = 0, to = 1): number =>
  interpolate(frame, [a, b], [from, to], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

const fadeIn = (frame: number, start: number, dur = 20) =>
  easeOut(fi(frame, start, start + dur));

const fadeOut = (frame: number, start: number, dur = 20) =>
  1 - easeOut(fi(frame, start, start + dur));

const slideUp = (frame: number, start: number, dur = 25, dist = 50) =>
  (1 - easeOut(fi(frame, start, start + dur))) * dist;

const scaleIn = (frame: number, start: number, dur = 20, from = 0.85) =>
  from + (1 - from) * easeOut(fi(frame, start, start + dur));

// ─── Scene 1: Hook ────────────────────────────────────────────────────────────
const SceneHook: React.FC<{ frame: number }> = ({ frame }) => {
  const bgOp = Math.min(fadeIn(frame, 0, 8), fadeOut(frame, T.S2_IN - 15, 15));

  // NEW badge
  const badgeOp = fadeIn(frame, 5, 12);
  const badgeScale = scaleIn(frame, 5, 12, 0.5);

  // 主標題 — 切割兩行分別進場
  const line1Op = fadeIn(frame, 10, 18);
  const line1Y = slideUp(frame, 10, 18, 60);

  const line2Op = fadeIn(frame, 28, 18);
  const line2Y = slideUp(frame, 28, 18, 60);

  // 副標題
  const subOp = fadeIn(frame, 48, 20);
  const subY = slideUp(frame, 48, 20, 40);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: C.pageBg,
        opacity: bgOp,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 0,
      }}
    >
      {/* Background glow */}
      <div
        style={{
          position: 'absolute',
          width: 600,
          height: 600,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(249,115,22,0.15) 0%, transparent 70%)',
          top: '25%',
          left: '50%',
          transform: 'translateX(-50%)',
        }}
      />

      {/* NEW badge */}
      <div
        style={{
          opacity: badgeOp,
          transform: `scale(${badgeScale})`,
          backgroundColor: C.orange,
          borderRadius: 40,
          padding: '10px 36px',
          marginBottom: 32,
        }}
      >
        <span style={{ color: C.white, fontSize: 32, fontWeight: 800, letterSpacing: 4, fontFamily: 'sans-serif' }}>
          測試版新功能
        </span>
      </div>

      {/* Main headline */}
      <div
        style={{
          opacity: line1Op,
          transform: `translateY(${line1Y}px)`,
          fontSize: 96,
          fontWeight: 900,
          color: C.white,
          fontFamily: 'sans-serif',
          textAlign: 'center',
          lineHeight: 1.1,
          padding: '0 60px',
        }}
      >
        肌力訓練
      </div>
      <div
        style={{
          opacity: line2Op,
          transform: `translateY(${line2Y}px)`,
          fontSize: 96,
          fontWeight: 900,
          color: C.orange,
          fontFamily: 'sans-serif',
          textAlign: 'center',
          lineHeight: 1.1,
          padding: '0 60px',
          marginBottom: 40,
        }}
      >
        AI 幫你規劃
      </div>

      {/* Sub */}
      <div
        style={{
          opacity: subOp,
          transform: `translateY(${subY}px)`,
          fontSize: 40,
          color: C.dim,
          fontFamily: 'sans-serif',
          textAlign: 'center',
          padding: '0 80px',
          lineHeight: 1.5,
        }}
      >
        跑步課表裡，自動配置肌力補充訓練
      </div>
    </AbsoluteFill>
  );
};

// ─── Scene 2: Supplementary Training Feature ─────────────────────────────────
const exercises = [
  { name: '棒式', detail: '3組 · 45秒', color: C.purple },
  { name: '死蟲式', detail: '3組 · 12次', color: C.blue },
  { name: '鳥狗式', detail: '3組 · 10次', color: C.teal },
  { name: '側棒式', detail: '2組 · 30秒', color: C.green },
];

const SceneFeatureA: React.FC<{ frame: number }> = ({ frame }) => {
  const bgOp = Math.min(
    fadeIn(frame, T.S2_IN, 18),
    fadeOut(frame, T.S3_IN - 15, 15),
  );

  // App header
  const headerOp = fadeIn(frame, T.S2_IN + 5, 15);

  // Day card slide in
  const cardOp = fadeIn(frame, T.S2_CARD, 20);
  const cardY = slideUp(frame, T.S2_CARD, 25, 80);

  // Orange "補充訓練" badge
  const badgeOp = fadeIn(frame, T.S2_BADGE, 18);
  const badgeScale = scaleIn(frame, T.S2_BADGE, 18, 0.6);

  // Exercise header
  const exHeaderOp = fadeIn(frame, T.S2_EXERCISES, 15);

  // Caption
  const captionOp = Math.min(
    fadeIn(frame, T.S2_CAPTION, 15),
    fadeOut(frame, T.S3_IN - 20, 15),
  );
  const captionY = slideUp(frame, T.S2_CAPTION, 20, 30);

  return (
    <AbsoluteFill style={{ backgroundColor: C.pageBg, opacity: bgOp, flexDirection: 'column' }}>
      {/* App Header */}
      <div
        style={{
          opacity: headerOp,
          padding: '70px 50px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span style={{ color: C.white, fontSize: 44, fontWeight: 700, fontFamily: 'sans-serif' }}>
          訓練計畫
        </span>
      </div>

      {/* Day info row */}
      <div style={{ opacity: cardOp, transform: `translateY(${cardY}px)`, padding: '0 48px' }}>
        <div
          style={{
            backgroundColor: C.card,
            borderRadius: 20,
            border: `1px solid ${C.cardBorder}`,
            overflow: 'hidden',
          }}
        >
          {/* Day header */}
          <div
            style={{
              padding: '24px 32px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <span style={{ color: C.white, fontSize: 36, fontWeight: 700, fontFamily: 'sans-serif' }}>
                星期二
              </span>
              <span style={{ color: C.dim, fontSize: 30, fontFamily: 'sans-serif' }}>03/17</span>
            </div>
            <div
              style={{
                backgroundColor: C.greenBg,
                border: `1px solid ${C.green}`,
                borderRadius: 20,
                padding: '6px 24px',
              }}
            >
              <span style={{ color: C.green, fontSize: 28, fontWeight: 600, fontFamily: 'sans-serif' }}>
                輕鬆跑
              </span>
            </div>
          </div>

          {/* Run detail */}
          <div style={{ padding: '0 32px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ color: C.white, fontSize: 34, fontWeight: 600, fontFamily: 'sans-serif' }}>7.0 km</span>
            <span style={{ color: C.muted, fontSize: 28, fontFamily: 'sans-serif' }}>·</span>
            <span style={{ color: C.dim, fontSize: 28, fontFamily: 'sans-serif' }}>HR 141-162</span>
          </div>

          {/* Supplementary Training Badge */}
          <div style={{ padding: '0 32px 16px' }}>
            <div
              style={{
                opacity: badgeOp,
                transform: `scale(${badgeScale})`,
                transformOrigin: 'left center',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                backgroundColor: C.orangeBg,
                border: `1px solid ${C.orangeBorder}`,
                borderRadius: 12,
                padding: '10px 20px',
              }}
            >
              <span style={{ fontSize: 26 }}>➕</span>
              <span style={{ color: C.orange, fontSize: 28, fontWeight: 700, fontFamily: 'sans-serif' }}>
                補充訓練
              </span>
            </div>
          </div>

          {/* Strength type */}
          <div style={{ padding: '0 32px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: C.white, fontSize: 30, fontWeight: 600, fontFamily: 'sans-serif' }}>
              核心穩定訓練
            </span>
            <span style={{ color: C.dim, fontSize: 28, fontFamily: 'sans-serif' }}>15分鐘</span>
          </div>

          {/* Exercise list */}
          <div
            style={{
              margin: '0 32px 24px',
              backgroundColor: C.purpleBg,
              borderRadius: 14,
              padding: '16px 20px',
              opacity: exHeaderOp,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <span style={{ fontSize: 24 }}>💪</span>
              <span style={{ color: C.dim, fontSize: 26, fontWeight: 600, fontFamily: 'sans-serif' }}>訓練動作</span>
            </div>
            {exercises.map((ex, i) => {
              const exOp = fadeIn(frame, T.S2_EX1 + i * 30, 18);
              const exY = slideUp(frame, T.S2_EX1 + i * 30, 20, 24);
              return (
                <div
                  key={ex.name}
                  style={{
                    opacity: exOp,
                    transform: `translateY(${exY}px)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingBottom: i < exercises.length - 1 ? 14 : 0,
                    borderBottom: i < exercises.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                    marginBottom: i < exercises.length - 1 ? 14 : 0,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ color: C.muted, fontSize: 26, fontFamily: 'sans-serif' }}>{i + 1}.</span>
                    <span style={{ color: C.white, fontSize: 30, fontFamily: 'sans-serif' }}>{ex.name}</span>
                  </div>
                  <span style={{ color: ex.color, fontSize: 26, fontFamily: 'sans-serif' }}>{ex.detail}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Caption */}
      <div
        style={{
          opacity: captionOp,
          transform: `translateY(${captionY}px)`,
          position: 'absolute',
          bottom: 120,
          left: 0,
          right: 0,
          padding: '0 60px',
        }}
      >
        <div
          style={{
            backgroundColor: 'rgba(0,0,0,0.75)',
            borderRadius: 16,
            padding: '20px 32px',
          }}
        >
          <p
            style={{
              color: C.white,
              fontSize: 38,
              fontFamily: 'sans-serif',
              textAlign: 'center',
              margin: 0,
              lineHeight: 1.4,
            }}
          >
            AI 根據訓練計畫，自動配置肌力補充訓練
          </p>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ─── Scene 3: Exercise Instruction ───────────────────────────────────────────
const SceneFeatureB: React.FC<{ frame: number }> = ({ frame }) => {
  const bgOp = Math.min(
    fadeIn(frame, T.S3_IN, 15),
    fadeOut(frame, T.S4_IN - 15, 15),
  );

  // Highlight effect on "棒式" row
  const highlightOp = Math.min(
    fadeIn(frame, T.S3_HIGHLIGHT, 12),
    fadeOut(frame, T.S3_SHEET - 5, 10),
  );

  // Bottom sheet slide up
  const sheetProgress = easeOut(fi(frame, T.S3_SHEET, T.S3_SHEET + 30));
  const sheetY = (1 - sheetProgress) * 900;

  // Image fade in
  const imgOp = fadeIn(frame, T.S3_IMG, 20);

  // Description text
  const descOp = fadeIn(frame, T.S3_DESC, 20);

  // Caption
  const captionOp = Math.min(
    fadeIn(frame, T.S3_CAPTION, 15),
    fadeOut(frame, T.S4_IN - 20, 15),
  );

  return (
    <AbsoluteFill style={{ backgroundColor: C.pageBg, opacity: bgOp }}>
      {/* Dimmed background with exercise list */}
      <div style={{ position: 'absolute', inset: 0, padding: '70px 48px 0' }}>
        {/* Simplified exercise list (dimmed) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 24,
          }}
        >
          <span style={{ color: C.white, fontSize: 44, fontWeight: 700, fontFamily: 'sans-serif' }}>
            訓練計畫
          </span>
        </div>
        <div
          style={{
            backgroundColor: C.card,
            borderRadius: 20,
            border: `1px solid ${C.cardBorder}`,
            padding: '24px 32px',
            opacity: 0.4,
          }}
        >
          <div style={{ marginBottom: 16, opacity: 0.8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <span style={{ fontSize: 24 }}>💪</span>
              <span style={{ color: C.dim, fontSize: 26, fontWeight: 600, fontFamily: 'sans-serif' }}>訓練動作</span>
            </div>
            {exercises.map((ex, i) => (
              <div
                key={ex.name}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingBottom: i < exercises.length - 1 ? 14 : 0,
                  marginBottom: i < exercises.length - 1 ? 14 : 0,
                  // Highlight 棒式
                  backgroundColor: i === 0 ? `rgba(249,115,22,${0.2 * highlightOp})` : 'transparent',
                  borderRadius: i === 0 ? 8 : 0,
                  padding: i === 0 ? '6px 10px' : '0',
                  border: i === 0 ? `1px solid rgba(249,115,22,${0.5 * highlightOp})` : 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ color: C.muted, fontSize: 26, fontFamily: 'sans-serif' }}>{i + 1}.</span>
                  <span style={{ color: C.white, fontSize: 30, fontFamily: 'sans-serif' }}>{ex.name}</span>
                </div>
                <span style={{ color: ex.color, fontSize: 26, fontFamily: 'sans-serif' }}>{ex.detail}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Overlay dim */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: `rgba(0,0,0,${0.5 * sheetProgress})`,
        }}
      />

      {/* Bottom Sheet */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          transform: `translateY(${sheetY}px)`,
          backgroundColor: '#142036',
          borderTopLeftRadius: 32,
          borderTopRightRadius: 32,
          border: `1px solid ${C.cardBorder}`,
          borderBottom: 'none',
          padding: '0 0 80px',
          minHeight: 900,
        }}
      >
        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '20px 0 16px' }}>
          <div style={{ width: 48, height: 6, borderRadius: 3, backgroundColor: C.muted }} />
        </div>

        {/* Header */}
        <div style={{ padding: '0 48px 20px', borderBottom: `1px solid ${C.cardBorder}` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ color: C.dim, fontSize: 30, fontFamily: 'sans-serif' }}>動作指引</span>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                backgroundColor: C.muted + '33',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span style={{ color: C.dim, fontSize: 26 }}>✕</span>
            </div>
          </div>
          <div style={{ fontSize: 54, fontWeight: 800, color: C.white, fontFamily: 'sans-serif', marginTop: 12 }}>
            棒式 Plank
          </div>
        </div>

        {/* Exercise Image */}
        <div
          style={{
            opacity: imgOp,
            padding: '32px 48px 24px',
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <Img
            src={staticFile('exercises/exercise_plank.png')}
            style={{
              width: 480,
              height: 320,
              objectFit: 'contain',
              borderRadius: 16,
              backgroundColor: 'rgba(255,255,255,0.05)',
            }}
          />
        </div>

        {/* Description */}
        <div
          style={{
            opacity: descOp,
            padding: '0 48px',
          }}
        >
          <p
            style={{
              color: C.dim,
              fontSize: 30,
              fontFamily: 'sans-serif',
              lineHeight: 1.7,
              margin: 0,
            }}
          >
            撐起身體，保持頭、肩、臀、腳跟成一直線。核心收緊，避免腰部下塌或臀部抬高。維持穩定呼吸，感受腹部肌群持續出力。
          </p>
        </div>
      </div>

      {/* Caption */}
      <div
        style={{
          opacity: captionOp,
          position: 'absolute',
          top: 80,
          left: 0,
          right: 0,
          padding: '0 60px',
        }}
      >
        <div
          style={{
            backgroundColor: 'rgba(0,0,0,0.8)',
            borderRadius: 16,
            padding: '16px 28px',
          }}
        >
          <p
            style={{
              color: C.white,
              fontSize: 34,
              fontFamily: 'sans-serif',
              textAlign: 'center',
              margin: 0,
            }}
          >
            點選任一動作，即可查看圖示說明
          </p>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ─── Scene 4: Bug Fix ─────────────────────────────────────────────────────────
const bugItems = [
  { icon: '🔄', text: '回到 App 自動重新整理本週課表' },
  { icon: '🛠', text: '修復課表更新後顯示舊資料的問題' },
  { icon: '⚡', text: '課表生成流程更穩定，不再錯過更新' },
];

const SceneBugFix: React.FC<{ frame: number }> = ({ frame }) => {
  const bgOp = Math.min(
    fadeIn(frame, T.S4_IN, 18),
    fadeOut(frame, T.S5_IN - 15, 15),
  );

  const titleOp = fadeIn(frame, T.S4_IN + 10, 20);
  const titleY = slideUp(frame, T.S4_IN + 10, 20, 50);

  const checkOp = fadeIn(frame, T.S4_CHECK, 18);
  const checkScale = scaleIn(frame, T.S4_CHECK, 18, 0.3);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: C.pageBg,
        opacity: bgOp,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        padding: '0 60px',
        gap: 0,
      }}
    >
      {/* Background glow */}
      <div
        style={{
          position: 'absolute',
          width: 500,
          height: 500,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(16,185,129,0.1) 0%, transparent 70%)',
          top: '30%',
          left: '50%',
          transform: 'translateX(-50%)',
        }}
      />

      {/* Check icon */}
      <div
        style={{
          opacity: checkOp,
          transform: `scale(${checkScale})`,
          width: 100,
          height: 100,
          borderRadius: '50%',
          backgroundColor: C.greenBg,
          border: `2px solid ${C.green}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 36,
          fontSize: 52,
        }}
      >
        ✓
      </div>

      {/* Title */}
      <div
        style={{
          opacity: titleOp,
          transform: `translateY(${titleY}px)`,
          textAlign: 'center',
          marginBottom: 48,
        }}
      >
        <div style={{ fontSize: 30, color: C.green, fontFamily: 'sans-serif', fontWeight: 600, marginBottom: 12 }}>
          BUG FIX
        </div>
        <div style={{ fontSize: 60, fontWeight: 800, color: C.white, fontFamily: 'sans-serif', lineHeight: 1.2 }}>
          課表流程修復
        </div>
      </div>

      {/* Bug items */}
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {bugItems.map((item, i) => {
          const op = fadeIn(frame, T.S4_ITEM1 + i * 25, 18);
          const y = slideUp(frame, T.S4_ITEM1 + i * 25, 20, 30);
          return (
            <div
              key={i}
              style={{
                opacity: op,
                transform: `translateY(${y}px)`,
                backgroundColor: C.greenBg,
                border: `1px solid rgba(16,185,129,0.25)`,
                borderRadius: 16,
                padding: '22px 28px',
                display: 'flex',
                alignItems: 'center',
                gap: 20,
              }}
            >
              <span style={{ fontSize: 36 }}>{item.icon}</span>
              <span style={{ color: C.white, fontSize: 32, fontFamily: 'sans-serif', lineHeight: 1.4 }}>
                {item.text}
              </span>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// ─── Scene 5: CTA ─────────────────────────────────────────────────────────────
const SceneCTA: React.FC<{ frame: number }> = ({ frame }) => {
  const bgOp = fadeIn(frame, T.S5_IN, 18);

  const logoOp = fadeIn(frame, T.S5_LOGO, 20);
  const logoScale = scaleIn(frame, T.S5_LOGO, 20, 0.8);

  const tagOp = fadeIn(frame, T.S5_TAG, 18);
  const tagY = slideUp(frame, T.S5_TAG, 18, 30);

  const urlOp = fadeIn(frame, T.S5_URL, 18);
  const urlY = slideUp(frame, T.S5_URL, 18, 30);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: C.pageBg,
        opacity: bgOp,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 0,
      }}
    >
      {/* Background glow */}
      <div
        style={{
          position: 'absolute',
          width: 700,
          height: 700,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 70%)',
          top: '20%',
          left: '50%',
          transform: 'translateX(-50%)',
        }}
      />

      {/* Logo */}
      <div
        style={{
          opacity: logoOp,
          transform: `scale(${logoScale})`,
          marginBottom: 48,
        }}
      >
        <Img
          src={staticFile('paceriz_dark.png')}
          style={{ width: 200, height: 200, objectFit: 'contain' }}
        />
      </div>

      {/* Tagline */}
      <div
        style={{
          opacity: tagOp,
          transform: `translateY(${tagY}px)`,
          textAlign: 'center',
          marginBottom: 40,
        }}
      >
        <div style={{ fontSize: 58, fontWeight: 800, color: C.white, fontFamily: 'sans-serif', lineHeight: 1.2 }}>
          Paceriz
        </div>
        <div style={{ fontSize: 36, color: C.dim, fontFamily: 'sans-serif', marginTop: 12 }}>
          你的 AI 跑步教練
        </div>
      </div>

      {/* URL / CTA */}
      <div
        style={{
          opacity: urlOp,
          transform: `translateY(${urlY}px)`,
          backgroundColor: 'rgba(59,130,246,0.12)',
          border: '1px solid rgba(59,130,246,0.4)',
          borderRadius: 16,
          padding: '20px 48px',
        }}
      >
        <span
          style={{
            color: C.blue,
            fontSize: 34,
            fontFamily: 'monospace',
            letterSpacing: 1,
          }}
        >
          測試版體驗申請中
        </span>
      </div>
    </AbsoluteFill>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
export const PacerizNewFeatures: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ backgroundColor: C.pageBg }}>
      <SceneHook frame={frame} />
      <SceneFeatureA frame={frame} />
      <SceneFeatureB frame={frame} />
      <SceneBugFix frame={frame} />
      <SceneCTA frame={frame} />
    </AbsoluteFill>
  );
};
