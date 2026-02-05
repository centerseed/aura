"use client";

import { useEffect, useState } from "react";
import { Sparkles, ArrowRight, CheckCircle2 } from "lucide-react";

export function TourScene3() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 200);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="space-y-12 max-w-3xl mx-auto">
      {/* 標題區域 - 統一風格 */}
      <div className="text-center space-y-3 animate-in fade-in duration-500">
        <h1 className="text-4xl md:text-5xl font-bold text-white drop-shadow-[0_2px_20px_rgba(168,85,247,0.4)]">
          AI 會自動整理並安排時間
        </h1>
        <p className="text-lg text-white/90 max-w-xl mx-auto font-medium">
          你只需記錄想法，分類和時間都交給 AI
        </p>
      </div>

      {/* 示意流程 - 簡化版 */}
      <div
        className={`transition-all duration-500 ${
          visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
        }`}
      >
        <div className="p-8 rounded-3xl bg-slate-900/80 backdrop-blur-xl border-2 border-white/20 shadow-2xl space-y-6">
          {/* 輸入 */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center text-white text-xs font-bold shadow-lg">
                1
              </div>
              <h3 className="text-white font-bold">用戶輸入</h3>
            </div>
            <div className="ml-8 p-3 rounded-xl bg-slate-800/80 border border-white/20">
              <p className="text-white font-medium">「完成 OAuth 登入功能」</p>
            </div>
          </div>

          <ArrowRight className="w-6 h-6 text-white/40 mx-auto" />

          {/* AI 整理與分析 */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-xs font-bold shadow-lg">
                2
              </div>
              <h3 className="text-white font-bold">AI 整理與分析</h3>
            </div>
            <div className="ml-8 space-y-2 text-sm">
              <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-400/30 text-white/90">
                🏷️ 自動分類: 事業 → Mobile App → 功能開發
              </div>
              <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-400/30 text-white/90">
                🎯 識別里程碑: MVP Release (2026-03-01)
              </div>
              <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-400/30 text-white/90">
                ⚙️ 評估複雜度: 中等，預留 5 天
              </div>
              <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-400/30 text-white/90">
                📅 計算時間: 2026-02-24 (提前緩衝)
              </div>
            </div>
          </div>

          <ArrowRight className="w-6 h-6 text-white/40 mx-auto" />

          {/* 結果 */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white text-xs font-bold shadow-lg">
                3
              </div>
              <h3 className="text-white font-bold">推斷結果</h3>
            </div>
            <div className="ml-8 p-4 rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 border-2 border-green-400/40">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-white/80">推斷完成日期</span>
                  <span className="text-green-300 font-bold text-lg">2026-02-24</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-green-200">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>已自動排程至合適日期</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 核心說明 - 簡化版 */}
      <div
        className={`p-6 rounded-2xl bg-gradient-to-r from-indigo-600/30 to-violet-600/30 border-2 border-indigo-400/40 backdrop-blur-xl shadow-2xl transition-all duration-500 ${
          visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
        }`}
        style={{ transitionDelay: "300ms" }}
      >
        <p className="text-white text-center text-lg leading-relaxed font-medium">
          <span className="text-indigo-200 font-bold text-xl">不用手動排程</span>
          <br />
          <span className="text-white/90">AI 會根據里程碑自動推斷最適合的完成時間</span>
        </p>
      </div>
    </div>
  );
}
