"use client";

import { X, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";

interface QuickInputGuideProps {
  onClose: () => void;
}

export function QuickInputGuide({ onClose }: QuickInputGuideProps) {
  return (
    <div className="fixed inset-0 z-[100] pointer-events-none">
      {/* 半透明遮罩，但不完全遮蔽 */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm pointer-events-auto" onClick={onClose} />

      {/* 聚光燈效果 - 右下角圓形鏤空 */}
      <div
        className="absolute bottom-6 right-6 w-20 h-20 rounded-full pointer-events-none"
        style={{
          boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.4)',
        }}
      />

      {/* 提示卡片 - 右下角上方 */}
      <div className="absolute bottom-32 right-6 pointer-events-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="relative max-w-sm">
          {/* 箭頭指向下方 */}
          <div className="absolute -bottom-3 right-8 w-6 h-6 bg-slate-800 rotate-45 border-b border-r border-white/20" />

          <div className="bg-slate-800 rounded-2xl p-6 shadow-2xl border border-white/20">
            <button
              onClick={onClose}
              className="absolute top-3 right-3 p-1 rounded-full hover:bg-white/20 text-white/70 hover:text-white transition-all"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="pr-6">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                  <ArrowDown className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-lg font-bold text-white">快速輸入在這裡！</h3>
              </div>

              <p className="text-white/90 text-sm leading-relaxed mb-4">
                隨時點擊右下角的按鈕，快速記錄新想法。AI 會自動幫你分類整理。
              </p>

              <Button
                onClick={onClose}
                className="w-full bg-white/20 hover:bg-white/30 text-white border border-white/30"
              >
                知道了
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
