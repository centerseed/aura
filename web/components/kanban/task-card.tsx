"use client";

import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, MoreHorizontal, ArrowRight, Calendar, AlertCircle, CheckCircle2, ChevronDown, Circle, CheckCircle, Edit2, X, Link, FileText, ExternalLink } from "lucide-react";
import type { TaskCard, SubItem, Reference } from "@/types";

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

// References 顯示組件
function ReferencesList({ references }: { references: Reference[] }) {
  if (!references || references.length === 0) return null;

  return (
    <div className="mt-3 space-y-1.5">
      <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
        參考資料
      </div>
      {references.map((ref) => (
        <div
          key={ref.id}
          className="flex items-start gap-2 px-2 py-1.5 rounded-md bg-slate-50 dark:bg-slate-700/50 text-sm"
        >
          {ref.type === "url" ? (
            <>
              <ExternalLink className="w-4 h-4 flex-shrink-0 mt-0.5 text-blue-500" />
              <a
                href={ref.content}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 text-blue-600 dark:text-blue-400 hover:underline break-all"
                onClick={(e) => e.stopPropagation()}
              >
                {ref.title || ref.content}
              </a>
            </>
          ) : (
            <>
              <FileText className="w-4 h-4 flex-shrink-0 mt-0.5 text-slate-400" />
              <span className="flex-1 text-slate-700 dark:text-slate-300">
                {ref.content}
              </span>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

// Sub-items 顯示組件
function SubItemsList({
  subItems,
  taskId,
  onToggle
}: {
  subItems: SubItem[],
  taskId: string,
  onToggle: (taskId: string, subItemId: string, completed: boolean) => void
}) {
  const [showAll, setShowAll] = useState(false);

  if (!subItems || subItems.length === 0) return null;

  // 按 order 排序
  const sortedItems = [...subItems].sort((a, b) => a.order - b.order);

  // 初始只顯示前 2 個項目
  const INITIAL_DISPLAY_COUNT = 2;
  const visibleItems = showAll ? sortedItems : sortedItems.slice(0, INITIAL_DISPLAY_COUNT);
  const hiddenCount = sortedItems.length - INITIAL_DISPLAY_COUNT;

  return (
    <div
      className="mt-3 space-y-1.5"
    >
      {visibleItems.map((item) => (
        <button
          key={item.id}
          onClick={(e) => {
            e.stopPropagation();
            onToggle(taskId, item.id, !item.completed);
          }}
          className={`
            w-full flex items-start gap-2 px-2 py-1.5 rounded-md
            text-sm transition-colors text-left
            hover:bg-slate-50 dark:hover:bg-slate-700/50
            ${item.completed ? "text-slate-400 dark:text-slate-500" : "text-slate-700 dark:text-slate-300"}
          `}
        >
          {item.completed ? (
            <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-green-500" />
          ) : (
            <Circle className="w-4 h-4 flex-shrink-0 mt-0.5 text-slate-400" />
          )}
          <span className={item.completed ? "line-through" : ""}>
            {item.content}
          </span>
        </button>
      ))}

      {/* 展開更多按鈕 */}
      {!showAll && hiddenCount > 0 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setShowAll(true);
          }}
          className="w-full flex items-center justify-center px-2 py-2 mt-1 text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-700/50 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 active:bg-slate-200 dark:active:bg-slate-600 transition-colors cursor-pointer"
        >
          +{hiddenCount} 更多
        </button>
      )}
    </div>
  );
}

interface TaskCardProps {
  task: TaskCard;
  isDragging?: boolean;
  onSetDueDate?: (taskId: string) => void;
  onComplete?: (taskId: string) => void;
  onToggleSubItem?: (taskId: string, subItemId: string, completed: boolean) => void;
  onEditTitle?: (taskId: string, newTitle: string) => void;
}

export function TaskCardComponent({ task, isDragging, onSetDueDate, onComplete, onToggleSubItem, onEditTitle }: TaskCardProps) {
  const [isExpanded, setIsExpanded] = useState(true);  // 預設展開 sub-items
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);

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

  // 計算是否有 sub-items 和進度
  const hasSubItems = task.sub_items && task.sub_items.length > 0;
  const completionRate = task.sub_items_meta?.completion_rate || 0;

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, touchAction: 'auto' }}
      className={`
        group relative bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700
        shadow-sm hover:shadow-md transition-all duration-200
        ${isCurrentlyDragging ? "shadow-xl ring-2 ring-purple-500 opacity-90 rotate-2 scale-105" : ""}
      `}
    >
      {/* Drag Handle */}
      <div
        {...attributes}
        {...listeners}
        className="absolute left-0 top-0 bottom-0 w-8 flex items-center justify-center cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <GripVertical className="w-4 h-4 text-slate-400" />
      </div>

      {/* Content */}
      <div className="p-4 pl-8">
        {/* Title Row with Expand Button */}
        <div className="flex items-start justify-between gap-2 mb-1">
          {isEditing ? (
            // 編輯模式
            <form
              className="flex-1 flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (editTitle.trim() && editTitle !== task.title) {
                  onEditTitle?.(task.id, editTitle.trim());
                }
                setIsEditing(false);
              }}
            >
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                autoFocus
                className="flex-1 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded px-2 py-1 text-slate-800 dark:text-slate-200 text-sm focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400"
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setEditTitle(task.title);
                    setIsEditing(false);
                  }
                }}
                onBlur={() => {
                  setTimeout(() => {
                    if (editTitle.trim() && editTitle !== task.title) {
                      onEditTitle?.(task.id, editTitle.trim());
                    }
                    setIsEditing(false);
                  }, 150);
                }}
              />
              <button
                type="submit"
                className="p-1 rounded hover:bg-green-100 dark:hover:bg-green-900/30 text-green-600 dark:text-green-400"
                title="確認"
              >
                <CheckCircle2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditTitle(task.title);
                  setIsEditing(false);
                }}
                className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400"
                title="取消"
              >
                <X className="w-4 h-4" />
              </button>
            </form>
          ) : (
            // 顯示模式
            <>
              <h4
                className="font-medium text-slate-800 dark:text-slate-200 flex-1 cursor-pointer hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditTitle(task.title);
                  setIsEditing(true);
                }}
                title="點擊編輯標題"
              >
                {task.title}
              </h4>

              {/* 編輯按鈕 */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setEditTitle(task.title);
                  setIsEditing(true);
                }}
                className="p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all"
                title="編輯標題"
              >
                <Edit2 className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300" />
              </button>
            </>
          )}

          {/* 展開/收起按鈕 (僅在有 sub-items 時顯示) */}
          {hasSubItems && !isEditing && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
              className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <ChevronDown
                className={`w-4 h-4 text-slate-500 transition-transform ${
                  isExpanded ? "" : "-rotate-90"
                }`}
              />
            </button>
          )}
        </div>

        {/* Path */}
        <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 mb-2">
          <span>{task.tag.area}</span>
          <ArrowRight className="w-3 h-3" />
          <span>{task.tag.product}</span>
          <ArrowRight className="w-3 h-3" />
          <span className="text-slate-400 dark:text-slate-500">{task.tag.topic}</span>
        </div>

        {/* Narrative Preview (僅在沒有 sub-items 或收起時顯示) */}
        {task.narrative && (!hasSubItems || !isExpanded) && (
          <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2">
            {task.narrative}
          </p>
        )}

        {/* Sub-items List (展開時顯示) */}
        {hasSubItems && isExpanded && (
          <SubItemsList
            subItems={task.sub_items || []}
            taskId={task.id}
            onToggle={onToggleSubItem || (() => {})}
          />
        )}

        {/* References List */}
        {task.references && task.references.length > 0 && (
          <ReferencesList references={task.references} />
        )}

        {/* Progress Bar (有 sub-items 時顯示) */}
        {hasSubItems && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
              <span>進度</span>
              <span>{task.sub_items_meta?.completed}/{task.sub_items_meta?.total}</span>
            </div>
            <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all duration-300"
                style={{ width: `${completionRate * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Badges Row */}
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          {/* Strategy Badge */}
          {task.strategy_used && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
              {task.strategy_used}
            </span>
          )}

          {/* Due Date Badge */}
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
        </div>
      </div>

      {/* Action Buttons */}
      <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {/* Complete Button */}
        {task.drawer !== "ARCHIVE" && onComplete && (
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
        {/* Menu Button */}
        <button className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400">
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
