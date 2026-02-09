/**
 * ReorderSubItemsUseCase - 重新排序任務子項目
 *
 * Application Layer Use Case
 * 處理任務 sub-items 的重新排序邏輯
 */

import { prisma } from '@/lib/db'
import { ValidationException, NotFoundException } from '@/lib/api-response'

// ============================================================================
// DTOs (Data Transfer Objects)
// ============================================================================

export interface ReorderSubItemsRequest {
  taskId: string
  userId: string
  subItemIds: string[]
}

export interface SubItemData {
  id: string
  content: string
  completed: boolean
  created_at: string
  completed_at: string | null
  order: number
}

export interface ReorderSubItemsResponse {
  subItems: SubItemData[]
  meta: {
    total: number
    completed: number
    completionRate: number
  }
}

// ============================================================================
// Use Case
// ============================================================================

export class ReorderSubItemsUseCase {
  async execute(
    request: ReorderSubItemsRequest
  ): Promise<ReorderSubItemsResponse> {
    // 1. 驗證輸入
    this.validateRequest(request)

    // 2. 查詢任務並驗證權限
    const task = await prisma.task.findFirst({
      where: {
        id: request.taskId,
        deleted_at: null,
        product: { user_id: request.userId },
      },
      include: { product: true },
    })

    if (!task) {
      throw new NotFoundException('Task')
    }

    // 3. 獲取現有的 sub-items
    const subItems = (task.sub_items as unknown as SubItemData[]) || []

    // 4. 按照指定順序重新排列
    const orderedSubItems = request.subItemIds
      .map((id) => subItems.find((item) => item.id === id))
      .filter(Boolean)
      .map((item, index) => ({
        ...item!,
        order: index,
      }))

    // 5. 計算統計資訊
    const completedCount = orderedSubItems.filter((item) => item.completed).length
    const total = orderedSubItems.length
    const completionRate = total > 0 ? completedCount / total : 0

    // 6. 更新資料庫
    await prisma.task.update({
      where: { id: request.taskId },
      data: {
        sub_items: orderedSubItems,
        updated_at: new Date(),
      },
    })

    return {
      subItems: orderedSubItems,
      meta: {
        total,
        completed: completedCount,
        completionRate,
      },
    }
  }

  private validateRequest(request: ReorderSubItemsRequest): void {
    if (!request.taskId) {
      throw new ValidationException('Task ID is required', 'taskId')
    }

    if (!Array.isArray(request.subItemIds)) {
      throw new ValidationException(
        'sub_item_ids must be an array',
        'sub_item_ids'
      )
    }
  }
}
