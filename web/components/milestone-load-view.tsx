"use client";

import { useMemo, useState, useEffect } from "react";
import { AlertTriangle, Calendar, CheckCircle2, Flag, ChevronDown, ChevronRight } from "lucide-react";
import type { TaskCard, Milestone } from "@/types";

interface MilestoneLoadViewProps {
  areas: Array<{
    id: string;
    name: string;
    products: Array<{
      id: string;
      name: string;
      tasks: TaskCard[];
    }>;
  }>;
  milestones: Milestone[];
}

interface WeekLoad {
  weekStart: Date;
  weekEnd: Date;
  tasks: TaskCard[];
  milestones: Milestone[];
  totalLoad: number;
}

// 負載等級閾值
const LOAD_THRESHOLDS = {
  low: 3,      // 0-2: 輕鬆
  medium: 5,   // 3-4: 適中
  warning: 8,  // 5-7: 警告
  // 8+: 危險
};

function getLoadColor(load: number): string {
  if (load < LOAD_THRESHOLDS.low) return "bg-emerald-500";
  if (load < LOAD_THRESHOLDS.medium) return "bg-blue-500";
  if (load < LOAD_THRESHOLDS.warning) return "bg-amber-500";
  return "bg-red-500";
}

function getLoadBorderColor(load: number): string {
  if (load < LOAD_THRESHOLDS.low) return "border-emerald-500/30";
  if (load < LOAD_THRESHOLDS.medium) return "border-blue-500/30";
  if (load < LOAD_THRESHOLDS.warning) return "border-amber-500/30";
  return "border-red-500/30";
}

function getLoadLabel(load: number): string {
  if (load < LOAD_THRESHOLDS.low) return "輕鬆";
  if (load < LOAD_THRESHOLDS.medium) return "適中";
  if (load < LOAD_THRESHOLDS.warning) return "忙碌";
  return "爆炸";
}

function getLoadLabelColor(load: number): string {
  if (load < LOAD_THRESHOLDS.low) return "text-emerald-400";
  if (load < LOAD_THRESHOLDS.medium) return "text-blue-400";
  if (load < LOAD_THRESHOLDS.warning) return "text-amber-400";
  return "text-red-400";
}

// 獲取週一
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d;
}

// 格式化日期
function formatWeekLabel(weekStart: Date): string {
  const month = weekStart.getMonth() + 1;
  const day = weekStart.getDate();
  return `${month}/${day}`;
}

