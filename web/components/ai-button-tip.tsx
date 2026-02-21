"use client";

import { useEffect } from "react";
import { X, Sparkles } from "lucide-react";

interface AIButtonTipProps {
  show: boolean;
  onClose: () => void;
}

export function AIButtonTip({ show, onClose }: AIButtonTipProps) {
  useEffect(() => {
    if (show) {
      const timer = setTimeout(() => {
        onClose();
        localStorage.setItem("aiButtonTipShown", "true");
      }, 8000);
      return () => clearTimeout(timer);
    }
  }, [show, onClose]);

  if (!show) return null;

  const handleClose = () => {
    onClose();
    localStorage.setItem("aiButtonTipShown", "true");
  };

  return (
    <div className="fixed top-20 right-6 z-[100] animate-in slide-in-from-right-4 fade-in duration-300">
      <div className="bg-slate-800 rounded-xl p-4 shadow-2xl max-w-sm border border-white/20">
        <button
          onClick={handleClose}
          className="absolute top-2 right-2 p-1 rounded-full hover:bg-white/20 text-white/70 hover:text-white transition-all"
        >
          <X className="w-4 h-4" />
        </button>
        <div className="flex items-start gap-3 pr-4">
          <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-medium text-white text-sm mb-1">
              小技巧：AI 整理功能
            </p>
            <p className="text-white/80 text-sm leading-relaxed">
              當專案事項變多變雜時，點擊專案卡片右上角的{" "}
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/20 text-white font-medium">
                <Sparkles className="w-3 h-3" />
              </span>{" "}
              按鈕，讓 AI 幫你自動整理分類。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
