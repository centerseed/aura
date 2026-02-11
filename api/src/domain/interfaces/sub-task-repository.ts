/**
 * SubTaskRepository Interface - 子任務儲存庫介面
 *
 * Domain Layer 定義的契約，由 Infrastructure Layer 實作
 */

import type { SubTaskData, SubTaskSource } from '../entities/sub-task.entity'

export interface CreateSubTaskInput {
  id?: string // 可指定 ID（用於遷移時保留原 ID）
  taskId: string
  userId: string
  content: string
  completed?: boolean
  completedAt?: Date | null
  order?: number
  startDate?: Date | null
  dueDate?: Date | null
  estimatedMinutes?: number | null
  source?: SubTaskSource
  originalTaskId?: string | null
}

export interface UpdateSubTaskInput {
  content?: string
  completed?: boolean
  completedAt?: Date | null
  order?: number
  startDate?: Date | null
  dueDate?: Date | null
  estimatedMinutes?: number | null
}

export interface ISubTaskRepository {
  /** 根據 ID 查詢 */
  findById(id: string): Promise<SubTaskData | null>

  /** 查詢某 task 的所有 sub_tasks */
  findByTaskId(taskId: string): Promise<SubTaskData[]>

  /** 查詢某 user 在特定日期到期的 sub_tasks */
  findByUserAndDueDate(
    userId: string,
    dateStart: Date,
    dateEnd: Date
  ): Promise<SubTaskData[]>

  /** 建立 sub_task */
  create(input: CreateSubTaskInput): Promise<SubTaskData>

  /** 批次建立 */
  createMany(inputs: CreateSubTaskInput[]): Promise<SubTaskData[]>

  /** 更新 */
  update(id: string, input: UpdateSubTaskInput): Promise<SubTaskData>

  /** 軟刪除 */
  softDelete(id: string): Promise<void>

  /** 批次更新排序 */
  reorder(taskId: string, orderedIds: string[]): Promise<void>

  /** 移動 sub_task 到另一個 task */
  updateTaskId(id: string, newTaskId: string, newOrder: number): Promise<SubTaskData>
}
