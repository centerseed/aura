/**
 * DeleteSubItemUseCase - 刪除任務子項目
 *
 * Application Layer Use Case
 * 操作 sub_tasks 表（soft delete）+ 雙寫 JSON（過渡期相容）
 */

import type {
  ITaskRepository,
} from '@/domain/interfaces/task-repository'
import { PrismaTaskRepository } from '@/infrastructure/repositories/prisma-task-repository'
import { ValidationException, NotFoundException } from '@/lib/api-response'
import { prisma } from '@/lib/db'
import { syncSubTasksToJson, getSubTasksMeta } from '@/infrastructure/repositories/sub-task-sync'

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

    // 3. 從 sub_tasks 表查詢目標
    const subTask = await prisma.subTask.findFirst({
      where: { id: request.subItemId, task_id: request.taskId, deleted_at: null },
    })

    if (!subTask) {
      throw new NotFoundException('Sub-item')
    }

    // 4. Soft delete sub_task
    await prisma.subTask.update({
      where: { id: request.subItemId },
      data: { deleted_at: new Date() },
    })

    // 5. 重新排序剩餘的 sub_tasks
    const remaining = await prisma.subTask.findMany({
      where: { task_id: request.taskId, deleted_at: null },
      orderBy: { order: 'asc' },
    })

    if (remaining.length > 0) {
      await prisma.$transaction(
        remaining.map((st, index) =>
          prisma.subTask.update({
            where: { id: st.id },
            data: { order: index },
          })
        )
      )
    }

    // 6. 雙寫：同步到 JSON
    await syncSubTasksToJson(request.taskId)

    // 7. 清理對應的 plan item
    try {
      await prisma.dailyPlanItem.deleteMany({
        where: {
          task_id: request.taskId,
          sub_task_id: request.subItemId,
        },
      })
    } catch (error) {
      console.error('[DeleteSubItemUseCase] Failed to cleanup plan item:', error)
    }

    // 8. 計算統計資訊
    const meta = await getSubTasksMeta(request.taskId)

    return {
      subItemId: request.subItemId,
      meta,
      message: 'Sub-item deleted successfully',
    }
  }

  private validateRequest(request: DeleteSubItemRequest): void {
    if (!request.taskId) {
      throw new ValidationException('Task ID is required', 'taskId')
    }

    if (!request.subItemId) {
      throw new ValidationException('Sub-item ID is required', 'subItemId')
    }
  }
}
