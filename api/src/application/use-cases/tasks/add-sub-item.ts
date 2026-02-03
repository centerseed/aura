/**
 * AddSubItemUseCase - 新增任務子項目
 *
 * Application Layer Use Case
 * 處理新增任務 sub-item 的業務邏輯
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

export interface AddSubItemRequest {
  taskId: string
  userId: string
  content: string
}

export interface SubItemData {
  id: string
  content: string
  completed: boolean
  created_at: string
  completed_at: string | null
  order: number
}

export interface AddSubItemResponse {
  subItem: SubItemData
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

export class AddSubItemUseCase {
  constructor(
    private readonly taskRepository: ITaskRepository = new PrismaTaskRepository()
  ) {}

  async execute(
    request: AddSubItemRequest
  ): Promise<AddSubItemResponse> {
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

    // 4. 創建新的 sub-item
    const now = new Date().toISOString()
    const newSubItem: SubItemData = {
      id: crypto.randomUUID(),
      content: request.content.trim(),
      completed: false,
      created_at: now,
      completed_at: null,
      order: existingSubItems.length, // 新增在最後
    }

    // 5. 更新資料庫
    const updatedSubItems = [...existingSubItems, newSubItem]

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

    return {
      subItem: newSubItem,
      meta: {
        total,
        completed: completedCount,
        completionRate,
      },
      message: 'Sub-item added successfully',
    }
  }

  /**
   * 驗證請求資料
   */
  private validateRequest(request: AddSubItemRequest): void {
    if (!request.taskId) {
      throw new ValidationException('Task ID is required', 'taskId')
    }

    if (!request.content) {
      throw new ValidationException('Content is required', 'content')
    }

    if (request.content.trim().length === 0) {
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
