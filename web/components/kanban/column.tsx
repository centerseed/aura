"use client";

import { useDroppable } from "@dnd-kit/core";
import type { TaskCard, DrawerStatus } from "@/types";
import { DRAWER_CONFIG } from "@/domain/constants/drawer-config";
import { TaskCardComponent } from "./task-card";

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
  const config = DRAWER_CONFIG[id];
  const Icon = config.icon;

  return (
    <div
      ref={setNodeRef}
      className={`
        flex flex-col card-float bg-gradient-to-b ${config.columnGradient}
        min-h-[500px]
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
          (Array.isArray(tasks) ? tasks : []).map((task) => (
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
