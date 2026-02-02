"use client";

import { useDroppable } from "@dnd-kit/core";
import { Inbox, Rocket, RefreshCw, BookOpen, Archive } from "lucide-react";
import type { TaskCard, DrawerStatus } from "@/types";
import { TaskCardComponent } from "./task-card";

const COLUMN_CONFIG: Record<DrawerStatus, { icon: typeof Inbox; gradient: string; border: string }> = {
  INBOX: {
    icon: Inbox,
    gradient: "from-amber-500/10 to-orange-500/5",
    border: "border-amber-200 dark:border-amber-800",
  },
  ACTIVE: {
    icon: Rocket,
    gradient: "from-blue-500/10 to-cyan-500/5",
    border: "border-blue-200 dark:border-blue-800",
  },
  MAINTAIN: {
    icon: RefreshCw,
    gradient: "from-indigo-500/10 to-emerald-500/5",
    border: "border-indigo-200 dark:border-purple-800",
  },
  REFERENCE: {
    icon: BookOpen,
    gradient: "from-green-500/10 to-emerald-500/5",
    border: "border-green-200 dark:border-green-800",
  },
  ARCHIVE: {
    icon: Archive,
    gradient: "from-slate-500/10 to-slate-500/5",
    border: "border-slate-200 dark:border-slate-700",
  },
};

interface KanbanColumnProps {
  id: DrawerStatus;
  title: string;
  color: string;
  tasks: TaskCard[];
  onToggleSubItem?: (taskId: string, subItemId: string, completed: boolean) => void;
  onSetDueDate?: (taskId: string) => void;
  onComplete?: (taskId: string) => void;
}

export function KanbanColumn({ id, title, color, tasks, onToggleSubItem, onSetDueDate, onComplete }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const config = COLUMN_CONFIG[id];
  const Icon = config.icon;

  return (
    <div
      ref={setNodeRef}
      className={`
        flex flex-col rounded-2xl bg-gradient-to-b ${config.gradient}
        border-2 ${config.border}
        min-h-[500px] transition-all duration-200
        ${isOver ? "ring-2 ring-indigo-500 ring-offset-2 scale-[1.02]" : ""}
      `}
    >
      {/* Column Header */}
      <div className="p-4 border-b border-inherit">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg bg-${color}-100 dark:bg-${color}-900/50 flex items-center justify-center`}>
            <Icon className={`w-4 h-4 text-${color}-600 dark:text-${color}-400`} />
          </div>
          <div>
            <h3 className="font-semibold text-slate-800 dark:text-slate-200">{title}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">{tasks.length} 個項目</p>
          </div>
        </div>
      </div>

      {/* Tasks */}
      <div className="flex-1 p-3 space-y-3 overflow-y-auto">
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-slate-400">
            <Icon className="w-8 h-8 mb-2 opacity-30" />
            <p className="text-sm">拖放項目到這裡</p>
          </div>
        ) : (
          tasks.map((task) => (
            <TaskCardComponent
              key={task.id}
              task={task}
              onToggleSubItem={onToggleSubItem}
              onSetDueDate={onSetDueDate}
              onComplete={onComplete}
            />
          ))
        )}
      </div>
    </div>
  );
}
