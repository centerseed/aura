/**
 * DeleteTaskUseCase - 軟刪除任務
 *
 * Application Layer Use Case
 * 軟刪除任務並將 references 遷移到 Product 層級
 */

import type {
  ITaskRepository,
  TaskData,
} from '@/domain/interfaces/task-repository'
import { PrismaTaskRepository } from '@/infrastructure/repositories/prisma-task-repository'
import { PrismaCoachBriefingRepository } from '@/infrastructure/repositories/prisma-coach-briefing-repository'
import { NotFoundException } from '@/lib/api-response'
import { prisma } from '@/lib/db'

// ============================================================================
// DTOs (Data Transfer Objects)
// ============================================================================

export interface DeleteTaskRequest {
  taskId: string
  userId: string
}

export interface DeleteTaskResponse {
  taskId: string
  referencesMigrated: number
  message: string
}

// ============================================================================
// Use Case
// ============================================================================

export class DeleteTaskUseCase {
  constructor(
    private readonly taskRepository: ITaskRepository = new PrismaTaskRepository()
  ) {}

  async execute(request: DeleteTaskRequest): Promise<DeleteTaskResponse> {
    // 1. 查詢任務（驗證存在性與權限）
    const task = await this.taskRepository.findById(
      request.taskId,
      request.userId
    )

    if (!task) {
      throw new NotFoundException('Task')
    }

    // 2. 遷移 References 到 Product 層級
    const referencesMigrated = await this.migrateReferencesToProduct(task)

    // 3. 清理 plan items（移除孤兒）
    await this.cleanupPlanItems(request.taskId)

    // 4. 清理 briefing（移除已刪除的任務）
    await this.cleanupBriefing(request.userId, request.taskId)

    // 5. 執行軟刪除
    await this.taskRepository.softDelete(request.taskId, request.userId)

    return {
      taskId: request.taskId,
      referencesMigrated,
      message: 'Task deleted successfully',
    }
  }

  /**
   * 刪除對應的 daily_plan_item
   */
  private async cleanupPlanItems(taskId: string): Promise<void> {
    try {
      await prisma.dailyPlanItem.deleteMany({
        where: { task_id: taskId },
      })
    } catch (error) {
      console.error('[DeleteTaskUseCase] Failed to cleanup plan items:', error)
    }
  }

  /**
   * 從今日 briefing 中移除已刪除的任務
   */
  private async cleanupBriefing(userId: string, taskId: string): Promise<void> {
    try {
      const briefingRepo = new PrismaCoachBriefingRepository()
      await briefingRepo.removeTaskFromBriefing(userId, taskId)
    } catch (error) {
      console.error('[DeleteTaskUseCase] Failed to cleanup briefing:', error)
    }
  }

  /**
   * 將任務的 References 遷移到 Product 層級
   *
   * 業務規則：當刪除任務時,保留其 References 到 Product 層級
   * 以便未來查找與追蹤
   */
  private async migrateReferencesToProduct(
    task: TaskData
  ): Promise<number> {
    const taskReferences = task.references || []

    // 如果沒有 references,直接返回
    if (taskReferences.length === 0) {
      return 0
    }

    // 查詢 Product 的現有 references
    const product = await prisma.product.findUnique({
      where: { id: task.productId },
      select: { references: true },
    })

    if (!product) {
      console.warn(
        `[DeleteTaskUseCase] Product not found: ${task.productId}`
      )
      return 0
    }

    const productReferences = (product.references as any[]) || []

    // 為每個 reference 添加原始 task 資訊
    const migratedReferences = taskReferences.map((ref) => ({
      id: ref.id,
      type: ref.type,
      content: ref.content,
      title: ref.title,
      created_at: ref.createdAt.toISOString(),
      originalTaskId: task.id,
      originalTaskContent: task.content,
    }))

    // 合併到 product 的 references
    const updatedProductReferences = [
      ...productReferences,
      ...migratedReferences,
    ]

    // 更新 Product
    await prisma.product.update({
      where: { id: task.productId },
      data: {
        references: updatedProductReferences,
      },
    })

    return taskReferences.length
  }
}
