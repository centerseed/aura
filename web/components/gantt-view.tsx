"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronRight, ChevronDown, Calendar, Flag, Star } from "lucide-react";
import type { TaskCard, DrawerStatus } from "@/types";

interface Milestone {
  id: string;
  name: string;
  target_date: Date;
  entity_type: string;
  entity_id: string;
}

interface GanttViewProps {
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
  drawerConfig: Record<DrawerStatus, { label: string; dotColor: string }>;
}

// 獲取日期範圍
function getDateRange(tasks: TaskCard[], milestones: Milestone[]) {
  const dates: Date[] = [];

  tasks.forEach((task) => {
    if (task.due_date) dates.push(new Date(task.due_date));
  });

  milestones.forEach((m) => {
    dates.push(new Date(m.target_date));
  });

  if (dates.length === 0) {
    const now = new Date();
    return {
      start: now,
      end: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000), // 30 天後
    };
  }

  const sortedDates = dates.sort((a, b) => a.getTime() - b.getTime());
  const start = new Date(sortedDates[0]);
  const end = new Date(sortedDates[sortedDates.length - 1]);

  // 加上一些 padding
  start.setDate(start.getDate() - 7);
  end.setDate(end.getDate() + 14);

  return { start, end };
}

// 生成週標籤
function generateWeekLabels(start: Date, end: Date) {
  const weeks: Date[] = [];
  const current = new Date(start);

  // 移到週一
  while (current.getDay() !== 1) {
    current.setDate(current.getDate() - 1);
  }

  while (current <= end) {
    weeks.push(new Date(current));
    current.setDate(current.getDate() + 7);
  }

  return weeks;
}

// 計算任務在時間軸上的位置和寬度
function calculateTaskPosition(
  task: { start_date?: string | Date | null; due_date: string | Date },
  rangeStart: Date,
  rangeEnd: Date
): { left: number; width: number } {
  const totalDays = (rangeEnd.getTime() - rangeStart.getTime()) / (1000 * 60 * 60 * 24);
  const dueDate = task.due_date instanceof Date ? task.due_date : new Date(task.due_date);

  if (task.start_date) {
    // Case 1: Has start_date → show as bar
    const startDate = task.start_date instanceof Date ? task.start_date : new Date(task.start_date);
    const taskStartDay = (startDate.getTime() - rangeStart.getTime()) / (1000 * 60 * 60 * 24);
    const taskEndDay = (dueDate.getTime() - rangeStart.getTime()) / (1000 * 60 * 60 * 24);

    const left = (taskStartDay / totalDays) * 100;
    const width = ((taskEndDay - taskStartDay) / totalDays) * 100;

    return {
      left: Math.max(0, Math.min(100, left)),
      width: Math.max(1, Math.min(100, width)) // Minimum 1% width
    };
  } else {
    // Case 2: No start_date → show as point (existing behavior)
    const daysSinceStart = (dueDate.getTime() - rangeStart.getTime()) / (1000 * 60 * 60 * 24);
    const left = (daysSinceStart / totalDays) * 100;

    return {
      left: Math.max(0, Math.min(100, left)),
      width: 2 // Keep as point
    };
  }
}

