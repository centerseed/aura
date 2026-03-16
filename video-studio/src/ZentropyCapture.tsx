import {
  AbsoluteFill,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
} from 'remotion';
import React from 'react';

// ─── Timeline (30fps ≈ 30s = 900 frames) ─────────────────────────────────────
// Scene 2  Hook              0  – 180  (6s)   Q1 punch-in → list → Q2
// Scene 4  Quick Capture   180  – 520  (11.3s) typing → AI → tags + 字幕
// Scene 5a 結構視圖          520  – 720  (6.7s) project cards
// Scene 6  CTA              720  – 900  (6s)
//
// Hook 結構：
//   0f  Q1 立刻 punch-in（1.3 秒內視覺衝擊 ✓）
//  12f  Todo list 淡入作為痛點佐證
//  75f  Q1 淡出
//  80f  Q2 進場
// 180f  cross-dissolve to Scene 4
//
// Q1 全見：12–62 = 50f ≈ 1.7s（短問句 10 字，夠了）
// Q2 全見：98–180 = 82f = 2.7s ✓

const T = {
  S2_IN: 0,

  S4_BG: 180,
  S4_PANEL: 208,
  S4_TYPE_START: 238,
  S4_TYPE_END: 328,   // 打字 90f = 3s
  S4_SPIN_START: 340,
  S4_SPIN_END: 400,   // 旋轉 60f = 2s
  S4_TAGS_IN: 403,
  S4_CAP1: 242,       // 打字開始後 4f 字幕出現
  S4_CAP2: 408,       // tags 出現後 5f 字幕出現

  S5_IN: 520,
  S6_IN: 720,
  TOTAL: 900,
};

