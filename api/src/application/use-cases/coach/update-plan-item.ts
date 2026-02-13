/**
 * UpdatePlanItemUseCase - 更新計畫項目（完成/釘選/延後/排序）
 *
 * 完成連動：
 * - subtask → 同步 SubTask.completed = true
 * - task → 不自動改 Task.status
 */

import type {
  DailyPlanItemData,
  UpdateDailyPlanItemData,
} from '@/domain/interfaces/daily-plan-repository'
import { PrismaDailyPlanRepository } from '@/infrastructure/repositories/prisma-daily-plan-repository'
import { ValidationException } from '@/lib/api-response'
import { prisma } from '@/lib/db'

export interface UpdatePlanItemRequest {
  userId: string
  itemId: string
  order?: number
  completed?: boolean
  actualMinutes?: number
  pinned?: boolean
  deferred?: boolean
}

export interface UpdatePlanItemResponse {
  item: DailyPlanItemData
}

export class UpdatePlanItemUseCase {
  constructor(
    private readonly repository: PrismaDailyPlanRepository = new PrismaDailyPlanRepository(),
  ) {}

  async execute(request: UpdatePlanItemRequest): Promise<UpdatePlanItemResponse> {
    if (!request.userId) {
      throw new ValidationException('User ID is required', 'userId')
    }
    if (!request.itemId) {
      throw new ValidationException('Item ID is required', 'itemId')
    }
    if (request.actualMinutes !== undefined) {
      if (request.actualMinutes < 0 || request.actualMinutes > 1440) {
        throw new ValidationException('Actual minutes must be between 0 and 1440', 'actualMinutes')
      }
    }

    const updateData: UpdateDailyPlanItemData = {}
    if (request.order !== undefined) updateData.order = request.order
    if (request.completed !== undefined) updateData.completed = request.completed
    if (request.pinned !== undefined) updateData.pinned = request.pinned
    if (request.deferred !== undefined) updateData.deferred = request.deferred
    if (request.actualMinutes !== undefined) updateData.actualMinutes = request.actualMinutes

    // 單一 transaction：所有權驗證 → 更新 → 完成連動
    const item = await prisma.$transaction(async (tx) => {
      // 1. Ownership 驗證
      const planItem = await tx.dailyPlanItem.findUnique({
        where: { id: request.itemId },
        include: { plan: { select: { user_id: true } } },
      })
      if (!planItem || planItem.plan.user_id !== request.userId) {
        throw new ValidationException('Plan item not found', 'itemId')
      }

      // 2. 更新 plan item
      const updatedItem = await this.repository.updateItemWithTx(tx, request.itemId, updateData)

      // 3. 完成連動：同步 SubTask 狀態
      if (request.completed !== undefined && updatedItem.subTaskId) {
        await tx.subTask.update({
          where: { id: updatedItem.subTaskId },
          data: {
            completed: request.completed,
            completed_at: request.completed ? new Date() : null,
          },
        })
      }

      return updatedItem
    })

    return { item }
  }
}
