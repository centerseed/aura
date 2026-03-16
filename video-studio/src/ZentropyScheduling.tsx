import {
  AbsoluteFill,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
} from 'remotion';
import React from 'react';

// ─── Timeline (30fps × 30s = 900 frames) ────────────────────────────────────
// Scene 1  Problem      0 –  60  (2s)   Q1 + 三個 App 視窗
// Scene 2  Agitate     60 – 120  (2s)   Q2 焦慮
// Scene 3  Solution   120 – 540  (14s)  里程碑 + 負載 + 每日計畫
// Scene 4  Result     540 – 720  (6s)   統計概覽
// Scene 5  CTA        720 – 900  (6s)   Logo + CTA
const T = {
  S1_IN: 0,
  S1_APPS: 10,
  S2_IN: 60,
  S3_BG: 120,
  S3_MS_PANEL: 148,
  S3_MS_FILL: 178,
  S3_MS_DONE: 258,
  S3_LIST_IN: 280,
  S3_HEAT_IN: 360,
  S3_HEAT_BARS: 390,
  S3_PLAN_IN: 460,
  S3_PLAN_ITEMS: 490,
  S3_COACH: 520,
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
  blue: '#3b82f6',
  indigo: '#818cf8',
  green: '#4ade80',
  emerald: '#34d399',
  orange: '#fb923c',
  amber: '#fbbf24',
  sky: '#38bdf8',
  red: '#ef4444',
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
const appWindows = [
  { title: '📅 行事曆', items: ['週一：產品會議', '週二：Sprint Review', '週三：客戶電話', '週四：1:1'] },
  { title: '📊 甘特圖', items: ['API 重構 ████░░░░', '設計稿 ██████░░', '測試 ░░░░░░░░'] },
  { title: '✅ Todo', items: ['整理需求文件', '更新進度表', '回覆客戶'] },
];

const SceneHook: React.FC<{ frame: number }> = ({ frame }) => {
  const bgOut = fadeOut(frame, T.S3_BG, 30);

  // Q1: frame 0 punch-in
  const Q1_OUT = 50;
  const q1Op = Math.min(fadeIn(frame, 0, 8), fadeOut(frame, Q1_OUT, 14));
  const q1Scale = 1.12 - 0.12 * easeOut(fi(frame, 0, 12));

  // App windows background
  const appsOp = Math.min(fadeIn(frame, T.S1_APPS, 20), fadeOut(frame, T.S2_IN, 20));

  // Q2
  const q2Op = Math.min(fadeIn(frame, T.S2_IN, 18), bgOut);
  const q2Scale = 1.08 - 0.08 * easeOut(fi(frame, T.S2_IN, T.S2_IN + 18));

  return (
    <AbsoluteFill style={{ backgroundColor: C.problemBg, opacity: bgOut }}>
      {/* 三個 App 視窗 */}
      <div style={{
        position: 'absolute', top: 160, left: 32, right: 32, opacity: appsOp,
        display: 'flex', flexDirection: 'column', gap: 16,
      }}>
        {appWindows.map((app, ai) => (
          <div key={ai} style={{
            borderRadius: 14, overflow: 'hidden', border: '1px solid #222',
            transform: `rotate(${(ai - 1) * 1.5}deg) translateX(${(ai - 1) * 15}px)`,
          }}>
            <div style={{
              backgroundColor: '#161616', padding: '12px 20px',
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              {['#ff5f57', '#febc2e', '#28c840'].map((c, i) => (
                <div key={i} style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: c }} />
              ))}
              <span style={{ color: '#888', fontSize: 26, marginLeft: 10, fontFamily: 'sans-serif' }}>
                {app.title}
              </span>
            </div>
            <div style={{ backgroundColor: '#111', padding: '10px 20px' }}>
              {app.items.map((item, ii) => (
                <div key={ii} style={{
                  fontSize: 24, color: '#777', fontFamily: 'monospace',
                  padding: '5px 0', borderBottom: '1px solid #191919',
                }}>{item}</div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Q1: 排進度，比做事還累？ */}
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
          排進度，<br /><span style={{ color: C.red }}>比做事還累</span>？
        </div>
      </div>

      {/* Q2: 時間都花在管理上 */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        opacity: q2Op, transform: `scale(${q2Scale})`,
        zIndex: 10, pointerEvents: 'none', gap: 20,
      }}>
        <div style={{
          fontSize: 46, color: '#a0aec0', fontFamily: 'sans-serif', textAlign: 'center',
        }}>
          三個 App 切來切去
        </div>
        <div style={{
          fontSize: 80, fontWeight: 900, color: C.white, fontFamily: 'sans-serif',
          backgroundColor: 'rgba(0,0,0,0.92)', borderRadius: 22,
          padding: '36px 64px', border: `2.5px solid ${C.orange}99`,
          lineHeight: 1.4, textAlign: 'center',
          boxShadow: '0 0 80px rgba(251,146,60,0.25)',
        }}>
          <span style={{ color: C.orange }}>時間都花在管理上</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ─── Scene 3: Solution ───────────────────────────────────────────────────────
const SceneSolution: React.FC<{ frame: number }> = ({ frame }) => {
  const bgOp = fadeIn(frame, T.S3_BG, 30);
  const sceneOut = fadeOut(frame, T.S4_IN, 25);

  // 里程碑 modal
  const msOp = fadeIn(frame, T.S3_MS_PANEL, 22);
  const msY = slideUp(frame, T.S3_MS_PANEL, 30);

  // 表單填入動畫
  const fillProgress = fi(frame, T.S3_MS_FILL, T.S3_MS_DONE);
  const nameTyped = '客戶提案完成'.slice(0, Math.floor(fillProgress * 6));
  const dateShow = fillProgress > 0.3;
  const descShow = fillProgress > 0.6;

  // 里程碑建立完成 checkmark
  const doneOp = fadeIn(frame, T.S3_MS_DONE, 15);

  // 字幕
  const cap1Op = Math.min(
    fadeIn(frame, T.S3_MS_FILL + 10, 18),
    fadeOut(frame, T.S3_LIST_IN - 10, 18),
  );

  // 里程碑列表 (slide out modal, slide in list)
  const listTransition = fi(frame, T.S3_LIST_IN, T.S3_LIST_IN + 25);
  const modalOut = frame >= T.S3_LIST_IN ? 1 - easeOut(listTransition) : 1;

  // 負載熱圖
  const heatOp = fadeIn(frame, T.S3_HEAT_IN, 22);
  const cap2Op = Math.min(
    fadeIn(frame, T.S3_HEAT_IN + 15, 18),
    fadeOut(frame, T.S3_PLAN_IN - 10, 18),
  );

  // 每日計畫
  const planOp = fadeIn(frame, T.S3_PLAN_IN, 22);
  const coachOp = fadeIn(frame, T.S3_COACH, 22);
  const cap3Op = Math.min(
    fadeIn(frame, T.S3_PLAN_ITEMS + 10, 18),
    fadeOut(frame, T.S4_IN - 15, 18),
  );

  // Heat map data
  const heatDays = [
    { day: '週一', hours: 6, max: 8, color: C.emerald },
    { day: '週二', hours: 8, max: 8, color: C.blue },
    { day: '週三', hours: 10, max: 8, color: C.red },
    { day: '週四', hours: 5, max: 8, color: C.emerald },
    { day: '週五', hours: 7, max: 8, color: C.amber },
  ];

  // Plan items
  const planItems = [
    { num: 1, text: '撰寫提案簡報', time: '2h', tag: '客戶提案' },
    { num: 2, text: '回覆客戶 email', time: '30m', tag: '客戶提案' },
    { num: 3, text: '更新產品路線圖', time: '1.5h', tag: 'Q2 發布' },
    { num: 4, text: '整理費用明細', time: '45m', tag: '個人' },
  ];

  // Milestone list
  const milestones = [
    { name: '客戶提案完成', days: 12, status: '進行中', statusColor: C.blue, entity: '事業' },
    { name: 'Q2 產品上線', days: 45, status: '規劃中', statusColor: C.amber, entity: '事業' },
    { name: '年度健檢', days: 8, status: '進行中', statusColor: C.blue, entity: '生活' },
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
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 10 }}>
            <Img src={staticFile('zentropy-logo.svg')} style={{ width: 56, height: 56, borderRadius: 12 }} />
            <span style={{ fontSize: 52, fontWeight: 900, color: C.white, fontFamily: 'sans-serif', letterSpacing: -1 }}>Zentropy</span>
          </div>
          <div style={{ fontSize: 40, color: '#c8dcf4', fontFamily: 'sans-serif', lineHeight: 1.35 }}>
            AI 排程 — <span style={{ color: C.indigo }}>設定目標，自動抵達</span>
          </div>
        </div>

        {/* 里程碑 Modal */}
        {frame < T.S3_HEAT_IN && (
          <div style={{
            opacity: msOp * modalOut,
            transform: `translateY(${msY}px)`,
            backgroundColor: C.card, border: `1.5px solid ${C.cardBorder}`,
            borderRadius: 22, overflow: 'hidden',
            boxShadow: '0 20px 72px rgba(0,0,0,0.55)',
          }}>
            {/* Gradient header */}
            <div style={{
              background: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)',
              padding: '28px 32px', display: 'flex', alignItems: 'center', gap: 16,
            }}>
              <span style={{ fontSize: 36 }}>🎯</span>
              <span style={{ fontSize: 38, fontWeight: 700, color: C.white, fontFamily: 'sans-serif' }}>
                建立里程碑
              </span>
            </div>

            {/* Form fields */}
            <div style={{ padding: '24px 32px' }}>
              {/* Name */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 28, color: C.dim, fontFamily: 'sans-serif', marginBottom: 10 }}>目標名稱</div>
                <div style={{
                  backgroundColor: C.inputBg, border: `1.5px solid ${C.inputBorder}`,
                  borderRadius: 12, padding: '16px 20px',
                }}>
                  <span style={{ fontSize: 32, color: nameTyped ? C.white : C.placeholder, fontFamily: 'sans-serif' }}>
                    {nameTyped || '輸入目標名稱...'}
                  </span>
                </div>
              </div>

              {/* Date */}
              <div style={{ marginBottom: 20, opacity: dateShow ? 1 : 0.3 }}>
                <div style={{ fontSize: 28, color: C.dim, fontFamily: 'sans-serif', marginBottom: 10 }}>目標日期</div>
                <div style={{
                  backgroundColor: C.inputBg, border: `1.5px solid ${dateShow ? C.inputBorder : C.cardBorder}`,
                  borderRadius: 12, padding: '16px 20px',
                  display: 'flex', alignItems: 'center', gap: 12,
                }}>
                  <span style={{ fontSize: 26, color: C.orange }}>📅</span>
                  <span style={{ fontSize: 32, color: dateShow ? C.white : C.placeholder, fontFamily: 'sans-serif' }}>
                    {dateShow ? '2026/03/28' : '選擇日期'}
                  </span>
                </div>
              </div>

              {/* Description */}
              <div style={{ marginBottom: 24, opacity: descShow ? 1 : 0.3 }}>
                <div style={{ fontSize: 28, color: C.dim, fontFamily: 'sans-serif', marginBottom: 10 }}>說明（選填）</div>
                <div style={{
                  backgroundColor: C.inputBg, border: `1.5px solid ${descShow ? C.inputBorder : C.cardBorder}`,
                  borderRadius: 12, padding: '16px 20px', minHeight: 60,
                }}>
                  <span style={{ fontSize: 30, color: descShow ? '#c8dcf4' : C.placeholder, fontFamily: 'sans-serif' }}>
                    {descShow ? '完成提案文件、報價單、簡報' : '補充說明...'}
                  </span>
                </div>
              </div>

              {/* Done checkmark */}
              {frame >= T.S3_MS_DONE && (
                <div style={{
                  opacity: doneOp,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16,
                  backgroundColor: 'rgba(74,222,128,0.12)', border: `1px solid ${C.green}55`,
                  borderRadius: 14, padding: '18px 24px',
                }}>
                  <span style={{ fontSize: 32, color: C.green }}>✓</span>
                  <span style={{ fontSize: 32, color: C.green, fontWeight: 700, fontFamily: 'sans-serif' }}>
                    里程碑已建立，AI 開始排程
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 里程碑列表 */}
        {frame >= T.S3_LIST_IN && frame < T.S3_HEAT_IN && (
          <div style={{ opacity: fadeIn(frame, T.S3_LIST_IN, 20) }}>
            <div style={{
              fontSize: 34, color: C.dim, fontFamily: 'sans-serif', marginBottom: 18,
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <span style={{ color: C.indigo }}>◆</span> 里程碑列表
            </div>
            {milestones.map((ms, i) => (
              <div key={i} style={{
                opacity: fadeIn(frame, T.S3_LIST_IN + 8 + i * 12, 14),
                backgroundColor: C.card, border: `1px solid ${C.cardBorder}`,
                borderRadius: 16, padding: '18px 24px', marginBottom: 14,
                display: 'flex', alignItems: 'center', gap: 16,
              }}>
                <div style={{
                  backgroundColor: `${ms.statusColor}22`, border: `1px solid ${ms.statusColor}55`,
                  borderRadius: 10, padding: '4px 14px',
                  fontSize: 24, color: ms.statusColor, fontFamily: 'sans-serif', flexShrink: 0,
                }}>{ms.status}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 32, color: C.white, fontWeight: 600, fontFamily: 'sans-serif' }}>{ms.name}</div>
                  <div style={{ fontSize: 24, color: C.dim, fontFamily: 'sans-serif' }}>{ms.entity}</div>
                </div>
                <div style={{
                  fontSize: 28, color: ms.days <= 10 ? C.orange : C.dim,
                  fontWeight: 600, fontFamily: 'sans-serif',
                }}>
                  {ms.days} 天
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 負載熱圖 */}
        {frame >= T.S3_HEAT_IN && frame < T.S3_PLAN_IN && (
          <div style={{ opacity: heatOp }}>
            <div style={{
              fontSize: 34, color: C.dim, fontFamily: 'sans-serif', marginBottom: 20,
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <span style={{ color: C.blue }}>📊</span> 本週工作負載
            </div>
            <div style={{
              backgroundColor: C.card, border: `1px solid ${C.cardBorder}`,
              borderRadius: 18, padding: '28px 28px 20px',
            }}>
              {heatDays.map((day, i) => {
                const barProgress = fi(frame, T.S3_HEAT_BARS + i * 8, T.S3_HEAT_BARS + i * 8 + 25);
                const barWidth = easeOut(barProgress) * (day.hours / 12) * 100;
                const overload = day.hours > day.max;
                return (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 16, marginBottom: 18,
                  }}>
                    <span style={{
                      fontSize: 28, color: C.dim, fontFamily: 'sans-serif',
                      width: 60, flexShrink: 0,
                    }}>{day.day}</span>
                    <div style={{
                      flex: 1, height: 32, backgroundColor: '#0d1c38',
                      borderRadius: 8, overflow: 'hidden', position: 'relative',
                    }}>
                      <div style={{
                        width: `${barWidth}%`, height: '100%',
                        backgroundColor: day.color,
                        borderRadius: 8,
                        transition: 'none',
                      }} />
                      {/* 8h 標記線 */}
                      <div style={{
                        position: 'absolute', left: `${(8 / 12) * 100}%`, top: 0, bottom: 0,
                        width: 2, backgroundColor: 'rgba(255,255,255,0.2)',
                      }} />
                    </div>
                    <span style={{
                      fontSize: 26, fontWeight: 600, fontFamily: 'sans-serif',
                      color: overload ? C.red : C.dim, width: 50, textAlign: 'right',
                    }}>{day.hours}h</span>
                    {overload && (
                      <span style={{ fontSize: 22, color: C.red }}>⚠</span>
                    )}
                  </div>
                );
              })}
              <div style={{
                fontSize: 24, color: C.placeholder, fontFamily: 'sans-serif',
                borderTop: `1px solid ${C.cardBorder}`, paddingTop: 14, marginTop: 4,
                display: 'flex', justifyContent: 'space-between',
              }}>
                <span>🟢 正常 ≤6h</span>
                <span>🔵 忙碌 7-8h</span>
                <span>🟡 緊繃 &gt;8h</span>
                <span>🔴 過載</span>
              </div>
            </div>
          </div>
        )}

        {/* 每日計畫 */}
        {frame >= T.S3_PLAN_IN && (
          <div style={{ opacity: planOp }}>
            <div style={{
              fontSize: 34, color: C.dim, fontFamily: 'sans-serif', marginBottom: 20,
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <span style={{ color: C.green }}>📋</span> 今日計畫
              <span style={{
                fontSize: 24, color: C.placeholder, fontFamily: 'sans-serif', marginLeft: 'auto',
              }}>週三 · 預估 4h 45m</span>
            </div>

            <div style={{
              backgroundColor: C.card, border: `1px solid ${C.cardBorder}`,
              borderRadius: 18, padding: '20px 24px',
            }}>
              {planItems.map((item, i) => (
                <div key={i} style={{
                  opacity: fadeIn(frame, T.S3_PLAN_ITEMS + i * 10, 14),
                  display: 'flex', alignItems: 'center', gap: 14, padding: '14px 0',
                  borderBottom: i < planItems.length - 1 ? `1px solid ${C.cardBorder}` : 'none',
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%',
                    backgroundColor: `${C.indigo}22`, border: `1.5px solid ${C.indigo}55`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 22, color: C.indigo, fontWeight: 700, fontFamily: 'sans-serif',
                    flexShrink: 0,
                  }}>{item.num}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 30, color: C.white, fontFamily: 'sans-serif' }}>{item.text}</div>
                  </div>
                  <div style={{
                    backgroundColor: 'rgba(129,140,248,0.12)',
                    borderRadius: 8, padding: '4px 12px',
                    fontSize: 22, color: C.indigo, fontFamily: 'sans-serif', flexShrink: 0,
                  }}>{item.tag}</div>
                  <div style={{
                    fontSize: 26, color: C.sky, fontWeight: 600,
                    fontFamily: 'sans-serif', flexShrink: 0,
                  }}>{item.time}</div>
                </div>
              ))}
            </div>

            {/* Coach message */}
            {frame >= T.S3_COACH && (
              <div style={{
                marginTop: 20, opacity: coachOp,
                backgroundColor: 'rgba(34,211,238,0.08)', border: `1px solid ${C.cyan}33`,
                borderRadius: 16, padding: '18px 24px',
                display: 'flex', alignItems: 'flex-start', gap: 14,
              }}>
                <span style={{ fontSize: 30, flexShrink: 0 }}>🤖</span>
                <div style={{ fontSize: 28, color: C.cyan, fontFamily: 'sans-serif', lineHeight: 1.5 }}>
                  週三負載偏高，建議把「整理費用明細」移到週四。已自動調整排程。
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 字幕 1：一個目標，一個日期 */}
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
          一個目標，一個日期，<br /><span style={{ color: C.indigo }}>剩下的交給 AI</span>
        </div>
      </div>

      {/* 字幕 2：負載可視化 */}
      <div style={{
        position: 'absolute', bottom: 280, left: 52, right: 52,
        opacity: cap2Op, textAlign: 'center', zIndex: 10, pointerEvents: 'none',
      }}>
        <div style={{
          display: 'inline-block', fontSize: 50, fontWeight: 900,
          color: C.white, fontFamily: 'sans-serif',
          backgroundColor: 'rgba(11,22,41,0.92)',
          borderRadius: 18, padding: '22px 52px',
          border: `1.5px solid ${C.blue}55`, lineHeight: 1.4,
        }}>
          負載可視化，<br /><span style={{ color: C.blue }}>過載一目瞭然</span>
        </div>
      </div>

      {/* 字幕 3：AI 幫你排好每一天 */}
      <div style={{
        position: 'absolute', bottom: 280, left: 52, right: 52,
        opacity: cap3Op, textAlign: 'center', zIndex: 10, pointerEvents: 'none',
      }}>
        <div style={{
          display: 'inline-block', fontSize: 50, fontWeight: 900,
          color: C.white, fontFamily: 'sans-serif',
          backgroundColor: 'rgba(11,22,41,0.92)',
          borderRadius: 18, padding: '22px 52px',
          border: `1.5px solid ${C.green}55`, lineHeight: 1.4,
        }}>
          AI 幫你排好每一天，<br /><span style={{ color: C.green }}>不用手動排程</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ─── Scene 4: Result (統計概覽) ──────────────────────────────────────────────
const SceneResult: React.FC<{ frame: number }> = ({ frame }) => {
  const op = fadeIn(frame, T.S4_IN, 25);
  const out = fadeOut(frame, T.S5_IN, 25);

  const stats = [
    { label: '本週完成率', value: '87%', color: C.green, icon: '✓' },
    { label: '準時率', value: '92%', color: C.blue, icon: '⏱' },
    { label: '負載平衡', value: '良好', color: C.emerald, icon: '⚖' },
    { label: '里程碑進度', value: '順利', color: C.indigo, icon: '🎯' },
  ];

  const cap4Op = fadeIn(frame, T.S4_IN + 60, 22);

  return (
    <AbsoluteFill style={{ backgroundColor: '#0a1628', opacity: op * out }}>
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse at 50% 30%, rgba(59,91,219,0.10) 0%, transparent 60%)',
      }} />

      <div style={{
        position: 'relative', zIndex: 1, padding: '120px 52px',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
      }}>
        <div style={{
          fontSize: 50, fontWeight: 900, color: C.white, fontFamily: 'sans-serif',
          textAlign: 'center', marginBottom: 60, lineHeight: 1.4,
        }}>
          <span style={{ color: C.indigo }}>里程碑驅動</span>，AI 排程<br />
          最小化管理負擔
        </div>

        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 24, justifyContent: 'center',
          width: '100%',
        }}>
          {stats.map((stat, i) => {
            const entryFrame = T.S4_IN + 15 + i * 18;
            const statOp = fadeIn(frame, entryFrame, 18);
            const statY = slideUp(frame, entryFrame, 25);
            return (
              <div key={i} style={{
                opacity: statOp, transform: `translateY(${statY}px)`,
                backgroundColor: C.card, border: `1.5px solid ${C.cardBorder}`,
                borderRadius: 22, padding: '32px 28px',
                width: 440, textAlign: 'center',
                boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
              }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>{stat.icon}</div>
                <div style={{
                  fontSize: 56, fontWeight: 900, color: stat.color,
                  fontFamily: 'sans-serif', marginBottom: 8,
                }}>{stat.value}</div>
                <div style={{
                  fontSize: 28, color: C.dim, fontFamily: 'sans-serif',
                }}>{stat.label}</div>
              </div>
            );
          })}
        </div>
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
          里程碑驅動，AI 排程，<span style={{ color: C.indigo }}>最小化管理負擔</span>
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
            設定目標，<br />AI 幫你抵達
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
export const ZentropyScheduling: React.FC = () => {
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
