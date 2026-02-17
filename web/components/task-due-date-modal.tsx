"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { X, Calendar, Loader2, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { zhTW } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { auth } from "@/lib/firebase";
import { API_BASE_URL } from "@/lib/api-client";
import { isWithinThreeDays, toDateOnlyISOString } from "@/lib/date-utils";

interface TaskDueDateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  taskId: string;
  taskTitle: string;
  currentDueDate?: string | null;
  dateType?: "due" | "start";
  currentStartDate?: string | null;
}

export function TaskDueDateModal({
  isOpen,
  onClose,
  onSuccess,
  taskId,
  taskTitle,
  currentDueDate,
  dateType = "due",
  currentStartDate,
}: TaskDueDateModalProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 初始化日期
  useEffect(() => {
    const currentDate = dateType === "due" ? currentDueDate : currentStartDate;
    if (currentDate) {
      setSelectedDate(new Date(currentDate));
    } else {
      setSelectedDate(undefined);
    }
    setError(null);
  }, [currentDueDate, currentStartDate, dateType, isOpen]);

  const handleSubmit = async (newDate: Date | null) => {
    setError(null);
    setIsSubmitting(true);

    try {
      // 獲取 Firebase token
      const user = auth.currentUser;
      if (!user) {
        throw new Error("未登入");
      }
      const token = await user.getIdToken();

      const fieldName = dateType === "due" ? "due_date" : "start_date";
      const res = await fetch(`${API_BASE_URL}/api/tasks`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          taskId,
          [fieldName]: newDate ? toDateOnlyISOString(newDate) : null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || "更新失敗");
      }

      onSuccess();

      // 🔔 如果更新 due_date 到三天內，通知 TodayOverviewSheet 刷新 plan
      if (dateType === "due" && newDate && isWithinThreeDays(newDate)) {
        // 延遲觸發，確保 Backend plan-sync 已完成
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent("plan-updated"));
          console.log("[TaskDueDateModal] plan-updated event dispatched");
        }, 300);
      }

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新失敗");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date);
    if (date) {
      handleSubmit(date);
    }
  };

  const handleClearDate = () => {
    setSelectedDate(undefined);
    handleSubmit(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <Card className="relative w-full max-w-sm mx-4 bg-white dark:bg-slate-900 border-gray-200 dark:border-white/10 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
              <Calendar className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                {dateType === "due" ? "設定截止日期" : "設定開始日期"}
              </h2>
              <p className="text-xs text-gray-500 dark:text-white/50 truncate max-w-[200px]">{taskTitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4 text-gray-400 dark:text-white/50" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {error && (
            <div className="mb-4 p-2 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-xs">
              {error}
            </div>
          )}

          {isSubmitting ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            </div>
          ) : (
            <>
              {/* 快速選擇按鈕 */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDateSelect(new Date())}
                  className="bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-600 dark:text-white/70 hover:bg-gray-100 dark:hover:bg-white/10 hover:text-gray-900 dark:hover:text-white text-xs"
                >
                  今天
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const tomorrow = new Date();
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    handleDateSelect(tomorrow);
                  }}
                  className="bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-600 dark:text-white/70 hover:bg-gray-100 dark:hover:bg-white/10 hover:text-gray-900 dark:hover:text-white text-xs"
                >
                  明天
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const nextWeek = new Date();
                    nextWeek.setDate(nextWeek.getDate() + 7);
                    handleDateSelect(nextWeek);
                  }}
                  className="bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-600 dark:text-white/70 hover:bg-gray-100 dark:hover:bg-white/10 hover:text-gray-900 dark:hover:text-white text-xs"
                >
                  下週
                </Button>
              </div>

              {/* 日曆 */}
              <div className="border border-gray-200 dark:border-white/10 rounded-lg overflow-hidden">
                <CalendarComponent
                  mode="single"
                  selected={selectedDate}
                  onSelect={handleDateSelect}
                  locale={zhTW}
                />
              </div>

              {/* 當前日期顯示 & 清除按鈕 */}
              {selectedDate && (
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-white/70">
                    已選擇：{format(selectedDate, "yyyy/MM/dd (EEEE)", { locale: zhTW })}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearDate}
                    className="text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-500/10"
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    清除
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