function formatFullDate(date: Date): string {
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

// 判斷是否為當前週
function isCurrentWeek(weekStart: Date): boolean {
  const now = new Date();
  const currentWeekStart = getWeekStart(now);
  return weekStart.getTime() === currentWeekStart.getTime();
}

function MilestoneLoadViewComponent({ areas, milestones }: MilestoneLoadViewProps) {
  // 收集所有任務
  const allTasks = useMemo(() => {
    return (Array.isArray(areas) ? areas : []).flatMap((area) =>
      (Array.isArray(area.products) ? area.products : []).flatMap((product) =>
        Array.isArray(product.tasks) ? product.tasks : []
      )
    );
  }, [areas]);

  // 計算每週負載
  const weeklyLoads = useMemo(() => {
    const weekMap = new Map<string, WeekLoad>();

    // 處理任務
    allTasks.forEach((task) => {
      if (!task.due_date) return;
      const dueDate = new Date(task.due_date);
      const weekStart = getWeekStart(dueDate);
      const key = weekStart.toISOString();

      if (!weekMap.has(key)) {
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        weekMap.set(key, {
          weekStart,
          weekEnd,
          tasks: [],
          milestones: [],
          totalLoad: 0,
        });
      }

      const week = weekMap.get(key)!;
      week.tasks.push(task);
      week.totalLoad++;
    });

    // 處理里程碑
    (Array.isArray(milestones) ? milestones : []).forEach((milestone) => {
      const targetDate = new Date(milestone.target_date);
      const weekStart = getWeekStart(targetDate);
      const key = weekStart.toISOString();

      if (!weekMap.has(key)) {
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        weekMap.set(key, {
          weekStart,
          weekEnd,
          tasks: [],
          milestones: [],
          totalLoad: 0,
        });
      }

      const week = weekMap.get(key)!;
      week.milestones.push(milestone);
      week.totalLoad++;
    });

    // 排序並轉為陣列
    return Array.from(weekMap.values()).sort(
      (a, b) => a.weekStart.getTime() - b.weekStart.getTime()
    );
  }, [allTasks, milestones]);

  // 預設全部展開
  const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(new Set());

  useEffect(() => {
    setExpandedWeeks(new Set(weeklyLoads.map((w) => w.weekStart.toISOString())));
  }, [weeklyLoads]);

  // 統計
  const stats = useMemo(() => {
    const overloadedWeeks = weeklyLoads.filter((w) => w.totalLoad >= LOAD_THRESHOLDS.warning);
    const avgLoad = weeklyLoads.length > 0
      ? weeklyLoads.reduce((sum, w) => sum + w.totalLoad, 0) / weeklyLoads.length
      : 0;

    return { overloadedWeeks: overloadedWeeks.length, avgLoad };
  }, [weeklyLoads]);

  const toggleWeek = (key: string) => {
    setExpandedWeeks((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  if (weeklyLoads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-white/50">
        <Calendar className="h-12 w-12 mb-4 opacity-50" />
        <p>沒有排定日期的任務或里程碑</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 頂部統計 */}
      <div className="flex items-center gap-6 text-sm text-white/60">
        <span>共 {weeklyLoads.length} 週</span>
        <span>平均負載: {stats.avgLoad.toFixed(1)}</span>
        {stats.overloadedWeeks > 0 && (
          <span className="text-red-400 font-medium flex items-center gap-1">
            <AlertTriangle className="h-4 w-4" />
            {stats.overloadedWeeks} 週超載
          </span>
        )}
      </div>

      {/* 週列表 */}
      <div className="space-y-3">
        {weeklyLoads.map((week) => {
          const key = week.weekStart.toISOString();
          const isExpanded = expandedWeeks.has(key);
          const isCurrent = isCurrentWeek(week.weekStart);

          return (
            <div
              key={key}
              className={`rounded-xl border bg-white/5 ${getLoadBorderColor(week.totalLoad)} ${
                isCurrent ? "ring-2 ring-blue-500/50" : ""
              }`}
            >
              {/* 週標題列 */}
              <button
                onClick={() => toggleWeek(key)}
                className="w-full px-4 py-3 flex items-center gap-4 hover:bg-white/5 transition-colors rounded-xl"
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-white/40" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-white/40" />
                )}

                {/* 週標籤 */}
                <div className="flex items-center gap-2 min-w-[100px]">
                  <span className="font-medium text-white">
                    {formatWeekLabel(week.weekStart)} 週
                  </span>
                  {isCurrent && (
                    <span className="text-xs bg-blue-500 text-white px-1.5 py-0.5 rounded">
                      本週
                    </span>
                  )}
                </div>

                {/* 負載條 */}
                <div className="flex-1 flex items-center gap-3">
                  <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${getLoadColor(week.totalLoad)} transition-all`}
                      style={{ width: `${Math.min((week.totalLoad / 10) * 100, 100)}%` }}
                    />
                  </div>
                  <span className={`text-sm font-medium min-w-[50px] ${getLoadLabelColor(week.totalLoad)}`}>
                    {getLoadLabel(week.totalLoad)}
                  </span>
                </div>

                {/* 數量統計 */}
                <div className="flex items-center gap-4 text-sm text-white/70">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-blue-400" />
                    {week.tasks.length}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Flag className="h-4 w-4 text-purple-400" />
                    {week.milestones.length}
                  </span>
                  <span className={`font-bold min-w-[40px] text-right ${
                    week.totalLoad >= LOAD_THRESHOLDS.warning ? "text-red-400" : "text-white"
                  }`}>
                    = {week.totalLoad}
                  </span>
                </div>
              </button>

              {/* 展開詳情 */}
              {isExpanded && (
                <div className="px-4 pb-4 pt-2 border-t border-white/10 space-y-3">
                  <div className="text-xs text-white/40">
                    {formatFullDate(week.weekStart)} ~ {formatFullDate(week.weekEnd)}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* 任務列表 */}
                    {week.tasks.length > 0 && (
                      <div className="space-y-2">
                        <div className="text-sm font-medium text-white/70 flex items-center gap-1.5">
                          <CheckCircle2 className="h-4 w-4 text-blue-400" />
                          任務
                        </div>
                        <div className="space-y-1.5">
                          {week.tasks.map((task) => (
                            <div
                              key={task.id}
                              className="bg-white/5 rounded-lg px-3 py-2 text-sm"
                            >
                              <div className="text-white/90">{task.title}</div>
                              {task.due_date && (
                                <div className="text-xs text-white/40 mt-0.5">
                                  {new Date(task.due_date).getMonth() + 1}/{new Date(task.due_date).getDate()}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 里程碑列表 */}
                    {week.milestones.length > 0 && (
                      <div className="space-y-2">
                        <div className="text-sm font-medium text-white/70 flex items-center gap-1.5">
                          <Flag className="h-4 w-4 text-purple-400" />
                          里程碑
                        </div>
                        <div className="space-y-1.5">
                          {week.milestones.map((m) => (
                            <div
                              key={m.id}
                              className="bg-purple-500/10 border border-purple-500/20 rounded-lg px-3 py-2 text-sm"
                            >
                              <div className="text-purple-300">{m.name}</div>
                              <div className="text-xs text-white/40 mt-0.5">
                                {new Date(m.target_date).getMonth() + 1}/{new Date(m.target_date).getDate()}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 圖例 */}
      <div className="flex flex-wrap gap-4 text-sm text-white/60 pt-2">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          <span>輕鬆 (0-2)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
          <span>適中 (3-4)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
          <span>忙碌 (5-7)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
          <span>爆炸 (8+)</span>
        </div>
      </div>
    </div>
  );
}

export { MilestoneLoadViewComponent as MilestoneLoadView };
