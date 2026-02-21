"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { X, FolderOpen, AlertCircle, Loader2, Sparkles, Trash2 } from "lucide-react";
import { auth } from "@/lib/firebase";
import { API_BASE_URL } from "@/lib/api-client";

interface AreaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  userId: string;
  editingArea?: {
    id: string;
    name: string;
    scope?: string | null;
    description?: string | null;
    productCount?: number;
  } | null;
}

// 預設身分選項作為建議
const PRESET_SUGGESTIONS = [
  {
    name: "事業",
    scope: "職涯發展、專案管理、技能提升、事業規劃",
  },
  {
    name: "個人",
    scope: "興趣愛好、自我學習、心靈成長、休閒娛樂",
  },
  {
    name: "人際",
    scope: "家庭關係、朋友社交、親子教育、人脈經營",
  },
  {
    name: "財務",
    scope: "投資理財、資產配置、預算管理、被動收入",
  },
];

export function AreaModal({
  isOpen,
  onClose,
  userId,
  onSuccess,
  editingArea,
}: AreaModalProps) {
  const [name, setName] = useState("");
  const [scope, setScope] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 重置或填充表單
  useEffect(() => {
    if (isOpen) {
      if (editingArea) {
        setName(editingArea.name);
        setScope(editingArea.scope || "");
      } else {
        setName("");
        setScope("");
      }
      setError(null);
    }
  }, [isOpen, editingArea]);

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError("請輸入身分名稱");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // 獲取 Firebase token
      const user = auth.currentUser;
      if (!user) {
        throw new Error("未登入");
      }
      const token = await user.getIdToken();

      if (editingArea) {
        // 更新現有 Area
        const res = await fetch(`${API_BASE_URL}/api/areas/${editingArea.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
          },
          body: JSON.stringify({
            name: name.trim(),
            scope: scope.trim() || undefined,
            description: scope.trim() || undefined,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error?.message || "更新失敗");
        }
      } else {
        // 創建新 Area
        const res = await fetch(`${API_BASE_URL}/api/areas`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
          },
          body: JSON.stringify({
            userId,
            name: name.trim(),
            scope: scope.trim(),
            description: scope.trim(),
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error?.message || "創建失敗");
        }
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失敗");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!editingArea) return;

    if (!confirm(`確定要刪除「${editingArea.name}」這個身分嗎？此操作無法復原。`)) {
      return;
    }

    setIsDeleting(true);
    setError(null);

    try {
      // 獲取 Firebase token
      const user = auth.currentUser;
      if (!user) {
        throw new Error("未登入");
      }
      const token = await user.getIdToken();

      const res = await fetch(`${API_BASE_URL}/api/areas/${editingArea.id}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.message || "刪除失敗");
      }

      onSuccess();
      onClose();
    } catch (err) {
      // 將英文錯誤訊息轉換為中文
      const message = err instanceof Error ? err.message : "刪除失敗";
      if (message.includes('existing products')) {
        // 從錯誤訊息中提取專案數量
        const match = message.match(/(\d+) product/);
        const count = match ? match[1] : '數個';
        setError(`此身分下還有 ${count} 個專案，請先刪除所有專案後再刪除此身分。`);
      } else {
        setError(message);
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const applySuggestion = (suggestion: { name: string; scope: string }) => {
    setName(suggestion.name);
    setScope(suggestion.scope);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <Card className="relative w-full max-w-2xl mx-4 bg-slate-900 border-white/10 shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 sticky top-0 bg-slate-900 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cta flex items-center justify-center">
              <FolderOpen className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">
                {editingArea ? "編輯身分" : "新增身分"}
              </h2>
              <p className="text-sm text-white/50">
                {editingArea ? "修改身分的名稱與範圍" : "定義一個新的身分地圖"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/50 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-5 space-y-5">
          {/* Error Message */}
          {error && (
            <div className="flex items-start gap-3 p-4 rounded-lg bg-red-500/10 border border-red-500/20">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-400">操作失敗</p>
                <p className="text-sm text-red-300/70 mt-1">{error}</p>
              </div>
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">
              身分名稱 <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：事業、個人、創作者..."
              className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              autoFocus
            />
          </div>

          {/* Scope */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">
              這個身分包含什麼？
            </label>
            <textarea
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              placeholder="例如：職涯發展、專案管理、技能提升..."
              rows={3}
              className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none"
            />
          </div>

          {/* Suggestions (僅在新增模式顯示) */}
          {!editingArea && (
            <div>
              <label className="block text-sm font-medium text-white/50 mb-3">
                快速選擇常見身分
              </label>
              <div className="grid grid-cols-2 gap-2">
                {PRESET_SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion.name}
                    onClick={() => applySuggestion(suggestion)}
                    className="p-3 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 hover:border-indigo-500/50 text-left transition-all group"
                  >
                    <div className="font-medium text-white text-sm mb-1 group-hover:text-indigo-300">
                      {suggestion.name}
                    </div>
                    <div className="text-xs text-white/40 line-clamp-2">
                      {suggestion.scope}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-white/10">
          {/* Delete Button (僅在編輯模式顯示) */}
          {editingArea && (
            <div className="flex flex-col gap-1">
              <Button
                onClick={handleDelete}
                disabled={isDeleting || isSubmitting}
                variant="outline"
                className="border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    刪除中...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 mr-2" />
                    刪除身分
                  </>
                )}
              </Button>
              {editingArea.productCount && editingArea.productCount > 0 && (
                <p className="text-xs text-amber-400/80">
                  此身分下有 {editingArea.productCount} 個專案
                </p>
              )}
            </div>
          )}

          <div className={`flex items-center gap-3 ${editingArea ? "" : "ml-auto"}`}>
            <Button
              onClick={onClose}
              variant="outline"
              className="border-white/10 bg-white/5 hover:bg-white/10 text-white"
              disabled={isSubmitting || isDeleting}
            >
              取消
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!name.trim() || isSubmitting || isDeleting}
              variant="cta"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {editingArea ? "更新中..." : "創建中..."}
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  {editingArea ? "更新身分" : "創建身分"}
                </>
              )}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
