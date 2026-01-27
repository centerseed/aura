"use client";

import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";

function DraggableTask({ id, title }: { id: string; title: string }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id,
    data: { type: 'task', taskId: id },
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`
        bg-white/10 border border-white/20 rounded-lg p-3 cursor-grab active:cursor-grabbing
        ${isDragging ? 'opacity-50' : ''}
      `}
    >
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-blue-500" />
        <span className="text-white">{title}</span>
      </div>
    </div>
  );
}

function DroppableProduct({ id, name, isOver }: { id: string; name: string; isOver: boolean }) {
  const { setNodeRef } = useDroppable({
    id: `product-${id}`,
    data: { type: 'product', productId: id },
  });

  return (
    <div
      ref={setNodeRef}
      className={`
        rounded-xl border-2 p-4 transition-all min-h-[150px]
        ${isOver
          ? 'border-indigo-500 bg-indigo-500/20 ring-2 ring-indigo-500/50'
          : 'border-white/10 bg-white/5'
        }
      `}
    >
      <h3 className="text-white font-medium mb-3">{name}</h3>
      <p className="text-white/50 text-sm">拖曳任務到這裡</p>
      {isOver && (
        <p className="text-indigo-400 text-sm mt-2">✓ 偵測到懸停</p>
      )}
    </div>
  );
}

export default function TestDndDebugPage() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overDropId, setOverDropId] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const addLog = (message: string) => {
    setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    addLog(`開始拖曳: ${event.active.id}`);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const overId = event.over?.id as string || null;
    setOverDropId(overId);
    if (overId) {
      addLog(`懸停在: ${overId}`);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setOverDropId(null);

    if (!over) {
      addLog(`拖曳結束: 沒有放置目標`);
      return;
    }

    addLog(`✅ 放置成功: ${active.id} → ${over.id}`);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold text-white mb-6">🧪 拖放功能測試</h1>

          <div className="grid grid-cols-2 gap-6 mb-6">
            {/* 左側：任務列表 */}
            <div className="space-y-3">
              <h2 className="text-lg font-medium text-white/80">任務</h2>
              <DraggableTask id="task-1" title="尋找同學會主要聯絡人" />
              <DraggableTask id="task-2" title="尋找通訊錄" />
              <DraggableTask id="task-3" title="尋找餐廳" />
            </div>

            {/* 右側：專案區域 */}
            <div className="space-y-3">
              <h2 className="text-lg font-medium text-white/80">專案</h2>
              <DroppableProduct
                id="product-1"
                name="辦同學會"
                isOver={overDropId === 'product-product-1'}
              />
              <DroppableProduct
                id="product-2"
                name="聚餐規劃"
                isOver={overDropId === 'product-product-2'}
              />
            </div>
          </div>

          {/* 事件日誌 */}
          <div className="bg-black/30 rounded-lg p-4 border border-white/10">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-medium text-white/80">事件日誌</h2>
              <button
                onClick={() => setLogs([])}
                className="text-xs text-white/50 hover:text-white/80 transition-colors"
              >
                清除
              </button>
            </div>
            <div className="space-y-1 max-h-60 overflow-y-auto font-mono text-xs">
              {logs.length === 0 ? (
                <p className="text-white/40">等待拖曳事件...</p>
              ) : (
                logs.map((log, i) => (
                  <div key={i} className="text-green-400">{log}</div>
                ))
              )}
            </div>
          </div>

          <div className="mt-6 bg-indigo-500/10 border border-indigo-500/30 rounded-lg p-4">
            <h3 className="text-indigo-300 font-medium mb-2">測試說明</h3>
            <ul className="text-white/70 text-sm space-y-1">
              <li>1. 拖曳左側任務到右側專案區域</li>
              <li>2. 觀察專案區域是否變藍(表示偵測到懸停)</li>
              <li>3. 放下後查看事件日誌確認是否成功</li>
              <li>4. 如果看不到藍色高亮或日誌沒有"懸停"訊息,表示 drop zone 沒有正常工作</li>
            </ul>
          </div>
        </div>

        {/* Drag Overlay */}
        <DragOverlay>
          {activeId ? (
            <div className="bg-slate-800 rounded-lg border-2 border-indigo-500 p-3 shadow-xl rotate-3">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                <span className="text-white">{activeId}</span>
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </div>
    </DndContext>
  );
}
