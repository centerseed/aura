"use client";

import { useState, useEffect } from "react";
import { CheckCircle2, Circle, Clock, X, Sun, Loader2, ListTodo, GripVertical, RefreshCw, CalendarClock } from "lucide-react";
import { API } from "@/lib/api-client";
import type { TaskCard } from "@/types";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  DragOverlay,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface PlanItem {
  id: string;
  task_id: string;
  sub_task_id?: string | null;
  content: string;
  product_name?: string;
  area_name?: string;
  order: number;
  estimated_minutes?: number;
  completed: boolean;
  pinned: boolean;
  deferred: boolean;
  status: "today" | "overflow";
  user_adjusted: boolean;
}

interface DailyPlan {
  id: string;
  plan_date: string;
  items: PlanItem[];
  overflow_items?: any[];
  capacity_note?: string;
  coach_message?: string;
}

interface TodayPlanSheetProps {
  open: boolean;
  onClose: () => void;
  completedTodayTasks: TaskCard[];
  onCompleteTask: (taskId: string) => void;
  onOpenTask?: (taskId: string, subTaskId?: string | null) => void;
}

function SortablePlanItem({
  item,
  idx,
  isCompleting,
  onComplete,
  onOpenTask,
  section,
}: {
  item: PlanItem;
  idx: number;
  isCompleting: boolean;
  onComplete: (item: PlanItem) => void;
  onOpenTask?: (taskId: string, subTaskId?: string | null) => void;
  section: "today" | "overflow";
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    data: { section },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  const isOverflow = section === "overflow";

  return (
    <li ref={setNodeRef} style={style} className="flex items-start gap-2 py-2 group">
      <div
        {...attributes}
        {...listeners}
        className="mt-1 cursor-grab active:cursor-grabbing p-0.5 text-gray-300 group-hover:text-gray-400 dark:text-white/20 dark:group-hover:text-white/40 transition-colors"
      >
        <GripVertical className="w-3.5 h-3.5" />
      </div>
      <button
        onClick={() => onComplete(item)}
        disabled={isCompleting}
        className="mt-0.5 shrink-0 text-gray-400 hover:text-green-500 dark:text-white/30 dark:hover:text-green-400 transition-colors disabled:opacity-50"
      >
        {isCompleting ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Circle className="w-4 h-4" />
        )}
      </button>
      <button
        onClick={() => onOpenTask?.(item.task_id, item.sub_task_id)}
        className="min-w-0 flex-1 text-left hover:bg-gray-100 dark:hover:bg-white/5 rounded px-1 -mx-1 transition-colors"
      >
        <p className={`text-sm truncate ${isOverflow ? "text-gray-400 dark:text-white/50" : "text-gray-700 dark:text-white/80"}`}>
          <span className="text-gray-400 dark:text-white/40 mr-1">{idx + 1}.</span>
          {item.product_name && (
            <span className="text-gray-400 dark:text-white/30">[{item.product_name}] </span>
          )}
          {item.content}
        </p>
        {item.user_adjusted && (
          <span className="text-[10px] text-blue-500/60 dark:text-blue-400/60 ml-5">手動調整</span>
        )}
      </button>
      {item.estimated_minutes && (
        <span className="shrink-0 flex items-center gap-1 text-xs text-gray-400 dark:text-white/30">
          <Clock className="w-3 h-3" />
          {item.estimated_minutes}m
        </span>
      )}
    </li>
  );
}

