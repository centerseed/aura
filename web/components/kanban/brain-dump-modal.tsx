"use client";

import { useState } from "react";
import { X, Sparkles, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BrainDumpModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (text: string) => Promise<void>;
  isLoading: boolean;
}

export function BrainDumpModal({ isOpen, onClose, onSubmit, isLoading }: BrainDumpModalProps) {
  const [text, setText] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!text.trim() || isLoading) return;
    await onSubmit(text);
    setText("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl mx-4 bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">腦內風暴</h2>
              <p className="text-sm text-white/50">傾倒你的想法，AI 會幫你整理</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5 text-white/50" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="腦袋裡在想什麼？任務、想法、隨機念頭——全部倒出來，AI 會幫你整理..."
            className="w-full h-48 p-4 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 resize-none focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all"
            autoFocus
          />

          {/* Tips */}
          <div className="mt-4 p-4 rounded-xl bg-gradient-to-r from-purple-900/30 to-indigo-900/30 border border-purple-500/20">
            <p className="text-sm text-purple-300">
              <strong>提示：</strong>可以混合多個主題，使用任何語言。AI 會：
            </p>
            <ul className="mt-2 text-sm text-purple-400 space-y-1">
              <li>• 從你的意識流中識別出不同的項目</li>
              <li>• 將每個項目分類到正確的 身分 → 產品 → 主題</li>
              <li>• 判斷緊急程度和生命週期階段</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-white/10 bg-slate-900/50">
          <Button variant="ghost" onClick={onClose} disabled={isLoading} className="text-white/60 hover:text-white hover:bg-white/10">
            取消
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!text.trim() || isLoading}
            className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white min-w-[120px]"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                處理中...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                送出
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
