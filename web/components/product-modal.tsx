"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { X, Package, AlertCircle, Loader2, Sparkles, Trash2 } from "lucide-react";
import { auth } from "@/lib/firebase";
import { API_BASE_URL } from "@/lib/api-client";

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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 重置或填充表單
  useEffect(() => {
    if (isOpen) {
      if (editingProduct) {
        setName(editingProduct.name);
        setDescription(editingProduct.description || "");
      } else {
        setName("");
        setDescription("");
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
      // 獲取 Firebase token
      const user = auth.currentUser;
      if (!user) {
        throw new Error("未登入");
      }
      const token = await user.getIdToken();

      if (editingProduct) {
        // 更新現有 Product
        const res = await fetch(`${API_BASE_URL}/api/products/${editingProduct.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
          },
          body: JSON.stringify({
            name: name.trim(),
            description: description.trim() || undefined,
            lifecycle: editingProduct.lifecycle,
            status: editingProduct.status,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error?.message || "更新失敗");
        }
      } else {
        // 創建新 Product
        if (!areaId) {
          throw new Error("缺少 Area ID");
        }

        const res = await fetch(`${API_BASE_URL}/api/products`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
          },
          body: JSON.stringify({
            areaId,
            name: name.trim(),
            description: description.trim() || undefined,
            lifecycle: "FINITE",
            status: "ACTIVE",
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
      // 獲取 Firebase token
      const user = auth.currentUser;
      if (!user) {
        throw new Error("未登入");
      }
      const token = await user.getIdToken();

      const res = await fetch(`${API_BASE_URL}/api/products/${editingProduct.id}`, {
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
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center">
              <Package className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">
                {editingProduct ? "編輯專案" : "新增產品/專案"}
              </h2>
              <p className="text-sm text-white/50">
                {editingProduct
                  ? "修改專案的名稱與描述"
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
              className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
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
              className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none"
            />
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
              className="bg-gradient-to-r from-indigo-600 to-indigo-600 hover:from-indigo-500 hover:to-indigo-500 text-white"
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
