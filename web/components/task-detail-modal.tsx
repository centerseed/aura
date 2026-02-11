"use client";

import { useState, useEffect, useRef } from "react";
import { X, Calendar, AlertCircle, Plus, Circle, CheckCircle, Trash2, Edit2, ExternalLink, FileText, Loader2, GripVertical, ArrowUpCircle, ClipboardList, Rocket, RefreshCw, BookOpen, Archive, ChevronDown, Bell, CalendarPlus, Link2, MoveRight } from "lucide-react";
import type { DrawerStatus } from "@/types";
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
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { TaskCard, SubItem, Reference } from "@/types";

interface TaskDetailModalProps {
  task: TaskCard;
  isOpen: boolean;
  onClose: () => void;
  onEditTitle?: (taskId: string, newTitle: string) => void;
  onEditNarrative?: (taskId: string, newNarrative: string) => void;
  onSetDueDate?: (taskId: string) => void;
  onSetStartDate?: (taskId: string) => void;
  onToggleSubItem?: (taskId: string, subItemId: string, completed: boolean) => void;
  onAddSubItem?: (taskId: string, content: string) => void;
  onDeleteSubItem?: (taskId: string, subItemId: string) => void;
  onEditSubItem?: (taskId: string, subItemId: string, updates: string | { content?: string; start_date?: string | null; due_date?: string | null }) => void;
  onReorderSubItems?: (taskId: string, subItemIds: string[]) => Promise<void>;
  onPromoteSubItem?: (taskId: string, subItemId: string) => Promise<void>;
  onMoveSubItem?: (sourceTaskId: string, subItemId: string, targetTaskId: string) => Promise<void>;
  siblingTasks?: { id: string; title: string }[];
  onAddReference?: (taskId: string, type: "url" | "note", content: string, title?: string) => Promise<void>;
  onDeleteReference?: (taskId: string, referenceId: string) => void;
  onComplete?: (taskId: string) => void;
  onDelete?: (taskId: string) => void;
  onStatusChange?: (taskId: string, newStatus: DrawerStatus) => void;
  onAddToCalendar?: (taskId: string) => Promise<{ eventLink: string; meetLink?: string } | null>;
  onSetReminder?: (taskId: string, reminderType: "calendar" | "notification", minutesBefore: number) => Promise<boolean>;
  isCalendarConnected?: boolean;
  initialEditSubItemId?: string | null;
}

// 計算相對時間描述（與 draggable-task-item 相同邏輯）
function getRelativeTimeDesc(dueDate: Date): { text: string; isOverdue: boolean; isUrgent: boolean } {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const due = new Date(dueDate)
  due.setHours(0, 0, 0, 0)
  const diffMs = due.getTime() - now.getTime()
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays < 0) return { text: `逾期 ${Math.abs(diffDays)} 天`, isOverdue: true, isUrgent: true }
  if (diffDays === 0) return { text: '今天', isOverdue: false, isUrgent: true }
  if (diffDays === 1) return { text: '明天', isOverdue: false, isUrgent: true }
  if (diffDays <= 3) return { text: `${diffDays} 天後`, isOverdue: false, isUrgent: true }
  if (diffDays <= 7) return { text: `${diffDays} 天後`, isOverdue: false, isUrgent: false }
  if (diffDays <= 14) return { text: '下週', isOverdue: false, isUrgent: false }
  if (diffDays <= 30) return { text: `${Math.floor(diffDays / 7)} 週後`, isOverdue: false, isUrgent: false }
  return { text: `${Math.floor(diffDays / 30)} 個月後`, isOverdue: false, isUrgent: false }
}

