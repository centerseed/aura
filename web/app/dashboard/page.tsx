"use client";

import { useState, useEffect, Suspense, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/lib/firebase";
import { API_BASE_URL } from "@/lib/api-client";
import { getOAuthStatus } from "@/lib/oauth-client";

// Helper function to get auth headers
async function getAuthHeaders() {
  const user = auth.currentUser;
  if (!user) throw new Error("No authenticated user");
  const token = await user.getIdToken();
  return { 'Authorization': `Bearer ${token}` };
}
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import {
  Plus,
  FolderOpen,
  Package,
  Inbox,
  Rocket,
  RefreshCw,
  BookOpen,
  Archive,
  ChevronRight,
  ChevronDown,
  GripVertical,
  Loader2,
  Tag,
  AlertCircle,
  LayoutGrid,
  Clock,
  Calendar,
  Target,
  Settings,
  Edit2,
  Sparkles,
  X,
  CheckCircle2,
  ExternalLink,
  FileText,
  Trash2,
} from "lucide-react";
import type {
  TaskCard,
  DrawerStatus,
  Milestone,
  SubItem,
  Reference,
  ReorganizeProposal,
  EntityType,
} from "@/types";
import { QuickCapture } from "@/components/quick-capture";
import { TodayOverviewSheet } from "@/components/today-overview-sheet";
import { AIButtonTip } from "@/components/ai-button-tip";
import { QuickInputGuide } from "@/components/quick-input-guide";
import { TimelineView } from "@/components/timeline-view";
import { MilestoneLoadView } from "@/components/milestone-load-view";
import { MilestoneModal } from "@/components/milestone-modal";
import { MilestoneList } from "@/components/milestone-list";
import { ProductModal } from "@/components/product-modal";
import { ProductDetailModal } from "@/components/product-detail-modal";
import { AreaModal } from "@/components/area-modal";
import { TaskDueDateModal } from "@/components/task-due-date-modal";
import { ReorganizeModal } from "@/components/reorganize-modal";
import { TaskDetailModal } from "@/components/task-detail-modal";
import { ThemeToggle } from "@/components/theme-toggle";

// 視圖類型
type ViewMode = "structure" | "timeline" | "load";

// Drawer 狀態配置
const DRAWER_CONFIG: Record<DrawerStatus, { label: string; icon: typeof Inbox; color: string; dotColor: string }> = {
  INBOX: { label: "規劃中", icon: Inbox, color: "text-amber-500", dotColor: "bg-amber-500" },
  ACTIVE: { label: "進行中", icon: Rocket, color: "text-blue-500", dotColor: "bg-blue-500" },
  MAINTAIN: { label: "維護中", icon: RefreshCw, color: "text-indigo-500", dotColor: "bg-indigo-500" },
  REFERENCE: { label: "參考資料", icon: BookOpen, color: "text-green-500", dotColor: "bg-green-500" },
  ARCHIVE: { label: "已歸檔", icon: Archive, color: "text-slate-400", dotColor: "bg-slate-400" },
};

// API 返回的 Area 結構
interface ApiArea {
  id: string;
  name: string;
  description: string | null;
  scope: string | null;
  products: ApiProduct[];
}

interface ApiProduct {
  id: string;
  name: string;
  description: string | null;
  status: string;
  lifecycle: "FINITE" | "PERPETUAL";
  referenceCount: number;
  tasks: TaskCard[];
  topics?: Array<{ id: string; name: string }>;
}

/**
 * 資料清理層 - 類似 Flutter 的 transformForDisplay
 * 過濾所有可能的 null/undefined，確保資料完整性
 */
function cleanLibraryData(areas: any[]): ApiArea[] {
  if (!Array.isArray(areas)) return [];

  return areas
    .filter((area) => area != null && area.id && area.name)
    .map((area) => ({
      id: area.id,
      name: area.name,
      description: area.description || null,
      scope: area.scope || null,
      products: (Array.isArray(area.products) ? area.products : [])
        .filter((p: any) => p != null && p.id && p.name)
        .map((product: any) => ({
          id: product.id,
          name: product.name,
          description: product.description || null,
          status: product.status || 'ACTIVE',
          lifecycle: product.lifecycle || 'FINITE',
          referenceCount: Number(product.referenceCount) || 0,
          topics: (Array.isArray(product.topics) ? product.topics : [])
            .filter((t: any) => t != null && t.id && t.name),
          tasks: (Array.isArray(product.tasks) ? product.tasks : [])
            .filter((t: any) => t != null && t.id && t.title)
            .map((task: any) => ({
              ...task,
              sub_items: (Array.isArray(task.sub_items) ? task.sub_items : [])
                .filter((s: any) => s != null && s.id && s.content),
              references: (Array.isArray(task.references) ? task.references : [])
                .filter((r: any) => r != null && r.id && r.content && r.type),
            })),
        })),
    }));
}

/**
 * 統一的狀態更新 Helper - 確保所有更新都經過清理
 *
 * 用法：
 * setAreas((prev) => updateAreasState(prev, (areas) => {
 *   // 任意的狀態更新邏輯
 *   return areas.map(area => ...)
 * }))
 */
function updateAreasState(
  prevAreas: ApiArea[],
  updater: (areas: ApiArea[]) => ApiArea[]
): ApiArea[] {
  try {
    const updated = updater(prevAreas);
    return cleanLibraryData(updated);
  } catch (error) {
    console.error('❌ updateAreasState failed:', error);
    // 發生錯誤時返回清理過的原始資料
    return cleanLibraryData(prevAreas);
  }
}

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

// 可拖曳的任務項目（支援拖曳和 Task-to-Task 合併）
function DraggableTaskItem({
  task,
  onSetDueDate,
  onComplete,
  onToggleSubItem,
  onDeleteSubItem,
  onPromoteSubItem,
  onEditTitle,
  onEditSubItem,
  onAddSubItem,
  onDeleteReference,
  onOpenDetail,
  onOpenSubItemDetail,
  isDropTarget = false,
}: {
  task: TaskCard;
  onSetDueDate?: (task: TaskCard) => void;
  onComplete?: (taskId: string) => void;
  onToggleSubItem?: (taskId: string, subItemId: string, completed: boolean) => void;
  onDeleteSubItem?: (taskId: string, subItemId: string) => void;
  onPromoteSubItem?: (taskId: string, subItemId: string) => void;
  onEditTitle?: (taskId: string, newTitle: string) => void;
  onEditSubItem?: (taskId: string, subItemId: string, newContent: string) => void;
  onAddSubItem?: (taskId: string, content: string) => void;
  onDeleteReference?: (taskId: string, referenceId: string) => void;
  onOpenDetail?: () => void;
  onOpenSubItemDetail?: (subItemId: string) => void;
  isDropTarget?: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [showAllSubItems, setShowAllSubItems] = useState(false);
  const [editingSubItemId, setEditingSubItemId] = useState<string | null>(null);
  const [editSubItemContent, setEditSubItemContent] = useState("");
  const [isAddingSubItem, setIsAddingSubItem] = useState(false);
  const [newSubItemContent, setNewSubItemContent] = useState("");
  const isSubmittingRef = useRef(false);

  const { attributes, listeners, setNodeRef: setDragRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: { task },
  });

  // 只在標題區域作為放置目標（接收其他 Task 合併為 sub-item）
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `task-drop-${task.id}`,
    data: { type: 'task', targetTaskId: task.id, targetTask: task },
  });

  const drawerConfig = DRAWER_CONFIG[task.drawer] || DRAWER_CONFIG.INBOX;
  const isCompleted = task.drawer === "ARCHIVE";

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  const dueInfo = task.due_date ? getRelativeTimeDesc(new Date(task.due_date)) : null;

  return (
    <div
      ref={setDragRef}
      style={style}
      {...(isEditing || isCompleted ? {} : listeners)}
      {...(isEditing || isCompleted ? {} : attributes)}
      onClick={(e) => {
        // 已完成的卡片點擊整個區域可以取消標記
        if (isCompleted && !isEditing) {
          e.stopPropagation();
          onComplete?.(task.id);
        }
      }}
      className={`
        group relative rounded-lg border p-3
        ${isEditing ? "cursor-default" : isCompleted ? "cursor-pointer" : "cursor-grab active:cursor-grabbing"}
        transition-all duration-150
        ${isCompleted
          ? "bg-green-500/20 border-green-500/30 hover:bg-green-500/30 hover:border-green-500/40"
          : "bg-white/10 border-white/10 hover:bg-white/15 hover:border-white/20"
        }
        ${isDragging ? "opacity-50 scale-105" : ""}
        ${isOver ? "" : ""}
      `}
    >
      <div className="flex items-start gap-3">
        <div
          className={`mt-1.5 w-2 h-2 rounded-full ${drawerConfig.dotColor} shrink-0`}
          title={drawerConfig.label}
        />

        <div className="flex-1 min-w-0">
          {isEditing ? (
            <form
              className="flex items-center gap-1"
              onSubmit={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (isSubmittingRef.current) return;
                isSubmittingRef.current = true;
                if (editTitle.trim() && editTitle !== task.title) {
                  onEditTitle?.(task.id, editTitle.trim());
                }
                setIsEditing(false);
                setTimeout(() => { isSubmittingRef.current = false; }, 100);
              }}
            >
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                autoFocus
                className="flex-1 bg-white/10 border border-white/30 rounded px-2 py-1 text-white text-sm focus:outline-none focus:border-indigo-400"
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === "Escape") {
                    setEditTitle(task.title);
                    setIsEditing(false);
                  }
                }}
                onBlur={() => {
                  // 只關閉編輯模式，不提交（避免與 onSubmit 重複）
                  setTimeout(() => {
                    if (!isSubmittingRef.current) {
                      setIsEditing(false);
                      setEditTitle(task.title); // 恢復原值
                    }
                  }, 100);
                }}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              />
              <button
                type="submit"
                className="p-1 rounded hover:bg-green-500/20 text-green-400"
                onPointerDown={(e) => e.stopPropagation()}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditTitle(task.title);
                  setIsEditing(false);
                }}
                className="p-1 rounded hover:bg-red-500/20 text-red-400"
                onPointerDown={(e) => e.stopPropagation()}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </form>
          ) : (
            <h4
              ref={setDropRef}
              className={`
                font-medium text-white text-sm leading-snug cursor-pointer hover:text-indigo-300 transition-colors
                rounded px-2 py-1 -mx-2
                ${isOver ? "bg-indigo-500/30 ring-2 ring-indigo-500" : ""}
              `}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                if (!isOver) {
                  onOpenDetail?.();
                }
              }}
              onPointerDown={(e) => e.stopPropagation()}
              title={isOver ? "放開以合併為待辦事項" : "點擊查看詳情"}
            >
              {task.title}
            </h4>
          )}

          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <div className="flex items-center gap-1">
              <Tag className="w-3 h-3 text-white/40" />
              <span className="text-xs text-white/50">
                {task.tag.topic}
              </span>
            </div>

            {/* Due Date Badge - Hidden when completed */}
            {!isCompleted && (
              <>
                {dueInfo ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      onSetDueDate?.(task);
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs transition-colors
                      ${dueInfo.isOverdue
                        ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                        : dueInfo.isUrgent
                          ? "bg-orange-500/20 text-orange-400 hover:bg-orange-500/30"
                          : "bg-blue-500/20 text-blue-400 hover:bg-blue-500/30"
                      }`}
                  >
                    {dueInfo.isOverdue && <AlertCircle className="w-3 h-3" />}
                    {!dueInfo.isOverdue && <Calendar className="w-3 h-3" />}
                    {dueInfo.text}
                  </button>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      onSetDueDate?.(task);
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs text-white/40 hover:text-white/60 hover:bg-white/10 transition-colors"
                  >
                    <Calendar className="w-3 h-3" />
                    設定日期
                  </button>
                )}
              </>
            )}
          </div>

          {/* 進度指示 - Moved to top */}
          {!isCompleted && task.sub_items_meta && task.sub_items_meta.total > 0 && (
            <div className="flex items-center gap-2 mt-2">
              <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 transition-all"
                  style={{ width: `${(task.sub_items_meta.completion_rate || 0) * 100}%` }}
                />
              </div>
              <span className="text-xs text-white/50 font-medium">
                {task.sub_items_meta.completed}/{task.sub_items_meta.total}
              </span>
            </div>
          )}

          {/* Sub-items 簡化顯示 - Hidden when completed */}
          {!isCompleted && task.sub_items && task.sub_items.length > 0 && (
            <div className="mt-2 space-y-1">
              {(showAllSubItems ? task.sub_items : task.sub_items.slice(0, 3)).filter(subItem => subItem != null).map((subItem) => (
                <div
                  key={subItem.id}
                  className="group/subitem flex items-center gap-1.5 text-xs hover:bg-white/5 rounded px-1 py-0.5 -mx-1"
                >
                  {editingSubItemId === subItem.id ? (
                    // 編輯模式
                    <>
                      <div className="w-3 h-3 shrink-0" />
                      <form
                        className="flex-1 flex items-center gap-1"
                        onSubmit={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (editSubItemContent.trim() && editSubItemContent !== subItem.content) {
                            onEditSubItem?.(task.id, subItem.id, editSubItemContent.trim());
                          }
                          setEditingSubItemId(null);
                          setEditSubItemContent("");
                        }}
                      >
                        <input
                          type="text"
                          value={editSubItemContent}
                          onChange={(e) => setEditSubItemContent(e.target.value)}
                          autoFocus
                          className="flex-1 bg-white/10 border border-white/30 rounded px-1.5 py-0.5 text-white text-xs focus:outline-none focus:border-indigo-400"
                          onKeyDown={(e) => {
                            e.stopPropagation();
                            if (e.key === "Escape") {
                              setEditingSubItemId(null);
                              setEditSubItemContent("");
                            }
                          }}
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <button
                          type="submit"
                          className="p-0.5 rounded hover:bg-green-500/20 text-green-400"
                          onPointerDown={(e) => e.stopPropagation()}
                        >
                          <CheckCircle2 className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingSubItemId(null);
                            setEditSubItemContent("");
                          }}
                          className="p-0.5 rounded hover:bg-red-500/20 text-red-400"
                          onPointerDown={(e) => e.stopPropagation()}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </form>
                    </>
                  ) : (
                    // 顯示模式
                    <>
                      <button
                        type="button"
                        className="flex items-center gap-1.5 flex-1 min-w-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          onToggleSubItem?.(task.id, subItem.id, !subItem.completed);
                        }}
                        onPointerDown={(e) => e.stopPropagation()}
                      >
                        {subItem.completed ? (
                          <CheckCircle2 className="w-3 h-3 text-green-400 shrink-0" />
                        ) : (
                          <div className="w-3 h-3 rounded-full border border-white/30 shrink-0 hover:border-white/50" />
                        )}
                        <span
                          className={`text-white/60 truncate text-left cursor-pointer ${subItem.completed ? "line-through text-white/40" : ""}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            onOpenSubItemDetail?.(subItem.id);
                          }}
                          title="點擊編輯"
                        >
                          {subItem.content}
                        </span>
                        {subItem.due_date && !subItem.completed && (() => {
                          const dueInfo = getRelativeTimeDesc(new Date(subItem.due_date!));
                          return (
                            <span
                              className={`inline-flex items-center gap-0.5 px-1 py-0 rounded text-[10px] shrink-0
                                ${dueInfo.isOverdue
                                  ? "bg-red-500/20 text-red-400"
                                  : dueInfo.isUrgent
                                    ? "bg-orange-500/20 text-orange-400"
                                    : "bg-blue-500/20 text-blue-400"
                                }`}
                            >
                              {dueInfo.isOverdue ? <AlertCircle className="w-2.5 h-2.5" /> : <Calendar className="w-2.5 h-2.5" />}
                              {dueInfo.text}
                            </span>
                          );
                        })()}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          onDeleteSubItem?.(task.id, subItem.id);
                        }}
                        onPointerDown={(e) => e.stopPropagation()}
                        className="opacity-0 group-hover/subitem:opacity-100 p-0.5 rounded hover:bg-red-500/20 text-white/30 hover:text-red-400 transition-all shrink-0"
                        title="刪除此項"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </>
                  )}
                </div>
              ))}
              {task.sub_items.length > 3 && !showAllSubItems && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    setShowAllSubItems(true);
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  className="w-full text-xs text-white/50 hover:text-white/70 hover:bg-white/10 rounded px-2 py-1.5 mt-1 transition-colors"
                >
                  +{task.sub_items.length - 3} 更多
                </button>
              )}
              {task.sub_items.length > 3 && showAllSubItems && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    setShowAllSubItems(false);
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  className="w-full text-xs text-white/50 hover:text-white/70 hover:bg-white/10 rounded px-2 py-1.5 mt-1 transition-colors"
                >
                  收起
                </button>
              )}

              {/* 新增 sub-item */}
              {isAddingSubItem ? (
                <form
                  className="flex items-center gap-1 px-1 py-0.5"
                  onSubmit={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (newSubItemContent.trim()) {
                      onAddSubItem?.(task.id, newSubItemContent.trim());
                      setNewSubItemContent("");
                      setIsAddingSubItem(false);
                    }
                  }}
                >
                  <div className="w-3 h-3 shrink-0" />
                  <input
                    type="text"
                    value={newSubItemContent}
                    onChange={(e) => setNewSubItemContent(e.target.value)}
                    placeholder="新增待辦事項..."
                    autoFocus
                    className="flex-1 bg-white/10 border border-white/30 rounded px-1.5 py-0.5 text-white text-xs placeholder:text-white/30 focus:outline-none focus:border-indigo-400"
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === "Escape") {
                        setIsAddingSubItem(false);
                        setNewSubItemContent("");
                      }
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <button
                    type="submit"
                    className="p-0.5 rounded hover:bg-green-500/20 text-green-400"
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    <CheckCircle2 className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsAddingSubItem(false);
                      setNewSubItemContent("");
                    }}
                    className="p-0.5 rounded hover:bg-red-500/20 text-red-400"
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    setIsAddingSubItem(true);
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  className="w-full text-xs text-white/40 hover:text-white/60 hover:bg-white/10 rounded px-2 py-1.5 mt-1 transition-colors flex items-center justify-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  新增待辦事項
                </button>
              )}
            </div>
          )}

          {/* References 區塊 - Hidden when completed */}
          {!isCompleted && task.references && task.references.length > 0 && (
            <div className="mt-2">
              <div className="flex items-center gap-1.5 text-xs text-white/40 mb-1">
                <span>參考資料</span>
                {task.references.some(ref => ref && ref.type === "note") && (
                  <FileText className="w-3 h-3" />
                )}
              </div>
              <div className="space-y-1">
                {task.references.filter(ref => ref && ref.type === "url").map((ref) => (
                  <div
                    key={ref.id}
                    className="group/ref flex items-start gap-1.5 text-xs hover:bg-white/5 rounded px-1 py-0.5 -mx-1"
                  >
                    <ExternalLink className="w-3 h-3 text-blue-400 shrink-0 mt-0.5" />
                    <a
                      href={ref.content}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 text-blue-400 hover:underline break-all"
                      onClick={(e) => e.stopPropagation()}
                      onPointerDown={(e) => e.stopPropagation()}
                    >
                      {ref.title || ref.content}
                    </a>
                    {onDeleteReference && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          onDeleteReference(task.id, ref.id);
                        }}
                        onPointerDown={(e) => e.stopPropagation()}
                        className="opacity-0 group-hover/ref:opacity-100 p-0.5 rounded hover:bg-red-500/20 text-white/30 hover:text-red-400 transition-all shrink-0"
                        title="刪除"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Completed Badge or Complete Button */}
        {isCompleted ? (
          /* Completed Badge - Click to undo */
          <button
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onComplete?.(task.id);
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className="flex items-center justify-center w-6 h-6 rounded-full bg-green-500/30 hover:bg-green-500/50 transition-all cursor-pointer"
            title="點擊取消標記為已完成"
          >
            <CheckCircle2 className="w-4 h-4 text-green-400" />
          </button>
        ) : onComplete ? (
          /* Complete Button */
          <button
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onComplete(task.id);
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className="opacity-0 group-hover:opacity-100 p-1 rounded-md hover:bg-green-500/20 text-green-400 transition-all shrink-0"
            title="標記為已完成"
          >
            <CheckCircle2 className="w-4 h-4" />
          </button>
        ) : null}

        <GripVertical className="w-4 h-4 text-white/30 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
      </div>
    </div>
  );
}

// 拖曳預覽 - Task
function DragOverlayTask({ task }: { task: TaskCard }) {
  const drawerConfig = DRAWER_CONFIG[task.drawer] || DRAWER_CONFIG.INBOX;

  return (
    <div className="bg-slate-800 rounded-lg border-2 border-indigo-500 p-3 shadow-xl shadow-indigo-500/25 rotate-3 scale-105">
      <div className="flex items-start gap-3">
        <div className={`mt-1.5 w-2 h-2 rounded-full ${drawerConfig.dotColor} shrink-0`} />
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-white text-sm">{task.title}</h4>
          <div className="flex items-center gap-1 mt-1.5">
            <Tag className="w-3 h-3 text-white/40" />
            <span className="text-xs text-white/50">{task.tag.topic}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// 拖曳預覽 - Product
function DragOverlayProduct({ productName }: { productName: string }) {
  return (
    <div className="bg-slate-800 rounded-xl border-2 border-indigo-500 p-4 shadow-xl shadow-indigo-500/25 rotate-3 scale-105 min-w-[200px]">
      <div className="flex items-center gap-2">
        <Package className="w-4 h-4 text-indigo-400" />
        <span className="font-medium text-white">{productName}</span>
      </div>
    </div>
  );
}

// 可拖放的產品區塊（同時可拖曳和可放置）
function DroppableProduct({
  productId,
  productName,
  productDescription,
  productLifecycle,
  productStatus,
  referenceCount = 0,
  tasks,
  isOver,
  milestones,
  onEditMilestone,
  areaId,
  onSetDueDate,
  onComplete,
  onReorganize,
  onToggleSubItem,
  onDeleteSubItem,
  onPromoteSubItem,
  onEditSubItem,
  onAddSubItem,
  onDeleteReference,
  onOpenTaskDetail,
  onOpenSubItemDetail,
  onRename,
  onEdit,
  onShowReferences,
  onEditTaskTitle,
  isReorganizing = false,
}: {
  productId: string;
  productName: string;
  productDescription?: string | null;
  productLifecycle: "FINITE" | "PERPETUAL";
  productStatus: string;
  referenceCount?: number;
  tasks: TaskCard[];
  isOver: boolean;
  milestones: Milestone[];
  onEditMilestone: (milestone?: Milestone | Partial<Milestone>) => void;
  areaId: string;
  onSetDueDate?: (task: TaskCard) => void;
  onComplete?: (taskId: string) => void;
  onReorganize?: (productId: string, productName: string) => void;
  onToggleSubItem?: (taskId: string, subItemId: string, completed: boolean) => void;
  onDeleteSubItem?: (taskId: string, subItemId: string) => void;
  onPromoteSubItem?: (taskId: string, subItemId: string) => void;
  onEditSubItem?: (taskId: string, subItemId: string, newContent: string) => void;
  onAddSubItem?: (taskId: string, content: string) => void;
  onDeleteReference?: (taskId: string, referenceId: string) => void;
  onOpenTaskDetail?: (task: TaskCard) => void;
  onOpenSubItemDetail?: (task: TaskCard, subItemId: string) => void;
  onRename?: (productId: string, newName: string) => void;
  onEdit?: (product: { id: string; name: string; description?: string | null; lifecycle: "FINITE" | "PERPETUAL"; status: string }) => void;
  onShowReferences?: (product: { id: string; name: string; description?: string | null; lifecycle: "FINITE" | "PERPETUAL"; status: string }) => void;
  onEditTaskTitle?: (taskId: string, newTitle: string) => void;
  isReorganizing?: boolean;
}) {
  // 作為放置目標（接收 Task 和其他 Product）
  const { setNodeRef: setDropRef } = useDroppable({
    id: `product-${productId}`,
    data: { type: 'product', productId, areaId }
  });

  // 作為可拖曳項目（拖曳到 Area 或其他 Product）
  const { attributes, listeners, setNodeRef: setDragRef, transform, isDragging } = useDraggable({
    id: `draggable-product-${productId}`,
    data: {
      type: 'product',
      productId,
      productName,
      areaId
    },
  });

  // 合併兩個 refs
  const setRefs = (element: HTMLDivElement | null) => {
    setDropRef(element);
    setDragRef(element);
  };

  // 篩選此 Product 的所有里程碑（支援多個，排除已過期）
  const productMilestones = (Array.isArray(milestones) ? milestones : [])
    .filter((m) => m.entity_type === "PRODUCT" && m.entity_id === productId)
    .filter((m) => m.status !== "completed")
    .filter((m) => {
      // 排除已過期的 milestone
      const daysRemaining = Math.ceil(
        (new Date(m.target_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
      );
      return daysRemaining >= 0;
    })
    .sort((a, b) => new Date(a.target_date).getTime() - new Date(b.target_date).getTime());

  const hasMilestone = productMilestones.length > 0;

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <div
      ref={setRefs}
      style={style}
      {...attributes}
      className={`
        rounded-xl border-2 transition-all duration-200
        ${isDragging ? "opacity-50 scale-105" : ""}
        ${isOver
          ? "border-indigo-500 bg-indigo-500/20 ring-2 ring-indigo-500/50 scale-[1.02]"
          : "border-white/10 bg-white/5 backdrop-blur-sm"
        }
      `}
    >
      <div className="border-b border-white/10">
        {/* Product Header */}
        <div
          className="px-4 py-3 group/header cursor-grab active:cursor-grabbing hover:bg-white/5 transition-colors"
          {...listeners}
        >
          <div className="flex items-center gap-2">
            <GripVertical className="w-4 h-4 text-white/30 group-hover/header:text-white/60 transition-colors" />
            <Package className="w-4 h-4 text-white/50" />
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit?.({
                  id: productId,
                  name: productName,
                  description: productDescription,
                  lifecycle: productLifecycle,
                  status: productStatus,
                });
              }}
              className="font-medium text-white flex-1 truncate text-left hover:text-indigo-300 transition-colors"
              title="點擊查看專案詳情"
            >
              {productName}
            </button>

            {/* References 按鈕 - 只在有 references 時顯示 */}
            {referenceCount > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onShowReferences?.({
                    id: productId,
                    name: productName,
                    description: productDescription,
                    lifecycle: productLifecycle,
                    status: productStatus,
                  });
                }}
                className="p-1.5 rounded-md border bg-amber-500/10 border-amber-500/30 hover:bg-amber-500/20 hover:border-amber-400/50 transition-all"
                title={`查看相關資料 (${referenceCount})`}
              >
                <FileText className="w-3.5 h-3.5 text-amber-400" />
              </button>
            )}

            {/* AI Reorganize 按鈕 */}
            {onReorganize && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onReorganize(productId, productName);
                }}
                disabled={isReorganizing}
                className={`p-1.5 rounded-md border transition-all ${
                  isReorganizing
                    ? "bg-indigo-500/30 border-indigo-400/50 cursor-wait"
                    : "bg-indigo-500/10 border-indigo-500/30 hover:bg-indigo-500/20 hover:border-indigo-400/50"
                }`}
                title={isReorganizing ? "AI 分析中..." : "AI 自動整理 Topics 與時間"}
              >
                {isReorganizing ? (
                  <Loader2 className="w-3.5 h-3.5 text-indigo-400 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                )}
              </button>
            )}
          </div>
        </div>

        {/* 里程碑列表（支援多個）*/}
        {hasMilestone && (
          <div className="px-4 pb-2 flex flex-wrap gap-1.5">
            {productMilestones.map((milestone) => {
              const daysRemaining = Math.ceil(
                (new Date(milestone.target_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
              );
              const isUrgent = daysRemaining <= 7 && daysRemaining >= 0;
              const isOverdue = daysRemaining < 0;

              return (
                <button
                  key={milestone.id}
                  onClick={() => onEditMilestone(milestone)}
                  className="group flex items-center gap-1.5 px-2 py-1 rounded-md bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/20 transition-colors"
                  title={`點擊編輯「${milestone.name}」`}
                >
                  <Target className="w-3 h-3 text-indigo-400 shrink-0" />
                  <span className="text-xs text-white/70 max-w-[120px] truncate">
                    {milestone.name}
                  </span>
                  <span
                    className={`text-xs font-medium shrink-0 ${
                      isOverdue
                        ? "text-red-400"
                        : isUrgent
                        ? "text-orange-400"
                        : "text-indigo-300"
                    }`}
                  >
                    {isOverdue
                      ? `逾期${Math.abs(daysRemaining)}天`
                      : `${daysRemaining}天`}
                  </span>
                </button>
              );
            })}

            {/* 新增里程碑按鈕 */}
            <button
              onClick={() => onEditMilestone({ entity_type: "PRODUCT", entity_id: productId })}
              className="flex items-center gap-1 px-2 py-1 rounded-md border border-dashed border-white/20 hover:border-indigo-400/50 hover:bg-indigo-500/10 transition-colors group"
              title="新增里程碑"
            >
              <Plus className="w-3 h-3 text-white/40 group-hover:text-indigo-400 transition-colors" />
              <span className="text-xs text-white/40 group-hover:text-indigo-300 transition-colors">新增</span>
            </button>
          </div>
        )}

        {/* 沒有里程碑時顯示設定按鈕 */}
        {!hasMilestone && (
          <div className="px-4 pb-2">
            <button
              onClick={() => onEditMilestone({ entity_type: "PRODUCT", entity_id: productId })}
              className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-dashed border-white/20 hover:border-indigo-400/50 hover:bg-indigo-500/10 transition-colors w-full justify-center group"
              title="設定第一個里程碑"
            >
              <Target className="w-3 h-3 text-white/30 group-hover:text-indigo-400 transition-colors" />
              <span className="text-xs text-white/40 group-hover:text-indigo-300 transition-colors">設定里程碑</span>
            </button>
          </div>
        )}
      </div>

      <div className="p-3 space-y-2 min-h-[80px]">
        {tasks.length === 0 ? (
          <div className="flex items-center justify-center h-16 text-white/30 text-sm">
            拖曳任務到這裡
          </div>
        ) : (
          [...tasks]
            .sort((a, b) => {
              // 有 due_date 的排前面
              if (a.due_date && !b.due_date) return -1;
              if (!a.due_date && b.due_date) return 1;
              if (!a.due_date && !b.due_date) return 0;
              // 兩個都有 due_date，按日期排序（早的在前）
              return new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime();
            })
            .map((task) => <DraggableTaskItem key={task.id} task={task} onSetDueDate={onSetDueDate} onComplete={onComplete} onToggleSubItem={onToggleSubItem} onDeleteSubItem={onDeleteSubItem} onPromoteSubItem={onPromoteSubItem} onEditTitle={onEditTaskTitle} onEditSubItem={onEditSubItem} onAddSubItem={onAddSubItem} onDeleteReference={onDeleteReference} onOpenDetail={() => onOpenTaskDetail?.(task)} onOpenSubItemDetail={(subItemId) => onOpenSubItemDetail?.(task, subItemId)} />)
        )}
      </div>
    </div>
  );
}

