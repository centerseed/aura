"use client";

import { useEffect, useState } from "react";
import { Calendar, Anchor, Sparkles, Lightbulb } from "lucide-react";

export function TourScene2() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 200);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="space-y-12 max-w-3xl mx-auto">
      {/* 標題區域 */}
      <div className="text-center space-y-3 animate-in fade-in duration-500">
        <h1 className="text-4xl md:text-5xl font-bold text-white drop-shadow-[0_2px_20px_rgba(59,130,246,0.4)]">
          什麼是里程碑？
        </h1>
        <p className="text-lg text-white/90 max-w-xl mx-auto font-medium">
          里程碑是你為重要目標設定的截止日期
        </p>
      </div>

      {/* 三個重點說明 */}
      <div
        className={`space-y-6 transition-all duration-500 ${
          visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
        }`}
      >
        {/* 重點 1 */}
        <div className="flex gap-4 items-start">
          <div className="flex-shrink-0 w-12 h-12 rounded-full bg-indigo-500/20 border-2 border-indigo-400/40 flex items-center justify-center">
            <span className="text-indigo-400 text-xl font-bold">1</span>
          </div>
          <div className="flex-1 pt-2">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-5 h-5 text-indigo-400" />
              <h3 className="text-white text-xl font-semibold">你需要自己設定里程碑</h3>
            </div>
            <p className="text-white/70 text-base">為重要的事情設定明確的完成日期</p>
          </div>
        </div>

        {/* 重點 2 */}
        <div className="flex gap-4 items-start">
          <div className="flex-shrink-0 w-12 h-12 rounded-full bg-blue-500/20 border-2 border-blue-400/40 flex items-center justify-center">
            <span className="text-blue-400 text-xl font-bold">2</span>
          </div>
          <div className="flex-1 pt-2">
            <div className="flex items-center gap-2 mb-2">
              <Anchor className="w-5 h-5 text-blue-400" />
              <h3 className="text-white text-xl font-semibold">里程碑是時間錨點</h3>
            </div>
            <p className="text-white/70 text-base">讓系統知道什麼時候必須完成</p>
          </div>
        </div>

        {/* 重點 3 */}
        <div className="flex gap-4 items-start">
          <div className="flex-shrink-0 w-12 h-12 rounded-full bg-emerald-500/20 border-2 border-emerald-400/40 flex items-center justify-center">
            <span className="text-emerald-400 text-xl font-bold">3</span>
          </div>
          <div className="flex-1 pt-2">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-5 h-5 text-emerald-400" />
              <h3 className="text-white text-xl font-semibold">AI 會自動安排任務</h3>
            </div>
            <p className="text-white/70 text-base">根據你的里程碑倒推任務時間</p>
          </div>
        </div>
      </div>

      {/* 範例說明 */}
      <div
        className={`p-6 rounded-2xl bg-gradient-to-r from-amber-600/20 to-orange-600/20 border-2 border-amber-500/40 backdrop-blur-xl shadow-2xl transition-all duration-500 ${
          visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
        }`}
        style={{ transitionDelay: "300ms" }}
      >
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
            <Lightbulb className="w-6 h-6 text-amber-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-amber-400 text-xl font-bold mb-3">舉例</h3>
            <p className="text-white/90 text-base leading-relaxed">
              你設定：「3 月 1 日要完成 MVP Release」
              <br />
              <br />
              AI 會自動：為相關任務安排合適的完成時間，確保在 3 月 1 日前都能完成
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
