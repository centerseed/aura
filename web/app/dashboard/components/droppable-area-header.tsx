/**
 * DroppableAreaHeader - 可放置的 Area Header
 *
 * 接收 Product 的放置目標
 */

'use client'

import { useDroppable } from '@dnd-kit/core'
import { FolderOpen, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'

export interface DroppableAreaHeaderProps {
  areaId: string
  areaName: string
  productCount: number
  taskCount: number
  isOver: boolean
  onAddProduct: () => void
}

export function DroppableAreaHeader({
  areaId,
  areaName,
  productCount,
  taskCount,
  isOver,
  onAddProduct,
}: DroppableAreaHeaderProps) {
  const { setNodeRef } = useDroppable({
    id: `area-${areaId}`,
    data: { type: 'area', areaId },
  })

  return (
    <div
      ref={setNodeRef}
      className={`flex items-center justify-between mb-4 p-4 rounded-xl transition-all ${
        isOver
          ? 'bg-indigo-500/10 border-2 border-indigo-500 border-dashed'
          : 'border-2 border-transparent'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-cta flex items-center justify-center">
          <FolderOpen className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">{areaName}</h2>
          <p className="text-sm text-white/50">
            {productCount} 個專案 · {taskCount} 個任務
          </p>
        </div>
      </div>

      {/* 新增專案按鈕 */}
      <Button
        onClick={onAddProduct}
        className="bg-white/10 hover:bg-white/20 border border-white/20 text-white"
        size="sm"
      >
        <Plus className="w-4 h-4 mr-2" />
        新增專案
      </Button>
    </div>
  )
}
