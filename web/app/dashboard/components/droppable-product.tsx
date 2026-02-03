/**
 * DroppableProduct - 可拖放的產品區塊
 *
 * 同時支援作為拖曳來源和放置目標
 */

'use client'

import { useDraggable, useDroppable } from '@dnd-kit/core'
import {
  Package,
  GripVertical,
  Target,
  Plus,
  Sparkles,
  Loader2,
  FileText,
} from 'lucide-react'
import type { TaskCard, Milestone } from '@/types'
import { DraggableTaskItem } from './draggable-task-item'

export interface DroppableProductProps {
  productId: string
  productName: string
  productDescription?: string | null
  productLifecycle: 'FINITE' | 'PERPETUAL'
  productStatus: string
  referenceCount?: number
  tasks: TaskCard[]
  isOver: boolean
  milestones: Milestone[]
  onEditMilestone: (milestone?: Milestone | Partial<Milestone>) => void
  areaId: string
  onSetDueDate?: (task: TaskCard) => void
  onComplete?: (taskId: string) => void
  onReorganize?: (productId: string, productName: string) => void
  onToggleSubItem?: (taskId: string, subItemId: string, completed: boolean) => void
  onDeleteSubItem?: (taskId: string, subItemId: string) => void
  onPromoteSubItem?: (taskId: string, subItemId: string) => void
  onEditSubItem?: (taskId: string, subItemId: string, newContent: string) => void
  onAddSubItem?: (taskId: string, content: string) => void
  onDeleteReference?: (taskId: string, referenceId: string) => void
  onOpenTaskDetail?: (task: TaskCard) => void
  onRename?: (productId: string, newName: string) => void
  onEdit?: (product: { id: string; name: string; description?: string | null; lifecycle: 'FINITE' | 'PERPETUAL'; status: string }) => void
  onShowReferences?: (product: { id: string; name: string; description?: string | null; lifecycle: 'FINITE' | 'PERPETUAL'; status: string }) => void
  onOpenTasks?: (product: { id: string; name: string }) => void
  onEditTaskTitle?: (taskId: string, newTitle: string) => void
  isReorganizing?: boolean
}

