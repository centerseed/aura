/**
 * PromoteSubItemUseCase - 將 sub-item 升級為獨立任務
 *
 * Application Layer Use Case
 * 處理將 sub-item 升級為獨立 Task 的業務邏輯
 */

import type { ITaskRepository } from '@/domain/interfaces/task-repository'
import { PrismaTaskRepository } from '@/infrastructure/repositories/prisma-task-repository'
import { ValidationException, NotFoundException } from '@/lib/api-response'
import { prisma } from '@/lib/db'

// ============================================================================
// DTOs (Data Transfer Objects)
// ============================================================================

export interface PromoteSubItemRequest {
  taskId: string
  subItemId: string
  userId: string
}

export interface SubItemData {
  id: string
  content: string
  completed: boolean
  created_at: string
  completed_at: string | null
  order: number
  original_task_id?: string
}

export interface TaskData {
  id: string
  content: string
  status: string
  product_id: string
  topic_id: string | null
  created_at: string
  updated_at: string
}

export interface PromoteSubItemResponse {
  newTask: TaskData
  parentTaskId: string
  removedSubItemId: string
  meta: {
    total: number
    completed: number
    completionRate: number
  }
  message: string
}

// ============================================================================
// Use Case
// ============================================================================

export class PromoteSubItemUseCase {
  private static readonly MAX_TASK_CONTENT_LENGTH = 500

  constructor(
    private readonly taskRepository: ITaskRepository = new PrismaTaskRepository()
  ) {}

  async execute(request: PromoteSubItemRequest): Promise<PromoteSubItemResponse> {
    // 1. 驗證輸入
    this.validateRequest(request)

    // 2. 查詢 parent task 並驗證權限
    const parentTask = await this.taskRepository.findById(
      request.taskId,
      request.userId
    )

    if (!parentTask) {
      throw new NotFoundException('Parent task')
    }

    // 3. 在 sub_items 中找到目標 sub-item
    const existingSubItems = (parentTask.subItems || []).map((item) => ({
      id: item.id,
      content: item.content,
      completed: item.completed,
      created_at: this.safeToISOString(item.createdAt) || new Date().toISOString(),
      completed_at: this.safeToISOString(item.completedAt),
      order: item.order,
      original_task_id: (item as any).original_task_id,
    }))

    const targetSubItem = existingSubItems.find(
      (item) => item.id === request.subItemId
    )

    if (!targetSubItem) {
      throw new NotFoundException('Sub-item')
    }

    // 4. 準備新 Task 資料
    const now = new Date()
    const newTaskId = crypto.randomUUID()
    const newTaskStatus = targetSubItem.completed ? 'ARCHIVE' : 'INBOX'
    const newTaskContent = this.truncateContent(targetSubItem.content)

    // 5. 準備 ai_analysis 用於追蹤來源
    const aiAnalysis = {
      promoted_from: {
        parent_task_id: request.taskId,
        sub_item_id: request.subItemId,
        ...(targetSubItem.original_task_id && {
          original_task_id: targetSubItem.original_task_id,
        }),
      },
    }

    // 6. 從 parent task 移除 sub-item 並重新排序
    const updatedSubItems = existingSubItems
      .filter((item) => item.id !== request.subItemId)
      .map((item, index) => ({
        ...item,
        order: index,
      }))

    // 7. 使用 transaction 確保原子性
    const [createdTask] = await prisma.$transaction([
      // 創建新 Task
      prisma.task.create({
        data: {
          id: newTaskId,
          user_id: request.userId,
          content: newTaskContent,
          status: newTaskStatus,
          product_id: parentTask.productId,
          topic_id: parentTask.topicId || null,
          sub_items: [],
          references: [],
          ai_analysis: aiAnalysis,
          created_at: now,
          updated_at: now,
        },
      }),
      // 更新 parent Task (移除 sub-item)
      prisma.task.update({
        where: { id: request.taskId },
        data: {
          sub_items: updatedSubItems as any,
          updated_at: now,
        },
      }),
    ])

    // 8. 計算統計資訊
    const total = updatedSubItems.length
    const completedCount = updatedSubItems.filter((item) => item.completed).length
    const completionRate = total > 0 ? completedCount / total : 0

    return {
      newTask: {
        id: createdTask.id,
        content: createdTask.content,
        status: createdTask.status,
        product_id: createdTask.product_id,
        topic_id: createdTask.topic_id,
        created_at: createdTask.created_at.toISOString(),
        updated_at: createdTask.updated_at.toISOString(),
      },
      parentTaskId: request.taskId,
      removedSubItemId: request.subItemId,
      meta: {
        total,
        completed: completedCount,
        completionRate,
      },
      message: `Sub-item "${newTaskContent}" 已升級為獨立任務`,
    }
  }

  /**
   * 驗證請求資料
   */
  private validateRequest(request: PromoteSubItemRequest): void {
    if (!request.taskId) {
      throw new ValidationException('Task ID is required', 'taskId')
    }

    if (!request.subItemId) {
      throw new ValidationException('Sub-item ID is required', 'subItemId')
    }
  }

  /**
   * 截斷內容以符合 Task 標題長度限制
   */
  private truncateContent(content: string): string {
    const trimmed = content.trim()
    if (trimmed.length <= PromoteSubItemUseCase.MAX_TASK_CONTENT_LENGTH) {
      return trimmed
    }
    return trimmed.substring(0, PromoteSubItemUseCase.MAX_TASK_CONTENT_LENGTH - 3) + '...'
  }

  /**
   * 安全的日期轉換為 ISO 字串
   * 處理 Invalid Date 或 null/undefined 的情況
   */
  private safeToISOString(date: Date | null | undefined): string | null {
    if (!date) return null
    if (!(date instanceof Date)) return null
    if (isNaN(date.getTime())) return null
    return date.toISOString()
  }
}
