"use client";

import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import type { TaskCard, DrawerStatus } from "@/types";
import { KanbanColumn } from "./column";
import { TaskCardComponent } from "./task-card";

const COLUMNS: { id: DrawerStatus; title: string; color: string }[] = [
  { id: "INBOX", title: "規劃中", color: "amber" },
  { id: "ACTIVE", title: "進行中", color: "blue" },
  { id: "MAINTAIN", title: "維護中", color: "blue" },
  { id: "REFERENCE", title: "參考資料", color: "green" },
];

interface KanbanBoardProps {
  tasks: TaskCard[];
  onTaskMove: (taskId: string, newDrawer: DrawerStatus) => void;
  onToggleSubItem?: (taskId: string, subItemId: string, completed: boolean) => void;
  onSetDueDate?: (taskId: string) => void;
  onComplete?: (taskId: string) => void;
}

export function KanbanBoard({ tasks, onTaskMove, onToggleSubItem, onSetDueDate, onComplete }: KanbanBoardProps) {
  const [activeTask, setActiveTask] = useState<TaskCard | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const task = tasks.find((t) => t.id === active.id);
    if (task) {
      setActiveTask(task);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      // 檢查是否拖到不同的 column
      const activeTask = tasks.find((t) => t.id === active.id);
      const overColumn = COLUMNS.find((c) => c.id === over.id);

      if (activeTask && overColumn) {
        onTaskMove(activeTask.id, overColumn.id);
      } else {
        // 可能是拖到另一個 task 上
        const overTask = tasks.find((t) => t.id === over.id);
        if (overTask && activeTask && activeTask.drawer !== overTask.drawer) {
          onTaskMove(activeTask.id, overTask.drawer);
        }
      }
    }

    setActiveTask(null);
  };

  // 按 drawer 分組任務
  const tasksByColumn = COLUMNS.reduce((acc, column) => {
    acc[column.id] = tasks.filter((t) => t.drawer === column.id);
    return acc;
  }, {} as Record<DrawerStatus, TaskCard[]>);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="grid grid-cols-4 gap-4 bg-app min-h-screen p-6 rounded-xl">
        {COLUMNS.map((column) => (
          <SortableContext
            key={column.id}
            items={tasksByColumn[column.id].map((t) => t.id)}
            strategy={verticalListSortingStrategy}
          >
            <KanbanColumn
              id={column.id}
              title={column.title}
              color={column.color}
              tasks={tasksByColumn[column.id]}
              onToggleSubItem={onToggleSubItem}
              onSetDueDate={onSetDueDate}
              onComplete={onComplete}
            />
          </SortableContext>
        ))}
      </div>

      <DragOverlay>
        {activeTask ? (
          <TaskCardComponent task={activeTask} isDragging />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
