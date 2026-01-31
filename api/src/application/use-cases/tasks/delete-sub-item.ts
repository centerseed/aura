/**
 * DeleteSubItemUseCase - 刪除任務子項目
 *
 * Application Layer Use Case
 * 處理從任務中刪除 sub-item 的業務邏輯
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

export interface DeleteSubItemRequest {
  taskId: string
  userId: string
  subItemId: string
}

export interface DeleteSubItemResponse {
  subItemId: string
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

export class DeleteSubItemUseCase {
  constructor(
    private readonly taskRepository: ITaskRepository = new PrismaTaskRepository()
  ) {}

  async execute(
    request: DeleteSubItemRequest
  ): Promise<DeleteSubItemResponse> {
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
      created_at: item.createdAt.toISOString(),
      completed_at: item.completedAt?.toISOString() || null,
      order: item.order,
    }))

    // 4. 檢查 sub-item 是否存在
    const subItemExists = existingSubItems.some(
      (item) => item.id === request.subItemId
    )

    if (!subItemExists) {
      throw new NotFoundException('Sub-item')
    }

    // 5. 過濾掉要刪除的 sub-item 並重新計算 order
    const updatedSubItems = existingSubItems
      .filter((item) => item.id !== request.subItemId)
      .map((item, index) => ({
        ...item,
        order: index, // 重新計算順序
      }))

    // 6. 更新資料庫
    await prisma.task.update({
      where: { id: request.taskId },
      data: {
        sub_items: updatedSubItems as any,
        updated_at: new Date(),
      },
    })

    // 7. 計算統計資訊
    const total = updatedSubItems.length
    const completedCount = updatedSubItems.filter((item) => item.completed).length
    const completionRate = total > 0 ? completedCount / total : 0

    return {
      subItemId: request.subItemId,
      meta: {
        total,
        completed: completedCount,
        completionRate,
      },
      message: 'Sub-item deleted successfully',
    }
  }

  /**
   * 驗證請求資料
   */
  private validateRequest(request: DeleteSubItemRequest): void {
    if (!request.taskId) {
      throw new ValidationException('Task ID is required', 'taskId')
    }

    if (!request.subItemId) {
      throw new ValidationException('Sub-item ID is required', 'subItemId')
    }
  }
}
