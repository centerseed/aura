/**
 * ReorderSubItemsUseCase - 重新排序任務子項目
 *
 * Application Layer Use Case
 * 操作 sub_tasks 表
 */

import { prisma } from '@/lib/db'
import { ValidationException, NotFoundException } from '@/lib/api-response'
import { getSubTasksMeta } from '@/infrastructure/repositories/sub-task-utils'

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
    })

    if (!task) {
      throw new NotFoundException('Task')
    }

    // 3. 從 sub_tasks 表批次更新排序
    await prisma.$transaction(
      request.subItemIds.map((id, index) =>
        prisma.subTask.update({
          where: { id },
          data: { order: index },
        })
      )
    )

    // 4. 讀取更新後的 sub_tasks
    const subTasks = await prisma.subTask.findMany({
      where: { task_id: request.taskId, deleted_at: null },
      orderBy: { order: 'asc' },
    })

    const subItems: SubItemData[] = subTasks.map((st) => ({
      id: st.id,
      content: st.content,
      completed: st.completed,
      created_at: st.created_at.toISOString(),
      completed_at: st.completed_at?.toISOString() ?? null,
      order: st.order,
    }))

    // 6. 計算統計資訊
    const meta = await getSubTasksMeta(request.taskId)

    return { subItems, meta }
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
