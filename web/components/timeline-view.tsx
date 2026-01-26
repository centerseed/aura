"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, Calendar, Target, AlertCircle, Sparkles } from "lucide-react";
import type { TaskCard, DrawerStatus, Milestone } from "@/types";

interface TimelineViewProps {
  tasks: TaskCard[];
  drawerConfig: Record<DrawerStatus, { label: string; dotColor: string }>;
  milestones?: Milestone[];
  onSetDueDate?: (task: TaskCard) => void;
}

// 計算相對時間描述
function getRelativeTimeDesc(dueDate: Date): { text: string; isOverdue: boolean } {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);

  const diffMs = due.getTime() - now.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return { text: `逾期 ${Math.abs(diffDays)} 天`, isOverdue: true };
  if (diffDays === 0) return { text: "今天", isOverdue: false };
  if (diffDays === 1) return { text: "明天", isOverdue: false };
  if (diffDays < 7) return { text: `${diffDays} 天後`, isOverdue: false };
  if (diffDays < 14) return { text: "下週", isOverdue: false };
  if (diffDays < 30) return { text: `${Math.floor(diffDays / 7)} 週後`, isOverdue: false };
  return { text: `${Math.floor(diffDays / 30)} 個月後`, isOverdue: false };
}

// 分組任務 - 按具體日期分組(類似 Google Calendar)
function groupTasksByDate(tasks: TaskCard[]) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  // 建立今天、明天、後天的日期
  const today = new Date(now);
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dayAfterTomorrow = new Date(now);
  dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);

  const groups = {
    overdue: [] as TaskCard[],
    today: [] as TaskCard[],
    tomorrow: [] as TaskCard[],
    dayAfterTomorrow: [] as TaskCard[],
    later: [] as TaskCard[],
    noDueDate: [] as TaskCard[],
  };

  tasks.forEach((task) => {
    if (!task.due_date) {
      groups.noDueDate.push(task);
      return;
    }

    const dueDate = new Date(task.due_date);
    dueDate.setHours(0, 0, 0, 0);

    if (dueDate < today) {
      groups.overdue.push(task);
    } else if (dueDate.getTime() === today.getTime()) {
      groups.today.push(task);
    } else if (dueDate.getTime() === tomorrow.getTime()) {
      groups.tomorrow.push(task);
    } else if (dueDate.getTime() === dayAfterTomorrow.getTime()) {
      groups.dayAfterTomorrow.push(task);
    } else {
      groups.later.push(task);
    }
  });

  // Sort each group by due_date (earliest first)
  const sortByDueDate = (a: TaskCard, b: TaskCard) => {
    if (!a.due_date || !b.due_date) return 0;
    return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
  };

  Object.values(groups).forEach((group) => group.sort(sortByDueDate));

  return groups;
}

