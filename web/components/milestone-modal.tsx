"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { X, Calendar, Target, AlertCircle, Loader2, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { zhTW } from "date-fns/locale";
import type { Milestone, MilestoneStatus, EntityType } from "@/types";
import { cn } from "@/lib/utils";

interface MilestoneModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  userId: string;
  areas: Array<{
    id: string;
    name: string;
    products: Array<{
      id: string;
      name: string;
      topics?: Array<{ id: string; name: string }>;
    }>;
  }>;
  editingMilestone?: Milestone | null;
}

export function MilestoneModal({
  isOpen,
  onClose,
  onSuccess,
  userId,
  areas,
  editingMilestone,
}: MilestoneModalProps) {
  const [name, setName] = useState("");
  const [targetDate, setTargetDate] = useState<Date | undefined>();
  const [entityType, setEntityType] = useState<EntityType>("PRODUCT");
  const [entityId, setEntityId] = useState("");
  const [priority, setPriority] = useState(5);
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 當編輯模式時，填充表單
  useEffect(() => {
    if (editingMilestone) {
      setName(editingMilestone.name || "");
      setTargetDate(editingMilestone.target_date ? new Date(editingMilestone.target_date) : undefined);
      setEntityType(editingMilestone.entity_type || "PRODUCT");
      setEntityId(editingMilestone.entity_id || "");
      setPriority(editingMilestone.priority ?? 5);
      setDescription(editingMilestone.description || "");
    } else {
      // 重置表單
      setName("");
      setTargetDate(undefined);
      setEntityType("PRODUCT");
      setEntityId("");
      setPriority(5);
      setDescription("");
    }
    setError(null);
  }, [editingMilestone, isOpen]);

  // 根據 entityType 獲取可選實體列表
  const getEntityOptions = () => {
    if (entityType === "AREA") {
      return areas.map((area) => ({ id: area.id, name: area.name }));
    } else if (entityType === "PRODUCT") {
      return areas.flatMap((area) =>
        area.products.map((product) => ({
          id: product.id,
          name: `${area.name} / ${product.name}`,
        }))
      );
    } else {
      // TOPIC
      return areas.flatMap((area) =>
        area.products.flatMap((product) =>
          (product.topics || []).map((topic) => ({
            id: topic.id,
            name: `${area.name} / ${product.name} / ${topic.name}`,
          }))
        )
      );
    }
  };

  const entityOptions = getEntityOptions();

  // 當 entityType 改變時，重置 entityId
  useEffect(() => {
    if (!editingMilestone) {
      setEntityId("");
    }
  }, [entityType, editingMilestone]);

  const handleSubmit = async () => {
    setError(null);

    // 驗證
    if (!name.trim()) {
      setError("請輸入里程碑名稱");
      return;
    }
    if (!targetDate) {
      setError("請選擇目標日期");
      return;
    }
    if (!entityId) {
      setError("請選擇關聯的實體");
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        userId,
        name,
        target_date: targetDate.toISOString(),
        status: "planned" as MilestoneStatus,
        entity_type: entityType,
        entity_id: entityId,
        priority,
        description: description.trim() || undefined,
      };

      const url = editingMilestone?.id
        ? `/api/milestones/${editingMilestone.id}`
        : "/api/milestones";
      const method = editingMilestone?.id ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "操作失敗");
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
    if (!editingMilestone?.id) return;
    if (!confirm(`確定要刪除「${name}」嗎？`)) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/milestones/${editingMilestone.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "刪除失敗");
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "刪除失敗");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <Card className="relative w-full max-w-2xl mx-4 bg-slate-900 border-white/10 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
              <Target className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">
                {editingMilestone?.id ? "編輯里程碑" : "新增里程碑"}
              </h2>
              <p className="text-sm text-white/50">設定專案或任務的時間目標</p>
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
        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* 錯誤提示 */}
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* 里程碑名稱 */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">
              里程碑名稱 <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：MVP Release、Beta 測試完成"
              className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
            />
          </div>

          {/* 目標日期 */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">
              目標日期 <span className="text-red-400">*</span>
            </label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20 text-white",
                    !targetDate && "text-white/50"
                  )}
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  {targetDate ? (
                    format(targetDate, "PPP", { locale: zhTW })
                  ) : (
                    <span>選擇日期</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={targetDate}
                  onSelect={setTargetDate}
                  locale={zhTW}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* 實體類型和選擇 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">
                關聯層級 <span className="text-red-400">*</span>
              </label>
              <select
                value={entityType}
                onChange={(e) => setEntityType(e.target.value as EntityType)}
                className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
              >
                <option value="AREA">Area（身分）</option>
                <option value="PRODUCT">Product（產品）</option>
                <option value="TOPIC">Topic（主題）</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">
                選擇實體 <span className="text-red-400">*</span>
              </label>
              <select
                value={entityId}
                onChange={(e) => setEntityId(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
              >
                <option value="">請選擇...</option>
                {entityOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 優先級滑桿 */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">
              優先級（1-10）
              <span className="ml-2 text-white/90 text-base font-semibold">{priority}</span>
            </label>
            <div className="px-2 py-4">
              <Slider
                value={[priority]}
                onValueChange={(values) => setPriority(values[0])}
                min={1}
                max={10}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-white/40 mt-2 px-1">
                <span>低</span>
                <span>中</span>
                <span>高</span>
              </div>
            </div>
          </div>

          {/* 描述 */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">
              描述（選填）
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="說明這個里程碑的具體目標或注意事項..."
              rows={3}
              className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/30 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-white/10 bg-slate-900/50">
          {/* 左側：刪除按鈕（僅編輯模式顯示）*/}
          <div>
            {editingMilestone?.id && (
              <Button
                variant="ghost"
                onClick={handleDelete}
                disabled={isSubmitting}
                className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                刪除
              </Button>
            )}
          </div>

          {/* 右側：取消和提交按鈕 */}
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              onClick={onClose}
              disabled={isSubmitting}
              className="text-white/60 hover:text-white hover:bg-white/10"
            >
              取消
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white min-w-[100px]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  處理中...
                </>
              ) : editingMilestone?.id ? (
                "更新"
              ) : (
                "創建"
              )}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
