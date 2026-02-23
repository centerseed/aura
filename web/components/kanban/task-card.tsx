"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, MoreHorizontal, ArrowRight, Calendar, AlertCircle, CheckCircle2, Link } from "lucide-react";
import type { TaskCard } from "@/types";

// 計算相對時間描述
function getRelativeTimeDesc(dueDate: Date): { text: string; isOverdue: boolean; isUrgent: boolean } {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);

  const diffMs = due.getTime() - now.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return { text: `逾期 ${Math.abs(diffDays)} 天`, isOverdue: true, isUrgent: true };
  if (diffDays === 0) return { text: "今天", isOverdue: false, isUrgent: true };
  if (diffDays === 1) return { text: "明天", isOverdue: false, isUrgent: true };
  if (diffDays <= 3) return { text: `${diffDays} 天後`, isOverdue: false, isUrgent: true };
  if (diffDays <= 7) return { text: `${diffDays} 天後`, isOverdue: false, isUrgent: false };
  if (diffDays <= 14) return { text: "下週", isOverdue: false, isUrgent: false };
  if (diffDays <= 30) return { text: `${Math.floor(diffDays / 7)} 週後`, isOverdue: false, isUrgent: false };
  return { text: `${Math.floor(diffDays / 30)} 個月後`, isOverdue: false, isUrgent: false };
}

interface TaskCardProps {
  task: TaskCard;
  isDragging?: boolean;
  onOpenDetail?: () => void;
  onSetDueDate?: (taskId: string) => void;
  onComplete?: (taskId: string) => void;
  onToggleSubItem?: (taskId: string, subItemId: string, completed: boolean) => void;
}

export function TaskCardComponent({ task, isDragging, onOpenDetail, onSetDueDate, onComplete, onToggleSubItem }: TaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isCurrentlyDragging = isDragging || isSortableDragging;
  const isCompleted = task.drawer === "ARCHIVE";

  // 計算是否有 sub-items 和 references
  const hasSubItems = task.sub_items && task.sub_items.length > 0;
  const hasReferences = task.references && task.references.length > 0;

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, touchAction: 'auto' }}
      className={`
        group relative card-float-inner cursor-pointer
        ${isCompleted
          ? "!bg-green-50/80 dark:!bg-green-950/30 !border-green-200/70 dark:!border-green-800/50"
          : ""
        }
        ${isCurrentlyDragging ? "!shadow-float-lg ring-2 ring-indigo-500 opacity-90 rotate-2 scale-105" : ""}
      `}
      onClick={onOpenDetail}
    >
      {/* Drag Handle */}
      <div
        {...attributes}
        {...listeners}
        className="absolute left-0 top-0 bottom-0 w-8 flex items-center justify-center cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="w-4 h-4 text-slate-400" />
      </div>

      {/* Content */}
      <div className="p-4 pl-8">
        {/* Title Row */}
        <div className="flex items-start justify-between gap-2 mb-1">
          <h4 className="font-medium text-slate-800 dark:text-slate-200 flex-1">
            {task.title}
          </h4>
        </div>

        {/* Path */}
        <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 mb-2">
          <span>{task.tag.area}</span>
          <ArrowRight className="w-3 h-3" />
          <span>{task.tag.product}</span>
          <ArrowRight className="w-3 h-3" />
          <span className="text-slate-400 dark:text-slate-500">{task.tag.topic}</span>
        </div>

        {/* Progress Indicator - Moved to top */}
        {hasSubItems && (
          <div className="flex items-center gap-2 mb-3">
            <div className="flex-1 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 transition-all"
                style={{ width: `${(task.sub_items_meta?.completed || 0) / (task.sub_items_meta?.total || 1) * 100}%` }}
              />
            </div>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">
              {task.sub_items_meta?.completed}/{task.sub_items_meta?.total}
            </span>
          </div>
        )}

        {/* Narrative Preview */}
        {task.narrative && (
          <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2 mb-3">
            {task.narrative}
          </p>
        )}

        {/* Summary badges - References count */}
        {hasReferences && (
          <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 mb-3">
            <Link className="w-3.5 h-3.5" />
            <span>{task.references!.length} 個參考資料</span>
          </div>
        )}

        {/* Badges Row */}
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          {/* Strategy Badge */}
          {task.strategy_used && !isCompleted && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
              {task.strategy_used}
            </span>
          )}

          {/* Due Date Badge - Hidden when completed */}
          {!isCompleted && (
            <>
              {task.due_date ? (
                (() => {
                  const { text, isOverdue, isUrgent } = getRelativeTimeDesc(new Date(task.due_date));
                  return (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSetDueDate?.(task.id);
                      }}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-colors
                        ${isOverdue
                          ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50"
                          : isUrgent
                            ? "bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 hover:bg-orange-200 dark:hover:bg-orange-900/50"
                            : "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50"
                        }`}
                    >
                      {isOverdue && <AlertCircle className="w-3 h-3" />}
                      {!isOverdue && <Calendar className="w-3 h-3" />}
                      {text}
                    </button>
                  );
                })()
              ) : (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSetDueDate?.(task.id);
                  }}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                >
                  <Calendar className="w-3 h-3" />
                  設定日期
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Top Right Corner - Completed Badge or Action Buttons */}
      <div className="absolute top-3 right-3 flex items-center gap-2">
        {isCompleted ? (
          /* Completed Badge - Click to undo */
          <button
            onClick={(e) => {
              e.stopPropagation();
              onComplete?.(task.id);
            }}
            className="flex items-center gap-2 px-2 py-1 rounded-full bg-green-100 dark:bg-green-900/50 hover:bg-green-200 dark:hover:bg-green-900/70 transition-colors cursor-pointer"
            title="點擊取消標記為已完成"
          >
            <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
            <span className="text-xs font-semibold text-green-600 dark:text-green-400">已完成</span>
          </button>
        ) : (
          /* Action Buttons */
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {onComplete && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onComplete(task.id);
                }}
                className="p-1 rounded-md hover:bg-green-100 dark:hover:bg-green-900/30 text-green-600 dark:text-green-400 transition-colors"
                title="標記為已完成"
              >
                <CheckCircle2 className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={(e) => e.stopPropagation()}
              className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
