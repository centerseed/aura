"use client";

import { useState, useEffect, useRef } from "react";
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
// Trend Chart (canvas-based, no extra deps)
// ============================================================================

function TrendChart({ data }: { data: { date: string; count: number }[] }) {
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
    const pad = { top: 16, right: 16, bottom: 32, left: 36 };

    ctx.clearRect(0, 0, width, height);

    if (data.length === 0) {
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.font = "12px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("無資料", width / 2, height / 2);
      return;
    }

    const maxCount = Math.max(...data.map((d) => d.count), 1);
    const cw = width - pad.left - pad.right;
    const ch = height - pad.top - pad.bottom;

    // Axes
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad.left, pad.top);
    ctx.lineTo(pad.left, pad.top + ch);
    ctx.lineTo(pad.left + cw, pad.top + ch);
    ctx.stroke();

    if (data.length < 2) return;

    const xStep = cw / (data.length - 1);

    // Filled area under line
    ctx.fillStyle = "rgba(99,102,241,0.15)";
    ctx.beginPath();
    data.forEach((point, i) => {
      const x = pad.left + i * xStep;
      const y = pad.top + ch - (point.count / maxCount) * ch;
      if (i === 0) ctx.moveTo(x, pad.top + ch);
      ctx.lineTo(x, y);
    });
    ctx.lineTo(pad.left + (data.length - 1) * xStep, pad.top + ch);
    ctx.closePath();
    ctx.fill();

    // Line
    ctx.strokeStyle = "#6366f1";
    ctx.lineWidth = 2;
    ctx.beginPath();
    data.forEach((point, i) => {
      const x = pad.left + i * xStep;
      const y = pad.top + ch - (point.count / maxCount) * ch;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Dots
    ctx.fillStyle = "#818cf8";
    data.forEach((point, i) => {
      const x = pad.left + i * xStep;
      const y = pad.top + ch - (point.count / maxCount) * ch;
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    });

    // X labels (every ~6 ticks)
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "center";
    const labelEvery = Math.max(1, Math.ceil(data.length / 6));
    data.forEach((point, i) => {
      if (i % labelEvery !== 0 && i !== data.length - 1) return;
      const x = pad.left + i * xStep;
      ctx.fillText(point.date.slice(5), x, height - 6);
    });

    // Y labels
    ctx.textAlign = "right";
    for (let i = 0; i <= 4; i++) {
      const value = Math.round((maxCount * i) / 4);
      const y = pad.top + ch - (i / 4) * ch + 4;
      ctx.fillText(String(value), pad.left - 4, y);
    }
  }, [data]);

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
              <TrendChart data={dailyTrend} />
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
