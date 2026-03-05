"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { API_BASE_URL } from "@/lib/api-client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, RefreshCw } from "lucide-react";

// ============================================================================
// Types
// ============================================================================

type DistillStatus = "none" | "building" | "active" | "flywheel";

interface UserStat {
  userId: string;
  email: string | null;
  name: string | null;
  total: number;
  applied: number;
  edited: number;
  cancelled: number;
  editRatePct: number;
  firstAt: string;
  lastAt: string;
  correctionCount: number;
  ruleCount: number;
  avgConfidence: number;
  totalApplied: number;
  distillStatus: DistillStatus;
}

interface AnalyticsData {
  brainDump: {
    total: number;
    byUser: UserStat[];
    dailyTrend: { date: string; count: number }[];
  };
  librarian: {
    byUser: {
      userId: string;
      email: string | null;
      correctionCount: number;
      ruleCount: number;
      avgConfidence: number;
      totalApplied: number;
      distillStatus: DistillStatus;
    }[];
  };
  flywheelSummary: {
    totalUsers: number;
    usersWithAnyBrainDump: number;
    usersOverThreshold: number;
    usersNearThreshold: number;
    overallEditRate: number;
  };
}

// ============================================================================
// LineChart (canvas-based, no extra deps)
// ============================================================================

function LineChart({
  dates,
  values,
  lineColor,
  fillColor,
  dotColor,
  leftPad = 36,
  formatY = String,
}: {
  dates: string[];
  values: number[];
  lineColor: string;
  fillColor: string;
  dotColor: string;
  leftPad?: number;
  formatY?: (value: number) => string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const pad = { top: 16, right: 16, bottom: 32, left: leftPad };

    ctx.clearRect(0, 0, width, height);

    if (dates.length === 0) {
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.font = "12px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("無資料", width / 2, height / 2);
      return;
    }

    const maxVal = Math.max(...values, 1);
    const cw = width - pad.left - pad.right;
    const ch = height - pad.top - pad.bottom;

    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad.left, pad.top);
    ctx.lineTo(pad.left, pad.top + ch);
    ctx.lineTo(pad.left + cw, pad.top + ch);
    ctx.stroke();

    if (dates.length < 2) return;

    const xStep = cw / (dates.length - 1);

    ctx.fillStyle = fillColor;
    ctx.beginPath();
    values.forEach((v, i) => {
      const x = pad.left + i * xStep;
      const y = pad.top + ch - (v / maxVal) * ch;
      if (i === 0) ctx.moveTo(x, pad.top + ch);
      ctx.lineTo(x, y);
    });
    ctx.lineTo(pad.left + (dates.length - 1) * xStep, pad.top + ch);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    values.forEach((v, i) => {
      const x = pad.left + i * xStep;
      const y = pad.top + ch - (v / maxVal) * ch;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    ctx.fillStyle = dotColor;
    values.forEach((v, i) => {
      const x = pad.left + i * xStep;
      const y = pad.top + ch - (v / maxVal) * ch;
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "center";
    const labelEvery = Math.max(1, Math.ceil(dates.length / 6));
    dates.forEach((date, i) => {
      if (i % labelEvery !== 0 && i !== dates.length - 1) return;
      const x = pad.left + i * xStep;
      ctx.fillText(date.slice(5), x, height - 6);
    });

    ctx.textAlign = "right";
    for (let i = 0; i <= 4; i++) {
      const value = Math.round((maxVal * i) / 4);
      const y = pad.top + ch - (i / 4) * ch + 4;
      ctx.fillText(formatY(value), pad.left - 4, y);
    }
  }, [dates, values, lineColor, fillColor, dotColor, leftPad, formatY]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: "100%", height: "160px", display: "block" }}
    />
  );
}

// ============================================================================
// Status Badge
// ============================================================================

