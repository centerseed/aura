/**
 * UpdateSubItemUseCase - 更新任務子項目
 *
 * Application Layer Use Case
 * 處理更新任務 sub-item 的業務邏輯(狀態或內容)
 */

import type {
  ITaskRepository,
} from '@/domain/interfaces/task-repository'
import { PrismaTaskRepository } from '@/infrastructure/repositories/prisma-task-repository'
import { ValidationException, NotFoundException } from '@/lib/api-response'
import { prisma } from '@/lib/db'

// ============================================================================
// DTOs (Data Transfer Objects)
// ============================================================================

export interface UpdateSubItemRequest {
  taskId: string
  userId: string
  subItemId: string
  completed?: boolean
  content?: string
}

export interface SubItemData {
  id: string
  content: string
  completed: boolean
  created_at: string
  completed_at: string | null
  order: number
}

export interface UpdateSubItemResponse {
  subItem: SubItemData
  meta: {
    total: number
    completed: number
    completionRate: number
  }
  taskCompleted: boolean
  message: string
}

// ============================================================================
// Use Case
// ============================================================================

export class UpdateSubItemUseCase {
  constructor(
    private readonly taskRepository: ITaskRepository = new PrismaTaskRepository()
  ) {}

  async execute(
    request: UpdateSubItemRequest
  ): Promise<UpdateSubItemResponse> {
    // 1. 驗證輸入
    this.validateRequest(request)

    // 2. 查詢任務並驗證權限
    const task = await this.taskRepository.findById(
      request.taskId,
      request.userId
    )

    if (!task) {
      throw new NotFoundException('Task')
    }

    // 3. 獲取現有的 sub-items
    const existingSubItems = (task.subItems || []).map((item) => ({
      id: item.id,
      content: item.content,
      completed: item.completed,
      created_at: this.safeToISOString(item.createdAt) || new Date().toISOString(),
      completed_at: this.safeToISOString(item.completedAt),
      order: item.order,
    }))

    // 4. 找到並更新目標 sub-item
    const now = new Date().toISOString()
    let found = false
    let updatedSubItem: SubItemData | null = null

    const updatedSubItems = existingSubItems.map((item) => {
      if (item.id === request.subItemId) {
        found = true

        // 更新 content (如果提供)
        const newContent =
          request.content !== undefined
            ? request.content.trim()
            : item.content

        // 更新 completed 狀態 (如果提供)
        const newCompleted =
          request.completed !== undefined
            ? request.completed
            : item.completed

        const newCompletedAt =
          request.completed !== undefined
            ? (request.completed ? now : null)
            : item.completed_at

        updatedSubItem = {
          id: item.id,
          content: newContent,
          completed: newCompleted,
          created_at: item.created_at,
          completed_at: newCompletedAt,
          order: item.order,
        }

        return updatedSubItem
      }
      return item
    })

    if (!found) {
      throw new NotFoundException('Sub-item')
    }

    // 5. 更新資料庫
    await prisma.task.update({
      where: { id: request.taskId },
      data: {
        sub_items: updatedSubItems as any,
        updated_at: new Date(),
      },
    })

    // 6. 計算統計資訊
    const total = updatedSubItems.length
    const completedCount = updatedSubItems.filter((item) => item.completed).length
    const completionRate = total > 0 ? completedCount / total : 0
    const allCompleted = completedCount === total && total > 0

    return {
      subItem: updatedSubItem!,
      meta: {
        total,
        completed: completedCount,
        completionRate,
      },
      taskCompleted: allCompleted,
      message: 'Sub-item updated successfully',
    }
  }

  /**
   * 驗證請求資料
   */
  private validateRequest(request: UpdateSubItemRequest): void {
    if (!request.taskId) {
      throw new ValidationException('Task ID is required', 'taskId')
    }

    if (!request.subItemId) {
      throw new ValidationException('Sub-item ID is required', 'subItemId')
    }

    // 至少需要提供 completed 或 content 其中之一
    if (request.completed === undefined && request.content === undefined) {
      throw new ValidationException(
        'Either completed or content field is required',
        'body'
      )
    }

    // 驗證 content 不能為空字串
    if (request.content !== undefined && request.content.trim().length === 0) {
      throw new ValidationException(
        'Content cannot be empty',
        'content'
      )
    }
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
