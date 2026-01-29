/**
 * StructureView - 結構視圖
 *
 * Dashboard 的主要視圖，顯示 Area → Product → Task 層級結構
 */

'use client'

import { useMemo } from 'react'
import { FolderOpen, Package, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { TaskCard, Milestone } from '@/types'
import type { ApiArea, ApiProduct } from '../context/types'
import { DroppableAreaHeader } from './droppable-area-header'
import { DroppableProduct } from './droppable-product'

export interface StructureViewProps {
  areas: ApiArea[]
  milestones: Milestone[]
  showArchive: boolean
  selectedArea: string | null
  overDropId: string | null
  reorganizingProductId: string | null
  recentArchivedTasks: TaskCard[]
  // Handlers
  onAddProduct: (areaId: string, areaName: string) => void
  onEditMilestone: (milestone?: Milestone | Partial<Milestone>) => void
  onSetDueDate: (task: TaskCard) => void
  onComplete: (taskId: string) => void
  onReorganize: (productId: string, productName: string) => void
  onToggleSubItem: (taskId: string, subItemId: string, completed: boolean) => void
  onDeleteSubItem: (taskId: string, subItemId: string) => void
  onEditSubItem: (taskId: string, subItemId: string, newContent: string) => void
  onAddSubItem: (taskId: string, content: string) => void
  onDeleteReference: (taskId: string, referenceId: string) => void
  onOpenTaskDetail: (task: TaskCard) => void
  onRenameProduct: (productId: string, newName: string) => void
  onEditProduct: (product: { id: string; name: string; description?: string | null; lifecycle: 'FINITE' | 'PERPETUAL'; status: string }) => void
  onShowReferences: (product: { id: string; name: string; description?: string | null; lifecycle: 'FINITE' | 'PERPETUAL'; status: string }) => void
  onOpenTasks: (product: { id: string; name: string }) => void
  onEditTaskTitle: (taskId: string, newTitle: string) => void
}

export function StructureView({
  areas,
  milestones,
  showArchive,
  selectedArea,
  overDropId,
  reorganizingProductId,
  recentArchivedTasks,
  onAddProduct,
  onEditMilestone,
  onSetDueDate,
  onComplete,
  onReorganize,
  onToggleSubItem,
  onDeleteSubItem,
  onEditSubItem,
  onAddSubItem,
  onDeleteReference,
  onOpenTaskDetail,
  onRenameProduct,
  onEditProduct,
  onShowReferences,
  onOpenTasks,
  onEditTaskTitle,
}: StructureViewProps) {
  // 篩選顯示的 Areas，並在 showArchive 時合併近兩週完成的任務
  const displayAreas = useMemo(() => {
    const baseAreas = selectedArea ? areas.filter((a) => a.name === selectedArea) : areas

    if (!showArchive || recentArchivedTasks.length === 0) {
      return baseAreas
    }

    // 建立 product_id -> archived tasks 的映射
    const archivedByProduct = new Map<string, TaskCard[]>()
    for (const task of recentArchivedTasks) {
      const productId = task.product_id
      if (productId) {
        if (!archivedByProduct.has(productId)) {
          archivedByProduct.set(productId, [])
        }
        archivedByProduct.get(productId)!.push(task)
      }
    }

    // 合併到對應的 Product
    return baseAreas.map((area) => ({
      ...area,
      products: area.products.map((product) => {
        const archivedTasks = archivedByProduct.get(product.id) || []
        if (archivedTasks.length === 0) return product
        return {
          ...product,
          tasks: [...product.tasks, ...archivedTasks],
        }
      }),
    }))
  }, [selectedArea, areas, showArchive, recentArchivedTasks])

  if (displayAreas.length === 0) {
    return (
      <div className="text-center py-16">
        <FolderOpen className="w-16 h-16 mx-auto mb-4 text-white/20" />
        <h3 className="text-lg font-medium text-white/70 mb-2">尚無資料</h3>
        <p className="text-white/40 mb-4">使用「快速記錄」傾倒你的想法，AI 會幫你整理</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {displayAreas.map((area) => (
        <div key={area.id}>
          {/* Area Header (可放置 Product) */}
          <DroppableAreaHeader
            areaId={area.id}
            areaName={area.name}
            productCount={area.products.length}
            taskCount={area.products.reduce(
              (sum, p) => sum + p.tasks.filter((t) => showArchive || t.drawer !== 'ARCHIVE').length,
              0
            )}
            isOver={overDropId === `area-${area.id}`}
            onAddProduct={() => onAddProduct(area.id, area.name)}
          />

          {/* Products Grid */}
          {area.products.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {area.products.map((product) => (
                <DroppableProduct
                  key={product.id}
                  productId={product.id}
                  productName={product.name}
                  productDescription={product.description}
                  productLifecycle={product.lifecycle}
                  productStatus={product.status}
                  referenceCount={product.referenceCount}
                  tasks={showArchive ? product.tasks : product.tasks.filter((t) => t.drawer !== 'ARCHIVE')}
                  isOver={overDropId === `product-${product.id}`}
                  milestones={milestones}
                  areaId={area.id}
                  onEditMilestone={onEditMilestone}
                  onSetDueDate={onSetDueDate}
                  onComplete={onComplete}
                  onReorganize={onReorganize}
                  onToggleSubItem={onToggleSubItem}
                  onDeleteSubItem={onDeleteSubItem}
                  onEditSubItem={onEditSubItem}
                  onAddSubItem={onAddSubItem}
                  onDeleteReference={onDeleteReference}
                  onRename={onRenameProduct}
                  onEdit={onEditProduct}
                  onShowReferences={onShowReferences}
                  onOpenTasks={onOpenTasks}
                  onEditTaskTitle={onEditTaskTitle}
                  onOpenTaskDetail={onOpenTaskDetail}
                  isReorganizing={reorganizingProductId === product.id}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border-2 border-dashed border-white/10 bg-white/5 p-12 text-center">
              <div className="flex flex-col items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center">
                  <Package className="w-8 h-8 text-white/30" />
                </div>
                <div>
                  <h3 className="text-lg font-medium text-white/70 mb-2">
                    這個身分下還沒有專案
                  </h3>
                  <p className="text-sm text-white/40 mb-4">
                    點擊上方「新增專案」按鈕來創建第一個項目
                  </p>
                </div>
                <Button
                  onClick={() => onAddProduct(area.id, area.name)}
                  className="bg-gradient-to-r from-indigo-600 to-indigo-600 hover:from-indigo-500 hover:to-indigo-500 text-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  立即新增
                </Button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
