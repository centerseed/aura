/**
 * useDragAndDrop Hook - 拖放功能管理
 *
 * 處理任務和產品的拖放操作
 */

'use client'

import { useState, useCallback, useRef } from 'react'
import {
  useSensor,
  useSensors,
  PointerSensor,
  KeyboardSensor,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core'
import { API } from '@/lib/api-client'
import type { TaskCard, DrawerStatus } from '@/types'
import type { ApiArea } from '../context/types'

interface UseDragAndDropProps {
  areas: ApiArea[]
  setAreas: React.Dispatch<React.SetStateAction<ApiArea[]>>
  refreshData: () => Promise<void>
  openMergeConfirmModal: (sourceTask: TaskCard, targetTask: TaskCard) => void
}

/**
 * useDragAndDrop Hook
 *
 * 管理拖放相關的狀態和操作
 */
export function useDragAndDrop({
  areas,
  setAreas,
  refreshData,
  openMergeConfirmModal,
}: UseDragAndDropProps) {
  // 拖放狀態
  const [activeTask, setActiveTask] = useState<TaskCard | null>(null)
  const [activeProduct, setActiveProduct] = useState<{ id: string; name: string } | null>(null)
  const [overDropId, setOverDropId] = useState<string | null>(null)

  // 拖放鎖定（防止重複觸發）
  const isDraggingRef = useRef(false)

  // DnD Sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  )

  /**
   * 拖曳開始
   */
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const activeData = event.active.data.current

    // 拖曳 Task
    if (activeData?.task) {
      setActiveTask(activeData.task)
      setActiveProduct(null)
    }
    // 拖曳 Product
    else if (activeData?.type === 'product') {
      setActiveProduct({ id: activeData.productId, name: activeData.productName })
      setActiveTask(null)
    }
  }, [])

  /**
   * 拖曳中（移過目標）
   */
  const handleDragOver = useCallback((event: DragOverEvent) => {
    const overId = event.over?.id?.toString() || null
    setOverDropId(overId)
  }, [])

  /**
   * 拖曳結束
   */
  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event

      // 重置狀態
      setActiveTask(null)
      setActiveProduct(null)
      setOverDropId(null)

      if (!over) return

      const activeData = active.data.current
      const overData = over.data.current
      const overId = over.id.toString()

      // 防止重複觸發
      if (isDraggingRef.current) return
      isDraggingRef.current = true

      try {
        // ========== Task 拖放處理 ==========
        if (activeData?.task) {
          const draggedTask: TaskCard = activeData.task

          // Task-to-Task 合併（拖到另一個 Task 上）
          if (overData?.task && overData.task.id !== draggedTask.id) {
            const targetTask: TaskCard = overData.task
            openMergeConfirmModal(draggedTask, targetTask)
            return
          }

          // 拖到 Drawer（改變狀態）
          if (overId.startsWith('drawer-')) {
            const newStatus = overId.replace('drawer-', '') as DrawerStatus
            if (newStatus !== draggedTask.drawer) {
              await updateTaskStatus(draggedTask.id, newStatus)
            }
            return
          }

          // 拖到 Product（移動任務）
          if (overId.startsWith('product-')) {
            const newProductId = overId.replace('product-', '')
            if (newProductId !== draggedTask.product_id) {
              await moveTaskToProduct(draggedTask.id, newProductId)
            }
            return
          }
        }

        // ========== Product 拖放處理 ==========
        if (activeData?.type === 'product') {
          const productId = activeData.productId

          // 拖到 Area（移動 Product）
          if (overId.startsWith('area-')) {
            const newAreaId = overId.replace('area-', '')
            const currentArea = areas.find((a) =>
              a.products.some((p) => p.id === productId)
            )
            if (currentArea && currentArea.id !== newAreaId) {
              await moveProductToArea(productId, newAreaId)
            }
          }
        }
      } finally {
        isDraggingRef.current = false
      }
    },
    [areas, openMergeConfirmModal]
  )

  /**
   * 更新任務狀態
   */
  const updateTaskStatus = async (taskId: string, newStatus: DrawerStatus) => {
    try {
      await API.tasks.update(taskId, { status: newStatus })

      setAreas((prev) =>
        prev.map((area) => ({
          ...area,
          products: area.products.map((product) => ({
            ...product,
            tasks: product.tasks.map((task) =>
              task.id === taskId ? { ...task, drawer: newStatus } : task
            ),
          })),
        }))
      )
    } catch (error) {
      console.error('Failed to update task status:', error)
    }
  }

  /**
   * 移動任務到另一個 Product
   */
  const moveTaskToProduct = async (taskId: string, newProductId: string) => {
    try {
      await API.tasks.update(taskId, { product_id: newProductId })

      // 需要刷新資料因為任務在不同 product 間移動
      await refreshData()
    } catch (error) {
      console.error('Failed to move task:', error)
    }
  }

  /**
   * 移動 Product 到另一個 Area
   */
  const moveProductToArea = async (productId: string, newAreaId: string) => {
    try {
      await API.products.update(productId, { area_id: newAreaId })

      await refreshData()
    } catch (error) {
      console.error('Failed to move product:', error)
    }
  }

  return {
    // 狀態
    activeTask,
    activeProduct,
    overDropId,
    sensors,

    // 事件處理
    handleDragStart,
    handleDragOver,
    handleDragEnd,
  }
}

export type UseDragAndDropReturn = ReturnType<typeof useDragAndDrop>
