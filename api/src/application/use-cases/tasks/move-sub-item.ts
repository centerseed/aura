/**
 * MoveSubItemUseCase - 移動子項目到另一個 Task
 *
 * Application Layer Use Case
 * 將 sub_task 從一個 task 移動到另一個 task
 */

import type {
  ITaskRepository,
} from '@/domain/interfaces/task-repository'
import { PrismaTaskRepository } from '@/infrastructure/repositories/prisma-task-repository'
import { ValidationException, NotFoundException } from '@/lib/api-response'
import { prisma } from '@/lib/db'
import { getSubTasksMeta } from '@/infrastructure/repositories/sub-task-utils'
import { librarianObserve } from '@/lib/librarian-client'

// ============================================================================
// DTOs (Data Transfer Objects)
// ============================================================================

export interface MoveSubItemRequest {
  sourceTaskId: string
  targetTaskId: string
  subItemId: string
  userId: string
}

export interface MoveSubItemResponse {
  subItem: {
    id: string
    content: string
    completed: boolean
    order: number
  }
  sourceTaskMeta: {
    total: number
    completed: number
    completionRate: number
  }
  targetTaskMeta: {
    total: number
    completed: number
    completionRate: number
  }
  message: string
}

// ============================================================================
// Use Case
// ============================================================================

export class MoveSubItemUseCase {
  constructor(
    private readonly taskRepository: ITaskRepository = new PrismaTaskRepository()
  ) {}

  async execute(
    request: MoveSubItemRequest
  ): Promise<MoveSubItemResponse> {
    // 1. 驗證輸入
    this.validateRequest(request)

    // 2. 查詢 source task 並驗證權限
    const sourceTask = await this.taskRepository.findById(
      request.sourceTaskId,
      request.userId
    )
    if (!sourceTask) {
      throw new NotFoundException('Source task')
    }

    // 3. 查詢 target task 並驗證權限（同一 user）
    const targetTask = await this.taskRepository.findById(
      request.targetTaskId,
      request.userId
    )
    if (!targetTask) {
      throw new NotFoundException('Target task')
    }

    // 4. 查詢 sub_task
    const subTask = await prisma.subTask.findFirst({
      where: { id: request.subItemId, task_id: request.sourceTaskId, deleted_at: null },
    })
    if (!subTask) {
      throw new NotFoundException('Sub-item')
    }

    // 5. 取得 target task 的最大 order
    const maxOrderResult = await prisma.subTask.aggregate({
      where: { task_id: request.targetTaskId, deleted_at: null },
      _max: { order: true },
    })
    const nextOrder = (maxOrderResult._max.order ?? -1) + 1

    // 6. 自動調整日期：若 target task 有 due_date，sub-item 日期不能超過
    const targetDueDate = (targetTask as any).due_date || (targetTask as any).dueDate
    const dateAdjustments: any = {}
    if (targetDueDate) {
      const targetDue = typeof targetDueDate === 'string' ? new Date(targetDueDate) : targetDueDate
      if (subTask.due_date && subTask.due_date > targetDue) {
        dateAdjustments.due_date = targetDue
      }
      if (subTask.start_date && subTask.start_date > targetDue) {
        dateAdjustments.start_date = targetDue
      }
    }

    // 7. 更新 sub_task 的 task_id 和 order（含日期調整）
    await prisma.subTask.update({
      where: { id: request.subItemId },
      data: { task_id: request.targetTaskId, order: nextOrder, ...dateAdjustments },
    })

    // 8. 重新排序 source task 剩餘的 sub_tasks
    const remaining = await prisma.subTask.findMany({
      where: { task_id: request.sourceTaskId, deleted_at: null },
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

    // 9. 計算統計資訊
    const sourceTaskMeta = await getSubTasksMeta(request.sourceTaskId)
    const targetTaskMeta = await getSubTasksMeta(request.targetTaskId)

    // 11. 通知 Librarian（fire-and-forget）
    const srcProdName = sourceTask.product?.name
    const tgtProdName = targetTask.product?.name
    if (srcProdName && tgtProdName && srcProdName !== tgtProdName) {
      librarianObserve({
        userId: request.userId,
        taskContent: subTask.content,
        originalProduct: srcProdName,
        correctedProduct: tgtProdName,
      }).catch(() => {})
    }

    return {
      subItem: {
        id: request.subItemId,
        content: subTask.content,
        completed: subTask.completed,
        order: nextOrder,
      },
      sourceTaskMeta,
      targetTaskMeta,
      message: 'Sub-item moved successfully',
    }
  }

  private validateRequest(request: MoveSubItemRequest): void {
    if (!request.sourceTaskId) {
      throw new ValidationException('Source task ID is required', 'sourceTaskId')
    }

    if (!request.targetTaskId) {
      throw new ValidationException('Target task ID is required', 'targetTaskId')
    }

    if (!request.subItemId) {
      throw new ValidationException('Sub-item ID is required', 'subItemId')
    }

    if (request.sourceTaskId === request.targetTaskId) {
      throw new ValidationException(
        'Source and target task cannot be the same',
        'targetTaskId'
      )
    }
  }
}