// ─── Colours ──────────────────────────────────────────────────────────────────
const C = {
  pageBg: '#0B1629',
  card: '#142244',
  cardBorder: '#243d72',
  inputBg: '#0d1c38',
  inputBorder: '#3b5bdb',
  white: '#ffffff',
  dim: '#b0c8e8',
  placeholder: '#6a80a0',
  cyan: '#22d3ee',
  cyanBg: '#0f2644',
  blue: '#3b82f6',
  indigo: '#818cf8',
  green: '#4ade80',
  orange: '#fb923c',
  sky: '#38bdf8',
  red: '#ef4444',
  redBg: 'rgba(239,68,68,0.12)',
  problemBg: '#080c14',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fi = (frame: number, a: number, b: number, from = 0, to = 1): number =>
  interpolate(frame, [a, b], [from, to], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

// ease-out cubic — fast start, smooth settle
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
// ease-in-out — for elements that need to feel weighty
const easeInOut = (t: number) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

const fadeIn = (frame: number, start: number, dur = 20) => {
  const t = fi(frame, start, start + dur);
  return easeOut(t);
};

const slideUp = (frame: number, start: number, dur = 30): number => {
  const t = easeOut(fi(frame, start, start + dur));
  return (1 - t) * 60; // translateY: 60px → 0
};

// fadeOut 改用 easeOut（與 fadeIn 互補），確保 cross-dissolve 無黑底穿透
const fadeOut = (frame: number, start: number, dur = 20) => {
  const t = fi(frame, start, start + dur);
  return 1 - easeOut(t);
};

// ─── Scene 2: Todo List Hook ──────────────────────────────────────────────────
const chaosItems = [
  '下週客戶開會要準備什麼？',
  '回覆 Alex 的提案 email',
  '整理上週開會紀錄',
  '更新產品路線圖',
  '確認行銷活動的進度',
  '這個月的費用還沒整理',
  '和團隊對齊下季方向',
  '繳房租',
];

const Scene23: React.FC<{ frame: number }> = ({ frame }) => {
  // cross-dissolve：dur=30，與 Scene4 bgOp dur 完全對齊
  const bgOut = fadeOut(frame, T.S4_BG, 30);

  // ── Hook 結構：Q1 先行，list 佐證，Q2 深化 ──
  // Q1：frame 0 立即 punch-in（1.3 秒內抓住眼球）
  const Q1_OUT = 75;
  const q1Op = Math.min(
    fadeIn(frame, 0, 8),           // 0.27s 極快入場
    fadeOut(frame, Q1_OUT, 14),
  );
  const q1Scale = 1.12 - 0.12 * easeOut(fi(frame, 0, 12)); // 更強 punch-in

  // Todo list：frame 12 淡入，Q1 的佐證
  const listOp = fadeIn(frame, 12, 20);

  // Q2：frame 80 進場，由 bgOut 帶走
  const Q2_IN = 80;
  const q2Op = Math.min(
    fadeIn(frame, Q2_IN, 18),
    bgOut,
  );
  const q2Scale = 1.08 - 0.08 * easeOut(fi(frame, Q2_IN, Q2_IN + 18));

  return (
    <AbsoluteFill style={{ backgroundColor: C.problemBg, opacity: bgOut }}>
      {/* Window chrome — 延後出現，讓 Q1 先佔據注意力 */}
      <div style={{ margin: '52px 52px 0', borderRadius: 18, overflow: 'hidden', border: '1px solid #222', opacity: listOp }}>
        <div style={{ backgroundColor: '#161616', padding: '18px 28px', display: 'flex', alignItems: 'center', gap: 12 }}>
          {['#ff5f57', '#febc2e', '#28c840'].map((c, i) => (
            <div key={i} style={{ width: 15, height: 15, borderRadius: '50%', backgroundColor: c }} />
          ))}
          <div style={{ color: '#888', fontSize: 32, marginLeft: 16, fontFamily: 'sans-serif' }}>
            📝 我的 Todo List
          </div>
          <div style={{ marginLeft: 'auto', color: '#555', fontSize: 28, fontFamily: 'sans-serif' }}>
            8 項目
          </div>
        </div>

        <div style={{ backgroundColor: '#111', padding: '10px 28px', display: 'flex', borderBottom: '1px solid #1e1e1e' }}>
          <div style={{ width: 20, marginRight: 22 }} />
          <div style={{ fontSize: 26, color: '#444', fontFamily: 'sans-serif', flex: 1 }}>任務名稱</div>
        </div>

        {chaosItems.map((text, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center',
            padding: '20px 28px', borderBottom: '1px solid #191919',
          }}>
            <div style={{ width: 22, height: 22, borderRadius: 4, border: '2px solid #2e2e2e', marginRight: 22, flexShrink: 0 }} />
            <div style={{ flex: 1, fontSize: 34, color: '#a0aec0', fontWeight: 400, fontFamily: 'sans-serif' }}>
              {text}
            </div>
          </div>
        ))}
      </div>

      {/* 問句 1：開場 hook — 畫面正中央，第 0 幀立刻出現 */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        opacity: q1Op, transform: `scale(${q1Scale})`,
        zIndex: 10, pointerEvents: 'none',
      }}>
        <div style={{
          fontSize: 80, fontWeight: 900,
          color: C.white, fontFamily: 'sans-serif',
          backgroundColor: 'rgba(0,0,0,0.92)', borderRadius: 22,
          padding: '36px 64px', border: `2.5px solid ${C.red}99`,
          lineHeight: 1.4, textAlign: 'center',
          boxShadow: '0 0 80px rgba(239,68,68,0.25)',
        }}>
          又是一堆事，<br /><span style={{ color: C.red }}>不知道從哪開始</span>
        </div>
      </div>

      {/* 問句 2：脈絡深化 — 同樣居中 */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        opacity: q2Op, transform: `scale(${q2Scale})`,
        zIndex: 10, pointerEvents: 'none',
      }}>
        <div style={{
          fontSize: 80, fontWeight: 900,
          color: C.white, fontFamily: 'sans-serif',
          backgroundColor: 'rgba(0,0,0,0.92)', borderRadius: 22,
          padding: '36px 64px', border: `2.5px solid ${C.orange}99`,
          lineHeight: 1.4, textAlign: 'center',
          boxShadow: '0 0 80px rgba(251,146,60,0.25)',
        }}>
          每天寫清單，<br />卻<span style={{ color: C.orange }}>越寫越焦慮</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ─── Scene 4: Quick Capture + AI classification ───────────────────────────────