function TaskItem({
  task,
  drawerConfig,
  milestones,
  onSetDueDate,
}: {
  task: TaskCard;
  drawerConfig: any;
  milestones?: Milestone[];
  onSetDueDate?: (task: TaskCard) => void;
}) {
  const config = drawerConfig[task.drawer] || drawerConfig.INBOX;
  const dueDate = task.due_date ? new Date(task.due_date) : null;
  const timeInfo = dueDate ? getRelativeTimeDesc(dueDate) : null;

  // 檢查是否為低信心度
  const isLowConfidence =
    task.time_confidence !== null &&
    task.time_confidence !== undefined &&
    task.time_confidence < 0.6;

  // 查找關聯的里程碑
  const relatedMilestone =
    task.inferred_from_milestone && milestones
      ? milestones.find((m) => m.id === task.inferred_from_milestone)
      : null;

  return (
    <div className="group bg-white/5 rounded-lg border border-white/10 p-3 hover:bg-white/10 transition-all">
      <div className="flex items-start gap-3">
        <div className={`mt-1.5 w-2 h-2 rounded-full ${config.dotColor} shrink-0`} />

        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-white text-sm leading-snug mb-1">
            {task.title}
          </h4>

          {task.narrative && (
            <p className="text-xs text-white/50 leading-relaxed mb-2">
              {task.narrative}
            </p>
          )}

          {/* 時間資訊區 */}
          <div className="flex items-center gap-2 text-xs flex-wrap">
            {/* 截止日期按鈕 */}
            {timeInfo ? (
              <button
                onClick={() => onSetDueDate?.(task)}
                className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg transition-colors ${
                  timeInfo.isOverdue
                    ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                    : "bg-white/10 text-white/70 hover:bg-white/20"
                }`}
              >
                {timeInfo.isOverdue ? (
                  <AlertCircle className="w-3 h-3" />
                ) : (
                  <Calendar className="w-3 h-3" />
                )}
                <span>{timeInfo.text}</span>
              </button>
            ) : (
              <button
                onClick={() => onSetDueDate?.(task)}
                className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/60 transition-colors"
              >
                <Calendar className="w-3 h-3" />
                <span>設定日期</span>
              </button>
            )}

            {/* AI 信心標記 */}
            {task.time_confidence !== undefined && task.time_confidence !== null && (
              <div
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg ${
                  isLowConfidence
                    ? "bg-orange-500/20 text-orange-400"
                    : task.time_confidence >= 0.8
                    ? "bg-green-500/20 text-green-400"
                    : "bg-blue-500/20 text-blue-400"
                }`}
                title={`AI 時間推斷信心度：${Math.round(task.time_confidence * 100)}%\n\n此功能正在開發中\n${isLowConfidence ? '信心度較低，建議手動確認截止日期' : '系統根據 Milestone 與任務語意自動推斷'}`}
              >
                {isLowConfidence && <AlertCircle className="w-3 h-3" />}
                <Sparkles className="w-3 h-3" />
                <span>{Math.round(task.time_confidence * 100)}%</span>
              </div>
            )}

            {/* Milestone 關聯提示 */}
            {relatedMilestone && (
              <div
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-500/20 text-indigo-400"
                title={`關聯里程碑：${relatedMilestone.name}`}
              >
                <Target className="w-3 h-3" />
                <span className="truncate max-w-[120px]">{relatedMilestone.name}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function TimelineSection({
  title,
  icon: Icon,
  count,
  tasks,
  drawerConfig,
  milestones,
  onSetDueDate,
  color = "text-white",
}: {
  title: string;
  icon: any;
  count: number;
  tasks: TaskCard[];
  drawerConfig: any;
  milestones?: Milestone[];
  onSetDueDate?: (task: TaskCard) => void;
  color?: string;
}) {
  if (count === 0) return null;

  return (
    <Card className="bg-white/5 border-white/10 backdrop-blur-xl">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Icon className={`w-5 h-5 ${color}`} />
            <CardTitle className={`text-base font-semibold ${color}`}>
              {title}
            </CardTitle>
          </div>
          <span className="text-xs bg-white/10 px-2.5 py-1 rounded-full text-white/60">
            {count} 個任務
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {tasks.map((task) => (
          <TaskItem
            key={task.id}
            task={task}
            drawerConfig={drawerConfig}
            milestones={milestones}
            onSetDueDate={onSetDueDate}
          />
        ))}
      </CardContent>
    </Card>
  );
}

export function TimelineView({ tasks, drawerConfig, milestones, onSetDueDate }: TimelineViewProps) {
  const groups = useMemo(() => groupTasksByDate(tasks), [tasks]);

  // 獲取日期顯示文字
  const getTodayDateText = () => {
    const today = new Date();
    return `今天 ${today.getMonth() + 1}/${today.getDate()}`;
  };

  const getTomorrowDateText = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return `明天 ${tomorrow.getMonth() + 1}/${tomorrow.getDate()}`;
  };

  const getDayAfterTomorrowDateText = () => {
    const dayAfter = new Date();
    dayAfter.setDate(dayAfter.getDate() + 2);
    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    return `後天 ${dayAfter.getMonth() + 1}/${dayAfter.getDate()} (週${weekdays[dayAfter.getDay()]})`;
  };

  return (
    <div className="space-y-4">
      {/* 已逾期 */}
      <TimelineSection
        title="🔴 已逾期"
        icon={Clock}
        count={groups.overdue.length}
        tasks={groups.overdue}
        drawerConfig={drawerConfig}
        milestones={milestones}
        onSetDueDate={onSetDueDate}
        color="text-red-400"
      />

      {/* 今天 */}
      <TimelineSection
        title={`📍 ${getTodayDateText()}`}
        icon={Calendar}
        count={groups.today.length}
        tasks={groups.today}
        drawerConfig={drawerConfig}
        milestones={milestones}
        onSetDueDate={onSetDueDate}
        color="text-orange-400"
      />

      {/* 明天 */}
      <TimelineSection
        title={`📅 ${getTomorrowDateText()}`}
        icon={Calendar}
        count={groups.tomorrow.length}
        tasks={groups.tomorrow}
        drawerConfig={drawerConfig}
        milestones={milestones}
        onSetDueDate={onSetDueDate}
        color="text-blue-400"
      />

      {/* 後天 */}
      <TimelineSection
        title={`📆 ${getDayAfterTomorrowDateText()}`}
        icon={Calendar}
        count={groups.dayAfterTomorrow.length}
        tasks={groups.dayAfterTomorrow}
        drawerConfig={drawerConfig}
        milestones={milestones}
        onSetDueDate={onSetDueDate}
        color="text-green-400"
      />

      {/* 稍後 */}
      <TimelineSection
        title="🗓️ 稍後"
        icon={Calendar}
        count={groups.later.length}
        tasks={groups.later}
        drawerConfig={drawerConfig}
        milestones={milestones}
        onSetDueDate={onSetDueDate}
        color="text-indigo-400"
      />

      {/* 無截止日期 */}
      {groups.noDueDate.length > 0 && (
        <Card className="bg-white/5 border-white/10 backdrop-blur-xl border-dashed">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold text-white/50">
                ⚪ 無截止日期
              </CardTitle>
              <span className="text-xs bg-white/10 px-2.5 py-1 rounded-full text-white/40">
                {groups.noDueDate.length} 個任務
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {groups.noDueDate.map((task: TaskCard) => (
              <TaskItem
                key={task.id}
                task={task}
                drawerConfig={drawerConfig}
                milestones={milestones}
                onSetDueDate={onSetDueDate}
              />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