export function DroppableProduct({
  productId,
  productName,
  productDescription,
  productLifecycle,
  productStatus,
  referenceCount = 0,
  tasks,
  isOver,
  milestones,
  onEditMilestone,
  areaId,
  onSetDueDate,
  onComplete,
  onReorganize,
  onToggleSubItem,
  onDeleteSubItem,
  onPromoteSubItem,
  onEditSubItem,
  onAddSubItem,
  onDeleteReference,
  onOpenTaskDetail,
  onEdit,
  onShowReferences,
  onOpenTasks,
  onEditTaskTitle,
  isReorganizing = false,
}: DroppableProductProps) {
  // 作為放置目標（接收 Task 和其他 Product）
  const { setNodeRef: setDropRef } = useDroppable({
    id: `product-${productId}`,
    data: { type: 'product', productId, areaId },
  })

  // 作為可拖曳項目（拖曳到 Area 或其他 Product）
  const { attributes, listeners, setNodeRef: setDragRef, transform, isDragging } = useDraggable({
    id: `draggable-product-${productId}`,
    data: {
      type: 'product',
      productId,
      productName,
      areaId,
    },
  })

  // 合併兩個 refs
  const setRefs = (element: HTMLDivElement | null) => {
    setDropRef(element)
    setDragRef(element)
  }

  // 篩選此 Product 的所有里程碑（支援多個，排除已過期）
  const productMilestones = (Array.isArray(milestones) ? milestones : [])
    .filter((m) => m.entity_type === 'PRODUCT' && m.entity_id === productId)
    .filter((m) => m.status !== 'completed' && m.status !== 'cancelled')
    .filter((m) => {
      // 排除已過期的 milestone
      const daysRemaining = Math.ceil(
        (new Date(m.target_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
      )
      return daysRemaining >= 0
    })
    .sort((a, b) => new Date(a.target_date).getTime() - new Date(b.target_date).getTime())

  const hasMilestone = productMilestones.length > 0

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined

  return (
    <div
      ref={setRefs}
      style={style}
      {...attributes}
      className={`
        rounded-xl border-2 transition-all duration-200
        ${isDragging ? 'opacity-50 scale-105' : ''}
        ${isOver
          ? 'border-indigo-500 bg-indigo-500/20 ring-2 ring-indigo-500/50 scale-[1.02]'
          : 'border-white/10 bg-white/5 backdrop-blur-sm'
        }
      `}
    >
      <div className="border-b border-white/10">
        {/* Product Header */}
        <div
          className="px-4 py-3 group/header cursor-grab active:cursor-grabbing hover:bg-white/5 transition-colors"
          {...listeners}
        >
          <div className="flex items-center gap-2">
            <GripVertical className="w-4 h-4 text-white/30 group-hover/header:text-white/60 transition-colors" />
            <Package className="w-4 h-4 text-white/50" />
            <button
              onClick={(e) => {
                e.stopPropagation()
                onOpenTasks?.({
                  id: productId,
                  name: productName,
                })
              }}
              className="font-medium text-white flex-1 truncate text-left hover:text-indigo-300 transition-colors"
              title="點擊查看專案任務"
            >
              {productName}
            </button>

            {/* References 按鈕 - 只在有 references 時顯示 */}
            {referenceCount > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onShowReferences?.({
                    id: productId,
                    name: productName,
                    description: productDescription,
                    lifecycle: productLifecycle,
                    status: productStatus,
                  })
                }}
                className="p-1.5 rounded-md border bg-amber-500/10 border-amber-500/30 hover:bg-amber-500/20 hover:border-amber-400/50 transition-all"
                title={`查看相關資料 (${referenceCount})`}
              >
                <FileText className="w-3.5 h-3.5 text-amber-400" />
              </button>
            )}

            {/* AI Reorganize 按鈕 */}
            {onReorganize && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onReorganize(productId, productName)
                }}
                disabled={isReorganizing}
                className={`p-1.5 rounded-md border transition-all ${
                  isReorganizing
                    ? 'bg-indigo-500/30 border-indigo-400/50 cursor-wait'
                    : 'bg-indigo-500/10 border-indigo-500/30 hover:bg-indigo-500/20 hover:border-indigo-400/50'
                }`}
                title={isReorganizing ? 'AI 分析中...' : 'AI 自動整理 Topics 與時間'}
              >
                {isReorganizing ? (
                  <Loader2 className="w-3.5 h-3.5 text-indigo-400 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                )}
              </button>
            )}
          </div>
        </div>

        {/* 里程碑列表（支援多個）*/}
        {hasMilestone && (
          <div className="px-4 pb-2 flex flex-wrap gap-1.5">
            {productMilestones.map((milestone) => {
              const daysRemaining = Math.ceil(
                (new Date(milestone.target_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
              )
              const isUrgent = daysRemaining <= 7 && daysRemaining >= 0
              const isOverdue = daysRemaining < 0

              return (
                <button
                  key={milestone.id}
                  onClick={() => onEditMilestone(milestone)}
                  className="group flex items-center gap-1.5 px-2 py-1 rounded-md bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/20 transition-colors"
                  title={`點擊編輯「${milestone.name}」`}
                >
                  <Target className="w-3 h-3 text-indigo-400 shrink-0" />
                  <span className="text-xs text-white/70 max-w-[120px] truncate">
                    {milestone.name}
                  </span>
                  <span
                    className={`text-xs font-medium shrink-0 ${
                      isOverdue
                        ? 'text-red-400'
                        : isUrgent
                        ? 'text-orange-400'
                        : 'text-indigo-300'
                    }`}
                  >
                    {isOverdue
                      ? `逾期${Math.abs(daysRemaining)}天`
                      : `${daysRemaining}天`}
                  </span>
                </button>
              )
            })}

            {/* 新增里程碑按鈕 */}
            <button
              onClick={() => onEditMilestone({ entity_type: 'PRODUCT', entity_id: productId })}
              className="flex items-center gap-1 px-2 py-1 rounded-md border border-dashed border-white/20 hover:border-indigo-400/50 hover:bg-indigo-500/10 transition-colors group"
              title="新增里程碑"
            >
              <Plus className="w-3 h-3 text-white/40 group-hover:text-indigo-400 transition-colors" />
              <span className="text-xs text-white/40 group-hover:text-indigo-300 transition-colors">新增</span>
            </button>
          </div>
        )}

        {/* 沒有里程碑時顯示設定按鈕 */}
        {!hasMilestone && (
          <div className="px-4 pb-2">
            <button
              onClick={() => onEditMilestone({ entity_type: 'PRODUCT', entity_id: productId })}
              className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-dashed border-white/20 hover:border-indigo-400/50 hover:bg-indigo-500/10 transition-colors w-full justify-center group"
              title="設定第一個里程碑"
            >
              <Target className="w-3 h-3 text-white/30 group-hover:text-indigo-400 transition-colors" />
              <span className="text-xs text-white/40 group-hover:text-indigo-300 transition-colors">設定里程碑</span>
            </button>
          </div>
        )}
      </div>

      <div className="p-3 space-y-2 min-h-[80px]">
        {tasks.length === 0 ? (
          <div className="flex items-center justify-center h-16 text-white/30 text-sm">
            拖曳任務到這裡
          </div>
        ) : (
          [...tasks]
            .sort((a, b) => {
              // 有 due_date 的排前面
              if (a.due_date && !b.due_date) return -1
              if (!a.due_date && b.due_date) return 1
              if (!a.due_date && !b.due_date) return 0
              // 兩個都有 due_date，按日期排序（早的在前）
              return new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime()
            })
            .map((task) => (
              <DraggableTaskItem
                key={task.id}
                task={task}
                onSetDueDate={onSetDueDate}
                onComplete={onComplete}
                onToggleSubItem={onToggleSubItem}
                onDeleteSubItem={onDeleteSubItem}
                onPromoteSubItem={onPromoteSubItem}
                onEditTitle={onEditTaskTitle}
                onEditSubItem={onEditSubItem}
                onAddSubItem={onAddSubItem}
                onDeleteReference={onDeleteReference}
                onOpenDetail={() => onOpenTaskDetail?.(task)}
              />
            ))
        )}
      </div>
    </div>
  )
}
