/**
 * UpdatePlanItemUseCase - 更新計畫項目（完成/釘選/延後/排序）
 *
 * 完成連動：
 * - subtask → 同步 SubTask.completed = true
 * - task → 不自動改 Task.status
 */

import type {
  IDailyPlanRepository,
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
    private readonly repository: IDailyPlanRepository = new PrismaDailyPlanRepository(),
  ) {}

  async execute(request: UpdatePlanItemRequest): Promise<UpdatePlanItemResponse> {
    if (!request.userId) {
      throw new ValidationException('User ID is required', 'userId')
    }
    if (!request.itemId) {
      throw new ValidationException('Item ID is required', 'itemId')
    }

    // Ownership 驗證：確認 item 屬於該用戶
    const planItem = await prisma.dailyPlanItem.findUnique({
      where: { id: request.itemId },
      include: { plan: { select: { user_id: true } } },
    })
    if (!planItem || planItem.plan.user_id !== request.userId) {
      throw new ValidationException('Plan item not found', 'itemId')
    }

    const updateData: UpdateDailyPlanItemData = {}
    if (request.order !== undefined) updateData.order = request.order
    if (request.completed !== undefined) updateData.completed = request.completed
    if (request.pinned !== undefined) updateData.pinned = request.pinned
    if (request.deferred !== undefined) updateData.deferred = request.deferred
    if (request.actualMinutes !== undefined) {
      if (request.actualMinutes < 0 || request.actualMinutes > 1440) {
        throw new ValidationException('Actual minutes must be between 0 and 1440', 'actualMinutes')
      }
      updateData.actualMinutes = request.actualMinutes
    }

    const item = await this.repository.updateItem(request.itemId, updateData)

    // 完成連動：如果標記完成且有 subTaskId，同步 SubTask
    if (request.completed && item.subTaskId) {
      await prisma.subTask.update({
        where: { id: item.subTaskId },
        data: {
          completed: true,
          completed_at: new Date(),
        },
      })
    }

    // 如果取消完成且有 subTaskId，也同步取消
    if (request.completed === false && item.subTaskId) {
      await prisma.subTask.update({
        where: { id: item.subTaskId },
        data: {
          completed: false,
          completed_at: null,
        },
      })
    }

    return { item }
  }
}
