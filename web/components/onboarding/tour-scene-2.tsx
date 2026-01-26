"use client";

import { useEffect, useState } from "react";
import { Target, Calendar, Zap } from "lucide-react";

interface Props {
  userAreas: string[];
}

export function TourScene2({ userAreas }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 200);
    return () => clearTimeout(timer);
  }, []);

  const milestones = [
    {
      id: 1,
      area: userAreas[0] || "事業",
      name: "MVP Release",
      date: "2026-03-01",
      daysAway: 36,
      color: "from-blue-500 to-blue-600",
      icon: "🎯",
    },
    {
      id: 2,
      area: userAreas[1] || "個人",
      name: "達成目標體重",
      date: "2026-06-01",
      daysAway: 128,
      color: "from-green-500 to-emerald-600",
      icon: "🏃",
    },
    {
      id: 3,
      area: userAreas[0] || "事業",
      name: "正式上線",
      date: "2026-04-01",
      daysAway: 67,
      color: "from-purple-500 to-pink-600",
      icon: "🚀",
    },
  ];

  const sortedMilestones = [...milestones].sort((a, b) => a.daysAway - b.daysAway);

  return (
    <div className="space-y-12 max-w-3xl mx-auto">
      {/* 標題區域 - 統一風格 */}
      <div className="text-center space-y-3 animate-in fade-in duration-500">
        <h1 className="text-4xl md:text-5xl font-bold text-white drop-shadow-[0_2px_20px_rgba(168,85,247,0.4)]">
          為重要的事設定里程碑
        </h1>
        <p className="text-lg text-white/90 max-w-xl mx-auto font-medium">
          Milestone 是你的時間錨點
        </p>
      </div>

      {/* 時間軸視覺化 - 簡化高對比版 */}
      <div
        className={`transition-all duration-500 ${
          visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
        }`}
      >
        <div className="p-8 rounded-3xl bg-slate-900/80 backdrop-blur-xl border-2 border-white/20 shadow-2xl">
          {/* 時間軸 */}
          <div className="relative h-24 mb-8">
            <div className="absolute top-1/2 left-0 right-0 h-1.5 bg-gradient-to-r from-purple-500/40 via-violet-500/40 to-pink-500/40 rounded-full shadow-lg" />

            {sortedMilestones.map((milestone, i) => {
              const position = (milestone.daysAway / 150) * 100;
              return (
                <div
                  key={milestone.id}
                  className="absolute top-1/2 -translate-y-1/2"
                  style={{ left: `${Math.min(position, 92)}%` }}
                >
                  <div className="flex flex-col items-center -translate-x-1/2">
                    <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${milestone.color} flex items-center justify-center text-lg shadow-xl shadow-purple-500/50 border-2 border-white/30`}>
                      {milestone.icon}
                    </div>
                    <div className="mt-3 bg-slate-800/90 border border-white/30 rounded-lg px-3 py-2 text-center whitespace-nowrap backdrop-blur-sm shadow-xl">
                      <p className="font-bold text-white text-sm">{milestone.name}</p>
                      <p className="text-white/70 text-xs">{milestone.daysAway} 天後</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 核心說明 - 簡化版 */}
      <div
        className={`p-6 rounded-2xl bg-gradient-to-r from-purple-600/30 to-violet-600/30 border-2 border-purple-400/40 backdrop-blur-xl shadow-2xl transition-all duration-500 ${
          visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
        }`}
        style={{ transitionDelay: "300ms" }}
      >
        <p className="text-white text-center text-lg leading-relaxed font-medium">
          <span className="text-purple-200 font-bold text-xl">設定 Milestone 後</span>
          <br />
          <span className="text-white/90">AI 會根據時間點自動推斷任務完成日期</span>
        </p>
      </div>
    </div>
  );
}
