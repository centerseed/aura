"use client";

import { useEffect, useState } from "react";
import { FolderOpen, Package, Tag } from "lucide-react";

interface Props {
  userAreas: string[];
}

export function TourScene1({ userAreas }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 200);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      {/* 標題區域 - 緊湊版 */}
      <div className="text-center space-y-2 animate-in fade-in duration-500">
        <h1 className="text-3xl md:text-4xl font-bold text-white drop-shadow-[0_2px_20px_rgba(168,85,247,0.4)]">
          剛剛你定義了「身份地圖」
        </h1>
        <p className="text-base text-white/90 max-w-xl mx-auto font-medium">
          現在看看如何組織一切
        </p>
      </div>

      {/* 三層架構 - 高對比度簡化版 */}
      <div
        className={`transition-all duration-500 ${
          visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
        }`}
      >
        {/* 統一卡片背景 - 深色半透明提高對比 */}
        <div className="p-6 rounded-3xl bg-slate-900/80 backdrop-blur-xl border-2 border-white/20 shadow-2xl">
          {/* Area 層 */}
          <div className="mb-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/50">
                <FolderOpen className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-white">Area (身份)</h3>
                <p className="text-sm text-white/70">你是誰？</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 ml-15">
              {userAreas.slice(0, 3).map((area, i) => (
                <div
                  key={i}
                  className="px-4 py-2 rounded-lg bg-indigo-500/20 border border-indigo-400/50 text-white font-medium shadow-lg"
                >
                  {area}
                </div>
              ))}
            </div>
          </div>

          {/* Project 層 */}
          <div className="mb-5 ml-8">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center shadow-lg shadow-blue-500/50">
                <Package className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <h4 className="text-base font-bold text-white">Project (專案)</h4>
                <p className="text-xs text-white/70">在做什麼？</p>
              </div>
            </div>
            <div className="ml-13 space-y-2">
              {["Mobile App", "健康計畫", "投資組合"].slice(0, userAreas.length).map((project, i) => (
                <div key={i} className="text-sm text-white/90 pl-3 border-l-2 border-blue-400/60 font-medium">
                  {project}
                </div>
              ))}
            </div>
          </div>

          {/* Topic 層 */}
          <div className="ml-16">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/50">
                <Tag className="w-4 h-4 text-white" />
              </div>
              <div>
                <h5 className="text-base font-bold text-white">Topic (主題)</h5>
                <p className="text-xs text-white/70">怎麼做？</p>
              </div>
            </div>
            <div className="ml-10 flex flex-wrap gap-2">
              {["功能開發", "Bug 修復", "營養規劃"].map((topic, i) => (
                <span
                  key={i}
                  className="text-xs px-3 py-1.5 rounded-lg bg-amber-500/20 border border-amber-400/50 text-white font-medium shadow-md"
                >
                  {topic}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 核心說明 - 高對比 */}
      <div
        className={`p-5 rounded-2xl bg-gradient-to-r from-indigo-600/30 to-indigo-600/30 border-2 border-indigo-400/40 backdrop-blur-xl shadow-2xl transition-all duration-500 ${
          visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
        }`}
        style={{ transitionDelay: "300ms" }}
      >
        <p className="text-white text-center text-base leading-relaxed font-medium">
          <span className="text-indigo-200 font-bold text-lg">AI 會自動將你的想法分類</span>
          <br />
          <span className="text-white/90">到對應的身份、專案和主題</span>
        </p>
      </div>
    </div>
  );
}