const TYPED = '下週跟客戶開會要準備報價跟提案方向';

const Scene4: React.FC<{ frame: number }> = ({ frame }) => {
  // cross-dissolve：dur=30，與 Scene23 bgOut dur 完全對齊，消除黑底穿透
  const bgOp = fadeIn(frame, T.S4_BG, 30);
  const panelOp = fadeIn(frame, T.S4_PANEL, 22);
  const panelY = slideUp(frame, T.S4_PANEL, 30);
  // cross-dissolve out：dur=25，與 Scene5a op dur 對齊
  const sceneOut = fadeOut(frame, T.S5_IN, 25);

  const charCount = fi(frame, T.S4_TYPE_START, T.S4_TYPE_END, 0, TYPED.length);
  const typedText = TYPED.slice(0, Math.floor(charCount));
  const showCursor = frame < T.S4_SPIN_START && frame % 28 < 18;

  const spinning = frame >= T.S4_SPIN_START && frame < T.S4_SPIN_END;
  const spinAngle = fi(frame, T.S4_SPIN_START, T.S4_SPIN_END, 0, 720);

  const tags = [
    { label: '專案', value: '客戶提案', color: C.indigo },
    { label: '類型', value: '會議', color: C.green },
    { label: '優先度', value: 'P1', color: C.orange },
    { label: '時間軸', value: '本週', color: C.sky },
  ];

  // ── 字幕 1：打字時說明價值（讓觀眾知道這不是普通打字框）
  const cap1Op = (() => {
    const fadeInVal = fadeIn(frame, T.S4_CAP1, 18);
    const fadeOutVal = fadeOut(frame, T.S4_SPIN_START - 15, 18);
    return Math.min(fadeInVal, fadeOutVal);
  })();

  // ── 字幕 2：tags 出現時說明結果
  const cap2Op = (() => {
    const fadeInVal = fadeIn(frame, T.S4_CAP2, 18);
    const fadeOutVal = fadeOut(frame, T.S5_IN - 20, 18);
    return Math.min(fadeInVal, fadeOutVal);
  })();

  return (
    <AbsoluteFill style={{ backgroundColor: C.pageBg, opacity: bgOp * sceneOut }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 35%, rgba(59,91,219,0.10) 0%, transparent 65%)' }} />

      <div style={{ position: 'relative', zIndex: 1, padding: '100px 64px', display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Title */}
        <div style={{ marginBottom: 52 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 18 }}>
            <Img src={staticFile('zentropy-logo.svg')} style={{ width: 64, height: 64, borderRadius: 14 }} />
            <span style={{ fontSize: 60, fontWeight: 900, color: C.white, fontFamily: 'sans-serif', letterSpacing: -1 }}>Zentropy</span>
          </div>
          <div style={{ fontSize: 46, color: '#c8dcf4', fontFamily: 'sans-serif', lineHeight: 1.35 }}>
            說出來就好，<br /><span style={{ color: C.indigo }}>AI 幫你放對地方</span>
          </div>
        </div>

        {/* Quick capture card */}
        <div style={{
          opacity: panelOp, transform: `translateY(${panelY}px)`,
          backgroundColor: C.card, border: `1.5px solid ${C.cardBorder}`,
          borderRadius: 22, overflow: 'hidden',
          boxShadow: '0 20px 72px rgba(0,0,0,0.55)',
        }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', padding: '28px 36px 20px', borderBottom: `1px solid ${C.cardBorder}` }}>
            <span style={{ fontSize: 38, marginRight: 14, color: C.indigo }}>✦</span>
            <span style={{ fontSize: 44, fontWeight: 700, color: C.white, fontFamily: 'sans-serif', flex: 1 }}>快速記錄</span>
            <span style={{ fontSize: 34, color: C.placeholder, marginRight: 24, fontFamily: 'sans-serif' }}>∨</span>
            <span style={{ fontSize: 34, color: C.placeholder, fontFamily: 'sans-serif' }}>×</span>
          </div>

          {/* Input */}
          <div style={{ padding: '24px 36px 0' }}>
            <div style={{
              backgroundColor: C.inputBg, border: `2px solid ${C.inputBorder}`,
              borderRadius: 14, padding: '22px 26px', minHeight: 100,
              boxShadow: '0 0 0 3px rgba(59,91,219,0.14)',
            }}>
              {typedText.length === 0 ? (
                <span style={{ fontSize: 34, color: C.placeholder, fontFamily: 'sans-serif' }}>
                  輸入任何想法...
                </span>
              ) : (
                <span style={{ fontSize: 34, color: C.white, fontFamily: 'sans-serif', lineHeight: 1.5 }}>
                  {typedText}
                  {showCursor && (
                    <span style={{ display: 'inline-block', width: 3, height: 34, backgroundColor: C.inputBorder, marginLeft: 3, verticalAlign: 'text-bottom' }} />
                  )}
                </span>
              )}
            </div>
          </div>

          {/* Hint */}
          <div style={{ padding: '18px 36px 0' }}>
            <div style={{ backgroundColor: C.cyanBg, borderRadius: 10, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 28, color: C.cyan }}>⊙</span>
              <span style={{ fontSize: 30, color: C.cyan, fontFamily: 'sans-serif' }}>
                腦袋有幾件事，一次全倒出來也沒問題
              </span>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', alignItems: 'center', padding: '18px 36px 28px' }}>
            {['📷', '🎤'].map((icon, i) => (
              <div key={i} style={{
                width: 56, height: 56, borderRadius: 12, border: `1px solid ${C.cardBorder}`,
                backgroundColor: '#1a2a4a', display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: 26, marginRight: 14,
              }}>{icon}</div>
            ))}
            <div style={{ flex: 1 }} />
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              backgroundColor: C.blue, borderRadius: 12, padding: '14px 28px',
              boxShadow: frame >= T.S4_SPIN_START
                ? `0 0 ${fi(frame, T.S4_SPIN_START, T.S4_SPIN_START + 15, 0, 28)}px rgba(59,130,246,0.7)`
                : 'none',
            }}>
              <span style={{ fontSize: 34, color: C.white, fontWeight: 700, fontFamily: 'sans-serif' }}>送出</span>
              <span style={{ fontSize: 30, color: C.white }}>➤</span>
            </div>
          </div>
        </div>

        {/* AI spinning */}
        {spinning && (
          <div style={{ marginTop: 44, display: 'flex', alignItems: 'center', gap: 24, opacity: fadeIn(frame, T.S4_SPIN_START, 12) }}>
            <div style={{
              width: 48, height: 48, border: `4px solid ${C.indigo}`,
              borderTopColor: 'transparent', borderRadius: '50%',
              transform: `rotate(${spinAngle}deg)`,
            }} />
            <span style={{ fontSize: 38, color: C.indigo, fontFamily: 'sans-serif', fontWeight: 600 }}>
              AI 分析中...
            </span>
          </div>
        )}

        {/* Result tags */}
        {frame >= T.S4_TAGS_IN && (
          <div style={{ marginTop: 40, opacity: fadeIn(frame, T.S4_TAGS_IN, 18) }}>
            <div style={{ fontSize: 34, color: C.green, marginBottom: 24, fontFamily: 'sans-serif', display: 'flex', alignItems: 'center', gap: 14 }}>
              <span style={{ fontSize: 38 }}>✓</span> 自動分類完成
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
              {tags.map((tag, i) => (
                <div key={i} style={{
                  opacity: fadeIn(frame, T.S4_TAGS_IN + i * 14, 14),
                  backgroundColor: `${tag.color}1e`,
                  border: `1.5px solid ${tag.color}66`,
                  borderRadius: 12, padding: '12px 24px',
                  display: 'flex', gap: 12, alignItems: 'center',
                }}>
                  <span style={{ fontSize: 28, color: '#aabbd0', fontFamily: 'sans-serif' }}>{tag.label}</span>
                  <span style={{ fontSize: 36, color: tag.color, fontWeight: 700, fontFamily: 'sans-serif' }}>{tag.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 字幕 1：打字時 — 緊貼卡片正下方（卡片約結束在 750px）*/}
      <div style={{
        position: 'absolute', top: 790, left: 64, right: 64,
        opacity: cap1Op, textAlign: 'center', zIndex: 10,
        pointerEvents: 'none',
      }}>
        <div style={{
          display: 'inline-block', fontSize: 50, fontWeight: 900,
          color: C.white, fontFamily: 'sans-serif',
          backgroundColor: 'rgba(11,22,41,0.92)',
          borderRadius: 18, padding: '22px 52px',
          border: `1.5px solid ${C.indigo}55`,
          lineHeight: 1.4,
        }}>
          不用分類，不用排版，<br /><span style={{ color: C.indigo }}>腦袋倒出來就好</span>
        </div>
      </div>

      {/* 字幕 2：tags 出現後 — 緊貼 tags 正下方（tags 約結束在 950px）*/}
      <div style={{
        position: 'absolute', top: 1000, left: 64, right: 64,
        opacity: cap2Op, textAlign: 'center', zIndex: 10,
        pointerEvents: 'none',
      }}>
        <div style={{
          display: 'inline-block', fontSize: 50, fontWeight: 900,
          color: C.white, fontFamily: 'sans-serif',
          backgroundColor: 'rgba(11,22,41,0.92)',
          borderRadius: 18, padding: '22px 52px',
          border: `1.5px solid ${C.green}55`,
          lineHeight: 1.4,
        }}>
          <span style={{ color: C.green }}>AI 幫你決定</span>：<br />
          專案 · 優先度 · 時間軸
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ─── Scene 5a: 結構視圖 (real Zentropy mobile UI) ────────────────────────────
const S5A_PROJECTS = [
  {
    name: '客戶提案',
    priority: 'P1',
    desc: '準備下週提案：報價方案、簡報、開會流程',
    milestones: 3,
    highlight: true,
    tasks: [
      { text: '整理上週開會紀錄', due: null },
      { text: '準備報價跟提案方向', due: '3天後' },
      { text: '回覆 Alex 的 email 確認細節', due: '明天' },
    ],
    moreCount: 1,
  },
  {
    name: 'Q2 產品發布',
    priority: 'P1',
    desc: '更新路線圖、對齊團隊方向、確認行銷時程',
    milestones: 4,
    highlight: false,
    tasks: [
      { text: '更新產品路線圖文件', due: '5天後' },
      { text: '和團隊對齊下季優先級', due: '4天後' },
      { text: '確認行銷活動進度', due: '本週' },
    ],
    moreCount: 2,
  },
  {
    name: '個人財務',
    priority: 'P2',
    desc: '費用整理、預算規劃、每月帳款追蹤',
    milestones: 2,
    highlight: false,
    tasks: [
      { text: '整理這個月的費用明細', due: '本週' },
      { text: '繳房租', due: '明天' },
    ],
    moreCount: 0,
  },
];

const ProjectCard: React.FC<{
  proj: typeof S5A_PROJECTS[0];
  frame: number;
  entryFrame: number;
  scrollY: number;
}> = ({ proj, frame, entryFrame, scrollY }) => {
  const cardOp = fadeIn(frame, entryFrame, 18);
  const cardY = (1 - easeOut(fi(frame, entryFrame, entryFrame + 25))) * 50;
  const aiPulse = Math.sin((frame - entryFrame) * 0.18) * 0.15 + 0.85;

  return (
    <div style={{
      opacity: cardOp,
      transform: `translateY(${cardY + scrollY}px)`,
      backgroundColor: proj.highlight ? '#1a2d55' : C.card,
      border: `1.5px solid ${proj.highlight ? '#3b5bdb' : C.cardBorder}`,
      borderRadius: 20,
      marginBottom: 24,
      overflow: 'hidden',
      boxShadow: proj.highlight ? '0 4px 32px rgba(59,91,219,0.22)' : 'none',
    }}>
      {/* Card header */}
      <div style={{ padding: '22px 28px 14px', display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        <div style={{
          backgroundColor: '#ef4444',
          borderRadius: 8, padding: '4px 12px',
          fontSize: 26, fontWeight: 700, color: C.white,
          fontFamily: 'sans-serif', flexShrink: 0, marginTop: 4,
        }}>{proj.priority}</div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 38, fontWeight: 700, color: C.white, fontFamily: 'sans-serif', marginBottom: 6 }}>
            {proj.name}
          </div>
          <div style={{
            fontSize: 26, color: C.dim, fontFamily: 'sans-serif',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {proj.desc}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10, flexShrink: 0 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            backgroundColor: 'rgba(255,255,255,0.06)',
            borderRadius: 10, padding: '4px 14px',
          }}>
            <span style={{ fontSize: 22, color: C.dim }}>◆</span>
            <span style={{ fontSize: 28, color: C.dim, fontFamily: 'sans-serif' }}>{proj.milestones}</span>
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            backgroundColor: 'rgba(129,140,248,0.18)',
            border: '1px solid rgba(129,140,248,0.45)',
            borderRadius: 10, padding: '6px 18px',
            opacity: aiPulse,
          }}>
            <span style={{ fontSize: 24, color: C.indigo }}>✦</span>
            <span style={{ fontSize: 26, color: C.indigo, fontWeight: 700, fontFamily: 'sans-serif' }}>AI</span>
          </div>
        </div>
      </div>

      <div style={{ height: 1, backgroundColor: proj.highlight ? '#2a3f6f' : '#1e2d4a', margin: '0 28px' }} />

      <div style={{ padding: '14px 28px' }}>
        {proj.tasks.map((task, ti) => (
          <div key={ti} style={{
            display: 'flex', alignItems: 'center', gap: 14,
            padding: '10px 0',
            borderBottom: ti < proj.tasks.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
          }}>
            <div style={{
              width: 10, height: 10, borderRadius: '50%',
              backgroundColor: proj.highlight ? C.indigo : '#4a6490',
              flexShrink: 0,
            }} />
            <span style={{
              fontSize: 28, color: proj.highlight ? '#d0e0f8' : '#8899bb',
              fontFamily: 'sans-serif', flex: 1,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>{task.text}</span>
            {task.due && (
              <div style={{
                backgroundColor: 'rgba(251,146,60,0.14)',
                border: '1px solid rgba(251,146,60,0.4)',
                borderRadius: 8, padding: '3px 12px',
                fontSize: 24, color: C.orange,
                fontFamily: 'sans-serif', flexShrink: 0,
              }}>{task.due}</div>
            )}
          </div>
        ))}
        {proj.moreCount > 0 && (
          <div style={{ fontSize: 26, color: C.dim, fontFamily: 'sans-serif', padding: '6px 0 0 24px' }}>
            + {proj.moreCount} 更多任務
          </div>
        )}
      </div>
    </div>
  );
};

const Scene5a: React.FC<{ frame: number }> = ({ frame }) => {
  // cross-dissolve in：dur=25，與 Scene4 sceneOut dur 對齊
  const op = fadeIn(frame, T.S5_IN, 25);
  // cross-dissolve out：dur=25，與 Scene6 bgOp dur 對齊
  const out = fadeOut(frame, T.S6_IN, 25);

  const scrollStart = T.S5_IN + 70;
  const scrollY = fi(frame, scrollStart, scrollStart + 90, 0, -280);

  const navPulse = Math.sin((frame - T.S5_IN) * 0.15) * 0.12 + 0.88;

  return (
    <AbsoluteFill style={{ backgroundColor: '#0a1628', opacity: op * out, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 20%, rgba(59,91,219,0.08) 0%, transparent 60%)' }} />

      {/* Status bar */}
      <div style={{ position: 'relative', zIndex: 2, padding: '56px 52px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 26, color: '#6a80a0', fontFamily: 'sans-serif' }}>9:41</span>
        <div style={{ display: 'flex', gap: 14 }}>
          {['▌▌▌', '⬆', '🔋'].map((icon, i) => (
            <span key={i} style={{ fontSize: 22, color: '#6a80a0' }}>{icon}</span>
          ))}
        </div>
      </div>

      {/* Top bar */}
      <div style={{ position: 'relative', zIndex: 2, padding: '20px 52px 0', display: 'flex', alignItems: 'center', gap: 18 }}>
        <span style={{ fontSize: 30, color: '#6a9af8' }}>📂</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 38, fontWeight: 700, color: C.white, fontFamily: 'sans-serif' }}>事業</div>
          <div style={{ fontSize: 24, color: C.dim, fontFamily: 'sans-serif' }}>職涯發展、創業經營、技能提升、事業規劃</div>
        </div>
        <div style={{
          fontSize: 26, color: C.indigo,
          backgroundColor: 'rgba(129,140,248,0.12)',
          border: '1px solid rgba(129,140,248,0.35)',
          borderRadius: 10, padding: '8px 18px',
          fontFamily: 'sans-serif',
        }}>結構視圖</div>
      </div>

      {/* Scrollable card area */}
      <div style={{ position: 'relative', zIndex: 1, padding: '24px 44px 140px', flex: 1 }}>
        {S5A_PROJECTS.map((proj, i) => (
          <ProjectCard
            key={proj.name}
            proj={proj}
            frame={frame}
            entryFrame={T.S5_IN + 10 + i * 20}
            scrollY={scrollY}
          />
        ))}
      </div>

      {/* Bottom navigation */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 3,
        backgroundColor: '#0d1c38',
        borderTop: `1px solid ${C.cardBorder}`,
        padding: '18px 0 44px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-around',
      }}>
        {[
          { icon: '📅', label: '時間', active: false },
          { icon: '⊞', label: '總覽', active: true },
          { icon: '📊', label: '分析', active: false },
          { icon: '⊙', label: '篩選', active: false },
        ].map((nav, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 36, opacity: nav.active ? navPulse : 0.5 }}>{nav.icon}</span>
            <span style={{
              fontSize: 24, fontFamily: 'sans-serif',
              color: nav.active ? C.indigo : '#6a80a0',
              fontWeight: nav.active ? 700 : 400,
            }}>{nav.label}</span>
          </div>
        ))}
        <div style={{
          width: 64, height: 64, borderRadius: '50%',
          backgroundColor: C.blue,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 36, color: C.white, boxShadow: '0 4px 18px rgba(59,130,246,0.5)',
        }}>+</div>
      </div>

      {/* Caption：改用 bottom 定位，精確落在底部導航列上方 */}
      <div style={{
        position: 'absolute', bottom: 180, left: 44, right: 44, zIndex: 4,
        opacity: fadeIn(frame, T.S5_IN + 45, 22),
        textAlign: 'center',
        pointerEvents: 'none',
      }}>
        <div style={{
          display: 'inline-block',
          fontSize: 48, fontWeight: 900, color: C.white,
          fontFamily: 'sans-serif',
          backgroundColor: 'rgba(10,22,40,0.88)',
          borderRadius: 18, padding: '18px 44px',
          border: `1.5px solid ${C.indigo}55`,
        }}>
          每件事，都有<span style={{ color: C.indigo }}>歸屬</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ─── Scene 6: CTA ─────────────────────────────────────────────────────────────
const Scene6: React.FC<{ frame: number }> = ({ frame }) => {
  const logoOp  = fadeIn(frame, T.S6_IN + 10, 28);
  const logoY   = slideUp(frame, T.S6_IN + 10, 32);
  const lineOp  = fadeIn(frame, T.S6_IN + 50, 28);
  const lineY   = slideUp(frame, T.S6_IN + 50, 32);
  const urlOp   = fadeIn(frame, T.S6_IN + 100, 28);
  const urlY    = slideUp(frame, T.S6_IN + 100, 32);
  // cross-dissolve：dur=25，與 Scene5a out dur 完全對齊，消除黑底穿透
  const bgOp    = fadeIn(frame, T.S6_IN, 25);

  return (
    <AbsoluteFill style={{
      background: 'linear-gradient(160deg, #050b18 0%, #0b1630 55%, #050b18 100%)',
      opacity: bgOp, justifyContent: 'center', alignItems: 'center',
    }}>
      {/* Background stars */}
      {[...Array(22)].map((_, i) => (
        <div key={i} style={{
          position: 'absolute', borderRadius: '50%',
          width: i % 4 === 0 ? 4 : 2, height: i % 4 === 0 ? 4 : 2,
          backgroundColor: 'rgba(255,255,255,0.3)',
          top: `${(i * 41 + 7) % 100}%`, left: `${(i * 57 + 13) % 100}%`,
          opacity: 0.2 + (i % 5) * 0.1,
        }} />
      ))}

      {/* Glow behind logo */}
      <div style={{
        position: 'absolute',
        width: 600, height: 600,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(129,140,248,0.12) 0%, transparent 70%)',
        top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        opacity: logoOp,
      }} />

      <div style={{ textAlign: 'center', padding: '0 80px', position: 'relative', zIndex: 1 }}>
        {/* Logo */}
        <div style={{ opacity: logoOp, transform: `translateY(${logoY}px)`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 32, marginBottom: 60 }}>
          <Img
            src={staticFile('zentropy-logo.svg')}
            style={{ width: 120, height: 120, borderRadius: 28 }}
          />
          <span style={{ fontSize: 96, fontWeight: 900, color: C.white, fontFamily: 'sans-serif', letterSpacing: -2 }}>Zentropy</span>
        </div>

        {/* Tagline */}
        <div style={{ opacity: lineOp, transform: `translateY(${lineY}px)`, marginBottom: 80 }}>
          <div style={{ fontSize: 58, fontWeight: 900, color: C.white, fontFamily: 'sans-serif', lineHeight: 1.3, textShadow: '0 0 60px rgba(129,140,248,0.5)' }}>
            終結你的混亂，<br />找回真正重要的事
          </div>
        </div>

        {/* URL */}
        <div style={{
          opacity: urlOp, transform: `translateY(${urlY}px)`,
          display: 'inline-block',
          fontSize: 46, color: C.white,
          fontFamily: 'monospace, sans-serif', fontWeight: 700, letterSpacing: 3,
          backgroundColor: 'rgba(59,91,219,0.22)',
          border: '2px solid rgba(129,140,248,0.55)',
          borderRadius: 18, padding: '22px 60px',
          boxShadow: '0 0 40px rgba(59,91,219,0.25)',
        }}>
          zentropy.cc
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ─── Root ─────────────────────────────────────────────────────────────────────
export const ZentropyCapture: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{
      backgroundColor: '#000000',
      WebkitFontSmoothing: 'antialiased',
      MozOsxFontSmoothing: 'grayscale',
      textRendering: 'optimizeLegibility',
    }}>
      {/* 全部同時 render，各 Scene 靠自身 opacity 控制，才能正確 cross-dissolve */}
      <Scene23 frame={frame} />
      <Scene4  frame={frame} />
      <Scene5a frame={frame} />
      <Scene6  frame={frame} />
    </AbsoluteFill>
  );
};
