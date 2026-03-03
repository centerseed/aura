'use client'

import { useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { PriorityPicker, type ProductPriority } from '@/components/priority-picker'
import type { ApiArea } from '../context/types'

interface ProductWithArea {
  id: string
  name: string
  areaName: string
  priority: ProductPriority
  activeTasks: number
  totalTasks: number
}

const PRIORITY_GROUPS: Array<{
  priority: ProductPriority
  color: string
  hoverColor: string
  dotColor: string
  label: string
  description: string
}> = [
  { priority: 'P0', color: 'border-orange-500/30 bg-orange-500/5', hoverColor: 'border-orange-500/70 bg-orange-500/15', dotColor: 'bg-orange-500', label: 'P0', description: '最高優先（本週必推進）' },
  { priority: 'P1', color: 'border-blue-500/30 bg-blue-500/5', hoverColor: 'border-blue-500/70 bg-blue-500/15', dotColor: 'bg-blue-500', label: 'P1', description: '重要（本月目標）' },
  { priority: 'P2', color: 'border-slate-400/30 bg-slate-400/5', hoverColor: 'border-slate-400/70 bg-slate-400/15', dotColor: 'bg-slate-400', label: 'P2', description: '一般（有空再做）' },
  { priority: 'P3', color: 'border-gray-500/20 bg-gray-500/5', hoverColor: 'border-gray-500/60 bg-gray-500/15', dotColor: 'bg-gray-500', label: 'P3', description: '低優先（長期擱置）' },
]

interface PriorityViewProps {
  areas: ApiArea[]
  onPriorityChange: (productId: string, priority: ProductPriority) => void
}

function DraggableCard({
  product,
  isDragging,
  onPriorityChange,
}: {
  product: ProductWithArea
  isDragging: boolean
  onPriorityChange: (productId: string, priority: ProductPriority) => void
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: product.id })

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-white/5 border border-white/10 rounded-lg p-3 flex flex-col gap-2 transition-all cursor-grab active:cursor-grabbing select-none
        ${isDragging ? 'opacity-30' : 'hover:bg-white/8'}`}
      {...listeners}
      {...attributes}
    >
      <p className="font-semibold text-white text-sm leading-tight line-clamp-2">{product.name}</p>
      <p className="text-xs text-white/40">{product.areaName}</p>
      <p className="text-xs text-white/50 mt-auto">活躍 {product.activeTasks} / {product.totalTasks}</p>
      <div onClick={(e) => e.stopPropagation()}>
        <PriorityPicker
          priority={product.priority}
          onSelect={(p) => onPriorityChange(product.id, p)}
        />
      </div>
    </div>
  )
}

function DroppableGroup({
  group,
  items,
  draggingId,
  onPriorityChange,
}: {
  group: typeof PRIORITY_GROUPS[number]
  items: ProductWithArea[]
  draggingId: string | null
  onPriorityChange: (productId: string, priority: ProductPriority) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: group.priority })
  const draggingProduct = draggingId ? items.find((p) => p.id === draggingId) : null
  const isAlreadyInGroup = draggingProduct?.priority === group.priority

  return (
    <div
      ref={setNodeRef}
      className={`rounded-xl border p-5 transition-all duration-150
        ${isOver && !isAlreadyInGroup ? group.hoverColor : group.color}`}
    >
      <div className="flex items-center gap-3 mb-4">
        <span className={`w-3 h-3 rounded-full shrink-0 ${group.dotColor}`} />
        <span className="font-semibold text-white/90 text-sm">
          {group.label} — {group.description}
        </span>
        <span className="ml-auto text-xs text-white/40">{items.length} 個專案</span>
      </div>

      {items.length === 0 ? (
        <p className={`text-xs pl-6 transition-colors ${isOver && !isAlreadyInGroup ? 'text-white/60' : 'text-white/30'}`}>
          {isOver && !isAlreadyInGroup ? '放開以移入此優先度' : '此優先度目前沒有專案'}
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {items.map((product) => (
            <DraggableCard
              key={product.id}
              product={product}
              isDragging={product.id === draggingId}
              onPriorityChange={onPriorityChange}
            />
          ))}
          {isOver && !isAlreadyInGroup && (
            <div className="border-2 border-dashed border-white/20 rounded-lg p-3 min-h-[80px]" />
          )}
        </div>
      )}
    </div>
  )
}

function CardOverlay({ product }: { product: ProductWithArea }) {
  const group = PRIORITY_GROUPS.find((g) => g.priority === product.priority)
  const glowColor = group?.priority === 'P0' ? 'shadow-orange-500/30'
    : group?.priority === 'P1' ? 'shadow-blue-500/30'
    : 'shadow-white/10'

  return (
    <div className={`bg-white/10 border border-white/20 rounded-lg p-3 flex flex-col gap-2 shadow-2xl ${glowColor} w-48 rotate-2 opacity-90`}>
      <p className="font-semibold text-white text-sm leading-tight line-clamp-2">{product.name}</p>
      <p className="text-xs text-white/40">{product.areaName}</p>
      <p className="text-xs text-white/50">活躍 {product.activeTasks} / {product.totalTasks}</p>
    </div>
  )
}

export function PriorityView({ areas, onPriorityChange }: PriorityViewProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  const products: ProductWithArea[] = (Array.isArray(areas) ? areas : []).flatMap((area) =>
    (Array.isArray(area.products) ? area.products : []).map((product) => ({
      id: product.id,
      name: product.name,
      areaName: area.name,
      priority: product.priority as ProductPriority,
      activeTasks: product.tasks.filter((t) => t && t.drawer !== 'ARCHIVE').length,
      totalTasks: product.tasks.length,
    }))
  )

  const grouped = Object.fromEntries(
    PRIORITY_GROUPS.map((g) => [g.priority, products.filter((p) => p.priority === g.priority)])
  )

  const draggingProduct = draggingId ? products.find((p) => p.id === draggingId) : null

  function handleDragStart(event: DragStartEvent) {
    setDraggingId(String(event.active.id))
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setDraggingId(null)
    if (!over) return
    const targetPriority = over.id as ProductPriority
    const product = products.find((p) => p.id === active.id)
    if (!product || product.priority === targetPriority) return
    onPriorityChange(String(active.id), targetPriority)
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex flex-col gap-6">
        {PRIORITY_GROUPS.map((group) => (
          <DroppableGroup
            key={group.priority}
            group={group}
            items={grouped[group.priority] ?? []}
            draggingId={draggingId}
            onPriorityChange={onPriorityChange}
          />
        ))}
      </div>
      <DragOverlay>
        {draggingProduct ? <CardOverlay product={draggingProduct} /> : null}
      </DragOverlay>
    </DndContext>
  )
}
