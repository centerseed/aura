/**
 * useTaskOperations Hook - 任務操作管理
 *
 * 處理任務的 CRUD 操作、狀態變更、子項目和參考資料管理
 */

'use client'

import { useCallback } from 'react'
import type { DrawerStatus, TaskCard } from '@/types'
import type { ApiArea } from '../context/types'

interface UseTaskOperationsProps {
  areas: ApiArea[]
  setAreas: React.Dispatch<React.SetStateAction<ApiArea[]>>
  refreshData: () => Promise<void>
  loadCompletedToday: () => Promise<void>
  getAuthHeaders: () => Promise<Record<string, string>>
}

/**
 * useTaskOperations Hook
 *
 * 管理任務相關的所有操作
 */
export function useTaskOperations({
  areas,
  setAreas,
  refreshData,
  loadCompletedToday,
  getAuthHeaders,
}: UseTaskOperationsProps) {
  /**
   * 完成任務（移至 ARCHIVE）
   */
  const handleTaskComplete = useCallback(
    async (taskId: string) => {
      try {
        const res = await fetch(`/api/tasks/${taskId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...(await getAuthHeaders()),
          },
          body: JSON.stringify({ status: 'ARCHIVE' }),
        })

        if (res.ok) {
          // 更新本地狀態
          setAreas((prev) =>
            prev.map((area) => ({
              ...area,
              products: area.products.map((product) => ({
                ...product,
                tasks: product.tasks.map((task) =>
                  task.id === taskId ? { ...task, drawer: 'ARCHIVE' as DrawerStatus } : task
                ),
              })),
            }))
          )
          // 重新載入今日完成
          loadCompletedToday()
        }
      } catch (error) {
        console.error('Failed to complete task:', error)
      }
    },
    [setAreas, loadCompletedToday, getAuthHeaders]
  )

  /**
   * 編輯任務標題
   */
  const handleTaskEdit = useCallback(
    async (taskId: string, newTitle: string) => {
      try {
        const res = await fetch(`/api/tasks/${taskId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...(await getAuthHeaders()),
          },
          body: JSON.stringify({ content: newTitle }),
        })

        if (res.ok) {
          setAreas((prev) =>
            prev.map((area) => ({
              ...area,
              products: area.products.map((product) => ({
                ...product,
                tasks: product.tasks.map((task) =>
                  task.id === taskId ? { ...task, title: newTitle } : task
                ),
              })),
            }))
          )
        }
      } catch (error) {
        console.error('Failed to edit task:', error)
      }
    },
    [setAreas, getAuthHeaders]
  )

  /**
   * 變更任務狀態
   */
  const handleTaskStatusChange = useCallback(
    async (taskId: string, newStatus: DrawerStatus) => {
      try {
        const res = await fetch(`/api/tasks/${taskId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...(await getAuthHeaders()),
          },
          body: JSON.stringify({ status: newStatus }),
        })

        if (res.ok) {
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
        }
      } catch (error) {
        console.error('Failed to change task status:', error)
      }
    },
    [setAreas, getAuthHeaders]
  )

  /**
   * 切換子項目完成狀態
   */
  const handleSubItemToggle = useCallback(
    async (taskId: string, subItemId: string, completed: boolean) => {
      try {
        const res = await fetch(`/api/tasks/${taskId}/sub-items/${subItemId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...(await getAuthHeaders()),
          },
          body: JSON.stringify({ completed }),
        })

        if (res.ok) {
          setAreas((prev) =>
            prev.map((area) => ({
              ...area,
              products: area.products.map((product) => ({
                ...product,
                tasks: product.tasks.map((task) =>
                  task.id === taskId
                    ? {
                        ...task,
                        sub_items: task.sub_items?.map((item) =>
                          item.id === subItemId
                            ? {
                                ...item,
                                completed,
                                completed_at: completed ? new Date().toISOString() : null,
                              }
                            : item
                        ),
                      }
                    : task
                ),
              })),
            }))
          )
        }
      } catch (error) {
        console.error('Failed to toggle sub-item:', error)
      }
    },
    [setAreas, getAuthHeaders]
  )

  /**
   * 刪除子項目
   */
  const handleSubItemDelete = useCallback(
    async (taskId: string, subItemId: string) => {
      try {
        const res = await fetch(`/api/tasks/${taskId}/sub-items/${subItemId}`, {
          method: 'DELETE',
          headers: await getAuthHeaders(),
        })

        if (res.ok) {
          setAreas((prev) =>
            prev.map((area) => ({
              ...area,
              products: area.products.map((product) => ({
                ...product,
                tasks: product.tasks.map((task) =>
                  task.id === taskId
                    ? {
                        ...task,
                        sub_items: task.sub_items?.filter((item) => item.id !== subItemId),
                      }
                    : task
                ),
              })),
            }))
          )
        }
      } catch (error) {
        console.error('Failed to delete sub-item:', error)
      }
    },
    [setAreas, getAuthHeaders]
  )

  /**
   * 編輯子項目
   */
  const handleSubItemEdit = useCallback(
    async (taskId: string, subItemId: string, content: string) => {
      try {
        const res = await fetch(`/api/tasks/${taskId}/sub-items/${subItemId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...(await getAuthHeaders()),
          },
          body: JSON.stringify({ content }),
        })

        if (res.ok) {
          setAreas((prev) =>
            prev.map((area) => ({
              ...area,
              products: area.products.map((product) => ({
                ...product,
                tasks: product.tasks.map((task) =>
                  task.id === taskId
                    ? {
                        ...task,
                        sub_items: task.sub_items?.map((item) =>
                          item.id === subItemId ? { ...item, content } : item
                        ),
                      }
                    : task
                ),
              })),
            }))
          )
        }
      } catch (error) {
        console.error('Failed to edit sub-item:', error)
      }
    },
    [setAreas, getAuthHeaders]
  )

  /**
   * 新增子項目
   */
  const handleSubItemAdd = useCallback(
    async (taskId: string, content: string) => {
      try {
        const res = await fetch(`/api/tasks/${taskId}/sub-items`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(await getAuthHeaders()),
          },
          body: JSON.stringify({ content }),
        })

        if (res.ok) {
          const newSubItem = await res.json()
          setAreas((prev) =>
            prev.map((area) => ({
              ...area,
              products: area.products.map((product) => ({
                ...product,
                tasks: product.tasks.map((task) =>
                  task.id === taskId
                    ? {
                        ...task,
                        sub_items: [...(task.sub_items || []), newSubItem],
                      }
                    : task
                ),
              })),
            }))
          )
        }
      } catch (error) {
        console.error('Failed to add sub-item:', error)
      }
    },
    [setAreas, getAuthHeaders]
  )

  /**
   * 刪除參考資料
   */
  const handleReferenceDelete = useCallback(
    async (taskId: string, referenceId: string) => {
      try {
        const res = await fetch(`/api/tasks/${taskId}/references/${referenceId}`, {
          method: 'DELETE',
          headers: await getAuthHeaders(),
        })

        if (res.ok) {
          setAreas((prev) =>
            prev.map((area) => ({
              ...area,
              products: area.products.map((product) => ({
                ...product,
                tasks: product.tasks.map((task) =>
                  task.id === taskId
                    ? {
                        ...task,
                        references: task.references?.filter((ref) => ref.id !== referenceId),
                      }
                    : task
                ),
              })),
            }))
          )
        }
      } catch (error) {
        console.error('Failed to delete reference:', error)
      }
    },
    [setAreas, getAuthHeaders]
  )

  /**
   * 更新任務到期日
   */
  const handleTaskDueDateUpdate = useCallback(
    async (taskId: string, dueDate: Date | null, startDate?: Date | null) => {
      try {
        const body: Record<string, string | null> = {}
        if (dueDate !== undefined) {
          body.due_date = dueDate ? dueDate.toISOString() : null
        }
        if (startDate !== undefined) {
          body.start_date = startDate ? startDate.toISOString() : null
        }

        const res = await fetch(`/api/tasks/${taskId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...(await getAuthHeaders()),
          },
          body: JSON.stringify(body),
        })

        if (res.ok) {
          setAreas((prev) =>
            prev.map((area) => ({
              ...area,
              products: area.products.map((product) => ({
                ...product,
                tasks: product.tasks.map((task) =>
                  task.id === taskId
                    ? {
                        ...task,
                        due_date: dueDate ? dueDate.toISOString() : null,
                        start_date: startDate !== undefined ? (startDate ? startDate.toISOString() : null) : task.start_date,
                      }
                    : task
                ),
              })),
            }))
          )
        }
      } catch (error) {
        console.error('Failed to update task due date:', error)
      }
    },
    [setAreas, getAuthHeaders]
  )

  return {
    handleTaskComplete,
    handleTaskEdit,
    handleTaskStatusChange,
    handleSubItemToggle,
    handleSubItemDelete,
    handleSubItemEdit,
    handleSubItemAdd,
    handleReferenceDelete,
    handleTaskDueDateUpdate,
  }
}

export type UseTaskOperationsReturn = ReturnType<typeof useTaskOperations>
