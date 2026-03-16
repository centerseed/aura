import {
  AbsoluteFill,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
} from 'remotion';
import React from 'react';

// ─── Timeline (30fps × 30s = 900 frames) ────────────────────────────────────
// Scene 1  Problem      0 –  60  (2s)   Q1 + 傳統表單背景
// Scene 2  Agitate     60 – 120  (2s)   Q2 焦慮文字
// Scene 3  Solution   120 – 540  (14s)  Brain Dump UI
// Scene 4  Result     540 – 720  (6s)   結構視圖
// Scene 5  CTA        720 – 900  (6s)   Logo + CTA
const T = {
  S1_IN: 0,
  S1_FORM: 10,
  S2_IN: 60,
  S3_BG: 120,
  S3_PANEL: 148,
  S3_TYPE_START: 178,
  S3_TYPE_END: 268,
  S3_SEND: 280,
  S3_SPIN: 300,
  S3_RESULT: 360,
  S3_IMG_IN: 440,
  S3_IMG_RESULT: 520,
  S4_IN: 540,
  S5_IN: 720,
  TOTAL: 900,
};

// ─── Colours ─────────────────────────────────────────────────────────────────
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

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fi = (frame: number, a: number, b: number, from = 0, to = 1): number =>
  interpolate(frame, [a, b], [from, to], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

const fadeIn = (frame: number, start: number, dur = 20) => {
  const t = fi(frame, start, start + dur);
  return easeOut(t);
};

const slideUp = (frame: number, start: number, dur = 30): number => {
  const t = easeOut(fi(frame, start, start + dur));
  return (1 - t) * 60;
};

const fadeOut = (frame: number, start: number, dur = 20) => {
  const t = fi(frame, start, start + dur);
  return 1 - easeOut(t);
};

// ─── Scene 1+2: Problem + Agitate (Hook) ────────────────────────────────────
const formFields = [
  { label: '分類', type: 'dropdown', value: '請選擇分類...' },
  { label: '日期', type: 'date', value: '選擇日期' },
  { label: '標籤', type: 'multi', value: '新增標籤...' },
  { label: '優先度', type: 'radio', value: '' },
  { label: '備註', type: 'text', value: '輸入備註...' },
];

const SceneHook: React.FC<{ frame: number }> = ({ frame }) => {
  const bgOut = fadeOut(frame, T.S3_BG, 30);

  // Q1: frame 0 立即 punch-in
  const Q1_OUT = 50;
  const q1Op = Math.min(fadeIn(frame, 0, 8), fadeOut(frame, Q1_OUT, 14));
  const q1Scale = 1.12 - 0.12 * easeOut(fi(frame, 0, 12));

  // 傳統表單背景
  const formOp = Math.min(fadeIn(frame, T.S1_FORM, 20), fadeOut(frame, T.S2_IN, 20));

  // Q2: frame 60
  const q2Op = Math.min(fadeIn(frame, T.S2_IN, 18), bgOut);
  const q2Scale = 1.08 - 0.08 * easeOut(fi(frame, T.S2_IN, T.S2_IN + 18));

  return (
    <AbsoluteFill style={{ backgroundColor: C.problemBg, opacity: bgOut }}>
      {/* 傳統表單背景 */}
      <div style={{
        margin: '120px 52px 0', borderRadius: 18, overflow: 'hidden',
        border: '1px solid #222', opacity: formOp,
      }}>
        <div style={{
          backgroundColor: '#161616', padding: '18px 28px',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          {['#ff5f57', '#febc2e', '#28c840'].map((c, i) => (
            <div key={i} style={{ width: 15, height: 15, borderRadius: '50%', backgroundColor: c }} />
          ))}
          <div style={{ color: '#888', fontSize: 32, marginLeft: 16, fontFamily: 'sans-serif' }}>
            📋 新增任務
          </div>
        </div>

        {formFields.map((field, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', padding: '22px 32px',
            borderBottom: '1px solid #1e1e1e', gap: 20,
          }}>
            <div style={{
              fontSize: 30, color: '#666', fontFamily: 'sans-serif',
              width: 100, flexShrink: 0,
            }}>{field.label}</div>
            {field.type === 'radio' ? (
              <div style={{ display: 'flex', gap: 20 }}>
                {['高', '中', '低'].map((p, pi) => (
                  <div key={pi} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                      width: 22, height: 22, borderRadius: '50%',
                      border: '2px solid #444',
                    }} />
                    <span style={{ fontSize: 28, color: '#777', fontFamily: 'sans-serif' }}>{p}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{
                flex: 1, backgroundColor: '#111', border: '1px solid #2e2e2e',
                borderRadius: 10, padding: '14px 18px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <span style={{ fontSize: 28, color: '#555', fontFamily: 'sans-serif' }}>
                  {field.value}
                </span>
                {field.type === 'dropdown' && (
                  <span style={{ fontSize: 22, color: '#444' }}>▾</span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Q1: 記一件事，要填 5 個欄位？ */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        opacity: q1Op, transform: `scale(${q1Scale})`,
        zIndex: 10, pointerEvents: 'none',
      }}>
        <div style={{
          fontSize: 80, fontWeight: 900, color: C.white, fontFamily: 'sans-serif',
          backgroundColor: 'rgba(0,0,0,0.92)', borderRadius: 22,
          padding: '36px 64px', border: `2.5px solid ${C.red}99`,
          lineHeight: 1.4, textAlign: 'center',
          boxShadow: '0 0 80px rgba(239,68,68,0.25)',
        }}>
          記一件事，<br />要填 <span style={{ color: C.red }}>5 個欄位</span>？
        </div>
      </div>

      {/* Q2: 算了，不記了 */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        opacity: q2Op, transform: `scale(${q2Scale})`,
        zIndex: 10, pointerEvents: 'none', gap: 20,
      }}>
        <div style={{
          fontSize: 46, color: '#a0aec0', fontFamily: 'sans-serif',
          textAlign: 'center', lineHeight: 1.5,
        }}>
          想到什麼→打開 App→選分類→設日期...
        </div>
        <div style={{
          fontSize: 80, fontWeight: 900, color: C.white, fontFamily: 'sans-serif',
          backgroundColor: 'rgba(0,0,0,0.92)', borderRadius: 22,
          padding: '36px 64px', border: `2.5px solid ${C.orange}99`,
          lineHeight: 1.4, textAlign: 'center',
          boxShadow: '0 0 80px rgba(251,146,60,0.25)',
        }}>
          <span style={{ color: C.orange }}>算了，不記了</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ─── Scene 3: Brain Dump Solution ────────────────────────────────────────────
const TYPED = '下週三跟客戶的提案會議，要準備報價單和簡報大綱';

const SceneSolution: React.FC<{ frame: number }> = ({ frame }) => {
  const bgOp = fadeIn(frame, T.S3_BG, 30);
  const sceneOut = fadeOut(frame, T.S4_IN, 25);
  const panelOp = fadeIn(frame, T.S3_PANEL, 22);
  const panelY = slideUp(frame, T.S3_PANEL, 30);

  const charCount = fi(frame, T.S3_TYPE_START, T.S3_TYPE_END, 0, TYPED.length);
  const typedText = TYPED.slice(0, Math.floor(charCount));
  const showCursor = frame < T.S3_SEND && frame % 28 < 18;

  const spinning = frame >= T.S3_SPIN && frame < T.S3_RESULT;
  const spinAngle = fi(frame, T.S3_SPIN, T.S3_RESULT, 0, 720);

  // 字幕時序
  const cap1Op = Math.min(
    fadeIn(frame, T.S3_TYPE_START + 10, 18),
    fadeOut(frame, T.S3_SEND - 10, 18),
  );
  const cap2Op = Math.min(
    fadeIn(frame, T.S3_RESULT + 10, 18),
    fadeOut(frame, T.S3_IMG_IN - 10, 18),
  );
  const cap3Op = Math.min(
    fadeIn(frame, T.S3_IMG_IN + 10, 18),
    fadeOut(frame, T.S4_IN - 15, 18),
  );

  // AI 結果卡片
  const resultOp = fadeIn(frame, T.S3_RESULT, 20);
  const resultY = slideUp(frame, T.S3_RESULT, 25);

  // 圖片輸入
  const imgOp = fadeIn(frame, T.S3_IMG_IN, 20);
  const imgResultOp = fadeIn(frame, T.S3_IMG_RESULT, 20);

  const taxonomyPath = [
    { label: '事業', color: C.indigo },
    { label: '客戶提案', color: C.blue },
    { label: '提案會議', color: C.green },
  ];

  return (
    <AbsoluteFill style={{ backgroundColor: C.pageBg, opacity: bgOp * sceneOut }}>
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse at 50% 35%, rgba(59,91,219,0.10) 0%, transparent 65%)',
      }} />

      <div style={{
        position: 'relative', zIndex: 1, padding: '80px 52px',
        display: 'flex', flexDirection: 'column', height: '100%',
      }}>
        {/* Title */}
        <div style={{ marginBottom: 36 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 14 }}>
            <Img src={staticFile('zentropy-logo.svg')} style={{ width: 56, height: 56, borderRadius: 12 }} />
            <span style={{ fontSize: 52, fontWeight: 900, color: C.white, fontFamily: 'sans-serif', letterSpacing: -1 }}>Zentropy</span>
          </div>
          <div style={{ fontSize: 40, color: '#c8dcf4', fontFamily: 'sans-serif', lineHeight: 1.35 }}>
            Brain Dump — <span style={{ color: C.indigo }}>腦袋倒出來就好</span>
          </div>
        </div>

        {/* Chat panel */}
        <div style={{
          opacity: panelOp, transform: `translateY(${panelY}px)`,
          backgroundColor: C.card, border: `1.5px solid ${C.cardBorder}`,
          borderRadius: 22, overflow: 'hidden',
          boxShadow: '0 20px 72px rgba(0,0,0,0.55)',
          flex: frame >= T.S3_RESULT ? undefined : 1,
        }}>
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', padding: '24px 32px 18px',
            borderBottom: `1px solid ${C.cardBorder}`,
          }}>
            <span style={{ fontSize: 34, marginRight: 12, color: C.indigo }}>✦</span>
            <span style={{ fontSize: 38, fontWeight: 700, color: C.white, fontFamily: 'sans-serif', flex: 1 }}>
              Brain Dump
            </span>
            <span style={{ fontSize: 30, color: C.placeholder }}>×</span>
          </div>

          {/* Chat area */}
          <div style={{ padding: '20px 32px', minHeight: 140 }}>
            {/* User message bubble */}
            {typedText.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
                <div style={{
                  backgroundColor: C.blue, borderRadius: '18px 18px 4px 18px',
                  padding: '16px 24px', maxWidth: '85%',
                }}>
                  <span style={{ fontSize: 32, color: C.white, fontFamily: 'sans-serif', lineHeight: 1.5 }}>
                    {typedText}
                    {showCursor && (
                      <span style={{
                        display: 'inline-block', width: 3, height: 32,
                        backgroundColor: 'rgba(255,255,255,0.7)', marginLeft: 3,
                        verticalAlign: 'text-bottom',
                      }} />
                    )}
                  </span>
                </div>
              </div>
            )}

            {/* AI spinning */}
            {spinning && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 18,
                opacity: fadeIn(frame, T.S3_SPIN, 12),
              }}>
                <div style={{
                  width: 40, height: 40, border: `3px solid ${C.indigo}`,
                  borderTopColor: 'transparent', borderRadius: '50%',
                  transform: `rotate(${spinAngle}deg)`,
                }} />
                <span style={{ fontSize: 32, color: C.indigo, fontFamily: 'sans-serif', fontWeight: 600 }}>
                  AI 分析中...
                </span>
              </div>
            )}

            {/* AI result bubble */}
            {frame >= T.S3_RESULT && (
              <div style={{
                display: 'flex', justifyContent: 'flex-start', marginTop: 12,
                opacity: resultOp, transform: `translateY(${resultY}px)`,
              }}>
                <div style={{
                  backgroundColor: '#1a2a4a', borderRadius: '18px 18px 18px 4px',
                  padding: '20px 24px', maxWidth: '90%',
                  border: `1px solid ${C.cardBorder}`,
                }}>
                  <div style={{ fontSize: 28, color: C.green, marginBottom: 14, fontFamily: 'sans-serif', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span>✓</span> 已整理完成
                  </div>

                  {/* Taxonomy path */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                    {taxonomyPath.map((t, i) => (
                      <React.Fragment key={i}>
                        <div style={{
                          backgroundColor: `${t.color}22`, border: `1px solid ${t.color}55`,
                          borderRadius: 10, padding: '6px 16px',
                          fontSize: 26, color: t.color, fontWeight: 600, fontFamily: 'sans-serif',
                        }}>{t.label}</div>
                        {i < taxonomyPath.length - 1 && (
                          <span style={{ fontSize: 22, color: '#555' }}>›</span>
                        )}
                      </React.Fragment>
                    ))}
                  </div>

                  {/* Due date */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14,
                  }}>
                    <span style={{ fontSize: 24, color: C.orange }}>📅</span>
                    <span style={{ fontSize: 28, color: C.orange, fontFamily: 'sans-serif' }}>下週三</span>
                  </div>

                  {/* Sub-items */}
                  <div style={{ borderTop: `1px solid ${C.cardBorder}`, paddingTop: 12 }}>
                    <div style={{ fontSize: 26, color: C.dim, marginBottom: 10, fontFamily: 'sans-serif' }}>子任務：</div>
                    {['準備報價單初稿', '撰寫簡報大綱', '預約會議室'].map((item, i) => (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'center', gap: 12, padding: '6px 0',
                      }}>
                        <div style={{
                          width: 20, height: 20, borderRadius: 5,
                          border: `2px solid ${C.indigo}66`, flexShrink: 0,
                        }} />
                        <span style={{ fontSize: 28, color: '#c8dcf4', fontFamily: 'sans-serif' }}>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input bar */}
          <div style={{
            display: 'flex', alignItems: 'center', padding: '14px 28px 20px', gap: 14,
            borderTop: `1px solid ${C.cardBorder}`,
          }}>
            <div style={{
              flex: 1, backgroundColor: C.inputBg, border: `1.5px solid ${C.inputBorder}`,
              borderRadius: 14, padding: '14px 20px',
            }}>
              <span style={{ fontSize: 30, color: C.placeholder, fontFamily: 'sans-serif' }}>
                {frame >= T.S3_SEND ? '繼續輸入...' : ''}
              </span>
            </div>
            {['📷', '🎤'].map((icon, i) => (
              <div key={i} style={{
                width: 50, height: 50, borderRadius: 12,
                border: `1px solid ${C.cardBorder}`, backgroundColor: '#1a2a4a',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
              }}>{icon}</div>
            ))}
            <div style={{
              backgroundColor: C.blue, borderRadius: 12, padding: '12px 22px',
              display: 'flex', alignItems: 'center', gap: 8,
              boxShadow: frame >= T.S3_SEND && frame < T.S3_SPIN
                ? `0 0 20px rgba(59,130,246,0.7)` : 'none',
            }}>
              <span style={{ fontSize: 30, color: C.white, fontWeight: 700, fontFamily: 'sans-serif' }}>送出</span>
              <span style={{ fontSize: 26, color: C.white }}>➤</span>
            </div>
          </div>
        </div>

        {/* 圖片輸入示範 */}
        {frame >= T.S3_IMG_IN && (
          <div style={{
            marginTop: 24, opacity: imgOp,
            display: 'flex', gap: 20, alignItems: 'flex-start',
          }}>
            {/* 圖片預覽 */}
            <div style={{
              width: 200, height: 200, borderRadius: 18,
              backgroundColor: '#1a2a4a', border: `1.5px solid ${C.cardBorder}`,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 12, flexShrink: 0,
            }}>
              <span style={{ fontSize: 52 }}>📷</span>
              <span style={{ fontSize: 24, color: C.dim, fontFamily: 'sans-serif' }}>拍照記錄</span>
              <div style={{
                width: 160, height: 100, borderRadius: 10,
                background: 'linear-gradient(135deg, #2a3f6f 0%, #1a2a4a 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ fontSize: 20, color: C.dim, fontFamily: 'sans-serif' }}>白板照片.jpg</span>
              </div>
            </div>

            {/* 圖片辨識結果 */}
            {frame >= T.S3_IMG_RESULT && (
              <div style={{
                flex: 1, opacity: imgResultOp,
                backgroundColor: '#1a2a4a', borderRadius: 18,
                border: `1px solid ${C.cardBorder}`, padding: '20px 24px',
              }}>
                <div style={{
                  fontSize: 28, color: C.green, marginBottom: 12,
                  fontFamily: 'sans-serif', display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <span>✓</span> 圖片辨識完成
                </div>
                <div style={{ fontSize: 28, color: '#c8dcf4', fontFamily: 'sans-serif', lineHeight: 1.6 }}>
                  偵測到會議白板內容，<br />已建立 3 個待辦事項
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
                  {[
                    { label: '白板紀錄', color: C.blue },
                    { label: '客戶提案', color: C.indigo },
                  ].map((tag, i) => (
                    <div key={i} style={{
                      backgroundColor: `${tag.color}1e`, border: `1px solid ${tag.color}55`,
                      borderRadius: 10, padding: '6px 16px',
                      fontSize: 24, color: tag.color, fontFamily: 'sans-serif',
                    }}>{tag.label}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 字幕 1：不用分類，不用選日期，打字就好 */}
      <div style={{
        position: 'absolute', bottom: 280, left: 52, right: 52,
        opacity: cap1Op, textAlign: 'center', zIndex: 10, pointerEvents: 'none',
      }}>
        <div style={{
          display: 'inline-block', fontSize: 50, fontWeight: 900,
          color: C.white, fontFamily: 'sans-serif',
          backgroundColor: 'rgba(11,22,41,0.92)',
          borderRadius: 18, padding: '22px 52px',
          border: `1.5px solid ${C.indigo}55`, lineHeight: 1.4,
        }}>
          不用分類，不用選日期，<br /><span style={{ color: C.indigo }}>打字就好</span>
        </div>
      </div>

      {/* 字幕 2：AI 自動分類 + 排期 */}
      <div style={{
        position: 'absolute', bottom: 280, left: 52, right: 52,
        opacity: cap2Op, textAlign: 'center', zIndex: 10, pointerEvents: 'none',
      }}>
        <div style={{
          display: 'inline-block', fontSize: 50, fontWeight: 900,
          color: C.white, fontFamily: 'sans-serif',
          backgroundColor: 'rgba(11,22,41,0.92)',
          borderRadius: 18, padding: '22px 52px',
          border: `1.5px solid ${C.green}55`, lineHeight: 1.4,
        }}>
          AI 自動分類 + 排期，<br /><span style={{ color: C.green }}>連子任務都幫你拆好</span>
        </div>
      </div>

      {/* 字幕 3：拍照也能直接記錄 */}
      <div style={{
        position: 'absolute', bottom: 280, left: 52, right: 52,
        opacity: cap3Op, textAlign: 'center', zIndex: 10, pointerEvents: 'none',
      }}>
        <div style={{
          display: 'inline-block', fontSize: 50, fontWeight: 900,
          color: C.white, fontFamily: 'sans-serif',
          backgroundColor: 'rgba(11,22,41,0.92)',
          borderRadius: 18, padding: '22px 52px',
          border: `1.5px solid ${C.cyan}55`, lineHeight: 1.4,
        }}>
          <span style={{ color: C.cyan }}>拍照也能直接記錄</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ─── Scene 4: 結構視圖 (Result) ─────────────────────────────────────────────
const S4_PROJECTS = [
  {
    name: '客戶提案',
    priority: 'P1',
    desc: '報價方案、簡報大綱、會議準備',
    tasks: [
      { text: '準備報價單初稿', due: '下週二' },
      { text: '撰寫簡報大綱', due: '下週二' },
      { text: '預約會議室', due: '明天' },
    ],
    highlight: true,
    isNew: true,
  },
  {
    name: 'Q2 產品發布',
    priority: 'P1',
    desc: '路線圖、團隊方向、行銷時程',
    tasks: [
      { text: '更新產品路線圖', due: '5天後' },
      { text: '確認行銷活動進度', due: '本週' },
    ],
    highlight: false,
    isNew: false,
  },
];

const SceneResult: React.FC<{ frame: number }> = ({ frame }) => {
  const op = fadeIn(frame, T.S4_IN, 25);
  const out = fadeOut(frame, T.S5_IN, 25);

  const cap4Op = fadeIn(frame, T.S4_IN + 50, 22);

  return (
    <AbsoluteFill style={{ backgroundColor: '#0a1628', opacity: op * out, overflow: 'hidden' }}>
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse at 50% 20%, rgba(59,91,219,0.08) 0%, transparent 60%)',
      }} />

      {/* Status bar */}
      <div style={{
        position: 'relative', zIndex: 2, padding: '56px 52px 0',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: 26, color: '#6a80a0', fontFamily: 'sans-serif' }}>9:41</span>
        <div style={{ display: 'flex', gap: 14 }}>
          {['▌▌▌', '⬆', '🔋'].map((icon, i) => (
            <span key={i} style={{ fontSize: 22, color: '#6a80a0' }}>{icon}</span>
          ))}
        </div>
      </div>

      {/* Top bar */}
      <div style={{
        position: 'relative', zIndex: 2, padding: '20px 52px 0',
        display: 'flex', alignItems: 'center', gap: 18,
      }}>
        <span style={{ fontSize: 30, color: '#6a9af8' }}>📂</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 38, fontWeight: 700, color: C.white, fontFamily: 'sans-serif' }}>事業</div>
          <div style={{ fontSize: 24, color: C.dim, fontFamily: 'sans-serif' }}>已自動歸類到正確的專案</div>
        </div>
        <div style={{
          fontSize: 26, color: C.indigo,
          backgroundColor: 'rgba(129,140,248,0.12)',
          border: '1px solid rgba(129,140,248,0.35)',
          borderRadius: 10, padding: '8px 18px', fontFamily: 'sans-serif',
        }}>結構視圖</div>
      </div>

      {/* Cards */}
      <div style={{ position: 'relative', zIndex: 1, padding: '24px 44px 200px' }}>
        {S4_PROJECTS.map((proj, i) => {
          const entryFrame = T.S4_IN + 10 + i * 22;
          const cardOp = fadeIn(frame, entryFrame, 18);
          const cardY = (1 - easeOut(fi(frame, entryFrame, entryFrame + 25))) * 50;

          return (
            <div key={proj.name} style={{
              opacity: cardOp, transform: `translateY(${cardY}px)`,
              backgroundColor: proj.highlight ? '#1a2d55' : C.card,
              border: `1.5px solid ${proj.highlight ? '#3b5bdb' : C.cardBorder}`,
              borderRadius: 20, marginBottom: 24, overflow: 'hidden',
              boxShadow: proj.highlight ? '0 4px 32px rgba(59,91,219,0.22)' : 'none',
            }}>
              <div style={{
                padding: '22px 28px 14px', display: 'flex', alignItems: 'flex-start', gap: 14,
              }}>
                <div style={{
                  backgroundColor: '#ef4444', borderRadius: 8, padding: '4px 12px',
                  fontSize: 26, fontWeight: 700, color: C.white, fontFamily: 'sans-serif',
                }}>{proj.priority}</div>
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontSize: 38, fontWeight: 700, color: C.white,
                    fontFamily: 'sans-serif', marginBottom: 6,
                  }}>{proj.name}</div>
                  <div style={{ fontSize: 26, color: C.dim, fontFamily: 'sans-serif' }}>{proj.desc}</div>
                </div>
                {proj.isNew && (
                  <div style={{
                    backgroundColor: 'rgba(74,222,128,0.18)',
                    border: '1px solid rgba(74,222,128,0.45)',
                    borderRadius: 10, padding: '6px 16px',
                    fontSize: 26, color: C.green, fontWeight: 700, fontFamily: 'sans-serif',
                  }}>NEW</div>
                )}
              </div>
              <div style={{ height: 1, backgroundColor: '#1e2d4a', margin: '0 28px' }} />
              <div style={{ padding: '14px 28px' }}>
                {proj.tasks.map((task, ti) => (
                  <div key={ti} style={{
                    display: 'flex', alignItems: 'center', gap: 14, padding: '10px 0',
                    borderBottom: ti < proj.tasks.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                  }}>
                    <div style={{
                      width: 10, height: 10, borderRadius: '50%',
                      backgroundColor: proj.highlight ? C.indigo : '#4a6490', flexShrink: 0,
                    }} />
                    <span style={{
                      fontSize: 28, color: proj.highlight ? '#d0e0f8' : '#8899bb',
                      fontFamily: 'sans-serif', flex: 1,
                    }}>{task.text}</span>
                    <div style={{
                      backgroundColor: 'rgba(251,146,60,0.14)',
                      border: '1px solid rgba(251,146,60,0.4)',
                      borderRadius: 8, padding: '3px 12px',
                      fontSize: 24, color: C.orange, fontFamily: 'sans-serif',
                    }}>{task.due}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Caption */}
      <div style={{
        position: 'absolute', bottom: 200, left: 44, right: 44, zIndex: 4,
        opacity: cap4Op, textAlign: 'center', pointerEvents: 'none',
      }}>
        <div style={{
          display: 'inline-block', fontSize: 48, fontWeight: 900, color: C.white,
          fontFamily: 'sans-serif', backgroundColor: 'rgba(10,22,40,0.88)',
          borderRadius: 18, padding: '18px 44px', border: `1.5px solid ${C.indigo}55`,
        }}>
          從混亂到有序，<span style={{ color: C.indigo }}>全自動</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ─── Scene 5: CTA ────────────────────────────────────────────────────────────
const SceneCTA: React.FC<{ frame: number }> = ({ frame }) => {
  const bgOp = fadeIn(frame, T.S5_IN, 25);
  const logoOp = fadeIn(frame, T.S5_IN + 10, 28);
  const logoY = slideUp(frame, T.S5_IN + 10, 32);
  const lineOp = fadeIn(frame, T.S5_IN + 50, 28);
  const lineY = slideUp(frame, T.S5_IN + 50, 32);
  const urlOp = fadeIn(frame, T.S5_IN + 100, 28);
  const urlY = slideUp(frame, T.S5_IN + 100, 32);

  return (
    <AbsoluteFill style={{
      background: 'linear-gradient(160deg, #050b18 0%, #0b1630 55%, #050b18 100%)',
      opacity: bgOp, justifyContent: 'center', alignItems: 'center',
    }}>
      {[...Array(22)].map((_, i) => (
        <div key={i} style={{
          position: 'absolute', borderRadius: '50%',
          width: i % 4 === 0 ? 4 : 2, height: i % 4 === 0 ? 4 : 2,
          backgroundColor: 'rgba(255,255,255,0.3)',
          top: `${(i * 41 + 7) % 100}%`, left: `${(i * 57 + 13) % 100}%`,
          opacity: 0.2 + (i % 5) * 0.1,
        }} />
      ))}

      <div style={{
        position: 'absolute', width: 600, height: 600, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(129,140,248,0.12) 0%, transparent 70%)',
        top: '50%', left: '50%', transform: 'translate(-50%, -50%)', opacity: logoOp,
      }} />

      <div style={{ textAlign: 'center', padding: '0 80px', position: 'relative', zIndex: 1 }}>
        <div style={{
          opacity: logoOp, transform: `translateY(${logoY}px)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 32, marginBottom: 60,
        }}>
          <Img src={staticFile('zentropy-logo.svg')} style={{ width: 120, height: 120, borderRadius: 28 }} />
          <span style={{ fontSize: 96, fontWeight: 900, color: C.white, fontFamily: 'sans-serif', letterSpacing: -2 }}>Zentropy</span>
        </div>

        <div style={{ opacity: lineOp, transform: `translateY(${lineY}px)`, marginBottom: 80 }}>
          <div style={{
            fontSize: 58, fontWeight: 900, color: C.white, fontFamily: 'sans-serif',
            lineHeight: 1.3, textShadow: '0 0 60px rgba(129,140,248,0.5)',
          }}>
            腦袋倒出來，<br />AI 幫你整理
          </div>
        </div>

        <div style={{
          opacity: urlOp, transform: `translateY(${urlY}px)`,
          display: 'inline-block', fontSize: 46, color: C.white,
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

// ─── Root ────────────────────────────────────────────────────────────────────
export const ZentropyBrainDump: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{
      backgroundColor: '#000000',
      WebkitFontSmoothing: 'antialiased',
      MozOsxFontSmoothing: 'grayscale',
      textRendering: 'optimizeLegibility',
    }}>
      <SceneHook frame={frame} />
      <SceneSolution frame={frame} />
      <SceneResult frame={frame} />
      <SceneCTA frame={frame} />
    </AbsoluteFill>
  );
};