function StatusBadge({ status }: { status: DistillStatus }) {
  const config = {
    none: { label: "none", cls: "bg-white/5 text-white/40 border-white/10" },
    building: { label: "🟡 building", cls: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
    active: { label: "🟢 active", cls: "bg-green-500/10 text-green-400 border-green-500/20" },
    flywheel: { label: "🚀 flywheel", cls: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20" },
  }[status];
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border whitespace-nowrap ${config.cls}`}>
      {config.label}
    </span>
  );
}

// ============================================================================
// Token Usage Types
// ============================================================================

interface TokenDailyRow {
  date: string;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  count: number;
}

interface TokenFeatureRow {
  feature: string;
  total_tokens: number;
  count: number;
  avg_tokens_per_call: number;
}

interface TokenUsageData {
  daily: TokenDailyRow[];
  byFeature: TokenFeatureRow[];
}

// ============================================================================
// Main Page
// ============================================================================

async function getAuthHeaders() {
  const user = auth.currentUser;
  if (!user) throw new Error("No authenticated user");
  const token = await user.getIdToken();
  return { Authorization: `Bearer ${token}` };
}

export default function AnalyticsDashboard() {
  const router = useRouter();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authed, setAuthed] = useState(false);
  const [tokenUsageData, setTokenUsageData] = useState<TokenUsageData | null>(null);
  const [tokenUserId, setTokenUserId] = useState("");
  const [tokenDays, setTokenDays] = useState(30);
  const [tokenLoading, setTokenLoading] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/");
        return;
      }
      // Just confirm login state
      try {
        const token = await user.getIdToken();
        const res = await fetch(`${API_BASE_URL}/api/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          router.push("/");
          return;
        }
        setAuthed(true);
      } catch {
        router.push("/");
      }
    });
    return () => unsub();
  }, [router]);

  const fetchTokenUsage = useCallback(async (uid: string, days: number) => {
    if (!uid.trim()) return;
    setTokenLoading(true);
    setTokenError(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(
        `${API_BASE_URL}/api/admin/token-usage?userId=${encodeURIComponent(uid)}&days=${days}`,
        { headers }
      );
      const json = await res.json();
      if (json.success) {
        setTokenUsageData(json.data);
      } else {
        setTokenError(json.error?.message ?? "Unknown error");
      }
    } catch (e) {
      setTokenError(String(e));
    } finally {
      setTokenLoading(false);
    }
  }, []);

  const fetchAnalytics = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE_URL}/api/admin/analytics`, { headers });
      if (res.status === 403) {
        router.push("/");
        return;
      }
      if (!res.ok) {
        setError(`Server error: ${res.status}`);
        return;
      }
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      } else {
        setError(json.error?.message ?? "Unknown error");
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (authed) fetchAnalytics();
  }, [authed]);

  if (!authed) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 to-slate-900 flex items-center justify-center">
        <p className="text-white/50">載入中...</p>
      </div>
    );
  }

  const summary = data?.flywheelSummary;
  const byUser = data?.brainDump.byUser ?? [];
  const dailyTrend = data?.brainDump.dailyTrend ?? [];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 to-slate-900 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push("/admin/eval")}
              className="border-white/10 bg-white/5 hover:bg-white/10 text-white"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              AI 評估紀錄
            </Button>
            <h1 className="text-2xl font-bold text-white">Flywheel 分析</h1>
          </div>
          <Button
            size="sm"
            onClick={fetchAnalytics}
            disabled={isLoading}
            className="bg-blue-600 hover:bg-blue-500 text-white"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            重新整理
          </Button>
        </div>

        {error && (
          <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        {isLoading && !data ? (
          <p className="text-white/40 text-center py-16">載入中...</p>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="bg-slate-900 border-white/10 p-4">
                <p className="text-white/50 text-xs mb-1">Brain Dumps 總計</p>
                <p className="text-3xl font-bold text-white">{data?.brainDump.total ?? 0}</p>
              </Card>
              <Card className="bg-slate-900 border-white/10 p-4">
                <p className="text-white/50 text-xs mb-1">整體 Edit Rate</p>
                <p className="text-3xl font-bold text-indigo-400">
                  {((summary?.overallEditRate ?? 0) * 100).toFixed(1)}%
                </p>
              </Card>
              <Card className="bg-slate-900 border-white/10 p-4">
                <p className="text-white/50 text-xs mb-1">Corrections ≥ 10</p>
                <p className="text-3xl font-bold text-green-400">
                  {summary?.usersOverThreshold ?? 0}
                  <span className="text-base text-white/40 ml-1">/ {summary?.totalUsers ?? 0} 人</span>
                </p>
              </Card>
              <Card className="bg-slate-900 border-white/10 p-4">
                <p className="text-white/50 text-xs mb-1">Near Threshold (5-9)</p>
                <p className="text-3xl font-bold text-amber-400">
                  {summary?.usersNearThreshold ?? 0}
                  <span className="text-base text-white/40 ml-1">人</span>
                </p>
              </Card>
            </div>

            {/* Per-User Table */}
            <Card className="bg-slate-900 border-white/10 p-4">
              <h2 className="text-lg font-semibold text-white mb-4">Per-User 明細</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-white/40 text-left border-b border-white/10">
                      <th className="pb-2 pr-4">用戶</th>
                      <th className="pb-2 pr-4 text-right">Dumps</th>
                      <th className="pb-2 pr-4 text-right">Edit%</th>
                      <th className="pb-2 pr-4 text-right">Corrections</th>
                      <th className="pb-2 pr-4 text-right">Rules</th>
                      <th className="pb-2 pr-4 text-right">Avg Conf</th>
                      <th className="pb-2 pr-4 text-right">Applied</th>
                      <th className="pb-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byUser.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="text-center text-white/30 py-8">
                          無資料
                        </td>
                      </tr>
                    ) : (
                      byUser.map((u) => (
                        <tr
                          key={u.userId}
                          className="border-b border-white/5 hover:bg-white/5 transition-colors"
                        >
                          <td className="py-2 pr-4">
                            <div className="text-white text-sm">{u.email ?? u.userId.slice(0, 8)}</div>
                            {u.name && (
                              <div className="text-white/40 text-xs">{u.name}</div>
                            )}
                          </td>
                          <td className="py-2 pr-4 text-right text-white">{u.total}</td>
                          <td className="py-2 pr-4 text-right text-indigo-300">
                            {u.editRatePct.toFixed(1)}%
                          </td>
                          <td className="py-2 pr-4 text-right text-white">
                            <span
                              className={
                                u.correctionCount >= 10
                                  ? "text-green-400 font-semibold"
                                  : u.correctionCount >= 5
                                  ? "text-amber-400"
                                  : "text-white/50"
                              }
                            >
                              {u.correctionCount}
                            </span>
                          </td>
                          <td className="py-2 pr-4 text-right text-white">{u.ruleCount}</td>
                          <td className="py-2 pr-4 text-right text-white/70">
                            {u.avgConfidence > 0 ? u.avgConfidence.toFixed(2) : "—"}
                          </td>
                          <td className="py-2 pr-4 text-right text-white/70">{u.totalApplied}</td>
                          <td className="py-2">
                            <StatusBadge status={u.distillStatus} />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Daily Trend Chart */}
            <Card className="bg-slate-900 border-white/10 p-4">
              <h2 className="text-lg font-semibold text-white mb-4">
                每日 Brain Dump 趨勢（近 30 天）
              </h2>
              <LineChart
                dates={dailyTrend.map((d) => d.date)}
                values={dailyTrend.map((d) => d.count)}
                lineColor="#6366f1"
                fillColor="rgba(99,102,241,0.15)"
                dotColor="#818cf8"
              />
            </Card>

            {/* Token Usage Section */}
            <Card className="bg-slate-900 border-white/10 p-4">
              <h2 className="text-lg font-semibold text-white mb-4">AI Token 用量查詢</h2>
              <div className="flex flex-wrap gap-3 mb-4">
                <input
                  type="text"
                  placeholder="User ID (UUID)"
                  value={tokenUserId}
                  onChange={(e) => setTokenUserId(e.target.value)}
                  className="flex-1 min-w-[200px] px-3 py-1.5 rounded bg-white/5 border border-white/10 text-white text-sm placeholder-white/30 outline-none focus:border-white/30"
                />
                <select
                  value={tokenDays}
                  onChange={(e) => setTokenDays(Number(e.target.value))}
                  className="px-3 py-1.5 rounded bg-white/5 border border-white/10 text-white text-sm outline-none"
                >
                  <option value={7}>近 7 天</option>
                  <option value={14}>近 14 天</option>
                  <option value={30}>近 30 天</option>
                </select>
                <Button
                  size="sm"
                  onClick={() => fetchTokenUsage(tokenUserId, tokenDays)}
                  disabled={tokenLoading || !tokenUserId.trim()}
                  className="bg-emerald-700 hover:bg-emerald-600 text-white"
                >
                  {tokenLoading ? "查詢中..." : "查詢"}
                </Button>
              </div>

              {tokenError && (
                <p className="text-red-400 text-sm mb-3">{tokenError}</p>
              )}

              {tokenUsageData && (
                <div className="space-y-4">
                  {/* Summary numbers */}
                  {tokenUsageData.daily.length > 0 && (() => {
                    const totalTokens = tokenUsageData.daily.reduce((s, d) => s + d.total_tokens, 0);
                    const totalCalls = tokenUsageData.daily.reduce((s, d) => s + d.count, 0);
                    return (
                      <div className="grid grid-cols-3 gap-3">
                        <div className="bg-white/5 rounded p-3">
                          <p className="text-white/40 text-xs mb-1">Total Tokens</p>
                          <p className="text-white font-semibold">{totalTokens.toLocaleString()}</p>
                        </div>
                        <div className="bg-white/5 rounded p-3">
                          <p className="text-white/40 text-xs mb-1">AI Calls</p>
                          <p className="text-white font-semibold">{totalCalls}</p>
                        </div>
                        <div className="bg-white/5 rounded p-3">
                          <p className="text-white/40 text-xs mb-1">Avg / Call</p>
                          <p className="text-white font-semibold">
                            {totalCalls > 0 ? Math.round(totalTokens / totalCalls).toLocaleString() : "—"}
                          </p>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Daily trend chart */}
                  <div>
                    <p className="text-white/50 text-xs mb-2">每日 Token 趨勢</p>
                    <LineChart
                      dates={tokenUsageData.daily.map((d) => d.date)}
                      values={tokenUsageData.daily.map((d) => d.total_tokens)}
                      lineColor="#10b981"
                      fillColor="rgba(16,185,129,0.12)"
                      dotColor="#34d399"
                      leftPad={56}
                      formatY={(v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)}
                    />
                  </div>

                  {/* Feature breakdown table */}
                  {tokenUsageData.byFeature.length > 0 && (
                    <div>
                      <p className="text-white/50 text-xs mb-2">功能分布</p>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-white/40 text-left border-b border-white/10">
                            <th className="pb-2 pr-4">Feature</th>
                            <th className="pb-2 pr-4 text-right">Calls</th>
                            <th className="pb-2 pr-4 text-right">Total Tokens</th>
                            <th className="pb-2 text-right">Avg / Call</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tokenUsageData.byFeature.map((row) => (
                            <tr key={row.feature} className="border-b border-white/5">
                              <td className="py-1.5 pr-4 text-white font-mono text-xs">{row.feature}</td>
                              <td className="py-1.5 pr-4 text-right text-white/70">{row.count}</td>
                              <td className="py-1.5 pr-4 text-right text-emerald-400">{row.total_tokens.toLocaleString()}</td>
                              <td className="py-1.5 text-right text-white/50">{row.avg_tokens_per_call.toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {tokenUsageData.byFeature.length === 0 && tokenUsageData.daily.length === 0 && (
                    <p className="text-white/30 text-sm text-center py-4">此期間無 token 記錄</p>
                  )}
                </div>
              )}
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
