"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { X, Package, AlertCircle, Loader2, Sparkles, Trash2 } from "lucide-react";

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  userId: string;
  areaId?: string;
  areaName?: string;
  editingProduct?: {
    id: string;
    name: string;
    description?: string | null;
    lifecycle: "FINITE" | "PERPETUAL";
    status: string;
  } | null;
}

const LIFECYCLE_OPTIONS = [
  { value: "FINITE", label: "有限期專案", description: "有明確結束日期的專案" },
  { value: "PERPETUAL", label: "永續維運", description: "持續維護的長期項目" },
];

const STATUS_OPTIONS = [
  { value: "ACTIVE", label: "進行中", color: "text-blue-400" },
  { value: "MAINTAIN", label: "維護中", color: "text-purple-400" },
  { value: "INBOX", label: "收件匣", color: "text-amber-400" },
  { value: "REFERENCE", label: "參考資料", color: "text-green-400" },
];

export function ProductModal({
  isOpen,
  onClose,
  userId,
  areaId,
  areaName,
  onSuccess,
  editingProduct,
}: ProductModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [lifecycle, setLifecycle] = useState<"FINITE" | "PERPETUAL">("FINITE");
  const [status, setStatus] = useState("ACTIVE");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 重置或填充表單
  useEffect(() => {
    if (isOpen) {
      if (editingProduct) {
        setName(editingProduct.name);
        setDescription(editingProduct.description || "");
        setLifecycle(editingProduct.lifecycle);
        setStatus(editingProduct.status);
      } else {
        setName("");
        setDescription("");
        setLifecycle("FINITE");
        setStatus("ACTIVE");
      }
      setError(null);
    }
  }, [isOpen, editingProduct]);

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError("請輸入產品名稱");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      if (editingProduct) {
        // 更新現有 Product
        const res = await fetch(`/api/products/${editingProduct.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            description: description.trim() || undefined,
            lifecycle,
            status,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "更新失敗");
        }
      } else {
        // 創建新 Product
        if (!areaId) {
          throw new Error("缺少 Area ID");
        }

        const res = await fetch("/api/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId,
            areaId,
            name: name.trim(),
            description: description.trim() || undefined,
            lifecycle,
            status,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "創建失敗");
        }
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : editingProduct ? "更新失敗" : "創建失敗");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!editingProduct) return;

    if (!confirm(`確定要刪除「${editingProduct.name}」這個專案嗎？\n\n注意：如果專案下有任務,將無法刪除。請先刪除或移動所有任務。`)) {
      return;
    }

    setIsDeleting(true);
    setError(null);

    try {
      const res = await fetch(`/api/products/${editingProduct.id}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.details || data.error || "刪除失敗");
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "刪除失敗");
    } finally {
      setIsDeleting(false);
    }
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
      <Card className="relative w-full max-w-lg mx-4 bg-slate-900 border-white/10 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
              <Package className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">
                {editingProduct ? "編輯專案" : "新增產品/專案"}
              </h2>
              <p className="text-sm text-white/50">
                {editingProduct
                  ? "修改專案的名稱、類型與狀態"
                  : `在「${areaName}」下創建新項目`}
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
                <p className="text-sm font-medium text-red-400">創建失敗</p>
                <p className="text-sm text-red-300/70 mt-1">{error}</p>
              </div>
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">
              產品名稱 <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Zentropy 後端系統、個人部落格..."
              className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">
              描述（選填）
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="這個產品的目標與範圍..."
              rows={3}
              className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-none"
            />
          </div>

          {/* Lifecycle */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-3">
              生命週期類型
            </label>
            <div className="grid grid-cols-2 gap-3">
              {LIFECYCLE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setLifecycle(option.value as "FINITE" | "PERPETUAL")}
                  className={`
                    p-4 rounded-lg border-2 text-left transition-all
                    ${lifecycle === option.value
                      ? "border-purple-500 bg-purple-500/10"
                      : "border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20"
                    }
                  `}
                >
                  <div className="font-medium text-white mb-1">{option.label}</div>
                  <div className="text-xs text-white/50">{option.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-3">
              初始狀態
            </label>
            <div className="grid grid-cols-2 gap-2">
              {STATUS_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setStatus(option.value)}
                  className={`
                    px-4 py-2.5 rounded-lg border transition-all text-sm font-medium
                    ${status === option.value
                      ? "border-purple-500 bg-purple-500/20 text-white"
                      : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:border-white/20"
                    }
                  `}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-white/10">
          {/* Delete Button (僅在編輯模式顯示) */}
          {editingProduct && (
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
                  刪除專案
                </>
              )}
            </Button>
          )}

          <div className={`flex items-center gap-3 ${editingProduct ? "" : "ml-auto"}`}>
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
              className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {editingProduct ? "更新中..." : "創建中..."}
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  {editingProduct ? "更新專案" : "創建產品"}
                </>
              )}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