function GanttViewComponent({ areas, milestones, drawerConfig }: GanttViewProps) {
  const [expandedAreas, setExpandedAreas] = useState<Set<string>>(
    new Set(areas.map((a) => a.id))
  );
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());

  const allTasks = useMemo(() => {
    return areas.flatMap((area) =>
      area.products.flatMap((product) => product.tasks)
    );
  }, [areas]);

  const { start, end } = useMemo(() => getDateRange(allTasks, milestones), [allTasks, milestones]);
  const weekLabels = useMemo(() => generateWeekLabels(start, end), [start, end]);

  const toggleArea = (areaId: string) => {
    setExpandedAreas((prev) => {
      const next = new Set(prev);
      if (next.has(areaId)) next.delete(areaId);
      else next.add(areaId);
      return next;
    });
  };

  const toggleTask = (taskId: string) => {
    setExpandedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  // 今天的標記線位置
  const todayPosition = useMemo(() => {
    // 設置為今天的午夜 (00:00:00)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const totalDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    const daysSinceStart = (today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    return (daysSinceStart / totalDays) * 100;
  }, [start, end]);

  return (
    <Card className="bg-white/5 border-white/10 backdrop-blur-xl overflow-hidden">
      <CardHeader className="border-b border-white/10">
        <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          甘特圖視圖
        </CardTitle>
      </CardHeader>

      <CardContent className="p-0">
        {/* 時間軸 Header */}
        <div className="border-b border-white/10 bg-slate-900/50 sticky top-0 z-10">
          <div className="flex">
            {/* 左側實體列 */}
            <div className="w-64 shrink-0 px-4 py-3 border-r border-white/10">
              <span className="text-xs font-medium text-white/50 uppercase tracking-wider">
                實體結構
              </span>
            </div>

            {/* 時間軸 */}
            <div className="flex-1 relative overflow-x-auto">
              <div className="flex h-full">
                {weekLabels.map((week, idx) => (
                  <div
                    key={idx}
                    className="flex-1 px-2 py-3 border-r border-white/5 text-center"
                    style={{ minWidth: "80px" }}
                  >
                    <div className="text-xs text-white/60">
                      {week.getMonth() + 1}/{week.getDate()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 甘特圖內容 */}
        <div className="relative">
          {/* 今天標記線 */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-red-500/50 z-20 pointer-events-none"
            style={{ left: `calc(256px + (100% - 256px) * ${todayPosition / 100})` }}
          >
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 text-xs text-red-400 bg-red-900/50 px-1 rounded">
              今天
            </div>
          </div>

          {/* Areas 和 Products */}
          {areas.map((area) => {
            const isExpanded = expandedAreas.has(area.id);
            const areaMilestones = milestones.filter(
              (m) => m.entity_type === "AREA" && m.entity_id === area.id
            );

            return (
              <div key={area.id} className="border-b border-white/5">
                {/* Area 行 */}
                <div className="flex hover:bg-white/5 transition-colors">
                  <div className="w-64 shrink-0 px-4 py-3 border-r border-white/10">
                    <button
                      onClick={() => toggleArea(area.id)}
                      className="flex items-center gap-2 w-full text-left"
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-white/50" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-white/50" />
                      )}
                      <span className="font-medium text-white text-sm">
                        {area.name}
                      </span>
                    </button>
                  </div>

                  {/* Area timeline */}
                  <div className="flex-1 relative py-3">
                    {areaMilestones.map((milestone) => {
                      const pos = calculateTaskPosition(
                        { due_date: milestone.target_date },
                        start,
                        end
                      );
                      return (
                        <div
                          key={milestone.id}
                          className="absolute top-1/2 -translate-y-1/2 group cursor-pointer"
                          style={{ left: `${pos.left}%` }}
                        >
                          <div className="relative">
                            <Flag
                              className="w-5 h-5 text-indigo-400 fill-purple-400 drop-shadow-lg group-hover:scale-125 transition-transform"
                            />
                            <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 border border-white/20 rounded px-3 py-2 text-xs text-white pointer-events-none z-30 shadow-xl">
                              <div className="font-semibold text-indigo-300">{milestone.name}</div>
                              <div className="text-white/60 text-xs mt-0.5">
                                {new Date(milestone.target_date).toLocaleDateString('zh-TW')}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Products and Tasks */}
                {isExpanded &&
                  area.products.map((product) => {
                    const productMilestones = milestones.filter(
                      (m) => m.entity_type === "PRODUCT" && m.entity_id === product.id
                    );
                    const tasksWithDates = product.tasks.filter((t) => t.due_date);

                    return (
                      <div key={product.id}>
                        {/* Product row */}
                        <div className="flex hover:bg-white/5 transition-colors border-b border-white/5">
                          <div className="w-64 shrink-0 px-4 py-3 pl-12 border-r border-white/10">
                            <span className="text-sm text-white/70">
                              📦 {product.name}
                            </span>
                          </div>

                          {/* Product timeline */}
                          <div className="flex-1 relative py-3">
                            {/* Product milestones */}
                            {productMilestones.map((milestone) => {
                              const pos = calculateTaskPosition(
                                { due_date: milestone.target_date },
                                start,
                                end
                              );
                              return (
                                <div
                                  key={milestone.id}
                                  className="absolute top-1/2 -translate-y-1/2 group cursor-pointer"
                                  style={{ left: `${pos.left}%` }}
                                >
                                  <div className="relative">
                                    <Star
                                      className="w-5 h-5 text-yellow-300 fill-yellow-300 drop-shadow-lg group-hover:scale-125 transition-transform"
                                    />
                                    <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 border border-white/20 rounded px-3 py-2 text-xs text-white pointer-events-none z-30 shadow-xl">
                                      <div className="font-semibold text-yellow-300">{milestone.name}</div>
                                      <div className="text-white/60 text-xs mt-0.5">
                                        {new Date(milestone.target_date).toLocaleDateString('zh-TW')}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Task rows */}
                        {tasksWithDates.map((task) => {
                          const pos = calculateTaskPosition(
                            task as { start_date?: string | null; due_date: string },
                            start,
                            end
                          );
                          const config = drawerConfig[task.drawer] || drawerConfig.INBOX;
                          const isTaskExpanded = expandedTasks.has(task.id);
                          const hasSubItems = task.sub_items && task.sub_items.length > 0;

                          return (
                            <div key={task.id}>
                              {/* Task row */}
                              <div className="flex hover:bg-white/5 transition-colors border-b border-white/5">
                                <div className="w-64 shrink-0 px-4 py-2.5 pl-16 border-r border-white/10">
                                  <button
                                    onClick={() => hasSubItems && toggleTask(task.id)}
                                    className="flex items-center gap-1.5 w-full text-left group"
                                    disabled={!hasSubItems}
                                  >
                                    {hasSubItems ? (
                                      isTaskExpanded ? (
                                        <ChevronDown className="w-3 h-3 text-white/40 shrink-0" />
                                      ) : (
                                        <ChevronRight className="w-3 h-3 text-white/40 shrink-0" />
                                      )
                                    ) : (
                                      <div className="w-3 h-3 shrink-0" />
                                    )}
                                    <span className={`text-xs truncate ${hasSubItems ? 'text-white/80 group-hover:text-white' : 'text-white/60'}`}>
                                      {task.title}
                                    </span>
                                    {hasSubItems && (
                                      <span className="text-[10px] text-white/40 shrink-0">
                                        {task.sub_items_meta?.completed}/{task.sub_items_meta?.total}
                                      </span>
                                    )}
                                  </button>
                                </div>

                                {/* Task timeline */}
                                <div className="flex-1 relative py-2.5">
                                  <div
                                    className="absolute top-1/2 -translate-y-1/2 group"
                                    style={{ left: `${pos.left}%`, width: `${pos.width}%` }}
                                  >
                                    <div
                                      className={`
                                        ${pos.width > 2 ? 'h-3' : 'h-2'}
                                        rounded-full
                                        ${config.dotColor}
                                        relative
                                        transition-opacity
                                        hover:opacity-80
                                      `}
                                    >
                                      <div className="absolute left-0 top-full mt-1 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 border border-white/20 rounded px-2 py-1 text-xs text-white pointer-events-none z-30">
                                        <div className="font-medium">{task.title}</div>
                                        {task.start_date && (
                                          <div className="text-white/50 text-xs">
                                            {new Date(task.start_date).toLocaleDateString('zh-TW')} - {new Date(task.due_date!).toLocaleDateString('zh-TW')}
                                          </div>
                                        )}
                                        {task.time_confidence !== undefined && task.time_confidence !== null && (
                                          <div className="text-white/50 text-xs">
                                            AI 時間推斷信心: {Math.round(task.time_confidence * 100)}%
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Sub-items rows */}
                              {hasSubItems && isTaskExpanded && task.sub_items!.map((subItem) => (
                                <div
                                  key={subItem.id}
                                  className="flex hover:bg-white/5 transition-colors border-b border-white/5"
                                >
                                  <div className="w-64 shrink-0 px-4 py-2 pl-20 border-r border-white/10">
                                    <span className={`text-xs ${subItem.completed ? 'text-white/40 line-through' : 'text-white/60'}`}>
                                      ✓ {subItem.content}
                                    </span>
                                  </div>
                                  <div className="flex-1 relative py-2">
                                    {/* Sub-item marker */}
                                    <div
                                      className={`absolute top-1/2 -translate-y-1/2 left-4 w-2 h-2 rounded-full ${
                                        subItem.completed ? 'bg-green-500/50' : 'bg-blue-500/50'
                                      }`}
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export { GanttViewComponent as GanttView };