export function TodayPlanSheet({
  open,
  onClose,
  completedTodayTasks,
  onCompleteTask,
  onOpenTask,
}: TodayPlanSheetProps) {
  const [plan, setPlan] = useState<DailyPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [completingItems, setCompletingItems] = useState<Set<string>>(new Set());
  const [noPlan, setNoPlan] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    if (open) {
      loadPlan();
    }
  }, [open]);

  const loadPlan = async () => {
    setLoading(true);
    setNoPlan(false);
    try {
      const res = await API.coach.plan.get() as any;
      if (res?.plan) {
        setPlan(res.plan);
      } else {
        setNoPlan(true);
      }
    } catch {
      setNoPlan(true);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await API.coach.plan.generate({
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }) as any;
      if (res?.plan) {
        setPlan(res.plan);
        setNoPlan(false);
      }
    } catch {
      // ignore
    } finally {
      setGenerating(false);
    }
  };

  const handleCompleteItem = async (item: PlanItem) => {
    setCompletingItems((prev) => new Set(prev).add(item.id));
    try {
      await API.coach.plan.updateItem(item.id, { completed: true });
      setPlan((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          items: prev.items.map((i) =>
            i.id === item.id ? { ...i, completed: true } : i
          ),
        };
      });
      if (item.task_id) {
        onCompleteTask(item.task_id);
      }
    } catch {
      // ignore
    } finally {
      setCompletingItems((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  };

  // 分組
  const todayItems = plan?.items
    .filter((i) => !i.completed && i.status === "today")
    .sort((a, b) => a.order - b.order) ?? [];
  const overflowItems = plan?.items
    .filter((i) => !i.completed && i.status === "overflow")
    .sort((a, b) => a.order - b.order) ?? [];
  const completedItems = plan?.items.filter((i) => i.completed) ?? [];

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id || !plan) return;

    const allPending = [...todayItems, ...overflowItems];
    const draggedItem = allPending.find((i) => i.id === active.id);
    const targetItem = allPending.find((i) => i.id === over.id);
    if (!draggedItem || !targetItem) return;

    const fromSection = draggedItem.status;
    const toSection = targetItem.status;
    const isCrossSection = fromSection !== toSection;

    let updatedToday: PlanItem[];
    let updatedOverflow: PlanItem[];

    if (!isCrossSection) {
      // 同 section 排序
      if (fromSection === "today") {
        const oldIdx = todayItems.findIndex((i) => i.id === active.id);
        const newIdx = todayItems.findIndex((i) => i.id === over.id);
        updatedToday = arrayMove(todayItems, oldIdx, newIdx).map((item, idx) => ({
          ...item,
          order: idx,
        }));
        updatedOverflow = overflowItems;
      } else {
        const oldIdx = overflowItems.findIndex((i) => i.id === active.id);
        const newIdx = overflowItems.findIndex((i) => i.id === over.id);
        updatedToday = todayItems;
        updatedOverflow = arrayMove(overflowItems, oldIdx, newIdx).map((item, idx) => ({
          ...item,
          order: todayItems.length + idx,
        }));
      }
    } else {
      // 跨 section 移動
      const movedItem = { ...draggedItem, status: toSection, user_adjusted: true };

      if (toSection === "today") {
        // overflow → today
        const targetIdx = todayItems.findIndex((i) => i.id === over.id);
        const newToday = [...todayItems];
        newToday.splice(targetIdx, 0, movedItem as PlanItem);
        updatedToday = newToday.map((item, idx) => ({ ...item, order: idx }));
        updatedOverflow = overflowItems
          .filter((i) => i.id !== draggedItem.id)
          .map((item, idx) => ({ ...item, order: updatedToday.length + idx }));
      } else {
        // today → overflow
        const targetIdx = overflowItems.findIndex((i) => i.id === over.id);
        const newOverflow = [...overflowItems];
        newOverflow.splice(targetIdx, 0, movedItem as PlanItem);
        updatedToday = todayItems
          .filter((i) => i.id !== draggedItem.id)
          .map((item, idx) => ({ ...item, order: idx }));
        updatedOverflow = newOverflow.map((item, idx) => ({
          ...item,
          order: updatedToday.length + idx,
        }));
      }
    }

    // Optimistic update
    setPlan({
      ...plan,
      items: [...updatedToday, ...updatedOverflow, ...completedItems],
    });

    // Persist
    try {
      const itemsToUpdate = [...updatedToday, ...updatedOverflow];
      await Promise.all(
        itemsToUpdate.map((item) => {
          const original = allPending.find((i) => i.id === item.id);
          const changed =
            original?.order !== item.order ||
            original?.status !== item.status ||
            (isCrossSection && item.id === draggedItem.id);
          if (!changed) return Promise.resolve();

          const updates: any = { order: item.order };
          if (isCrossSection && item.id === draggedItem.id) {
            updates.status = item.status;
            updates.user_adjusted = true;
          }
          return API.coach.plan.updateItem(item.id, updates);
        })
      );
    } catch {
      loadPlan();
    }
  };

  if (!open) return null;

  const today = new Date();
  const dateStr = `${today.getMonth() + 1}/${today.getDate()}（${"日一二三四五六"[today.getDay()]}）`;

  const activeItem = activeId
    ? [...todayItems, ...overflowItems].find((i) => i.id === activeId)
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Sheet */}
      <div className="relative w-full max-w-lg mx-4 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-white/10 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-white/10">
          <div className="flex items-center gap-2">
            <Sun className="w-5 h-5 text-amber-400" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">今日計畫</h3>
            <span className="text-sm text-gray-500 dark:text-white/50">{dateStr}</span>
          </div>
          <div className="flex items-center gap-1">
            {plan && (
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:text-white/50 dark:hover:text-white dark:hover:bg-white/10 transition-colors disabled:opacity-50"
                title="重新生成計畫"
              >
                {generating ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:text-white/50 dark:hover:text-white dark:hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="max-h-[60vh] overflow-y-auto">
          {loading ? (
            <div className="py-12 flex justify-center">
              <Loader2 className="w-6 h-6 text-gray-400 dark:text-white/50 animate-spin" />
            </div>
          ) : noPlan ? (
            <div className="py-12 text-center">
              <ListTodo className="w-10 h-10 text-gray-300 dark:text-white/30 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-white/50 mb-4">尚未生成今日計畫</p>
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="px-4 py-2 rounded-lg bg-blue-50 border border-blue-200 text-blue-600 hover:bg-blue-100 dark:bg-blue-500/20 dark:border-blue-500/30 dark:text-blue-400 dark:hover:bg-blue-500/30 transition-colors disabled:opacity-50"
              >
                {generating ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    生成中...
                  </span>
                ) : (
                  "生成今日計畫"
                )}
              </button>
            </div>
          ) : (
            <>
              {/* Coach message */}
              {plan?.coach_message && (
                <div className="px-5 py-3 border-b border-gray-100 dark:border-white/5 bg-blue-50 dark:bg-blue-500/5">
                  <p className="text-sm text-blue-600 dark:text-blue-300/80">
                    {plan.coach_message}
                  </p>
                </div>
              )}

              {/* Capacity note */}
              {plan?.capacity_note && (
                <div className="px-5 py-2 border-b border-gray-100 dark:border-white/5">
                  <p className="text-xs text-gray-500 dark:text-white/40">{plan.capacity_note}</p>
                </div>
              )}

              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
              >
                {/* Today items */}
                <div className="px-5 py-3 border-b border-gray-100 dark:border-white/5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700 dark:text-white/70">今日計畫</span>
                    <span className="text-xs text-gray-400 dark:text-white/40">{todayItems.length} 項</span>
                  </div>
                  {todayItems.length === 0 ? (
                    <p className="text-sm text-gray-400 dark:text-white/40 py-2">所有任務已完成！</p>
                  ) : (
                    <SortableContext
                      items={todayItems.map((i) => i.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <ul className="space-y-1">
                        {todayItems.map((item, idx) => (
                          <SortablePlanItem
                            key={item.id}
                            item={item}
                            idx={idx}
                            section="today"
                            isCompleting={completingItems.has(item.id)}
                            onComplete={handleCompleteItem}
                            onOpenTask={onOpenTask}
                          />
                        ))}
                      </ul>
                    </SortableContext>
                  )}
                </div>

                {/* Overflow items */}
                {overflowItems.length > 0 && (
                  <div className="px-5 py-3 border-b border-gray-100 dark:border-white/5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700 dark:text-white/70 flex items-center gap-1.5">
                        <CalendarClock className="w-3.5 h-3.5 text-gray-400 dark:text-white/40" />
                        明後天可做
                      </span>
                      <span className="text-xs text-gray-400 dark:text-white/40">{overflowItems.length} 項</span>
                    </div>
                    <SortableContext
                      items={overflowItems.map((i) => i.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <ul className="space-y-1.5">
                        {overflowItems.map((item, idx) => (
                          <SortablePlanItem
                            key={item.id}
                            item={item}
                            idx={idx}
                            section="overflow"
                            isCompleting={completingItems.has(item.id)}
                            onComplete={handleCompleteItem}
                            onOpenTask={onOpenTask}
                          />
                        ))}
                      </ul>
                    </SortableContext>
                  </div>
                )}

                {/* Drag overlay */}
                <DragOverlay>
                  {activeItem ? (
                    <div className="bg-gray-50 dark:bg-slate-700 rounded-lg px-3 py-2 shadow-xl border border-gray-200 dark:border-white/20">
                      <p className="text-sm text-gray-700 dark:text-white/80 truncate">
                        {activeItem.product_name && (
                          <span className="text-gray-400 dark:text-white/40">[{activeItem.product_name}] </span>
                        )}
                        {activeItem.content}
                      </p>
                    </div>
                  ) : null}
                </DragOverlay>
              </DndContext>

              {/* Completed items */}
              {(completedItems.length > 0 || completedTodayTasks.length > 0) && (
                <div className="px-5 py-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700 dark:text-white/70">已完成</span>
                    <span className="text-xs text-gray-400 dark:text-white/40">
                      {completedItems.length + completedTodayTasks.length} 項
                    </span>
                  </div>
                  <ul className="space-y-1">
                    {completedItems.map((item) => (
                      <li key={item.id} className="flex items-start gap-3 py-1.5">
                        <CheckCircle2 className="w-4 h-4 mt-0.5 text-green-400 shrink-0" />
                        <p className="text-sm text-gray-400 dark:text-white/50 line-through">
                          {item.area_name && (
                            <span className="text-gray-300 dark:text-white/30">[{item.area_name}] </span>
                          )}
                          {item.content}
                        </p>
                      </li>
                    ))}
                    {completedTodayTasks
                      .filter((t) => !completedItems.some((i) => i.task_id === t.id))
                      .map((task) => (
                        <li key={task.id} className="flex items-start gap-3 py-1.5">
                          <CheckCircle2 className="w-4 h-4 mt-0.5 text-green-400 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-gray-400 dark:text-white/50 line-through">{task.title}</p>
                            {task.tag && (
                              <p className="text-xs text-gray-300 dark:text-white/30 mt-0.5">
                                {task.tag.area} &gt; {task.tag.product}
                              </p>
                            )}
                          </div>
                        </li>
                      ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5">
          <p className="text-xs text-gray-400 dark:text-white/40 text-center">
            拖拽項目可在「今日計畫」與「明後天可做」之間移動
          </p>
        </div>
      </div>
    </div>
  );
}
