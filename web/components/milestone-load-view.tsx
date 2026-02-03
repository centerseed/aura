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

interface DayLoad {
  date: Date;
  tasks: TaskCard[];
  milestones: Milestone[];
  count: number;
}

interface WeekLoad {
  weekStart: Date;
  weekEnd: Date;
  tasks: TaskCard[];
  milestones: Milestone[];
  totalLoad: number;
  dailyLoads: DayLoad[]; // 7天的每日負載
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

// 判斷是否為今天
function isToday(date: Date): boolean {
  const now = new Date();
  return (
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()
  );
}

// 獲取星期標籤
function getDayLabel(date: Date): string {
  const days = ['日', '一', '二', '三', '四', '五', '六'];
  return days[date.getDay()];
}

// 獲取每日負載顏色（用於熱力圖）
function getDayLoadColor(count: number): string {
  if (count === 0) return 'bg-white/5';
  if (count <= 2) return 'bg-emerald-500/50';
  if (count <= 4) return 'bg-blue-500/70';
  if (count <= 7) return 'bg-amber-500/80';
  return 'bg-red-500';
}

// 獲取每日負載的高度（用於柱狀圖）
function getDayLoadHeight(count: number): number {
  return Math.min(count * 8 + 8, 48); // 最小8px，每個任務增加8px，最大48px
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

        // 初始化7天的每日負載
        const dailyLoads: DayLoad[] = [];
        for (let i = 0; i < 7; i++) {
          const dayDate = new Date(weekStart);
          dayDate.setDate(dayDate.getDate() + i);
          dailyLoads.push({
            date: dayDate,
            tasks: [],
            milestones: [],
            count: 0,
          });
        }

        weekMap.set(key, {
          weekStart,
          weekEnd,
          tasks: [],
          milestones: [],
          totalLoad: 0,
          dailyLoads,
        });
      }

      const week = weekMap.get(key)!;
      week.tasks.push(task);
      week.totalLoad++;

      // 更新對應日期的負載
      const dayIndex = Math.floor((dueDate.getTime() - week.weekStart.getTime()) / (1000 * 60 * 60 * 24));
      if (dayIndex >= 0 && dayIndex < 7) {
        week.dailyLoads[dayIndex].tasks.push(task);
        week.dailyLoads[dayIndex].count++;
      }
    });

    // 處理里程碑
    (Array.isArray(milestones) ? milestones : []).forEach((milestone) => {
      const targetDate = new Date(milestone.target_date);
      const weekStart = getWeekStart(targetDate);
      const key = weekStart.toISOString();

      if (!weekMap.has(key)) {
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);

        // 初始化7天的每日負載
        const dailyLoads: DayLoad[] = [];
        for (let i = 0; i < 7; i++) {
          const dayDate = new Date(weekStart);
          dayDate.setDate(dayDate.getDate() + i);
          dailyLoads.push({
            date: dayDate,
            tasks: [],
            milestones: [],
            count: 0,
          });
        }

        weekMap.set(key, {
          weekStart,
          weekEnd,
          tasks: [],
          milestones: [],
          totalLoad: 0,
          dailyLoads,
        });
      }

      const week = weekMap.get(key)!;
      week.milestones.push(milestone);
      week.totalLoad++;

      // 更新對應日期的負載
      const dayIndex = Math.floor((targetDate.getTime() - week.weekStart.getTime()) / (1000 * 60 * 60 * 24));
      if (dayIndex >= 0 && dayIndex < 7) {
        week.dailyLoads[dayIndex].milestones.push(milestone);
        week.dailyLoads[dayIndex].count++;
      }
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

                {/* 每日負載熱力圖 */}
                <div className="flex items-end gap-1.5 h-16 px-2 flex-1">
                  {week.dailyLoads.map((day, idx) => (
                    <div key={idx} className="flex flex-col items-center gap-1.5 group relative flex-1 min-w-[40px]">
                      {/* 柱狀圖容器 - 固定高度基準線 */}
                      <div className="flex flex-col justify-end w-full" style={{ height: '48px' }}>
                        <div
                          className={`w-full rounded-t transition-all ${getDayLoadColor(day.count)} ${
                            isToday(day.date) ? 'ring-2 ring-blue-400' : ''
                          }`}
                          style={{ height: day.count > 0 ? `${getDayLoadHeight(day.count)}px` : '2px' }}
                        />
                      </div>
                      {/* 星期標籤 */}
                      <span className={`text-xs leading-none ${
                        isToday(day.date)
                          ? 'text-blue-400 font-bold'
                          : day.count > 0
                            ? 'text-white/60'
                            : 'text-white/30'
                      }`}>
                        {getDayLabel(day.date)}
                      </span>
                      {/* 懸浮提示 */}
                      {day.count > 0 && (
                        <div className="absolute bottom-full mb-2 hidden group-hover:block z-10">
                          <div className="bg-black/90 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                            {formatFullDate(day.date)}: {day.count} 項
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* 總負載標籤 */}
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-medium ${getLoadLabelColor(week.totalLoad)}`}>
                    {getLoadLabel(week.totalLoad)}
                  </span>
                  <span className={`font-bold text-lg ${
                    week.totalLoad >= LOAD_THRESHOLDS.warning ? "text-red-400" : "text-white"
                  }`}>
                    {week.totalLoad}
                  </span>
                </div>
              </button>

              {/* 展開詳情 - 按日期分組 */}
              {isExpanded && (
                <div className="px-4 pb-4 pt-2 border-t border-white/10 space-y-2">
                  {week.dailyLoads.filter((day) => day.count > 0).map((day, idx) => (
                    <div
                      key={idx}
                      className={`rounded-lg border p-3 ${
                        isToday(day.date)
                          ? 'bg-blue-500/10 border-blue-500/30'
                          : 'bg-white/5 border-white/10'
                      }`}
                    >
                      {/* 日期標題 */}
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`text-sm font-bold ${
                          isToday(day.date) ? 'text-blue-400' : 'text-white'
                        }`}>
                          {formatFullDate(day.date)} ({getDayLabel(day.date)})
                        </span>
                        {isToday(day.date) && (
                          <span className="text-xs bg-blue-500 text-white px-1.5 py-0.5 rounded">
                            今天
                          </span>
                        )}
                        <span className={`text-xs ml-auto ${
                          day.count >= 5 ? 'text-red-400' : 'text-white/60'
                        }`}>
                          {day.count} 項
                        </span>
                      </div>

                      {/* 任務和里程碑列表 */}
                      <div className="space-y-1.5">
                        {day.tasks.map((task) => (
                          <div
                            key={task.id}
                            className="flex items-start gap-2 bg-black/20 rounded px-2 py-1.5 text-sm"
                          >
                            <CheckCircle2 className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
                            {/* Area 和 Product 標籤 */}
                            <div className="flex flex-col gap-0.5 min-w-[120px] flex-shrink-0">
                              <span className="text-xs text-white/40 leading-none">{task.tag.area}</span>
                              <span className="text-xs text-white/50 leading-none">{task.tag.product}</span>
                            </div>
                            <span className="text-white/90 flex-1">{task.title}</span>
                          </div>
                        ))}
                        {day.milestones.map((m) => (
                          <div
                            key={m.id}
                            className="flex items-start gap-2 bg-purple-500/20 rounded px-2 py-1.5 text-sm border border-purple-500/30"
                          >
                            <Flag className="h-4 w-4 text-purple-400 mt-0.5 flex-shrink-0" />
                            <span className="text-purple-300">{m.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
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
