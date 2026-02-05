/**
 * TaskRepository Interface - 任務儲存庫介面
 *
 * Domain Layer 定義的契約，由 Infrastructure Layer 實作
 * 遵循 Dependency Inversion Principle (DIP)
 */

import type { TaskStatus } from '../value-objects/task-status'

// ============================================================================
// Domain Types (純資料結構，不包含行為)
// ============================================================================

export interface TaskData {
  id: string
  userId: string
  productId: string
  topicId: string | null
  content: string
  status: TaskStatus
  aiAnalysis: {
    narrative?: string
    lifecycle?: string
    strategyUsed?: string
    reasoning?: string
    mergedItems?: string[]
  } | null
  references: Array<{
    id: string
    type: 'url' | 'note'
    content: string
    title?: string | null
    createdAt: Date
  }>
  subItems: Array<{
    id: string
    content: string
    completed: boolean
    createdAt: Date
    completedAt: Date | null
    order: number
  }>
  startDate: Date | null
  dueDate: Date | null
  timeConfidence: number | null
  inferredFromMilestone: string | null
  remindAt: Date | null
  reminderEnabled: boolean
  reminderTimezone: string | null
  notificationId: number | null
  createdAt: Date
  updatedAt: Date

  // Relations (可選)
  product?: {
    id: string
    name: string
    areaId: string
    area: {
      id: string
      name: string
    }
  }
  topic?: {
    id: string
    name: string
  }
}

// ============================================================================
// Query Filters
// ============================================================================

export interface TaskFilters {
  userId: string
  status?: TaskStatus
  productId?: string
  topicId?: string
  content?: string        // 精確匹配 content（用於重複檢查）
  createdAtFrom?: Date    // 創建時間範圍（用於重複檢查）
  completedToday?: boolean
  startDateFrom?: Date
  startDateTo?: Date
  dueDateFrom?: Date
  dueDateTo?: Date
  updatedAtFrom?: Date
  updatedAtTo?: Date
  includeDeleted?: boolean
}

export interface TaskUpdateData {
  status?: TaskStatus
  productId?: string
  topicId?: string | null
  content?: string
  narrative?: string | null
  startDate?: Date | null
  dueDate?: Date | null
  timeConfidence?: number | null
  inferredFromMilestone?: string | null
  remindAt?: Date | null
  reminderEnabled?: boolean
  reminderTimezone?: string | null
  notificationId?: number | null
}

// ============================================================================
// Repository Interface
// ============================================================================

/**
 * TaskRepository
 *
 * 定義任務資料存取的契約
 * 這是一個 Port (在 Hexagonal Architecture 中)
 */
export interface ITaskRepository {
  /**
   * 查詢多個任務
   */
  findMany(filters: TaskFilters): Promise<TaskData[]>

  /**
   * 根據 ID 查詢單一任務
   */
  findById(id: string, userId: string): Promise<TaskData | null>

  /**
   * 根據 IDs 查詢多個任務
   */
  findByIds(ids: string[], userId: string): Promise<TaskData[]>

  /**
   * 創建任務
   */
  create(data: Omit<TaskData, 'id' | 'createdAt' | 'updatedAt'>): Promise<TaskData>

  /**
   * 更新任務
   */
  update(id: string, userId: string, data: TaskUpdateData): Promise<TaskData>

  /**
   * 軟刪除任務
   */
  softDelete(id: string, userId: string): Promise<void>

  /**
   * 硬刪除任務（謹慎使用）
   */
  hardDelete(id: string, userId: string): Promise<void>

  /**
   * 統計查詢
   */
  count(filters: Omit<TaskFilters, 'includeDeleted'>): Promise<number>

  /**
   * 檢查任務是否存在
   */
  exists(id: string, userId: string): Promise<boolean>

  /**
   * 批量更新狀態
   */
  batchUpdateStatus(
    taskIds: string[],
    userId: string,
    status: TaskStatus
  ): Promise<void>
}

// ============================================================================
// Repository Factory (可選，用於 DI)
// ============================================================================

export type TaskRepositoryFactory = () => ITaskRepository
