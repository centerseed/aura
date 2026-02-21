"use client";

import { Button } from "@/components/ui/button";
import { ArrowRight, ArrowLeft, X } from "lucide-react";

interface Props {
  currentScene: number;
  totalScenes: number;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
}

export function TourNavigation({
  currentScene,
  totalScenes,
  onNext,
  onPrev,
  onSkip,
}: Props) {
  return (
    <>
      {/* 跳過按鈕（右上角固定） */}
      <button
        onClick={onSkip}
        className="fixed top-6 right-6 z-50 text-white/40 hover:text-white/80 transition-colors p-2 rounded-lg hover:bg-white/5"
        aria-label="Skip tour"
      >
        <X className="w-6 h-6" />
      </button>

      {/* 底部導航欄 */}
      <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-slate-900/95 to-slate-900/80 backdrop-blur-xl border-t border-white/10 z-40">
        <div className="max-w-5xl mx-auto px-6 py-6 flex items-center justify-between">
          {/* 左側：上一步按鈕 */}
          <div className="w-32">
            {currentScene > 1 ? (
              <button
                onClick={onPrev}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-all"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="text-sm font-medium">上一步</span>
              </button>
            ) : (
              <div /> // 空白佔位符
            )}
          </div>

          {/* 中間：進度指示器 */}
          <div className="flex items-center gap-2">
            {Array.from({ length: totalScenes }).map((_, i) => (
              <button
                key={i}
                onClick={() => {
                  // 允許用戶點擊進度點跳轉到特定場景
                  // 但為了簡化，這裡只用來顯示進度
                }}
                className={`transition-all duration-300 rounded-full ${
                  i + 1 === currentScene
                    ? "w-8 h-2 bg-gradient-to-r from-indigo-500 to-indigo-500"
                    : i + 1 < currentScene
                    ? "w-2 h-2 bg-indigo-500/50"
                    : "w-2 h-2 bg-white/20"
                }`}
                aria-label={`Scene ${i + 1}`}
              />
            ))}
          </div>

          {/* 右側：下一步/完成按鈕 */}
          <div className="w-32 flex justify-end">
            <Button
              onClick={onNext}
              variant="cta" className="flex items-center gap-2 px-6 py-2 font-medium rounded-lg transition-all duration-300 shadow-lg shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/40"
            >
              <span className="text-sm">
                {currentScene === totalScenes ? "開始使用" : "下一步"}
              </span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