// 可拖拽的子項目組件
function SortableSubItem({
  item,
  onToggle,
  onOpenDialog,
}: {
  item: SubItem;
  onToggle: (id: string, completed: boolean) => void;
  onOpenDialog: (item: SubItem) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex items-center gap-2 ${isDragging ? 'opacity-50' : ''}`}
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing p-1"
      >
        <GripVertical className="w-4 h-4 text-white/20 group-hover:text-white/40" />
      </div>

      {/* Checkbox toggle */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggle(item.id, !item.completed);
        }}
        className="shrink-0 p-1"
      >
        {item.completed ? (
          <CheckCircle className="w-5 h-5 text-green-400" />
        ) : (
          <Circle className="w-5 h-5 text-white/30 hover:text-white/50 transition-colors" />
        )}
      </button>

      {/* Content - click to open dialog */}
      <button
        onClick={() => onOpenDialog(item)}
        className="flex-1 px-2 py-2 rounded-lg hover:bg-white/5 transition-colors text-left"
      >
        <span
          className={`text-sm ${
            item.completed
              ? "line-through text-white/40"
              : "text-white/80"
          }`}
        >
          {item.content}
        </span>
        {item.due_date && (() => {
          const info = getRelativeTimeDesc(new Date(item.due_date!))
          return (
            <span
              className={`ml-2 inline-flex items-center gap-0.5 px-1.5 py-0 rounded text-[10px] shrink-0
                ${info.isOverdue
                  ? 'bg-red-500/20 text-red-400'
                  : info.isUrgent
                    ? 'bg-orange-500/20 text-orange-400'
                    : 'bg-blue-500/20 text-blue-400'
                }`}
            >
              {info.isOverdue ? <AlertCircle className="w-2.5 h-2.5" /> : <Calendar className="w-2.5 h-2.5" />}
              {info.text}
            </span>
          )
        })()}
      </button>

      {/* Edit icon hint */}
      <div className="opacity-0 group-hover:opacity-100 p-1 text-white/30 transition-all">
        <Edit2 className="w-3.5 h-3.5" />
      </div>
    </div>
  );
}

export function TaskDetailModal({
  task,
  isOpen,
  onClose,
  onEditTitle,
  onEditNarrative,
  onSetDueDate,
  onSetStartDate,
  onToggleSubItem,
  onAddSubItem,
  onDeleteSubItem,
  onEditSubItem,
  onReorderSubItems,
  onPromoteSubItem,
  onMoveSubItem,
  siblingTasks,
  onAddReference,
  onDeleteReference,
  onComplete,
  onDelete,
  onStatusChange,
  onAddToCalendar,
  onSetReminder,
  isCalendarConnected,
  initialEditSubItemId,
}: TaskDetailModalProps) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [editingNarrative, setEditingNarrative] = useState(false);
  const [narrative, setNarrative] = useState(task.narrative || "");
  const [isAddingSubItem, setIsAddingSubItem] = useState(false);
  const [newSubItemContent, setNewSubItemContent] = useState("");
  const [editingSubItemId, setEditingSubItemId] = useState<string | null>(null);
  const [editSubItemContent, setEditSubItemContent] = useState("");
  const [isAddingReference, setIsAddingReference] = useState(false);
  const [isSubmittingReference, setIsSubmittingReference] = useState(false);
  const [newRefType, setNewRefType] = useState<"url" | "note">("url");
  const [newRefContent, setNewRefContent] = useState("");
  const [newRefTitle, setNewRefTitle] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [subItems, setSubItems] = useState<SubItem[]>(task.sub_items || []);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [isAddingToCalendar, setIsAddingToCalendar] = useState(false);
  const [calendarEventLink, setCalendarEventLink] = useState<string | null>(null);
  const [showReminderOptions, setShowReminderOptions] = useState(false);
  const [isSettingReminder, setIsSettingReminder] = useState(false);
  const [editDialogSubItem, setEditDialogSubItem] = useState<SubItem | null>(null);
  const [editDialogContent, setEditDialogContent] = useState("");
  const [editDialogStartDate, setEditDialogStartDate] = useState("");
  const [editDialogDueDate, setEditDialogDueDate] = useState("");
  const startDateRef = useRef<HTMLInputElement>(null);
  const dueDateRef = useRef<HTMLInputElement>(null);
  const [editDialogTab, setEditDialogTab] = useState<"edit" | "move">("edit");
  const [moveTargetTaskId, setMoveTargetTaskId] = useState<string>("");
  const [isMoving, setIsMoving] = useState(false);
  const [isPromoting, setIsPromoting] = useState(false);

  // 從外部直接打開某個 sub-item 的編輯對話框
  useEffect(() => {
    if (initialEditSubItemId && isOpen) {
      const subItem = subItems.find((s) => s.id === initialEditSubItemId);
      if (subItem) {
        setEditDialogSubItem(subItem);
        setEditDialogContent(subItem.content);
        setEditDialogStartDate(subItem.start_date ? subItem.start_date.slice(0, 10) : "");
        setEditDialogDueDate(subItem.due_date ? subItem.due_date.slice(0, 10) : "");
        setMoveTargetTaskId("");
      }
    }
  }, [initialEditSubItemId, isOpen]);

  // 拖拽設置
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // 同步 task prop 的變化
  useEffect(() => {
    setTitle(task.title);
    setNarrative(task.narrative || "");
    setSubItems(task.sub_items || []);
  }, [task.title, task.narrative, task.start_date, task.due_date, task.id, task.sub_items]);

  if (!isOpen) return null;

  const handleSaveTitle = () => {
    if (title.trim() && title !== task.title) {
      onEditTitle?.(task.id, title.trim());
    }
    setEditingTitle(false);
  };

  const handleSaveNarrative = () => {
    if (narrative.trim() !== (task.narrative || "")) {
      onEditNarrative?.(task.id, narrative.trim());
    }
    setEditingNarrative(false);
  };

  const handleAddSubItem = () => {
    if (newSubItemContent.trim()) {
      onAddSubItem?.(task.id, newSubItemContent.trim());
      setNewSubItemContent("");
      setIsAddingSubItem(false);
    }
  };

  const handleEditSubItem = (subItemId: string) => {
    if (editSubItemContent.trim()) {
      onEditSubItem?.(task.id, subItemId, editSubItemContent.trim());
      setEditingSubItemId(null);
      setEditSubItemContent("");
    }
  };

  const handleAddReference = async () => {
    if (!newRefContent.trim()) return;

    setIsSubmittingReference(true);
    try {
      await onAddReference?.(task.id, newRefType, newRefContent.trim(), newRefTitle.trim() || undefined);
      setNewRefContent("");
      setNewRefTitle("");
      setIsAddingReference(false);
    } catch (error) {
      console.error("Failed to add reference:", error);
    } finally {
      setIsSubmittingReference(false);
    }
  };

  // 拖拽事件處理
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = subItems.findIndex((item) => item.id === active.id);
      const newIndex = subItems.findIndex((item) => item.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const newSubItems = arrayMove(subItems, oldIndex, newIndex);
        setSubItems(newSubItems);

        // 調用回調函數以保存新順序
        try {
          await onReorderSubItems?.(task.id, newSubItems.map((item) => item.id));
        } catch (error) {
          console.error("Failed to reorder sub-items:", error);
          // 恢復原始順序
          setSubItems(task.sub_items || []);
        }
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col border border-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-white/10">
          <div className="flex-1 mr-4">
            {editingTitle ? (
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={handleSaveTitle}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveTitle();
                  if (e.key === "Escape") {
                    setTitle(task.title);
                    setEditingTitle(false);
                  }
                }}
                autoFocus
                className="w-full text-2xl font-semibold bg-transparent border-b-2 border-indigo-400 text-white focus:outline-none"
              />
            ) : (
              <h2
                className="text-2xl font-semibold text-white cursor-pointer hover:text-indigo-300 transition-colors"
                onClick={() => setEditingTitle(true)}
              >
                {task.title}
              </h2>
            )}
            <div className="flex items-center gap-2 mt-2 text-sm text-white/60">
              <span>{task.tag.area}</span>
              <span>→</span>
              <span>{task.tag.product}</span>
              <span>→</span>
              <span>{task.tag.topic}</span>
            </div>
            {/* Status Badge */}
            {onStatusChange && (
              <div className="relative mt-3">
                <button
                  onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    {
                      INBOX: "bg-amber-500/20 text-amber-400 border border-amber-500/30",
                      ACTIVE: "bg-blue-500/20 text-blue-400 border border-blue-500/30",
                      MAINTAIN: "bg-purple-500/20 text-purple-400 border border-purple-500/30",
                      REFERENCE: "bg-green-500/20 text-green-400 border border-green-500/30",
                      ARCHIVE: "bg-slate-500/20 text-slate-400 border border-slate-500/30",
                    }[task.drawer]
                  }`}
                >
                  {({ INBOX: ClipboardList, ACTIVE: Rocket, MAINTAIN: RefreshCw, REFERENCE: BookOpen, ARCHIVE: Archive } as Record<string, typeof ClipboardList>)[task.drawer] &&
                    (() => { const Icon = ({ INBOX: ClipboardList, ACTIVE: Rocket, MAINTAIN: RefreshCw, REFERENCE: BookOpen, ARCHIVE: Archive } as Record<string, typeof ClipboardList>)[task.drawer]; return <Icon className="w-3.5 h-3.5" />; })()}
                  {{ INBOX: "規劃中", ACTIVE: "進行中", MAINTAIN: "維護中", REFERENCE: "參考資料", ARCHIVE: "已歸檔" }[task.drawer]}
                  <ChevronDown className="w-3 h-3" />
                </button>
                {showStatusDropdown && (
                  <div className="absolute top-full left-0 mt-1 z-10 bg-slate-800 border border-white/10 rounded-lg shadow-xl overflow-hidden min-w-[160px]">
                    {([
                      { id: "INBOX" as DrawerStatus, label: "規劃中", icon: ClipboardList, color: "text-amber-400" },
                      { id: "ACTIVE" as DrawerStatus, label: "進行中", icon: Rocket, color: "text-blue-400" },
                      { id: "MAINTAIN" as DrawerStatus, label: "維護中", icon: RefreshCw, color: "text-purple-400" },
                      { id: "REFERENCE" as DrawerStatus, label: "參考資料", icon: BookOpen, color: "text-green-400" },
                      { id: "ARCHIVE" as DrawerStatus, label: "已歸檔", icon: Archive, color: "text-slate-400" },
                    ]).map(({ id, label, icon: StatusIcon, color }) => (
                      <button
                        key={id}
                        onClick={() => {
                          if (id !== task.drawer) onStatusChange(task.id, id);
                          setShowStatusDropdown(false);
                        }}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/10 transition-colors ${
                          id === task.drawer ? "bg-white/5 font-medium" : ""
                        }`}
                      >
                        <StatusIcon className={`w-4 h-4 ${color}`} />
                        <span className="text-white/80">{label}</span>
                        {id === task.drawer && <CheckCircle className="w-3.5 h-3.5 ml-auto text-indigo-400" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content - Left/Right Split */}
        <div className="flex-1 overflow-hidden flex">
          {/* Left Column - Main Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm font-medium text-white/80 mb-2">開始日期</h3>
                <button
                  onClick={() => onSetStartDate?.(task.id)}
                  className="w-full flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 hover:border-indigo-400/50 hover:bg-white/10 transition-colors"
                >
                  <Calendar className="w-4 h-4 text-white/60" />
                  <span className="text-sm text-white/80">
                    {task.start_date ? new Date(task.start_date).toLocaleDateString('zh-TW') : "設定日期"}
                  </span>
                </button>
              </div>
              <div>
                <h3 className="text-sm font-medium text-white/80 mb-2">截止日期</h3>
                <button
                  onClick={() => onSetDueDate?.(task.id)}
                  className="w-full flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 hover:border-indigo-400/50 hover:bg-white/10 transition-colors"
                >
                  <Calendar className="w-4 h-4 text-white/60" />
                  <span className="text-sm text-white/80">
                    {task.due_date ? new Date(task.due_date).toLocaleDateString('zh-TW') : "設定日期"}
                  </span>
                </button>
              </div>
            </div>

            {/* Calendar & Reminder Actions */}
            {(onAddToCalendar || onSetReminder) && (
              <div className="flex gap-3">
                {onAddToCalendar && (
                  <div className="flex-1">
                    {calendarEventLink ? (
                      <a
                        href={calendarEventLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 hover:bg-green-500/20 transition-colors text-sm"
                      >
                        <Link2 className="w-4 h-4" />
                        查看日曆事件
                      </a>
                    ) : (
                      <button
                        onClick={async () => {
                          if (!task.start_date && !task.due_date) {
                            alert("請先設定開始日期或截止日期");
                            return;
                          }
                          if (!isCalendarConnected) {
                            alert("請先在設定頁面連接 Google Calendar");
                            return;
                          }
                          setIsAddingToCalendar(true);
                          try {
                            const result = await onAddToCalendar(task.id);
                            if (result) {
                              setCalendarEventLink(result.eventLink);
                            }
                          } catch {
                            alert("加入日曆失敗，請稍後再試");
                          } finally {
                            setIsAddingToCalendar(false);
                          }
                        }}
                        disabled={isAddingToCalendar}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 hover:border-blue-400/50 hover:bg-white/10 transition-colors text-sm text-white/80 disabled:opacity-50"
                      >
                        {isAddingToCalendar ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <CalendarPlus className="w-4 h-4 text-blue-400" />
                        )}
                        {isAddingToCalendar ? "加入中..." : "加入日曆"}
                      </button>
                    )}
                  </div>
                )}
                {onSetReminder && (
                  <div className="relative flex-1">
                    <button
                      onClick={() => setShowReminderOptions(!showReminderOptions)}
                      disabled={isSettingReminder}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 hover:border-amber-400/50 hover:bg-white/10 transition-colors text-sm text-white/80 disabled:opacity-50"
                    >
                      {isSettingReminder ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Bell className="w-4 h-4 text-amber-400" />
                      )}
                      {isSettingReminder ? "設定中..." : "設定提醒"}
                    </button>
                    {showReminderOptions && (
                      <div className="absolute top-full left-0 right-0 mt-1 z-10 bg-slate-800 border border-white/10 rounded-lg shadow-xl overflow-hidden">
                        {[
                          { label: "15 分鐘前", minutes: 15 },
                          { label: "1 小時前", minutes: 60 },
                          { label: "1 天前", minutes: 1440 },
                        ].map(({ label, minutes }) => (
                          <button
                            key={minutes}
                            onClick={async () => {
                              if (!task.due_date) {
                                alert("請先設定截止日期");
                                return;
                              }
                              setIsSettingReminder(true);
                              setShowReminderOptions(false);
                              try {
                                const success = await onSetReminder(
                                  task.id,
                                  isCalendarConnected ? "calendar" : "notification",
                                  minutes
                                );
                                if (success) {
                                  alert("提醒已設定");
                                }
                              } catch {
                                alert("設定提醒失敗");
                              } finally {
                                setIsSettingReminder(false);
                              }
                            }}
                            className="w-full px-3 py-2 text-sm text-white/80 hover:bg-white/10 transition-colors text-left"
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Narrative */}
            <div>
              <h3 className="text-sm font-medium text-white/80 mb-2">說明</h3>
              {editingNarrative ? (
                <textarea
                  value={narrative}
                  onChange={(e) => setNarrative(e.target.value)}
                  onBlur={handleSaveNarrative}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      setNarrative(task.narrative || "");
                      setEditingNarrative(false);
                    }
                  }}
                  autoFocus
                  rows={4}
                  className="w-full px-4 py-3 text-sm rounded-lg bg-white/5 border border-indigo-400/50 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-400/50 resize-none"
                  placeholder="輸入任務說明..."
                />
              ) : (
                <div
                  onClick={() => setEditingNarrative(true)}
                  className="px-4 py-3 text-sm text-white/70 leading-relaxed rounded-lg bg-white/5 border border-white/10 hover:border-indigo-400/50 hover:bg-white/10 cursor-pointer transition-colors min-h-[100px]"
                >
                  {task.narrative || <span className="text-white/40 italic">點擊新增說明...</span>}
                </div>
              )}
            </div>

            {/* Sub-items */}
            <div>
              <h3 className="text-sm font-medium text-white/80 mb-3">待辦事項</h3>

              {/* Progress - Moved to top */}
              {task.sub_items_meta && task.sub_items_meta.total > 0 && (
                <div className="mb-4">
                  <div className="flex items-center justify-between text-sm text-white/70 mb-2">
                    <span>進度</span>
                    <span>{task.sub_items_meta.completed} / {task.sub_items_meta.total}</span>
                  </div>
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 transition-all duration-300"
                      style={{ width: `${(task.sub_items_meta.completion_rate || 0) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={subItems.filter((item) => item?.id).map((item) => item.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
                    {subItems && subItems.length > 0 ? (
                      subItems.map((item) => (
                        <SortableSubItem
                          key={item.id}
                          item={item}
                          onToggle={(id, completed) => onToggleSubItem?.(task.id, id, completed)}
                          onOpenDialog={(subItem) => {
                            setEditDialogSubItem(subItem);
                            setEditDialogContent(subItem.content);
                            setEditDialogStartDate(subItem.start_date ? subItem.start_date.slice(0, 10) : "");
                            setEditDialogDueDate(subItem.due_date ? subItem.due_date.slice(0, 10) : "");
                            setEditDialogTab("edit");
                            setMoveTargetTaskId("");
                          }}
                        />
                      ))
                    ) : (
                      <p className="text-sm text-white/40 italic px-3 py-2">尚無待辦事項</p>
                    )}

                    {/* Add Sub-item */}
                    {isAddingSubItem ? (
                      <div className="flex items-center gap-2 pt-2">
                        <input
                          type="text"
                          value={newSubItemContent}
                          onChange={(e) => setNewSubItemContent(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleAddSubItem();
                            if (e.key === "Escape") {
                              setIsAddingSubItem(false);
                              setNewSubItemContent("");
                            }
                          }}
                          placeholder="輸入待辦事項..."
                          autoFocus
                          className="flex-1 px-3 py-2 text-sm rounded-lg bg-white/5 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:border-indigo-400/50 focus:ring-1 focus:ring-indigo-400/50"
                        />
                        <button
                          onClick={handleAddSubItem}
                          className="px-4 py-2 text-sm font-medium rounded-lg bg-indigo-500 text-white hover:bg-indigo-600 transition-colors"
                        >
                          新增
                        </button>
                        <button
                          onClick={() => {
                            setIsAddingSubItem(false);
                            setNewSubItemContent("");
                          }}
                          className="px-4 py-2 text-sm font-medium rounded-lg bg-white/10 text-white/80 hover:bg-white/20 transition-colors"
                        >
                          取消
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setIsAddingSubItem(true)}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border-2 border-dashed border-white/20 text-white/60 hover:border-indigo-400/50 hover:text-white/80 hover:bg-white/5 transition-all mt-2"
                      >
                        <Plus className="w-4 h-4" />
                        新增待辦事項
                      </button>
                    )}
                  </div>
                </SortableContext>
              </DndContext>
            </div>
          </div>

          {/* Right Column - References */}
          <div className="w-96 border-l border-white/10 overflow-y-auto p-6 bg-white/5">
            <h3 className="text-lg font-semibold text-white mb-4">參考資料</h3>
            <div className="space-y-3">
              {task.references && task.references.length > 0 ? (
                task.references.filter(ref => ref && ref.type).map((ref) => (
                  <div
                    key={ref.id}
                    className="group p-3 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-colors"
                  >
                    <div className="flex items-start gap-3 mb-2">
                      {ref.type === "url" ? (
                        <ExternalLink className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                      ) : (
                        <FileText className="w-5 h-5 text-white/60 shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1 min-w-0">
                        {ref.type === "url" ? (
                          <>
                            {ref.title && (
                              <div className="text-sm font-medium text-white/90 mb-1 break-words">{ref.title}</div>
                            )}
                            <a
                              href={ref.content}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-400 hover:text-blue-300 hover:underline break-all"
                            >
                              {ref.content}
                            </a>
                          </>
                        ) : (
                          <div className="text-sm text-white/80 break-words whitespace-pre-wrap">
                            {ref.content}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => onDeleteReference?.(task.id, ref.id)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded hover:bg-red-500/20 text-white/60 hover:text-red-400 transition-all shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-white/40 italic text-center py-8">尚無參考資料</p>
              )}

              {/* Add Reference */}
              {isAddingReference ? (
                <div className="p-4 rounded-lg bg-white/10 border border-white/20 space-y-3">
                  <div className="flex gap-2">
                    <button
                      onClick={() => setNewRefType("url")}
                      className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                        newRefType === "url"
                          ? "bg-indigo-500 text-white"
                          : "bg-white/10 text-white/70 hover:bg-white/20"
                      }`}
                    >
                      <ExternalLink className="w-3.5 h-3.5 inline mr-1.5" />
                      網址
                    </button>
                    <button
                      onClick={() => setNewRefType("note")}
                      className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                        newRefType === "note"
                          ? "bg-indigo-500 text-white"
                          : "bg-white/10 text-white/70 hover:bg-white/20"
                      }`}
                    >
                      <FileText className="w-3.5 h-3.5 inline mr-1.5" />
                      註記
                    </button>
                  </div>
                  <input
                    type="text"
                    placeholder="標題 (選填)"
                    value={newRefTitle}
                    onChange={(e) => setNewRefTitle(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg bg-white/5 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:border-indigo-400/50 focus:ring-1 focus:ring-indigo-400/50"
                  />
                  <textarea
                    placeholder={newRefType === "url" ? "https://example.com" : "輸入註記內容..."}
                    value={newRefContent}
                    onChange={(e) => setNewRefContent(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && e.metaKey) handleAddReference();
                      if (e.key === "Escape") {
                        setIsAddingReference(false);
                        setNewRefContent("");
                        setNewRefTitle("");
                      }
                    }}
                    autoFocus
                    rows={3}
                    className="w-full px-3 py-2 text-sm rounded-lg bg-white/5 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:border-indigo-400/50 focus:ring-1 focus:ring-indigo-400/50 resize-none"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleAddReference}
                      disabled={!newRefContent.trim() || isSubmittingReference}
                      className="flex-1 px-3 py-2 text-sm font-medium rounded-lg bg-indigo-500 text-white hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                    >
                      {isSubmittingReference && <Loader2 className="w-4 h-4 animate-spin" />}
                      {isSubmittingReference ? "新增中..." : "新增"}
                    </button>
                    <button
                      onClick={() => {
                        setIsAddingReference(false);
                        setNewRefContent("");
                        setNewRefTitle("");
                      }}
                      disabled={isSubmittingReference}
                      className="flex-1 px-3 py-2 text-sm font-medium rounded-lg bg-white/10 text-white/80 hover:bg-white/20 disabled:opacity-50 transition-colors"
                    >
                      取消
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setIsAddingReference(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 border-dashed border-white/20 text-white/60 hover:border-indigo-400/50 hover:text-white/80 hover:bg-white/5 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  新增參考資料
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-white/10 bg-black/20">
          <div className="flex items-center gap-3">
            {onComplete && (
              <button
                onClick={() => {
                  onComplete(task.id);
                  onClose();
                }}
                className={`px-6 py-2.5 text-sm font-medium rounded-lg border transition-colors ${
                  task.drawer === "ARCHIVE"
                    ? "bg-amber-500/20 text-amber-400 border-amber-500/30 hover:bg-amber-500/30 hover:border-amber-500/50"
                    : "bg-green-500/20 text-green-400 border-green-500/30 hover:bg-green-500/30 hover:border-green-500/50"
                }`}
              >
                {task.drawer === "ARCHIVE" ? "取消標記完成" : "標記為完成"}
              </button>
            )}
            {onDelete && !showDeleteConfirm && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="px-6 py-2.5 text-sm font-medium rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 hover:border-red-500/50 transition-colors flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                刪除任務
              </button>
            )}
            {showDeleteConfirm && onDelete && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-white/80">確定要刪除此任務?</span>
                <button
                  onClick={() => {
                    onDelete?.(task.id);
                    onClose();
                  }}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors"
                >
                  確定刪除
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-white/10 text-white/80 hover:bg-white/20 transition-colors"
                >
                  取消
                </button>
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-6 py-2.5 text-sm font-medium rounded-lg bg-white/10 text-white/80 hover:bg-white/20 transition-colors"
          >
            關閉
          </button>
        </div>
      </div>

      {/* Sub-Item Edit Dialog */}
      {editDialogSubItem && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setEditDialogSubItem(null)}
        >
          <div
            className="bg-slate-800 rounded-xl shadow-2xl w-full max-w-md border border-white/10 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Dialog Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <h3 className="text-base font-medium text-white">編輯待辦事項</h3>
              <button
                onClick={() => setEditDialogSubItem(null)}
                className="p-1 rounded hover:bg-white/10 text-white/60 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="p-5 space-y-4">
              {/* Edit Content */}
              <div>
                <label className="block text-xs font-medium text-white/60 mb-1.5">內容</label>
                <input
                  type="text"
                  value={editDialogContent}
                  onChange={(e) => setEditDialogContent(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setEditDialogSubItem(null);
                  }}
                  autoFocus
                  className="w-full px-3 py-2.5 text-sm rounded-lg bg-white/5 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:border-indigo-400/50 focus:ring-1 focus:ring-indigo-400/50"
                />
              </div>

              {/* Date Fields */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Start Date */}
                <div className="inline-flex items-center">
                  <input
                    ref={startDateRef}
                    type="date"
                    value={editDialogStartDate}
                    onChange={(e) => setEditDialogStartDate(e.target.value)}
                    className="absolute opacity-0 pointer-events-none [color-scheme:dark]"
                    tabIndex={-1}
                  />
                  <button
                    type="button"
                    onClick={() => startDateRef.current?.showPicker()}
                    className="cursor-pointer"
                  >
                    {editDialogStartDate ? (() => {
                      const d = new Date(editDialogStartDate)
                      const now = new Date()
                      now.setHours(0,0,0,0)
                      const diff = Math.ceil((d.getTime() - now.getTime()) / (1000*60*60*24))
                      const text = diff < 0 ? `已開始 ${Math.abs(diff)} 天` : diff === 0 ? '今天開始' : `${diff} 天後開始`
                      return (
                        <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors">
                          <Calendar className="w-3 h-3" />
                          {text}
                        </span>
                      )
                    })() : (
                      <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs bg-white/5 text-white/40 border border-dashed border-white/20 hover:bg-white/10 hover:text-white/60 transition-colors">
                        <CalendarPlus className="w-3 h-3" />
                        開始日期
                      </span>
                    )}
                  </button>
                  {editDialogStartDate && (
                    <button
                      type="button"
                      onClick={() => setEditDialogStartDate("")}
                      className="ml-1 w-5 h-5 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center flex-shrink-0"
                    >
                      <X className="w-3 h-3 text-white" />
                    </button>
                  )}
                </div>

                {/* Due Date */}
                <div className="inline-flex items-center">
                  <input
                    ref={dueDateRef}
                    type="date"
                    value={editDialogDueDate}
                    max={task.due_date ? task.due_date.slice(0, 10) : undefined}
                    onChange={(e) => setEditDialogDueDate(e.target.value)}
                    className="absolute opacity-0 pointer-events-none [color-scheme:dark]"
                    tabIndex={-1}
                  />
                  <button
                    type="button"
                    onClick={() => dueDateRef.current?.showPicker()}
                    className="cursor-pointer"
                  >
                    {editDialogDueDate ? (() => {
                      const info = getRelativeTimeDesc(new Date(editDialogDueDate))
                      return (
                        <span className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs transition-colors
                          ${info.isOverdue
                            ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                            : info.isUrgent
                              ? 'bg-orange-500/20 text-orange-400 hover:bg-orange-500/30'
                              : 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'
                          }`}
                        >
                          {info.isOverdue ? <AlertCircle className="w-3 h-3" /> : <Calendar className="w-3 h-3" />}
                          {info.text}
                        </span>
                      )
                    })() : (
                      <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs bg-white/5 text-white/40 border border-dashed border-white/20 hover:bg-white/10 hover:text-white/60 transition-colors">
                        <CalendarPlus className="w-3 h-3" />
                        截止日期
                      </span>
                    )}
                  </button>
                  {editDialogDueDate && (
                    <button
                      type="button"
                      onClick={() => setEditDialogDueDate("")}
                      className="ml-1 w-5 h-5 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center flex-shrink-0"
                    >
                      <X className="w-3 h-3 text-white" />
                    </button>
                  )}
                </div>
              </div>

              {/* Save / Delete */}
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    if (editDialogContent.trim()) {
                      onEditSubItem?.(task.id, editDialogSubItem.id, {
                        content: editDialogContent.trim(),
                        start_date: editDialogStartDate || null,
                        due_date: editDialogDueDate || null,
                      });
                      setEditDialogSubItem(null);
                    }
                  }}
                  disabled={!editDialogContent.trim()}
                  className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg bg-indigo-500 text-white hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  儲存
                </button>
                <button
                  onClick={() => {
                    onDeleteSubItem?.(task.id, editDialogSubItem.id);
                    setEditDialogSubItem(null);
                  }}
                  className="px-4 py-2.5 text-sm font-medium rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-colors flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  刪除
                </button>
              </div>

              {/* Move / Promote Section */}
              {(onMoveSubItem || onPromoteSubItem) && (
                <>
                  <div className="flex items-center gap-3 pt-1">
                    <div className="flex-1 h-px bg-white/10" />
                    <span className="text-xs text-white/30">移動 / 升級</span>
                    <div className="flex-1 h-px bg-white/10" />
                  </div>

                  <div className="flex gap-2">
                    {/* Move */}
                    {onMoveSubItem && siblingTasks && siblingTasks.length > 0 && (
                      <div className="flex-1 flex gap-1.5">
                        <select
                          value={moveTargetTaskId}
                          onChange={(e) => setMoveTargetTaskId(e.target.value)}
                          className="flex-1 min-w-0 px-2.5 py-2 text-xs rounded-lg bg-white/5 border border-white/20 text-white focus:outline-none focus:border-indigo-400/50 [&>option]:bg-slate-800 [&>option]:text-white"
                        >
                          <option value="">移動到...</option>
                          {siblingTasks
                            .filter((t) => t.id !== task.id)
                            .map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.title}
                              </option>
                            ))}
                        </select>
                        <button
                          onClick={async () => {
                            if (!moveTargetTaskId) return;
                            setIsMoving(true);
                            try {
                              await onMoveSubItem(task.id, editDialogSubItem.id, moveTargetTaskId);
                              setEditDialogSubItem(null);
                            } finally {
                              setIsMoving(false);
                            }
                          }}
                          disabled={!moveTargetTaskId || isMoving}
                          className="px-3 py-2 text-xs font-medium rounded-lg bg-indigo-500 text-white hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1 shrink-0"
                        >
                          {isMoving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MoveRight className="w-3.5 h-3.5" />}
                          {isMoving ? "移動中" : "移動"}
                        </button>
                      </div>
                    )}

                    {/* Promote */}
                    {onPromoteSubItem && (
                      <button
                        onClick={async () => {
                          setIsPromoting(true);
                          try {
                            await onPromoteSubItem(task.id, editDialogSubItem.id);
                            setEditDialogSubItem(null);
                          } finally {
                            setIsPromoting(false);
                          }
                        }}
                        disabled={isPromoting}
                        className="px-3 py-2 text-xs font-medium rounded-lg bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30 transition-colors flex items-center gap-1 shrink-0"
                      >
                        {isPromoting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowUpCircle className="w-3.5 h-3.5" />}
                        {isPromoting ? "升級中" : "升級"}
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
