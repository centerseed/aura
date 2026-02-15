/**
 * Tasks API Client - 任務 API 客戶端
 *
 * 提供類型安全的任務相關 API 調用
 */

import { apiGet, apiPost, apiPatch, apiDelete } from './client'
import type { Task, Reference, SubItem } from '@/domain/entities/task.entity'
import type { DrawerStatus } from '@/domain/value-objects/drawer-status'

/**
 * 創建任務 DTO
 */
export interface CreateTaskDTO {
  content: string
  product_id: string
  topic_id?: string | null
  status?: DrawerStatus
}

/**
 * 更新任務 DTO
 */
export interface UpdateTaskDTO {
  content?: string
  status?: DrawerStatus
  product_id?: string
  topic_id?: string | null
  due_date?: string | null
}

/**
 * 批次更新任務 DTO
 */
export interface BatchUpdateTasksDTO {
  updates: Array<{
    id: string
    status?: DrawerStatus
    topic_id?: string | null
    due_date?: string | null
  }>
}

/**
 * 合併任務 DTO
 */
export interface MergeTaskDTO {
  target_task_id: string
  merge_mode: 'as_sub_item' | 'consolidate'
}

/**
 * 創建參考資料 DTO
 */
export interface CreateReferenceDTO {
  type: 'url' | 'note'
  content: string
  title?: string
}

/**
 * 創建子任務 DTO
 */
export interface CreateSubItemDTO {
  content: string
}

/**
 * 更新子任務 DTO
 */
export interface UpdateSubItemDTO {
  content?: string
  completed?: boolean
}

/**
 * Tasks API 客戶端
 *
 * 封裝所有任務相關的 API 調用，提供類型安全的介面
 */
export const TasksAPI = {
  /**
   * 獲取所有任務
   */
  getAll: () => apiGet<Task[]>('/api/tasks'),

  /**
   * 獲取單個任務
   */
  getById: (id: string) => apiGet<Task>(`/api/tasks/${id}`),

  /**
   * 創建任務
   */
  create: (data: CreateTaskDTO) => apiPost<Task>('/api/tasks', data),

  /**
   * 更新任務
   */
  update: (id: string, data: UpdateTaskDTO) =>
    apiPatch<Task>(`/api/tasks/${id}`, data),

  /**
   * 批次更新任務
   */
  batchUpdate: (data: BatchUpdateTasksDTO) => apiPatch<{ updated: number }>('/api/tasks', data),

  /**
   * 刪除任務（軟刪除）
   */
  delete: (id: string) => apiDelete<void>(`/api/tasks/${id}`),

  /**
   * 合併任務
   */
  mergeInto: (sourceId: string, data: MergeTaskDTO) =>
    apiPost<Task>(`/api/tasks/${sourceId}/merge-into`, data),

  // ===== References API =====

  /**
   * 獲取任務的參考資料
   */
  getReferences: (taskId: string) => apiGet<Reference[]>(`/api/tasks/${taskId}/references`),

  /**
   * 添加參考資料
   */
  addReference: (taskId: string, data: CreateReferenceDTO) =>
    apiPost<Reference>(`/api/tasks/${taskId}/references`, data),

  /**
   * 刪除參考資料
   */
  deleteReference: (taskId: string, referenceId: string) =>
    apiDelete<void>(`/api/tasks/${taskId}/references/${referenceId}`),

  // ===== Sub-items API =====

  /**
   * 獲取任務的子任務
   */
  getSubItems: (taskId: string) => apiGet<SubItem[]>(`/api/tasks/${taskId}/sub-items`),

  /**
   * 添加子任務
   */
  addSubItem: (taskId: string, data: CreateSubItemDTO) =>
    apiPost<SubItem>(`/api/tasks/${taskId}/sub-items`, data),

  /**
   * 更新子任務
   */
  updateSubItem: (taskId: string, subItemId: string, data: UpdateSubItemDTO) =>
    apiPatch<SubItem>(`/api/tasks/${taskId}/sub-items/${subItemId}`, data),

  /**
   * 刪除子任務
   */
  deleteSubItem: (taskId: string, subItemId: string) =>
    apiDelete<void>(`/api/tasks/${taskId}/sub-items/${subItemId}`),
}