// 可放置的 Area Header（接收 Product）
function DroppableAreaHeader({
  areaId,
  areaName,
  productCount,
  taskCount,
  isOver,
  onAddProduct,
}: {
  areaId: string;
  areaName: string;
  productCount: number;
  taskCount: number;
  isOver: boolean;
  onAddProduct: () => void;
}) {
  const { setNodeRef } = useDroppable({
    id: `area-${areaId}`,
    data: { type: 'area', areaId }
  });

  return (
    <div
      ref={setNodeRef}
      className={`flex items-center justify-between mb-4 p-4 rounded-xl transition-all ${
        isOver
          ? "bg-indigo-500/10 border-2 border-indigo-500 border-dashed"
          : "border-2 border-transparent"
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center">
          <FolderOpen className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">{areaName}</h2>
          <p className="text-sm text-white/50">
            {productCount} 個專案 · {taskCount} 個任務
          </p>
        </div>
      </div>

      {/* 新增專案按鈕 */}
      <Button
        onClick={onAddProduct}
        className="bg-white/10 hover:bg-white/20 border border-white/20 text-white"
        size="sm"
      >
        <Plus className="w-4 h-4 mr-2" />
        新增專案
      </Button>
    </div>
  );
}

function DashboardContent() {
  const router = useRouter();

  const [viewMode, setViewMode] = useState<ViewMode>("structure");
  const [areas, setAreas] = useState<ApiArea[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>("User");
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [selectedArea, setSelectedArea] = useState<string | null>(null);
  const [expandedAreas, setExpandedAreas] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTask, setActiveTask] = useState<TaskCard | null>(null);
  const [activeProduct, setActiveProduct] = useState<{ id: string; name: string } | null>(null);
  const [overDropId, setOverDropId] = useState<string | null>(null);
  const [isMilestoneModalOpen, setIsMilestoneModalOpen] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<Milestone | null>(null);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isProductDetailModalOpen, setIsProductDetailModalOpen] = useState(false);
  const [productDetailInitialTab, setProductDetailInitialTab] = useState<"edit" | "milestones" | "references">("edit");
  const [selectedAreaForProduct, setSelectedAreaForProduct] = useState<{ id: string; name: string } | null>(null);
  const [editingProduct, setEditingProduct] = useState<{ id: string; name: string; description?: string | null; lifecycle: "FINITE" | "PERPETUAL"; status: string } | null>(null);
  const [isAreaModalOpen, setIsAreaModalOpen] = useState(false);
  const [editingArea, setEditingArea] = useState<{ id: string; name: string; scope?: string | null; description?: string | null; productCount?: number } | null>(null);
  const [isDueDateModalOpen, setIsDueDateModalOpen] = useState(false);
  const [editingTaskForDueDate, setEditingTaskForDueDate] = useState<TaskCard | null>(null);
  const [dateModalType, setDateModalType] = useState<"due" | "start">("due");
  const [isTaskDetailModalOpen, setIsTaskDetailModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskCard | null>(null);
  const [initialEditSubItemId, setInitialEditSubItemId] = useState<string | null>(null);
  const [showProductSuggestionModal, setShowProductSuggestionModal] = useState(false);
  const [productSuggestion, setProductSuggestion] = useState<{
    taskId: string;
    taskContent: string;
    areaId: string;
    areaName: string;
    suggestedName: string;
    reasoning: string;
    alternatives: string[];
  } | null>(null);
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [selectedTaskCalendarEvent, setSelectedTaskCalendarEvent] = useState<{ eventId: string; eventLink: string } | null>(null);
  const [showArchive, setShowArchive] = useState(false);
  const [isReorganizeModalOpen, setIsReorganizeModalOpen] = useState(false);
  const [reorganizeProposal, setReorganizeProposal] = useState<ReorganizeProposal | null>(null);
  const [isReorganizing, setIsReorganizing] = useState(false);
  const [isApplying, setIsApplying] = useState(false); // 新增: applying 狀態
  const [reorganizingProductId, setReorganizingProductId] = useState<string | null>(null);
  const proposalCacheRef = useRef<Map<string, ReorganizeProposal>>(new Map()); // 快取 proposal by productId
  const [isRestoring, setIsRestoring] = useState(false); // 還原中狀態
  const [lastReorganizedProductId, setLastReorganizedProductId] = useState<string | null>(null); // 記錄最後重組的 product

  // Task 合併相關 state
  const [showMergeConfirmModal, setShowMergeConfirmModal] = useState(false);
  const [pendingMerge, setPendingMerge] = useState<{
    sourceTask: TaskCard;
    targetTask: TaskCard;
  } | null>(null);
  const [isMerging, setIsMerging] = useState(false);

  // 歡迎模式（新用戶空白狀態）- 初始為 false，避免載入時閃爍
  const [isWelcomeMode, setIsWelcomeMode] = useState(false);
  const [showQuickInputGuide, setShowQuickInputGuide] = useState(false);
  const [showAIButtonTip, setShowAIButtonTip] = useState(false);

  // 今日完成任務追蹤（從 API 獲取）
  const [completedTodayTasks, setCompletedTodayTasks] = useState<TaskCard[]>([]);
  const [completionFeedback, setCompletionFeedback] = useState<string | null>(null);

  // 最近兩週已歸檔任務（用於「顯示已完成」功能）
  const [recentArchivedTasks, setRecentArchivedTasks] = useState<TaskCard[]>([]);
  const [isLoadingArchived, setIsLoadingArchived] = useState(false);
  const [archivedLoaded, setArchivedLoaded] = useState(false);

  // 載入今日完成的任務
  // 載入最近兩週的已歸檔任務
  const loadRecentArchived = useCallback(async () => {
    if (archivedLoaded || isLoadingArchived) return;
    setIsLoadingArchived(true);
    try {
      const twoWeeksAgo = new Date();
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
      const fromDate = twoWeeksAgo.toISOString();
      const res = await fetch(`${API_BASE_URL}/api/tasks?status=ARCHIVE&from=${fromDate}`, {
        headers: await getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        // 解析統一 API 格式: { success: true, data: { tasks: [...] } }
        const tasks = data.data?.tasks || data.tasks || [];
        setRecentArchivedTasks(Array.isArray(tasks) ? tasks : []);
        setArchivedLoaded(true);
      }
    } catch (err) {
      console.error("Failed to load recent archived tasks:", err);
    } finally {
      setIsLoadingArchived(false);
    }
  }, [archivedLoaded, isLoadingArchived]);

  // ✅ 已移至初始載入並行處理，不再需要單獨的 useEffect

  // DnD Sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  // 載入用戶數據
  useEffect(() => {
    setIsLoading(true);
    setError(null);

    // 檢查 Firebase Auth 狀態
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      if (!firebaseUser) {
        // 未登入，重定向到首頁
        router.push("/");
        return;
      }

      try {
        // 獲取 Firebase ID Token
        const token = await firebaseUser.getIdToken();
        const headers = { 'Authorization': `Bearer ${token}` };

        // 2. 根據 Firebase UID 獲取用戶資料
        const userRes = await fetch(`${API_BASE_URL}/api/me`, { headers });
        if (!userRes.ok) {
          throw new Error(`無法獲取用戶資料 (HTTP ${userRes.status})`);
        }
        const userData = await userRes.json();

        // 解析 API 統一回應格式: { success: true, data: { user: {...} } }
        const actualUser = userData.data?.user || userData.user || userData;

        if (!actualUser?.id) {
          throw new Error("用戶資料格式錯誤：缺少 id");
        }

        setUserId(actualUser.id);
        setUserName(actualUser.displayName || actualUser.name || actualUser.email || "User");

        // 3-5. 🚀 並行載入所有資料（library, milestones, completed_today）
        const [libraryRes, milestonesRes, completedTodayRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/library`, { headers }),
          fetch(`${API_BASE_URL}/api/milestones`, { headers }),
          fetch(`${API_BASE_URL}/api/tasks?completed_today=true`, { headers }),
        ]);

        // 處理 library
        if (!libraryRes.ok) throw new Error("無法獲取資料庫內容");
        const libraryData = await libraryRes.json();
        const rawAreas = libraryData.data?.areas || [];
        const areas = cleanLibraryData(rawAreas);
        setAreas(areas);

        // 處理 milestones
        if (milestonesRes.ok) {
          const milestonesData = await milestonesRes.json();
          setMilestones(milestonesData.data?.milestones || []);
        }

        // 處理 completed_today
        if (completedTodayRes.ok) {
          const completedData = await completedTodayRes.json();
          const tasks = completedData.data?.tasks || completedData.tasks || [];
          setCompletedTodayTasks(Array.isArray(tasks) ? tasks : []);
        }

        // 預設展開所有 Areas
        setExpandedAreas(new Set((Array.isArray(areas) ? areas : []).map((a: ApiArea) => a.name)));
      } catch (err) {
        setError(err instanceof Error ? err.message : "載入失敗");
      } finally {
        setIsLoading(false);
      }
    });

    // Cleanup: 正確地返回 cleanup function
    return () => unsubscribe();
  }, [router]);

  // 判斷是否需要顯示歡迎模式（新用戶沒有任何任務）
  const hasTasks = Array.isArray(areas) && areas.some(a =>
    Array.isArray(a.products) && a.products.some(p =>
      Array.isArray(p.tasks) && p.tasks.filter(t => t.drawer !== 'ARCHIVE').length > 0
    )
  );

  useEffect(() => {
    if (!isLoading && userId) {
      setIsWelcomeMode(!hasTasks);
    }
  }, [isLoading, userId, hasTasks]);

  // 檢查 Google Calendar 連線狀態
  useEffect(() => {
    if (!userId) return;
    const checkCalendar = async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;
        const token = await user.getIdToken();
        const status = await getOAuthStatus('google_calendar', token);
        setCalendarConnected(status.authorized);
      } catch {
        // 忽略錯誤，預設未連線
      }
    };
    checkCalendar();
  }, [userId]);

  // 獲取今天的日期範圍
  const getTodayDateRange = () => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
    return { todayStart, todayEnd };
  };

  // 統計
  const stats = {
    total: (() => {
      if (!Array.isArray(areas)) return 0;
      const { todayStart, todayEnd } = getTodayDateRange();
      return areas.reduce((sum, area) =>
        sum + (Array.isArray(area.products) ? area.products : []).reduce((ps, p) =>
          ps + (Array.isArray(p.tasks) ? p.tasks : []).filter((t) => {
            // 檢查任務是否存在
            if (!t) return false;
            // 未完成的任務
            if (t.drawer === "ARCHIVE") return false;
            // 必須有 due_date 且在今天
            if (!t.due_date) return false;
            const dueDate = new Date(t.due_date);
            return dueDate >= todayStart && dueDate < todayEnd;
          }).length, 0), 0);
    })(),
    active: Array.isArray(areas) ? areas.reduce(
      (sum, area) =>
        sum + (Array.isArray(area.products) ? area.products : []).reduce((ps, p) => ps + (Array.isArray(p.tasks) ? p.tasks : []).filter((t) => t && t.drawer === "ACTIVE").length, 0),
      0
    ) : 0,
    archived: Array.isArray(areas) ? areas.reduce(
      (sum, area) =>
        sum + (Array.isArray(area.products) ? area.products : []).reduce((ps, p) => ps + (Array.isArray(p.tasks) ? p.tasks : []).filter((t) => t && t.drawer === "ARCHIVE").length, 0),
      0
    ) : 0,
    areas: Array.isArray(areas) ? areas.length : 0,
    products: Array.isArray(areas) ? areas.reduce((sum, area) => sum + (Array.isArray(area.products) ? area.products.length : 0), 0) : 0,
  };

  const toggleArea = (areaName: string) => {
    setExpandedAreas((prev) => {
      const next = new Set(prev);
      if (next.has(areaName)) next.delete(areaName);
      else next.add(areaName);
      return next;
    });
  };

  // 拖曳開始
  const handleDragStart = (event: DragStartEvent) => {
    const activeData = event.active.data.current;

    // 拖曳 Task
    if (activeData?.task) {
      setActiveTask(activeData.task);
      setActiveProduct(null);
    }
    // 拖曳 Product
    else if (activeData?.type === 'product') {
      setActiveProduct({ id: activeData.productId, name: activeData.productName });
      setActiveTask(null);
    }
  };

  // 拖曳結束 - 移動任務到新 Product 或移動 Product 到新 Area
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);
    setActiveProduct(null);
    setOverDropId(null);

    if (!over) return;

    const activeData = active.data.current;
    const overData = over.data.current;

    // 情況 1: 拖曳 Product 到 Product (重新排序)
    if (activeData?.type === 'product' && overData?.type === 'product') {
      const activeId = activeData.productId;
      const overId = overData.productId;
      const activeAreaId = activeData.areaId;
      const overAreaId = overData.areaId;

      console.log('Product to Product drag:', { activeId, overId, activeAreaId, overAreaId });

      // 只在同一個 area 內重新排序
      if (activeId === overId || activeAreaId !== overAreaId) return;

      // 找到該 area 的所有 products
      const targetArea = (Array.isArray(areas) ? areas : []).find(a => a.id === activeAreaId);
      if (!targetArea || !Array.isArray(targetArea.products)) return;

      const oldIndex = targetArea.products.findIndex(p => p.id === activeId);
      const newIndex = targetArea.products.findIndex(p => p.id === overId);

      if (oldIndex === -1 || newIndex === -1) return;

      // 重新排列 products
      const reorderedProducts = [...targetArea.products];
      const [movedProduct] = reorderedProducts.splice(oldIndex, 1);
      reorderedProducts.splice(newIndex, 0, movedProduct);

      // 更新 UI
      setAreas(prevAreas =>
        prevAreas.map(area =>
          area.id === activeAreaId
            ? { ...area, products: reorderedProducts }
            : area
        )
      );

      // 調用 API 更新順序
      try {
        const updates = reorderedProducts.map((product, index) => ({
          id: product.id,
          display_order: index,
        }));

        const authHeaders = await getAuthHeaders();
        const res = await fetch(`${API_BASE_URL}/api/products/reorder`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...authHeaders
          },
          body: JSON.stringify({ updates }),
        });

        if (!res.ok) {
          throw new Error('更新順序失敗');
        }
      } catch (err) {
        console.error('Failed to reorder products:', err);
        // 如果失敗，重新載入數據
        const libraryRes = await fetch(`${API_BASE_URL}/api/library`, { headers: await getAuthHeaders() });
        if (libraryRes.ok) {
          const libraryData = await libraryRes.json();
          setAreas(cleanLibraryData(libraryData.data?.areas || []));
        }
      }
      return;
    }

    // 情況 2: 拖曳 Product 到 Area
    if (activeData?.type === 'product' && overData?.type === 'area') {
      const productId = activeData.productId;
      const currentAreaId = activeData.areaId;
      const newAreaId = overData.areaId;

      // 如果是同一個 area，不需要移動
      if (currentAreaId === newAreaId) return;

      // 樂觀更新 UI
      setAreas((prevAreas) => updateAreasState(prevAreas, (areas) => {
        let movedProduct: ApiProduct | null = null;

        // 從原 Area 移除 Product
        const updatedAreas = areas.map((area) => {
          if (area.id === currentAreaId) {
            const product = area.products.find((p) => p.id === productId);
            if (product) {
              movedProduct = product;
              return {
                ...area,
                products: area.products.filter((p) => p.id !== productId),
              };
            }
          }
          return area;
        });

        // 添加到新 Area
        if (movedProduct) {
          return updatedAreas.map((area) => {
            if (area.id === newAreaId) {
              return {
                ...area,
                products: [...area.products, movedProduct!],
              };
            }
            return area;
          });
        }

        return updatedAreas;
      }));

      // 調用 API 更新
      try {
        const authHeaders = await getAuthHeaders();
        const res = await fetch(`${API_BASE_URL}/api/products/${productId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...authHeaders
          },
          body: JSON.stringify({ area_id: newAreaId }),
        });

        if (!res.ok) {
          throw new Error("更新失敗");
        }
      } catch (err) {
        console.error("Failed to move product:", err);
        // 如果失敗，重新載入數據
        const libraryRes = await fetch(`${API_BASE_URL}/api/library`, { headers: await getAuthHeaders() });
        if (libraryRes.ok) {
          const libraryData = await libraryRes.json();
          setAreas(cleanLibraryData(libraryData.data?.areas || []));
        }
      }
      return;
    }

    // 情況 3: 拖曳 Task 到 Product
    if (activeData?.task && overData?.type === 'product') {
      const taskId = active.id as string;
      const newProductId = overData.productId;

      // 找到當前任務
      let currentTask: TaskCard | null = null;
      let currentProductId: string | null = null;

      for (const area of areas) {
        for (const product of area.products) {
          const task = product.tasks.find((t) => t.id === taskId);
          if (task) {
            currentTask = task;
            currentProductId = product.id;
            break;
          }
        }
        if (currentTask) break;
      }

      // 如果是同一個 product，不需要移動
      if (!currentTask || currentProductId === newProductId) return;

      // 樂觀更新 UI
      setAreas((prevAreas) => updateAreasState(prevAreas, (areas) => {
        return areas.map((area) => ({
          ...area,
          products: area.products.map((product) => {
            // 從原 product 移除
            if (product.id === currentProductId) {
              return {
                ...product,
                tasks: product.tasks.filter((t) => t.id !== taskId),
              };
            }
            // 添加到新 product
            if (product.id === newProductId) {
              const newTask = {
                ...currentTask!,
                tag: { ...currentTask!.tag, product: product.name },
              };
              return {
                ...product,
                tasks: [newTask, ...product.tasks],
              };
            }
            return product;
          }),
        }));
      }));

      // 調用 API 更新
      try {
        const authHeaders = await getAuthHeaders();
        const res = await fetch(`${API_BASE_URL}/api/tasks`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...authHeaders
          },
          body: JSON.stringify({ taskId, productId: newProductId }),
        });

        if (!res.ok) {
          throw new Error("更新失敗");
        }
      } catch (err) {
        console.error("Failed to move task:", err);
        // 如果失敗，重新載入數據
        const libraryRes = await fetch(`${API_BASE_URL}/api/library`, { headers: await getAuthHeaders() });
        if (libraryRes.ok) {
          const libraryData = await libraryRes.json();
          setAreas(cleanLibraryData(libraryData.data?.areas || []));
        }
      }
      return;
    }

    // 情況 4: 拖曳 Task 到 Area（需要 AI 推薦專案）
    if (activeData?.task && overData?.type === 'area') {
      const taskId = active.id as string;
      const targetAreaId = overData.areaId;

      // 找到任務和目標 Area
      let currentTask: TaskCard | null = null;
      let targetArea: ApiArea | null = null;

      for (const area of areas) {
        if (area.id === targetAreaId) {
          targetArea = area;
        }
        for (const product of area.products) {
          const task = product.tasks.find((t) => t.id === taskId);
          if (task) {
            currentTask = task;
          }
        }
      }

      if (!currentTask || !targetArea || !userId) return;

      // 調用 AI 推薦專案名稱
      try {
        const authHeaders = await getAuthHeaders();
        const res = await fetch(`${API_BASE_URL}/api/suggest-product`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...authHeaders
          },
          body: JSON.stringify({
            taskContent: currentTask.title,
            taskNarrative: currentTask.narrative,
            areaId: targetArea.id,
            areaName: targetArea.name,
            areaScope: targetArea.scope,
            userId,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          setProductSuggestion({
            taskId: currentTask.id,
            taskContent: currentTask.title,
            areaId: targetArea.id,
            areaName: targetArea.name,
            suggestedName: data.suggestion.suggested_name,
            reasoning: data.suggestion.reasoning,
            alternatives: data.suggestion.alternative_names || [],
          });
          setShowProductSuggestionModal(true);
        }
      } catch (err) {
        console.error("Failed to suggest product:", err);
      }
    }

    // 情況 5: 拖曳 Task 到另一個 Task（合併為 sub-item）
    if (activeData?.task && overData?.type === 'task') {
      const sourceTaskId = active.id as string;
      const targetTaskId = overData.targetTaskId;
      const targetTask = overData.targetTask;

      // 不能拖到自己
      if (sourceTaskId === targetTaskId) return;

      // 找到來源任務
      let sourceTask: TaskCard | null = null;
      for (const area of areas) {
        for (const product of area.products) {
          const task = product.tasks.find((t) => t.id === sourceTaskId);
          if (task) {
            sourceTask = task;
            break;
          }
        }
        if (sourceTask) break;
      }

      if (!sourceTask || !targetTask) return;

      // 顯示合併確認對話框
      setPendingMerge({
        sourceTask,
        targetTask,
      });
      setShowMergeConfirmModal(true);
    }
  };

  // 確認 Task 合併
  const handleConfirmMerge = async () => {
    if (!pendingMerge || !userId) return;

    setIsMerging(true);
    setShowMergeConfirmModal(false);

    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch(`${API_BASE_URL}/api/tasks/${pendingMerge.sourceTask.id}/merge-into`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders
        },
        body: JSON.stringify({ targetTaskId: pendingMerge.targetTask.id }),
      });

      if (!res.ok) {
        throw new Error("合併失敗");
      }

      // 重新載入數據
      const libraryRes = await fetch(`${API_BASE_URL}/api/library`, { headers: await getAuthHeaders() });
      if (libraryRes.ok) {
        const libraryData = await libraryRes.json();
        setAreas(cleanLibraryData(libraryData.data?.areas || []));
      }
    } catch (err) {
      console.error("Failed to merge task:", err);
    } finally {
      setIsMerging(false);
      setPendingMerge(null);
    }
  };

  // 取消 Task 合併
  const handleCancelMerge = () => {
    setShowMergeConfirmModal(false);
    setPendingMerge(null);
  };

  // 確認 AI 推薦的專案名稱並創建專案
  const handleConfirmProductSuggestion = async (productName: string) => {
    if (!productSuggestion || !userId) return;

    setShowProductSuggestionModal(false);

    try {
      const authHeaders = await getAuthHeaders();

      // 1. 創建新專案
      const createRes = await fetch(`${API_BASE_URL}/api/products`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders
        },
        body: JSON.stringify({
          areaId: productSuggestion.areaId,
          name: productName,
          status: "ACTIVE",
          lifecycle: "FINITE",
        }),
      });

      if (!createRes.ok) {
        throw new Error("創建專案失敗");
      }

      const createData = await createRes.json();

      if (!createData.success || !createData.product) {
        throw new Error("創建專案失敗：回傳格式錯誤");
      }

      const createdProduct = createData.product;

      // 2. 移動任務到新專案
      const moveRes = await fetch(`${API_BASE_URL}/api/tasks`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders
        },
        body: JSON.stringify({
          taskId: productSuggestion.taskId,
          productId: createdProduct.id,
        }),
      });

      if (!moveRes.ok) {
        throw new Error("移動任務失敗");
      }

      // 3. 重新載入數據
      const libraryRes = await fetch(`${API_BASE_URL}/api/library`, { headers: await getAuthHeaders() });
      if (libraryRes.ok) {
        const libraryData = await libraryRes.json();
        setAreas(cleanLibraryData(libraryData.data?.areas || []));
      }
    } catch (err) {
      console.error("Failed to create product and move task:", err);
    } finally {
      setProductSuggestion(null);
    }
  };

  // 拖曳懸停
  const handleDragOver = (event: DragOverEvent) => {
    setOverDropId(event.over?.id as string || null);
  };

  // 重新載入 milestones
  const reloadMilestones = async () => {
    if (!userId) return;
    try {
      const milestonesRes = await fetch(`${API_BASE_URL}/api/milestones`, { headers: await getAuthHeaders() });
      if (milestonesRes.ok) {
        const milestonesData = await milestonesRes.json();
        setMilestones(milestonesData.data?.milestones || []);
      }
    } catch (err) {
      console.error("Failed to reload milestones:", err);
    }
  };

  // 標記任務為已完成
  const handleTaskStatusChange = async (taskId: string, newStatus: DrawerStatus) => {
    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch(`${API_BASE_URL}/api/tasks`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders
        },
        body: JSON.stringify({ taskId, status: newStatus }),
      });

      if (!res.ok) throw new Error("狀態更新失敗");

      const responseData = await res.json();
      const { task: updatedTask } = responseData.data;

      if (updatedTask) {
        setAreas(prevAreas => updateAreasState(prevAreas, (areas) =>
          areas.map(area => ({
            ...area,
            products: area.products.map(product => ({
              ...product,
              tasks: product.tasks.map(task =>
                task.id === taskId ? updatedTask : task
              ),
            })),
          }))
        ));
      }
    } catch (error) {
      console.error("Failed to change task status:", error);
    }
  };

  const handleTopicChange = async (taskId: string, topicId: string | null) => {
    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch(`${API_BASE_URL}/api/tasks`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders
        },
        body: JSON.stringify({ taskId, topicId }),
      });

      if (!res.ok) throw new Error("主題更新失敗");

      const responseData = await res.json();
      const { task: updatedTask } = responseData.data;

      if (updatedTask) {
        setAreas(prevAreas => updateAreasState(prevAreas, (areas) =>
          areas.map(area => ({
            ...area,
            products: area.products.map(product => ({
              ...product,
              tasks: product.tasks.map(task =>
                task.id === taskId ? updatedTask : task
              ),
            })),
          }))
        ));
        if (selectedTask?.id === taskId) setSelectedTask(updatedTask);
      }
    } catch (error) {
      console.error("Failed to change topic:", error);
    }
  };

  const handleProductChange = async (taskId: string, newProductId: string) => {
    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch(`${API_BASE_URL}/api/tasks`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders
        },
        body: JSON.stringify({ taskId, productId: newProductId }),
      });

      if (!res.ok) throw new Error("專案更新失敗");

      // Product change moves task between products, reload all data
      const libraryRes = await fetch(`${API_BASE_URL}/api/library`, {
        headers: authHeaders,
      });
      if (libraryRes.ok) {
        const libraryData = await libraryRes.json();
        setAreas(cleanLibraryData(libraryData.data?.areas || []));

        // Update selectedTask to reflect changes
        const updatedTask = (libraryData.data?.areas || [])
          .flatMap((a: any) => a.products?.flatMap((p: any) => p.tasks || []) || [])
          .find((t: any) => t?.id === taskId);
        if (updatedTask) setSelectedTask(updatedTask);
      }
    } catch (error) {
      console.error("Failed to change product:", error);
    }
  };

  const handleCompleteTask = async (taskId: string) => {
    try {
      // 找到任務的當前狀態（從所有可能的來源）
      let task = areas
        .flatMap((area) => area.products)
        .flatMap((product) => product.tasks)
        .filter((t) => t != null)  // 過濾掉 null/undefined
        .find((t) => t.id === taskId);

      // 如果在 areas 中找不到，嘗試從已歸檔任務中尋找
      if (!task) {
        task = recentArchivedTasks.find((t) => t.id === taskId);
      }

      // 如果還是找不到，嘗試從今日完成任務中尋找
      if (!task) {
        task = completedTodayTasks.find((t) => t.id === taskId);
      }

      if (!task) {
        console.error("Task not found:", taskId);
        return;
      }

      console.log("🔍 Task current state:", {
        id: taskId,
        drawer: task.drawer
      });

      // 如果已完成（ARCHIVE），改為 ACTIVE；否則改為 ARCHIVE
      const newStatus = task.drawer === "ARCHIVE" ? "ACTIVE" : "ARCHIVE";
      const isCompleting = newStatus === "ARCHIVE";

      console.log("🎯 Updating to:", newStatus, "isCompleting:", isCompleting);

      const authHeaders = await getAuthHeaders();
      const res = await fetch(`${API_BASE_URL}/api/tasks`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders
        },
        body: JSON.stringify({ taskId, status: newStatus }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        console.error("API error:", errorData);
        throw new Error(errorData.error?.message || "更新失敗");
      }

      const responseData = await res.json();
      const { task: updatedTask } = responseData.data;

      if (!updatedTask) {
        console.error("API response missing task:", responseData);
        throw new Error("API 回應格式錯誤");
      }

      // 直接使用返回的完整任務資料更新 state（不重新查詢所有卡片）
      setAreas(prevAreas => updateAreasState(prevAreas, (areas) => {
        const taskExistsInAreas = areas.some(area =>
          area.products.some(product => product.tasks.some(t => t.id === taskId))
        );

        if (taskExistsInAreas) {
          // 任務已在 areas 中，直接更新
          return areas.map(area => ({
            ...area,
            products: area.products.map(product => ({
              ...product,
              tasks: product.tasks.map(task =>
                task.id === taskId ? updatedTask : task
              ),
            })),
          }));
        } else if (!isCompleting) {
          // 任務不在 areas 中，且正在取消完成 → 加入對應的 product
          return areas.map(area => ({
            ...area,
            products: area.products.map(product => {
              if (product.id === updatedTask.product_id) {
                return {
                  ...product,
                  tasks: [...product.tasks, updatedTask],
                };
              }
              return product;
            }),
          }));
        }
        return areas;
      }));

      // 更新 completedTodayTasks
      if (isCompleting) {
        setCompletedTodayTasks(prev => [...prev, updatedTask]);
        const newCount = completedTodayTasks.length + 1;
        setCompletionFeedback(`完成！今天已完成 ${newCount} 項`);
        setTimeout(() => setCompletionFeedback(null), 3000);
      } else {
        setCompletedTodayTasks(prev => prev.filter(t => t.id !== taskId));
      }

      // 更新 recentArchivedTasks
      if (isCompleting) {
        // 完成任務時，加入已歸檔列表
        setRecentArchivedTasks(prev => [...prev, updatedTask]);
      } else {
        // 取消完成時，從已歸檔列表移除
        setRecentArchivedTasks(prev => prev.filter(t => t.id !== taskId));
      }
    } catch (err) {
      console.error("Failed to complete task:", err);
    }
  };

  // 刪除任務
  const handleDeleteTask = async (taskId: string) => {
    try {
      // Optimistic update: 先從 UI 移除任務
      setAreas(prevAreas => updateAreasState(prevAreas, (areas) => {
        return areas.map(area => ({
          ...area,
          products: area.products.map(product => ({
            ...product,
            tasks: product.tasks.filter((task: TaskCard) => task.id !== taskId)
          }))
        }));
      }));

      // 關閉 Task Detail Modal
      setIsTaskDetailModalOpen(false);
      setSelectedTask(null);

      // API call
      const res = await fetch(`${API_BASE_URL}/api/tasks/${taskId}`, {
        method: "DELETE",
        headers: await getAuthHeaders(),
      });

      if (!res.ok) {
        throw new Error("刪除任務失敗");
      }
    } catch (err) {
      console.error("Failed to delete task:", err);
      alert("刪除任務失敗，請稍後再試");
      // 錯誤時重新載入數據
      const libraryRes = await fetch(`${API_BASE_URL}/api/library`, { headers: await getAuthHeaders() });
      if (libraryRes.ok) {
        const libraryData = await libraryRes.json();
        setAreas(cleanLibraryData(libraryData.data?.areas || []));
      }
    }
  };

  // 載入 task 已關聯的日曆事件
  const fetchTaskCalendarEvent = async (taskId: string) => {
    setSelectedTaskCalendarEvent(null);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) return;
      const token = await currentUser.getIdToken();


      const response = await fetch(`${API_BASE_URL}/api/tasks/${taskId}/events`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) return;
      const data = await response.json();
      const events = data.data?.events;
      if (events && events.length > 0) {
        const sorted = [...events].sort((a: any, b: any) =>
          (b.created_at || '').localeCompare(a.created_at || '')
        );
        const latest = sorted[0];
        setSelectedTaskCalendarEvent({
          eventId: latest.calendar_event_id,
          eventLink: latest.event_link || '',
        });
      }
    } catch (err) {
      console.warn('Failed to fetch task calendar event:', err)
    }
  };

  // 加入 / 更新 Google Calendar
  const handleAddToCalendar = async (taskId: string, options?: { startTime?: string; durationMinutes?: number; eventId?: string }): Promise<{ eventLink: string; meetLink?: string; eventId?: string } | null> => {
    const task = areas
      .flatMap((a) => a.products.flatMap((p) => p.tasks))
      .filter((t) => t != null)
      .find((t) => t.id === taskId);
    if (!task) return null;

    try {
      const headers = await getAuthHeaders();
      const durationMinutes = options?.durationMinutes || 60;
      const startTime = options?.startTime || "09:00";

      const dateStr = task.due_date || task.start_date;
      const date = dateStr ? new Date(dateStr) : new Date();
      const [hours, minutes] = startTime.split(':').map(Number);
      const start = new Date(date);
      start.setHours(hours, minutes, 0, 0);
      const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

      const startDateTime = start.toISOString();
      const endDateTime = end.toISOString();

      // 已有 eventId → 更新；否則建立
      if (options?.eventId) {
        const response = await fetch(`${API_BASE_URL}/api/calendar/update-event`, {
          method: 'PUT',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventId: options.eventId,
            summary: task.title,
            startDateTime,
            endDateTime,
          }),
        });
        if (!response.ok) throw new Error('Failed to update calendar event');
        const data = await response.json();
        return {
          eventLink: data.data?.eventLink || '',
          meetLink: data.data?.meetLink,
          eventId: options.eventId,
        };
      }

      const response = await fetch(`${API_BASE_URL}/api/calendar/create-event`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          summary: task.title,
          description: task.narrative || '',
          startDateTime,
          endDateTime,
          generateMeetLink: false,
          taskId,
        }),
      });
      if (!response.ok) throw new Error('Failed to create calendar event');
      const data = await response.json();
      const result = {
        eventLink: data.data?.eventLink || '',
        meetLink: data.data?.meetLink,
        eventId: data.data?.eventId,
      };
      if (result.eventId) {
        setSelectedTaskCalendarEvent({ eventId: result.eventId, eventLink: result.eventLink });
      }
      return result;
    } catch (err) {
      console.error('Failed to add/update calendar:', err);
      return null;
    }
  };

  // 編輯 Task 標題
  const handleEditTaskTitle = async (taskId: string, newTitle: string) => {
    if (!userId || !newTitle.trim()) return;

    // Optimistic update
    setAreas((prevAreas) => updateAreasState(prevAreas, (areas) =>
      areas.map((area) => ({
        ...area,
        products: area.products.map((product) => ({
          ...product,
          tasks: product.tasks.map((task) =>
            task.id === taskId ? { ...task, title: newTitle.trim() } : task
          ),
        })),
      }))
    ));

    // 同時更新 selectedTask
    if (selectedTask?.id === taskId) {
      setSelectedTask({ ...selectedTask, title: newTitle.trim() });
    }

    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch(`${API_BASE_URL}/api/tasks`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders
        },
        body: JSON.stringify({ taskId, content: newTitle.trim() }),
      });

      if (!res.ok) {
        throw new Error("更新失敗");
      }
    } catch (err) {
      console.error("Failed to edit task title:", err);
      alert("更新失敗，請稍後再試");
      // Revert on error
      const libraryRes = await fetch(`${API_BASE_URL}/api/library`, { headers: await getAuthHeaders() });
      if (libraryRes.ok) {
        const libraryData = await libraryRes.json();
        const cleanedAreas = cleanLibraryData(libraryData.data?.areas || []);
        setAreas(cleanedAreas);
        // 同時 revert selectedTask
        if (selectedTask?.id === taskId) {
          const task = cleanedAreas
            .flatMap((a: ApiArea) => a.products.flatMap((p: ApiProduct) => p.tasks))
            .filter((t: TaskCard) => t != null)
            .find((t: TaskCard) => t.id === taskId);
          if (task) {
            setSelectedTask(task);
          }
        }
      }
    }
  };

  // 編輯任務說明
  const handleEditNarrative = async (taskId: string, newNarrative: string) => {
    if (!userId) return;

    // Optimistic update
    setAreas((prevAreas) => updateAreasState(prevAreas, (areas) =>
      areas.map((area) => ({
        ...area,
        products: area.products.map((product) => ({
          ...product,
          tasks: product.tasks.map((task) =>
            task.id === taskId ? { ...task, narrative: newNarrative.trim() || null } : task
          ),
        })),
      }))
    ));

    // 同時更新 selectedTask
    if (selectedTask?.id === taskId) {
      setSelectedTask({ ...selectedTask, narrative: newNarrative.trim() || null });
    }

    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch(`${API_BASE_URL}/api/tasks`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders
        },
        body: JSON.stringify({ taskId, narrative: newNarrative.trim() }),
      });

      if (!res.ok) {
        throw new Error("更新失敗");
      }
    } catch (err) {
      console.error("Failed to edit narrative:", err);
      alert("更新說明失敗，請稍後再試");
      // Revert on error
      const libraryRes = await fetch(`${API_BASE_URL}/api/library`, { headers: await getAuthHeaders() });
      if (libraryRes.ok) {
        const libraryData = await libraryRes.json();
        const cleanedAreas = cleanLibraryData(libraryData.data?.areas || []);
        setAreas(cleanedAreas);
        // 同時 revert selectedTask
        if (selectedTask?.id === taskId) {
          const task = cleanedAreas
            .flatMap((a: ApiArea) => a.products.flatMap((p: ApiProduct) => p.tasks))
            .filter((t: TaskCard) => t != null)
            .find((t: TaskCard) => t.id === taskId);
          if (task) {
            setSelectedTask(task);
          }
        }
      }
    }
  };

  // 設定開始日期
  const handleSetStartDate = async (taskId: string) => {
    const task = areas
      .flatMap((a) => a.products.flatMap((p) => p.tasks))
      .filter((t) => t != null)
      .find((t) => t.id === taskId);
    if (task) {
      setEditingTaskForDueDate(task);
      setDateModalType("start");
      setIsDueDateModalOpen(true);
    }
  };

  // 切換 sub-item 完成狀態
  const handleToggleSubItem = async (taskId: string, subItemId: string, completed: boolean) => {
    try {
      // Optimistic update: 先更新 UI
      // 注意：library API 返回的資料中 sub_items 是直接放在 task 上，不是在 ai_analysis 裡
      setAreas(prevAreas => {
        return prevAreas.map(area => ({
          ...area,
          products: area.products?.map(product => ({
            ...product,
            tasks: product.tasks?.filter(task => task != null).map((task: TaskCard) => {
              if (task.id === taskId && task.sub_items) {
                const updatedSubItems = task.sub_items.filter((item: SubItem) => item != null).map((item: SubItem) =>
                  item.id === subItemId ? { ...item, completed } : item
                );
                const completedCount = updatedSubItems.filter((item: SubItem) => item && item.completed === true).length;
                const total = updatedSubItems.length;

                const updatedTask = {
                  ...task,
                  sub_items: updatedSubItems,
                  sub_items_meta: {
                    total,
                    completed: completedCount,
                    completion_rate: total > 0 ? completedCount / total : 0
                  }
                };

                // 同時更新 selectedTask
                if (selectedTask?.id === taskId) {
                  setSelectedTask(updatedTask);
                }

                return updatedTask;
              }
              return task;
            }) || []
          })) || []
        }));
      });

      // API call
      const authHeaders = await getAuthHeaders();
      const res = await fetch(`${API_BASE_URL}/api/tasks/${taskId}/sub-items/${subItemId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders
        },
        body: JSON.stringify({ task_id: taskId, sub_item_id: subItemId, completed }),
      });

      if (!res.ok) {
        throw new Error("更新失敗");
      }

      // 檢查是否所有 sub-items 都完成 (Task 自動歸檔)
      const result = await res.json();
      if (result.task_completed) {
        // Task 已自動歸檔,重新載入數據
        if (userId) {
          const libraryRes = await fetch(`${API_BASE_URL}/api/library`, { headers: await getAuthHeaders() });
          if (libraryRes.ok) {
            const libraryData = await libraryRes.json();
            setAreas(cleanLibraryData(libraryData.data?.areas || []));
          }
        }
      }
    } catch (err) {
      console.error("Failed to toggle sub-item:", err);
      // 錯誤時重新載入數據
      if (userId) {
        const libraryRes = await fetch(`${API_BASE_URL}/api/library`, { headers: await getAuthHeaders() });
        if (libraryRes.ok) {
          const libraryData = await libraryRes.json();
          setAreas(cleanLibraryData(libraryData.data?.areas || []));
        }
      }
    }
  };

  // 刪除 sub-item
  const handleDeleteSubItem = async (taskId: string, subItemId: string) => {
    try {
      // Optimistic update: 先更新 UI
      setAreas(prevAreas => {
        return prevAreas.map(area => ({
          ...area,
          products: area.products?.map(product => ({
            ...product,
            tasks: product.tasks?.filter(task => task != null).map((task: TaskCard) => {
              if (task.id === taskId && task.sub_items) {
                const updatedSubItems = task.sub_items.filter((item: SubItem) => item.id !== subItemId);
                const completedCount = updatedSubItems.filter((item: SubItem) => item && item.completed === true).length;
                const total = updatedSubItems.length;

                const updatedTask = {
                  ...task,
                  sub_items: updatedSubItems,
                  sub_items_meta: {
                    total,
                    completed: completedCount,
                    completion_rate: total > 0 ? completedCount / total : 0
                  }
                };

                // 同時更新 selectedTask
                if (selectedTask?.id === taskId) {
                  setSelectedTask(updatedTask);
                }

                return updatedTask;
              }
              return task;
            }) || []
          })) || []
        }));
      });

      // API call
      const authHeaders = await getAuthHeaders();
      const res = await fetch(`${API_BASE_URL}/api/tasks/${taskId}/sub-items/${subItemId}`, {
        method: "DELETE",
        headers: authHeaders
      });

      if (!res.ok) {
        throw new Error("刪除失敗");
      }
    } catch (err) {
      console.error("Failed to delete sub-item:", err);
      // 錯誤時重新載入數據
      if (userId) {
        const libraryRes = await fetch(`${API_BASE_URL}/api/library`, { headers: await getAuthHeaders() });
        if (libraryRes.ok) {
          const libraryData = await libraryRes.json();
          setAreas(cleanLibraryData(libraryData.data?.areas || []));
        }
      }
    }
  };

  // 升級 sub-item 為獨立 Task
  const handlePromoteSubItem = async (taskId: string, subItemId: string) => {
    try {
      // API call
      const authHeaders = await getAuthHeaders();
      const res = await fetch(`${API_BASE_URL}/api/tasks/${taskId}/sub-items/${subItemId}/promote`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders
        }
      });

      if (!res.ok) {
        throw new Error("升級失敗");
      }

      const result = await res.json();
      const { newTask, removedSubItemId, meta } = result.data;

      // 更新 UI：移除 sub-item 並加入新 Task
      setAreas(prevAreas => {
        return prevAreas.map(area => ({
          ...area,
          products: area.products?.map(product => {
            // 更新 parent task（移除 sub-item）
            let updatedTasks = product.tasks?.filter(task => task != null).map((task: TaskCard) => {
              if (task.id === taskId) {
                const updatedSubItems = task.sub_items?.filter(
                  (item: SubItem) => item.id !== removedSubItemId
                ) || [];

                const updatedTask = {
                  ...task,
                  sub_items: updatedSubItems,
                  sub_items_meta: meta,
                };

                // 同時更新 selectedTask
                if (selectedTask?.id === taskId) {
                  setSelectedTask(updatedTask);
                }

                return updatedTask;
              }
              return task;
            }) || [];

            // 如果新 Task 屬於這個 product，加入到 tasks 列表
            if (newTask.product_id === product.id) {
              const newTaskCard: TaskCard = {
                id: newTask.id,
                title: newTask.content,
                drawer: newTask.status,
                tag: {
                  area: area.name,
                  product: product.name,
                  topic: '',
                },
                sub_items: [],
                sub_items_meta: { total: 0, completed: 0, completion_rate: 0 },
                references: [],
                narrative: null,
                lifecycle: 'embryo',
                strategy_used: null,
                reasoning: null,
              };
              updatedTasks = [...updatedTasks, newTaskCard];
            }

            return { ...product, tasks: updatedTasks };
          }) || []
        }));
      });

      console.log(`Sub-item 已升級為獨立任務: ${newTask.content}`);
    } catch (err) {
      console.error("Failed to promote sub-item:", err);
      // 錯誤時重新載入數據
      if (userId) {
        const libraryRes = await fetch(`${API_BASE_URL}/api/library`, { headers: await getAuthHeaders() });
        if (libraryRes.ok) {
          const libraryData = await libraryRes.json();
          setAreas(cleanLibraryData(libraryData.data?.areas || []));
        }
      }
    }
  };

  // 移動 sub-item 到另一個 task
  const handleMoveSubItem = async (sourceTaskId: string, subItemId: string, targetTaskId: string) => {
    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch(`${API_BASE_URL}/api/tasks/${sourceTaskId}/sub-items/${subItemId}/move`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders
        },
        body: JSON.stringify({ target_task_id: targetTaskId })
      });

      if (!res.ok) {
        throw new Error("移動失敗");
      }

      // 移動成功後重新載入數據
      if (userId) {
        const libraryRes = await fetch(`${API_BASE_URL}/api/library`, { headers: await getAuthHeaders() });
        if (libraryRes.ok) {
          const libraryData = await libraryRes.json();
          const cleaned = cleanLibraryData(libraryData.data?.areas || []);
          setAreas(cleaned);

          // 更新 selectedTask
          if (selectedTask) {
            const updatedTask = cleaned
              .flatMap(a => a.products.flatMap(p => p.tasks))
              .find(t => t?.id === selectedTask.id);
            if (updatedTask) setSelectedTask(updatedTask);
          }
        }
      }
    } catch (err) {
      console.error("Failed to move sub-item:", err);
    }
  };

  // 編輯 sub-item 內容
  const handleEditSubItem = async (taskId: string, subItemId: string, updates: string | { content?: string; start_date?: string | null; due_date?: string | null }) => {
    // 支援舊的 string 格式（僅更新 content）和新的物件格式
    const updatePayload = typeof updates === 'string' ? { content: updates } : updates;

    try {
      // Optimistic update: 先更新 UI
      setAreas(prevAreas => {
        return prevAreas.map(area => ({
          ...area,
          products: area.products?.map(product => ({
            ...product,
            tasks: product.tasks?.filter(task => task != null).map((task: TaskCard) => {
              if (task.id === taskId && task.sub_items) {
                const updatedSubItems = task.sub_items.filter((item: SubItem) => item != null).map((item: SubItem) =>
                  item.id === subItemId ? { ...item, ...updatePayload } : item
                );

                const updatedTask = {
                  ...task,
                  sub_items: updatedSubItems,
                };

                // 同時更新 selectedTask
                if (selectedTask?.id === taskId) {
                  setSelectedTask(updatedTask);
                }

                return updatedTask;
              }
              return task;
            }) || []
          })) || []
        }));
      });

      // API call
      const authHeaders = await getAuthHeaders();
      const res = await fetch(`${API_BASE_URL}/api/tasks/${taskId}/sub-items/${subItemId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders
        },
        body: JSON.stringify(updatePayload),
      });

      if (!res.ok) {
        throw new Error("更新失敗");
      }
    } catch (err) {
      console.error("Failed to edit sub-item:", err);
      // 錯誤時重新載入數據
      if (userId) {
        const libraryRes = await fetch(`${API_BASE_URL}/api/library`, { headers: await getAuthHeaders() });
        if (libraryRes.ok) {
          const libraryData = await libraryRes.json();
          setAreas(cleanLibraryData(libraryData.data?.areas || []));
        }
      }
    }
  };

  // 新增 sub-item
  const handleAddSubItem = async (taskId: string, content: string) => {
    try {
      // API call 先執行（因為需要生成 ID）
      const authHeaders = await getAuthHeaders();
      const res = await fetch(`${API_BASE_URL}/api/tasks/${taskId}/sub-items`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders
        },
        body: JSON.stringify({ content }),
      });

      if (!res.ok) {
        throw new Error("新增失敗");
      }

      const result = await res.json();
      const newSubItem = result.data?.subItem || result.sub_item;

      // 更新 UI
      setAreas(prevAreas => {
        return prevAreas.map(area => ({
          ...area,
          products: area.products?.map(product => ({
            ...product,
            tasks: product.tasks?.filter(task => task != null).map((task: TaskCard) => {
              if (task.id === taskId) {
                const updatedSubItems = [...(task.sub_items || []), newSubItem];
                const completedCount = updatedSubItems.filter((item: SubItem) => item && item.completed === true).length;
                const total = updatedSubItems.length;

                const updatedTask = {
                  ...task,
                  sub_items: updatedSubItems,
                  sub_items_meta: {
                    total,
                    completed: completedCount,
                    completion_rate: total > 0 ? completedCount / total : 0
                  }
                };

                // 同時更新 selectedTask
                if (selectedTask?.id === taskId) {
                  setSelectedTask(updatedTask);
                }

                return updatedTask;
              }
              return task;
            }) || []
          })) || []
        }));
      });
    } catch (err) {
      console.error("Failed to add sub-item:", err);
      // 錯誤時重新載入數據
      if (userId) {
        const libraryRes = await fetch(`${API_BASE_URL}/api/library`, { headers: await getAuthHeaders() });
        if (libraryRes.ok) {
          const libraryData = await libraryRes.json();
          setAreas(cleanLibraryData(libraryData.data?.areas || []));
        }
      }
    }
  };

  // 重新排序 sub-items
  const handleReorderSubItems = async (taskId: string, subItemIds: string[]) => {
    try {
      // API call
      const authHeaders = await getAuthHeaders();
      const res = await fetch(`${API_BASE_URL}/api/tasks/${taskId}/sub-items`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders
        },
        body: JSON.stringify({ sub_item_ids: subItemIds }),
      });

      if (!res.ok) {
        throw new Error("重新排序失敗");
      }

      const result = await res.json();

      // 更新 UI
      setAreas(prevAreas => {
        return prevAreas.map(area => ({
          ...area,
          products: area.products?.map(product => ({
            ...product,
            tasks: product.tasks?.filter(task => task != null).map((task: TaskCard) => {
              if (task.id === taskId) {
                const updatedTask = {
                  ...task,
                  sub_items: result.sub_items,
                  sub_items_meta: result.sub_items_meta,
                };

                // 同時更新 selectedTask
                if (selectedTask?.id === taskId) {
                  setSelectedTask(updatedTask);
                }

                return updatedTask;
              }
              return task;
            }) || []
          })) || []
        }));
      });
    } catch (err) {
      console.error("Failed to reorder sub-items:", err);
    }
  };

  // 新增 reference
  const handleAddReference = async (taskId: string, type: "url" | "note", content: string, title?: string) => {
    try {
      // API call
      const authHeaders = await getAuthHeaders();
      const res = await fetch(`${API_BASE_URL}/api/tasks/${taskId}/references`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders
        },
        body: JSON.stringify({ type, content, title }),
      });

      if (!res.ok) {
        throw new Error("新增參考資料失敗");
      }

      const result = await res.json();
      const newReference = result.reference;

      // 更新 UI
      setAreas(prevAreas => {
        return prevAreas.map(area => ({
          ...area,
          products: area.products?.map(product => ({
            ...product,
            tasks: product.tasks?.filter(task => task != null).map((task: TaskCard) => {
              if (task.id === taskId) {
                return {
                  ...task,
                  references: [...(task.references || []), newReference]
                };
              }
              return task;
            }) || []
          })) || []
        }));
      });

      // 同時更新 selectedTask（使用函數式更新避免 stale closure）
      setSelectedTask(prev => {
        if (prev?.id === taskId) {
          return {
            ...prev,
            references: [...(prev.references || []), newReference]
          };
        }
        return prev;
      });
    } catch (err) {
      console.error("Failed to add reference:", err);
      alert("新增參考資料失敗，請稍後再試");
      // 錯誤時重新載入數據
      if (userId) {
        const libraryRes = await fetch(`${API_BASE_URL}/api/library`, { headers: await getAuthHeaders() });
        if (libraryRes.ok) {
          const libraryData = await libraryRes.json();
          setAreas(cleanLibraryData(libraryData.data?.areas || []));
        }
      }
      throw err; // 重新拋出錯誤以便 modal 知道失敗了
    }
  };

  // 刪除 reference
  const handleDeleteReference = async (taskId: string, referenceId: string) => {
    try {
      // Optimistic update: 先更新 UI
      setAreas(prevAreas => {
        return prevAreas.map(area => ({
          ...area,
          products: area.products?.map(product => ({
            ...product,
            tasks: product.tasks?.filter(task => task != null).map((task: TaskCard) => {
              if (task.id === taskId) {
                return {
                  ...task,
                  references: (task.references || []).filter((ref: Reference) => ref.id !== referenceId)
                };
              }
              return task;
            }) || []
          })) || []
        }));
      });

      // 同時更新 selectedTask（使用函數式更新避免 stale closure）
      setSelectedTask(prev => {
        if (prev?.id === taskId) {
          return {
            ...prev,
            references: (prev.references || []).filter((ref: Reference) => ref.id !== referenceId)
          };
        }
        return prev;
      });

      // API call
      const authHeaders = await getAuthHeaders();
      const res = await fetch(`${API_BASE_URL}/api/tasks/${taskId}/references?referenceId=${referenceId}`, {
        method: "DELETE",
        headers: authHeaders
      });

      if (!res.ok) {
        throw new Error("刪除參考資料失敗");
      }
    } catch (err) {
      console.error("Failed to delete reference:", err);
      alert("刪除參考資料失敗，請稍後再試");
      // 錯誤時重新載入數據
      if (userId) {
        const libraryRes = await fetch(`${API_BASE_URL}/api/library`, { headers: await getAuthHeaders() });
        if (libraryRes.ok) {
          const libraryData = await libraryRes.json();
          setAreas(cleanLibraryData(libraryData.data?.areas || []));
        }
      }
    }
  };

  // 重命名 Product
  const handleRenameProduct = async (productId: string, newName: string) => {
    if (!userId || !newName.trim()) return;

    // Optimistic update
    setAreas((prevAreas) => updateAreasState(prevAreas, (areas) =>
      areas.map((area) => ({
        ...area,
        products: area.products.map((product) =>
          product.id === productId
            ? { ...product, name: newName.trim() }
            : product
        ),
      }))
    ));

    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch(`${API_BASE_URL}/api/products/${productId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders
        },
        body: JSON.stringify({ name: newName.trim() }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "重命名失敗");
      }
    } catch (err) {
      console.error("Failed to rename product:", err);
      alert(err instanceof Error ? err.message : "重命名失敗，請稍後再試");
      // Revert on error
      const libraryRes = await fetch(`${API_BASE_URL}/api/library`, { headers: await getAuthHeaders() });
      if (libraryRes.ok) {
        const libraryData = await libraryRes.json();
        setAreas(cleanLibraryData(libraryData.data?.areas || []));
      }
    }
  };

  // AI 重組 Product Topics
  const handleReorganize = async (productId: string, productName: string) => {
    if (!userId) {
      alert("請先登入");
      return;
    }

    // ✅ 檢查是否已有快取的 proposal（重試時使用相同的 proposal）
    const cachedProposal = proposalCacheRef.current.get(productId);
    if (cachedProposal) {
      setReorganizeProposal(cachedProposal);
      setIsReorganizeModalOpen(true);
      return;
    }

    setIsReorganizing(true);
    setReorganizingProductId(productId);
    try {
      const res = await fetch(`${API_BASE_URL}/api/products/${productId}/reorganize-topics`, {
        method: "POST",
        headers: await getAuthHeaders(),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`重組分析失敗 (HTTP ${res.status}): ${errorText}`);
      }

      const proposal = await res.json();

      // 🔍 調試：打印 Web 端收到的數據
      console.log('🔍 [Web] task_consolidations:', proposal.task_consolidations);
      console.log('🔍 [Web] task_consolidations length:', proposal.task_consolidations?.length || 0);

      const fullProposal = { ...proposal, productId, productName };

      // ✅ 快取 proposal（只在成功時快取）
      proposalCacheRef.current.set(productId, fullProposal);

      setReorganizeProposal(fullProposal);
      setIsReorganizeModalOpen(true);
    } catch (err) {
      console.error("Failed to reorganize:", err);
      alert(`AI 分析失敗：${err instanceof Error ? err.message : "請稍後再試"}\n\n`);
    } finally {
      setIsReorganizing(false);
      setReorganizingProductId(null);
    }
  };

  // 應用 AI 重組建議
  const handleApplyReorganization = async (options?: { applyTopicOps: boolean; applyConsolidations: boolean }) => {
    if (!reorganizeProposal || !userId) return;

    setIsApplying(true); // ✅ 開始 applying loading
    try {
      const res = await fetch(`${API_BASE_URL}/api/products/${reorganizeProposal.product_id}/apply-reorganization`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await getAuthHeaders())
        },
        body: JSON.stringify({
          ...reorganizeProposal,
          apply_topic_operations: options?.applyTopicOps ?? true,
          apply_task_consolidations: options?.applyConsolidations ?? true,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.details || "應用重組失敗");
      }

      // 成功後清除該 product 的 proposal 快取
      proposalCacheRef.current.delete(reorganizeProposal.product_id);

      // ✅ 記錄最後重組的 product ID（用於還原功能）
      setLastReorganizedProductId(reorganizeProposal.product_id);

      // 重新載入數據
      const libraryRes = await fetch(`${API_BASE_URL}/api/library`, { headers: await getAuthHeaders() });
      if (libraryRes.ok) {
        const libraryData = await libraryRes.json();
        setAreas(cleanLibraryData(libraryData.data?.areas || []));
      }

      setIsReorganizeModalOpen(false);
      setReorganizeProposal(null);
    } catch (err) {
      console.error("Failed to apply reorganization:", err);
      alert(`應用失敗：${err instanceof Error ? err.message : "請稍後再試"}`);
      // ✅ 失敗時不清除 proposal，用戶可以重試
    } finally {
      setIsApplying(false); // ✅ 結束 applying loading
    }
  };

  // 還原上次重組
  const handleRestoreReorganization = async () => {
    if (!lastReorganizedProductId || !userId) return;

    const confirmed = window.confirm(
      "確定要還原上次的重組操作嗎？\n\n這將恢復最近 30 分鐘內被刪除的 Tasks（包含 references）。"
    );

    if (!confirmed) return;

    setIsRestoring(true);
    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch(
        `/api/products/${lastReorganizedProductId}/restore-recent-tasks`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...authHeaders
          },
          body: JSON.stringify({ minutes: 30 }),
        }
      );

      if (!res.ok) throw new Error("還原失敗");

      const data = await res.json();

      // 重新載入數據
      const libraryRes = await fetch(`${API_BASE_URL}/api/library`, { headers: await getAuthHeaders() });
      if (libraryRes.ok) {
        const libraryData = await libraryRes.json();
        setAreas(cleanLibraryData(libraryData.data?.areas || []));
      }

      // 清除記錄
      setLastReorganizedProductId(null);

      alert(`✅ 成功還原 ${data.restored_count} 個 Tasks`);
    } catch (err) {
      console.error("Failed to restore:", err);
      alert("還原失敗，請稍後再試");
    } finally {
      setIsRestoring(false);
    }
  };

  // 篩選顯示的 Areas，並在 showArchive 時合併近兩週完成的任務
  const displayAreas = useMemo(() => {
    const safeAreas = Array.isArray(areas) ? areas : [];
    const baseAreas = selectedArea ? safeAreas.filter((a) => a.name === selectedArea) : safeAreas;

    if (!showArchive || !Array.isArray(recentArchivedTasks) || recentArchivedTasks.length === 0) {
      return baseAreas;
    }

    // 建立 product_id -> archived tasks 的映射
    const archivedByProduct = new Map<string, TaskCard[]>();
    for (const task of recentArchivedTasks) {
      const productId = task.product_id;
      if (productId) {
        if (!archivedByProduct.has(productId)) {
          archivedByProduct.set(productId, []);
        }
        archivedByProduct.get(productId)!.push(task);
      }
    }

    // 合併到對應的 Product
    return baseAreas.map(area => ({
      ...area,
      products: (Array.isArray(area.products) ? area.products : []).map(product => {
        const archivedTasks = archivedByProduct.get(product.id) || [];
        if (archivedTasks.length === 0) return product;
        return {
          ...product,
          tasks: [...(Array.isArray(product.tasks) ? product.tasks : []), ...archivedTasks],
        };
      }),
    }));
  }, [selectedArea, areas, showArchive, recentArchivedTasks]);

  // 載入中
  if (isLoading && areas.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mx-auto mb-4" />
          <p className="text-white/50">載入資料中...</p>
        </div>
      </div>
    );
  }

  // 錯誤
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-white/80 mb-2">載入失敗</p>
          <p className="text-sm text-white/50">{error}</p>
        </div>
      </div>
    );
  }

  // 歡迎模式：新用戶沒有任務時顯示
  if (isWelcomeMode && !isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
        {/* Background Effects */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-indigo-500/20 rounded-full blur-3xl animate-pulse" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500/20 rounded-full blur-3xl animate-pulse" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />
        </div>

        {/* Minimal Header */}
        <header className="sticky top-0 z-50 bg-slate-900/80 backdrop-blur-xl border-b border-white/10">
          <div className="max-w-[1600px] mx-auto px-6 h-16 flex items-center justify-between">
            <h1 className="text-xl font-bold bg-gradient-to-r from-white via-white to-white/50 bg-clip-text text-transparent">
              Zentropy
            </h1>
            <button
              onClick={() => router.push("/settings")}
              className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-all"
              title="設定"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Centered Welcome Content */}
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-64px)] px-4">
          <div className="w-full max-w-xl text-center space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Welcome Message */}
            <div className="space-y-4">
              <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                <Sparkles className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-3xl font-bold text-white">
                嗨 {userName}！想到什麼就記下來
              </h2>
              <p className="text-lg text-white/60">
                AI 會自動幫你分類、整理、安排時間
              </p>
            </div>

            {/* Enlarged Input Area */}
            <QuickCapture
              userId={userId}
              areas={areas}
              welcomeMode={true}
              onItemsCreated={async () => {
                if (userId) {
                  const authHeaders = await getAuthHeaders();
                  const libraryRes = await fetch(`${API_BASE_URL}/api/library`, { headers: authHeaders });
                  if (libraryRes.ok) {
                    const libraryData = await libraryRes.json();
                    const areas = cleanLibraryData(libraryData.data?.areas || []);
                    setAreas(areas);
                    setExpandedAreas(new Set((Array.isArray(areas) ? areas : []).map((a: ApiArea) => a.name)));
                    // 離開歡迎模式，先顯示快速輸入引導
                    setIsWelcomeMode(false);
                    const guideShown = localStorage.getItem('quickInputGuideShown');
                    if (!guideShown) {
                      setTimeout(() => setShowQuickInputGuide(true), 500);
                    } else {
                      // 如果快速輸入引導已顯示過，直接顯示 AI 按鈕提示
                      const tipShown = localStorage.getItem('aiButtonTipShown');
                      if (!tipShown) {
                        setTimeout(() => setShowAIButtonTip(true), 1500);
                      }
                    }
                  }
                }
              }}
            />

            {/* Example Suggestions */}
            <div className="space-y-3">
              <p className="text-sm text-white/40">試試看：</p>
              <div className="flex flex-wrap justify-center gap-2">
                {[
                  "下週要交報告",
                  "買咖啡豆、洗衣精",
                  "跟老闆討論專案進度",
                ].map((example, i) => (
                  <span
                    key={i}
                    className="px-4 py-2 rounded-full bg-white/5 border border-white/10 text-sm text-white/50"
                  >
                    「{example}」
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
    >
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
        {/* Background Effects */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-indigo-500/20 rounded-full blur-3xl animate-pulse" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500/20 rounded-full blur-3xl animate-pulse" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />
        </div>

        {/* Quick Input Guide - 優先顯示 */}
        {showQuickInputGuide && (
          <QuickInputGuide
            onClose={() => {
              setShowQuickInputGuide(false);
              localStorage.setItem('quickInputGuideShown', 'true');
              // 關閉快速輸入引導後，顯示 AI 按鈕提示
              const tipShown = localStorage.getItem('aiButtonTipShown');
              if (!tipShown) {
                setTimeout(() => setShowAIButtonTip(true), 1000);
              }
            }}
          />
        )}

        {/* AI Button Tip Toast */}
        <AIButtonTip
          show={showAIButtonTip}
          onClose={() => setShowAIButtonTip(false)}
        />

        {/* Header */}
        <header className="sticky top-0 z-50 bg-slate-900/80 backdrop-blur-xl border-b border-white/10">
          <div className="max-w-[1600px] mx-auto px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-bold bg-gradient-to-r from-white via-white to-white/50 bg-clip-text text-transparent">
                Zentropy
              </h1>
              <span className="text-white/30 text-sm">|</span>
              <span className="text-white/60 text-sm">
                歡迎，<span className="font-medium text-white">{userName}</span>
              </span>
            </div>

            <div className="flex items-center gap-3">
              {/* 還原上次重組按鈕 */}
              {lastReorganizedProductId && (
                <button
                  onClick={handleRestoreReorganization}
                  disabled={isRestoring}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-300 hover:bg-yellow-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  title="還原最近一次重組操作"
                >
                  {isRestoring ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  <span className="text-sm font-medium">
                    {isRestoring ? "還原中..." : "還原上次重組"}
                  </span>
                </button>
              )}

              {/* 主題切換 */}
              <ThemeToggle />

              {/* 今日概覽 */}
              <TodayOverviewSheet
                completedTodayTasks={completedTodayTasks}
                onCompleteTask={handleCompleteTask}
                onOpenTask={(taskId, subTaskId) => {
                  const task = areas
                    .flatMap((a) => a.products.flatMap((p) => p.tasks))
                    .filter((t) => t != null)
                    .find((t) => t.id === taskId);
                  if (task) {
                    setInitialEditSubItemId(subTaskId || null);
                    setSelectedTask(task);
                    setSelectedTaskCalendarEvent(null);
                    setIsTaskDetailModalOpen(true);
                    fetchTaskCalendarEvent(task.id);
                  }
                }}
              />

              {/* 視圖切換按鈕 */}
              <div className="flex items-center gap-2 bg-white/5 rounded-lg p-1">
                <button
                  onClick={() => setViewMode("structure")}
                  className={`flex items-center gap-2 px-4 py-2 rounded-md transition-all ${
                    viewMode === "structure"
                      ? "bg-indigo-500/30 text-indigo-300"
                      : "text-white/60 hover:text-white hover:bg-white/10"
                  }`}
                >
                  <LayoutGrid className="w-4 h-4" />
                  <span className="text-sm font-medium">結構視圖</span>
                </button>
              <button
                onClick={() => setViewMode("timeline")}
                className={`flex items-center gap-2 px-4 py-2 rounded-md transition-all ${
                  viewMode === "timeline"
                    ? "bg-blue-500/30 text-blue-300"
                    : "text-white/60 hover:text-white hover:bg-white/10"
                }`}
              >
                <Clock className="w-4 h-4" />
                <span className="text-sm font-medium">時間視圖</span>
              </button>
              <button
                onClick={() => setViewMode("load")}
                className={`flex items-center gap-2 px-4 py-2 rounded-md transition-all ${
                  viewMode === "load"
                    ? "bg-purple-500/30 text-purple-300"
                    : "text-white/60 hover:text-white hover:bg-white/10"
                }`}
              >
                <Target className="w-4 h-4" />
                <span className="text-sm font-medium">負載視圖</span>
              </button>
            </div>


              {/* 設定按鈕 */}
              <button
                onClick={() => router.push("/settings")}
                className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-all"
                title="設定"
              >
                <Settings className="w-5 h-5" />
              </button>
            </div>
          </div>
        </header>

        <div className="max-w-[1600px] mx-auto px-6 py-8">
          <div className="flex gap-8">
            {/* Sidebar */}
            <aside className="w-72 shrink-0 h-[calc(100vh-136px)] sticky top-24 flex flex-col overflow-y-auto">
              <Card className="bg-white/5 border-white/10 backdrop-blur-xl shadow-xl shrink-0">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-white/50 uppercase tracking-wider">
                      身分地圖
                    </CardTitle>
                    <Button
                      onClick={() => {
                        setEditingArea(null);
                        setIsAreaModalOpen(true);
                      }}
                      size="sm"
                      className="h-7 px-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs"
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      新增
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-1">
                  {/* All Items */}
                  <button
                    onClick={() => setSelectedArea(null)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                      selectedArea === null
                        ? "bg-indigo-500/20 text-indigo-300"
                        : "hover:bg-white/10 text-white/60"
                    }`}
                  >
                    <Package className="w-4 h-4" />
                    <span className="font-medium">所有項目</span>
                    <span className="ml-auto text-xs bg-white/10 px-2 py-0.5 rounded-full">
                      {stats.total}
                    </span>
                  </button>

                  <div className="h-px bg-white/10 my-3" />

                  {/* Areas */}
                  {(Array.isArray(areas) ? areas : []).map((area) => {
                    const isExpanded = expandedAreas.has(area.name);
                    const taskCount = (Array.isArray(area.products) ? area.products : []).reduce(
                      (sum, p) => sum + (Array.isArray(p.tasks) ? p.tasks : []).filter((t) => t && (showArchive || t.drawer !== "ARCHIVE")).length,
                      0
                    );

                    return (
                      <div key={area.id} className="group">
                        <div className="relative flex items-center">
                          <button
                            onClick={() => {
                              toggleArea(area.name);
                              setSelectedArea(area.name);
                            }}
                            className={`flex-1 flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                              selectedArea === area.name
                                ? "bg-indigo-500/20 text-indigo-300"
                                : "hover:bg-white/10 text-white/60"
                            }`}
                          >
                            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                            <FolderOpen className="w-4 h-4" />
                            <span className="font-medium">{area.name}</span>
                            <span className="ml-auto text-xs bg-white/10 px-2 py-0.5 rounded-full">
                              {taskCount}
                            </span>
                          </button>

                          {/* Edit Button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingArea({
                                id: area.id,
                                name: area.name,
                                scope: area.scope,
                                description: area.description,
                                productCount: area.products?.length || 0,
                              });
                              setIsAreaModalOpen(true);
                            }}
                            className="absolute right-1 opacity-0 group-hover:opacity-100 p-1.5 rounded-md hover:bg-white/20 text-white/50 hover:text-white transition-all"
                            title="編輯身分"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {isExpanded && (
                          <div className="ml-8 mt-1 space-y-1">
                            {area.products.length > 0 ? (
                              area.products.map((product) => {
                                const productTaskCount = product.tasks.filter(
                                  (t) => t && (showArchive || t.drawer !== "ARCHIVE")
                                ).length;
                                return (
                                  <div
                                    key={product.id}
                                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-white/40"
                                  >
                                    <Package className="w-3.5 h-3.5" />
                                    <span>{product.name}</span>
                                    <span className="ml-auto text-xs">{productTaskCount}</span>
                                  </div>
                                );
                              })
                            ) : (
                              <div className="px-3 py-2 text-xs text-white/30 italic">
                                尚無專案，點擊右側查看此身分
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {areas.length === 0 && (
                    <div className="text-center py-8 text-white/30">
                      <FolderOpen className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">尚無身分資料</p>
                      <p className="text-xs mt-1">使用「腦內風暴」開始</p>
                    </div>
                  )}
                </CardContent>

                {/* Legend */}
                <div className="px-6 pb-4 pt-2 border-t border-white/10">
                  <p className="text-xs text-white/40 mb-2 font-medium">狀態圖例</p>
                  <div className="grid grid-cols-2 gap-1 mb-3">
                    {Object.entries(DRAWER_CONFIG)
                      .slice(0, 4)
                      .map(([key, config]) => (
                        <div key={key} className="flex items-center gap-1.5 text-xs text-white/50">
                          <div className={`w-2 h-2 rounded-full ${config.dotColor}`} />
                          <span>{config.label}</span>
                        </div>
                      ))}
                  </div>

                  {/* Show Archive Toggle */}
                  <button
                    onClick={() => {
                      const newState = !showArchive;
                      setShowArchive(newState);
                      if (newState && !archivedLoaded) {
                        loadRecentArchived();
                      }
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-all ${
                      showArchive
                        ? "bg-green-500/20 text-green-300"
                        : "bg-white/5 text-white/50 hover:bg-white/10"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Archive className="w-3.5 h-3.5" />
                      <span className="text-xs font-medium">近兩週完成</span>
                    </div>
                    <span className="text-xs bg-white/10 px-1.5 py-0.5 rounded-full">
                      {isLoadingArchived ? "..." : (archivedLoaded ? recentArchivedTasks.length : "?")}
                    </span>
                  </button>
                </div>
              </Card>

              {/* Milestone List */}
              <div className="mt-4">
                <MilestoneList
                  milestones={milestones}
                  onEdit={(milestone) => {
                    setEditingMilestone(milestone);
                    setIsMilestoneModalOpen(true);
                  }}
                  onDelete={async (milestoneId) => {
                    try {
                      const authHeaders = await getAuthHeaders();
                      const res = await fetch(`${API_BASE_URL}/api/milestones/${milestoneId}`, {
                        method: "DELETE",
                        headers: authHeaders
                      });
                      if (res.ok) {
                        await reloadMilestones();
                      }
                    } catch (err) {
                      console.error("Failed to delete milestone:", err);
                    }
                  }}
                />
              </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 min-w-0">
              {/* 視圖切換 */}
              {viewMode === "structure" && (
                <div className="space-y-8">
                  {(Array.isArray(displayAreas) ? displayAreas : []).map((area) => (
                    <div key={area.id}>
                      {/* Area Header (可放置 Product) */}
                      <DroppableAreaHeader
                        areaId={area.id}
                        areaName={area.name}
                        productCount={area.products.length}
                        taskCount={area.products.reduce(
                          (sum, p) => sum + p.tasks.filter((t) => t && (showArchive || t.drawer !== "ARCHIVE")).length,
                          0
                        )}
                        isOver={overDropId === `area-${area.id}`}
                        onAddProduct={() => {
                          setSelectedAreaForProduct({ id: area.id, name: area.name });
                          setIsProductModalOpen(true);
                        }}
                      />

                      {/* Products Grid */}
                      {area.products.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {area.products.map((product) => (
                            <DroppableProduct
                              key={product.id}
                              productId={product.id}
                              productName={product.name}
                              productDescription={product.description}
                              productLifecycle={product.lifecycle}
                              productStatus={product.status}
                              referenceCount={product.referenceCount}
                              tasks={showArchive ? product.tasks : product.tasks.filter((t) => t && t.drawer !== "ARCHIVE")}
                              isOver={overDropId === `product-${product.id}`}
                              milestones={milestones}
                              areaId={area.id}
                              onEditMilestone={(milestone) => {
                                if (milestone && 'id' in milestone && milestone.id) {
                                  // 編輯現有里程碑（完整的 Milestone）
                                  setEditingMilestone(milestone as Milestone);
                                } else if (milestone?.entity_id) {
                                  // 新增里程碑（預填 entity 信息）
                                  setEditingMilestone({
                                    entity_type: milestone.entity_type,
                                    entity_id: milestone.entity_id,
                                  } as Milestone);
                                } else {
                                  // 新增空白里程碑
                                  setEditingMilestone(null);
                                }
                                setIsMilestoneModalOpen(true);
                              }}
                              onSetDueDate={(task) => {
                                setEditingTaskForDueDate(task);
                                setIsDueDateModalOpen(true);
                              }}
                              onComplete={handleCompleteTask}
                              onReorganize={handleReorganize}
                              onToggleSubItem={handleToggleSubItem}
                              onDeleteSubItem={handleDeleteSubItem}
                              onPromoteSubItem={handlePromoteSubItem}
                              onEditSubItem={handleEditSubItem}
                              onAddSubItem={handleAddSubItem}
                              onDeleteReference={handleDeleteReference}
                              onRename={handleRenameProduct}
                              onEdit={(product) => {
                                setEditingProduct(product);
                                setProductDetailInitialTab("edit");
                                setIsProductDetailModalOpen(true);
                              }}
                              onShowReferences={(product) => {
                                setEditingProduct(product);
                                setProductDetailInitialTab("references");
                                setIsProductDetailModalOpen(true);
                              }}
                              onEditTaskTitle={handleEditTaskTitle}
                              onOpenTaskDetail={(task) => {
                                setInitialEditSubItemId(null);
                                setSelectedTask(task);
                                setSelectedTaskCalendarEvent(null);
                                setIsTaskDetailModalOpen(true);
                                fetchTaskCalendarEvent(task.id);
                              }}
                              onOpenSubItemDetail={(task: TaskCard, subItemId: string) => {
                                setInitialEditSubItemId(subItemId);
                                setSelectedTask(task);
                                setSelectedTaskCalendarEvent(null);
                                setIsTaskDetailModalOpen(true);
                                fetchTaskCalendarEvent(task.id);
                              }}
                              isReorganizing={reorganizingProductId === product.id}
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-xl border-2 border-dashed border-white/10 bg-white/5 p-12 text-center">
                          <div className="flex flex-col items-center gap-4">
                            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center">
                              <Package className="w-8 h-8 text-white/30" />
                            </div>
                            <div>
                              <h3 className="text-lg font-medium text-white/70 mb-2">
                                這個身分下還沒有專案
                              </h3>
                              <p className="text-sm text-white/40 mb-4">
                                點擊上方「新增專案」按鈕來創建第一個項目
                              </p>
                            </div>
                            <Button
                              onClick={() => {
                                setSelectedAreaForProduct({ id: area.id, name: area.name });
                                setIsProductModalOpen(true);
                              }}
                              className="bg-gradient-to-r from-indigo-600 to-indigo-600 hover:from-indigo-500 hover:to-indigo-500 text-white"
                            >
                              <Plus className="w-4 h-4 mr-2" />
                              立即新增
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}

                  {displayAreas.length === 0 && (
                    <div className="text-center py-16">
                      <FolderOpen className="w-16 h-16 mx-auto mb-4 text-white/20" />
                      <h3 className="text-lg font-medium text-white/70 mb-2">尚無資料</h3>
                      <p className="text-white/40 mb-4">使用「快速記錄」傾倒你的想法，AI 會幫你整理</p>
                    </div>
                  )}
                </div>
              )}

              {viewMode === "timeline" && (
                <TimelineView
                  tasks={areas
                    .flatMap((a) => a.products.flatMap((p) => p.tasks))
                    .filter((t) => t && (showArchive || t.drawer !== "ARCHIVE"))}
                  drawerConfig={DRAWER_CONFIG}
                  milestones={milestones}
                  onSetDueDate={(task) => {
                    setEditingTaskForDueDate(task);
                    setIsDueDateModalOpen(true);
                  }}
                />
              )}

              {viewMode === "load" && (
                <MilestoneLoadView
                  areas={(Array.isArray(areas) ? areas : []).map((area) => ({
                    ...area,
                    products: (Array.isArray(area.products) ? area.products : []).map((product) => ({
                      ...product,
                      tasks: product.tasks.filter((t) => t && (showArchive || t.drawer !== "ARCHIVE")),
                    })),
                  }))}
                  milestones={milestones}
                />
              )}
            </main>
          </div>
        </div>

        {/* Drag Overlay */}
        <DragOverlay>
          {activeTask ? (
            <DragOverlayTask task={activeTask} />
          ) : activeProduct ? (
            <DragOverlayProduct productName={activeProduct.name} />
          ) : null}
        </DragOverlay>

        {/* Milestone Modal */}
        <MilestoneModal
          isOpen={isMilestoneModalOpen}
          onClose={() => {
            setIsMilestoneModalOpen(false);
            setEditingMilestone(null);
          }}
          onSuccess={() => {
            reloadMilestones();
          }}
          userId={userId || ""}
          areas={areas}
          editingMilestone={editingMilestone}
        />

        {/* Product Modal */}
        <ProductModal
          isOpen={isProductModalOpen}
          onClose={() => {
            setIsProductModalOpen(false);
            setSelectedAreaForProduct(null);
            setEditingProduct(null);
          }}
          onSuccess={async () => {
            // 重新載入數據
            if (userId) {
              const libraryRes = await fetch(`${API_BASE_URL}/api/library`, { headers: await getAuthHeaders() });
              if (libraryRes.ok) {
                const libraryData = await libraryRes.json();
                setAreas(cleanLibraryData(libraryData.data?.areas || []));
              }
            }
          }}
          userId={userId || ""}
          areaId={selectedAreaForProduct?.id}
          areaName={selectedAreaForProduct?.name}
          editingProduct={editingProduct}
        />

        {/* Product Detail Modal (點擊標題開啟) */}
        <ProductDetailModal
          isOpen={isProductDetailModalOpen}
          onClose={() => {
            setIsProductDetailModalOpen(false);
            setEditingProduct(null);
            setProductDetailInitialTab("edit"); // 重置為預設 tab
          }}
          onSuccess={async () => {
            // 重新載入數據
            if (userId) {
              const libraryRes = await fetch(`${API_BASE_URL}/api/library`, { headers: await getAuthHeaders() });
              if (libraryRes.ok) {
                const libraryData = await libraryRes.json();
                setAreas(cleanLibraryData(libraryData.data?.areas || []));
              }
            }
          }}
          userId={userId || ""}
          product={editingProduct}
          initialTab={productDetailInitialTab}
          milestones={milestones}
          onMilestoneChange={reloadMilestones}
        />

        {/* Area Modal */}
        <AreaModal
          isOpen={isAreaModalOpen}
          onClose={() => {
            setIsAreaModalOpen(false);
            setEditingArea(null);
          }}
          onSuccess={async () => {
            // 重新載入數據
            if (userId) {
              const libraryRes = await fetch(`${API_BASE_URL}/api/library`, { headers: await getAuthHeaders() });
              if (libraryRes.ok) {
                const libraryData = await libraryRes.json();
                const areas = cleanLibraryData(libraryData.data?.areas || []);
                setAreas(areas);
                setExpandedAreas(new Set((Array.isArray(areas) ? areas : []).map((a: ApiArea) => a.name)));
              }
            }
          }}
          userId={userId || ""}
          editingArea={editingArea}
        />

        {/* Task Due Date Modal */}
        {editingTaskForDueDate && (
          <TaskDueDateModal
            isOpen={isDueDateModalOpen}
            onClose={() => {
              setIsDueDateModalOpen(false);
              setEditingTaskForDueDate(null);
              setDateModalType("due");
            }}
            onSuccess={async () => {
              // 重新載入數據
              if (userId) {
                const libraryRes = await fetch(`${API_BASE_URL}/api/library`, { headers: await getAuthHeaders() });
                if (libraryRes.ok) {
                  const libraryData = await libraryRes.json();
                  const areas = libraryData.data?.areas || [];
                  setAreas(areas);

                  // 同步更新 selectedTask（如果打開了詳情 modal）
                  if (selectedTask) {
                    const updatedTask = (Array.isArray(areas) ? areas : [])
                      .flatMap((a: ApiArea) => (Array.isArray(a.products) ? a.products : []).flatMap((p: ApiProduct) => Array.isArray(p.tasks) ? p.tasks : []))
                      .filter((t: TaskCard) => t != null)
                      .find((t: TaskCard) => t.id === selectedTask.id);
                    if (updatedTask) {
                      setSelectedTask(updatedTask);
                    }
                  }
                }
              }
            }}
            taskId={editingTaskForDueDate.id}
            taskTitle={editingTaskForDueDate.title}
            dateType={dateModalType}
            currentDueDate={editingTaskForDueDate.due_date}
            currentStartDate={editingTaskForDueDate.start_date}
          />
        )}

        {/* Reorganize Modal */}
        <ReorganizeModal
          isOpen={isReorganizeModalOpen}
          onClose={() => {
            setIsReorganizeModalOpen(false);
            // ✅ 不清除 proposal，保留快取以便重試
            // setReorganizeProposal(null);
          }}
          onApply={handleApplyReorganization}
          proposal={reorganizeProposal}
          isApplying={isApplying}
        />

        {/* Task Detail Modal */}
        {selectedTask && (
          <TaskDetailModal
            task={selectedTask}
            isOpen={isTaskDetailModalOpen}
            initialEditSubItemId={initialEditSubItemId}
            onClose={() => {
              setIsTaskDetailModalOpen(false);
              setSelectedTask(null);
              setInitialEditSubItemId(null);
            }}
            onEditTitle={handleEditTaskTitle}
            onEditNarrative={handleEditNarrative}
            onSetDueDate={(taskId) => {
              const task = areas
                .flatMap((a) => a.products.flatMap((p) => p.tasks))
                .filter((t) => t != null)
                .find((t) => t.id === taskId);
              if (task) {
                setEditingTaskForDueDate(task);
                setDateModalType("due");
                setIsDueDateModalOpen(true);
              }
            }}
            onSetStartDate={handleSetStartDate}
            onToggleSubItem={handleToggleSubItem}
            onAddSubItem={handleAddSubItem}
            onDeleteSubItem={handleDeleteSubItem}
            onPromoteSubItem={handlePromoteSubItem}
            onMoveSubItem={handleMoveSubItem}
            siblingTasks={
              areas
                .flatMap(a => a.products)
                .find(p => p.tasks?.some(t => t?.id === selectedTask?.id))
                ?.tasks?.filter(t => t != null && t.id !== selectedTask?.id)
                .map(t => ({ id: t.id, title: t.title })) || []
            }
            onEditSubItem={handleEditSubItem}
            onReorderSubItems={handleReorderSubItems}
            onAddReference={handleAddReference}
            onDeleteReference={handleDeleteReference}
            onComplete={handleCompleteTask}
            onDelete={handleDeleteTask}
            onStatusChange={handleTaskStatusChange}
            onProductChange={handleProductChange}
            onTopicChange={handleTopicChange}
            areas={(Array.isArray(areas) ? areas : []).map((area) => ({
              id: area.id,
              name: area.name,
              products: (Array.isArray(area.products) ? area.products : []).map((p) => ({
                id: p.id,
                name: p.name,
                topics: p.topics || [],
              })),
            }))}
            onAddToCalendar={handleAddToCalendar}
            isCalendarConnected={calendarConnected}
            calendarEvent={selectedTaskCalendarEvent}
          />
        )}

        {/* Product Suggestion Modal */}
        {showProductSuggestionModal && productSuggestion && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => {
                setShowProductSuggestionModal(false);
                setProductSuggestion(null);
              }}
            />

            {/* Modal */}
            <Card className="relative w-full max-w-lg mx-4 bg-slate-900 border-white/10 shadow-2xl">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-gradient-to-r from-teal-900/30 to-cyan-900/30">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-white">AI 推薦專案名稱</h2>
                    <p className="text-sm text-white/50">
                      為「{productSuggestion.taskContent}」建立專案
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowProductSuggestionModal(false);
                    setProductSuggestion(null);
                  }}
                  className="text-white/50 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Content */}
              <div className="px-6 py-5 space-y-4">
                {/* AI 分析 */}
                <div>
                  <p className="text-xs text-white/50 mb-2 font-medium uppercase tracking-wider">AI 分析</p>
                  <div className="p-3 rounded-lg bg-teal-500/10 border border-teal-500/20">
                    <p className="text-sm text-white/90">{productSuggestion.reasoning}</p>
                  </div>
                </div>

                {/* 推薦名稱 */}
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">
                    推薦的專案名稱
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 px-4 py-3 rounded-lg bg-white/5 border-2 border-teal-500/50 text-white font-medium">
                      {productSuggestion.suggestedName}
                    </div>
                    <Button
                      onClick={() => handleConfirmProductSuggestion(productSuggestion.suggestedName)}
                      className="bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 text-white"
                    >
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      使用此名稱
                    </Button>
                  </div>
                </div>

                {/* 其他選項 */}
                {productSuggestion.alternatives && productSuggestion.alternatives.length > 0 && (
                  <div>
                    <p className="text-xs text-white/50 mb-2 font-medium uppercase tracking-wider">其他建議</p>
                    <div className="grid grid-cols-2 gap-2">
                      {productSuggestion.alternatives.map((alt, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleConfirmProductSuggestion(alt)}
                          className="px-3 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 hover:border-teal-500/50 text-white text-sm transition-all"
                        >
                          {alt}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* 自訂名稱 */}
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">
                    或自訂名稱
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      id="custom-product-name"
                      placeholder="輸入專案名稱..."
                      className="flex-1 px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                    />
                    <Button
                      onClick={() => {
                        const input = document.getElementById("custom-product-name") as HTMLInputElement;
                        if (input && input.value.trim()) {
                          handleConfirmProductSuggestion(input.value.trim());
                        }
                      }}
                      variant="outline"
                      className="border-white/20 bg-white/5 hover:bg-white/10 text-white"
                    >
                      確認
                    </Button>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-white/10 bg-white/5 flex items-center justify-between">
                <p className="text-xs text-white/40">
                  目標：{productSuggestion.areaName}
                </p>
                <Button
                  onClick={() => {
                    setShowProductSuggestionModal(false);
                    setProductSuggestion(null);
                  }}
                  variant="outline"
                  className="border-white/10 bg-white/5 hover:bg-white/10 text-white"
                >
                  取消
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* Task Merge Confirm Modal */}
        {showMergeConfirmModal && pendingMerge && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={handleCancelMerge}
            />

            {/* Modal */}
            <Card className="relative w-full max-w-lg mx-4 bg-slate-900 border-white/10 shadow-2xl">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-gradient-to-r from-indigo-900/30 to-indigo-900/30">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center">
                    <Target className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-white">合併為待辦事項</h2>
                    <p className="text-sm text-white/50">
                      將任務合併到另一個任務的 todo list 中
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleCancelMerge}
                  className="text-white/50 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Content */}
              <div className="px-6 py-5 space-y-4">
                {/* 來源任務 */}
                <div>
                  <p className="text-xs text-white/50 mb-2 font-medium uppercase tracking-wider">要移動的任務</p>
                  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                    <p className="text-sm text-white font-medium">{pendingMerge.sourceTask.title}</p>
                    <p className="text-xs text-white/50 mt-1">
                      {pendingMerge.sourceTask.tag.area} → {pendingMerge.sourceTask.tag.product}
                    </p>
                  </div>
                </div>

                {/* 箭頭 */}
                <div className="flex justify-center">
                  <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center">
                    <ChevronDown className="w-5 h-5 text-indigo-400" />
                  </div>
                </div>

                {/* 目標任務 */}
                <div>
                  <p className="text-xs text-white/50 mb-2 font-medium uppercase tracking-wider">合併到</p>
                  <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                    <p className="text-sm text-white font-medium">{pendingMerge.targetTask.title}</p>
                    <p className="text-xs text-white/50 mt-1">
                      {pendingMerge.targetTask.tag.area} → {pendingMerge.targetTask.tag.product}
                    </p>
                    {pendingMerge.targetTask.sub_items && pendingMerge.targetTask.sub_items.length > 0 && (
                      <p className="text-xs text-indigo-400 mt-2">
                        目前有 {pendingMerge.targetTask.sub_items.length} 個待辦事項
                      </p>
                    )}
                  </div>
                </div>

                {/* 說明 */}
                <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                  <p className="text-xs text-white/60">
                    合併後，「{pendingMerge.sourceTask.title}」將成為「{pendingMerge.targetTask.title}」的一個待辦事項，原任務將被刪除。
                  </p>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-white/10 bg-white/5 flex items-center justify-end gap-3">
                <Button
                  onClick={handleCancelMerge}
                  variant="outline"
                  className="border-white/10 bg-white/5 hover:bg-white/10 text-white"
                >
                  取消
                </Button>
                <Button
                  onClick={handleConfirmMerge}
                  disabled={isMerging}
                  className="bg-gradient-to-r from-indigo-600 to-indigo-600 hover:from-indigo-500 hover:to-indigo-500 text-white"
                >
                  {isMerging ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      合併中...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      確認合併
                    </>
                  )}
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* 完成回饋 Toast */}
        {completionFeedback && (
          <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-green-500/90 text-white shadow-lg backdrop-blur-sm">
              <CheckCircle2 className="w-5 h-5" />
              <span className="font-medium">{completionFeedback}</span>
            </div>
          </div>
        )}

        {/* 浮動快速輸入 */}
        <QuickCapture
          userId={userId}
          areas={areas}
          onItemsCreated={async () => {
            // 重新載入數據
            if (userId) {
              const libraryRes = await fetch(`${API_BASE_URL}/api/library`, { headers: await getAuthHeaders() });
              if (libraryRes.ok) {
                const libraryData = await libraryRes.json();
                const areas = cleanLibraryData(libraryData.data?.areas || []);
                setAreas(areas);
                setExpandedAreas(new Set((Array.isArray(areas) ? areas : []).map((a: ApiArea) => a.name)));
              }
            }
          }}
        />
      </div>
    </DndContext>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
