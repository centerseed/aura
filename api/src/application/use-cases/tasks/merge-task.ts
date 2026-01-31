/**
 * MergeTaskUseCase - 合併任務
 *
 * Application Layer Use Case
 * 處理將來源任務合併為目標任務的 sub-item 的業務邏輯
 */

import type {
  ITaskRepository,
} from '@/domain/interfaces/task-repository'
import { PrismaTaskRepository } from '@/infrastructure/repositories/prisma-task-repository'
import { ValidationException, NotFoundException } from '@/lib/api-response'
import { prisma } from '@/lib/db'
import { mergeReferences } from '@/application/use-cases/merge-references'
import type { Reference } from '@/domain/entities/task.entity'

// ============================================================================
// DTOs (Data Transfer Objects)
// ============================================================================

export interface MergeTaskRequest {
  sourceTaskId: string
  targetTaskId: string
  userId: string
}

export interface SubItemData {
  id: string
  content: string
  completed: boolean
  created_at: string
  completed_at: string | null
  order: number
  original_task_id: string
}

export interface MergeTaskResponse {
  sourceTaskId: string
  targetTaskId: string
  newSubItem: SubItemData
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

export class MergeTaskUseCase {
  constructor(
    private readonly taskRepository: ITaskRepository = new PrismaTaskRepository()
  ) {}

  async execute(
    request: MergeTaskRequest
  ): Promise<MergeTaskResponse> {
    // 1. 驗證輸入
    this.validateRequest(request)

    // 2. 查詢來源任務並驗證權限
    const sourceTask = await this.taskRepository.findById(
      request.sourceTaskId,
      request.userId
    )

    if (!sourceTask) {
      throw new NotFoundException('Source task')
    }

    // 3. 查詢目標任務並驗證權限
    const targetTask = await this.taskRepository.findById(
      request.targetTaskId,
      request.userId
    )

    if (!targetTask) {
      throw new NotFoundException('Target task')
    }

    // 4. 準備合併資料
    const existingSubItems = (targetTask.subItems || []).map((item) => ({
      id: item.id,
      content: item.content,
      completed: item.completed,
      created_at: item.createdAt.toISOString(),
      completed_at: item.completedAt?.toISOString() || null,
      order: item.order,
    }))

    // 5. 創建新的 sub-item (從來源 Task)
    const now = new Date().toISOString()
    const isCompleted = sourceTask.status === 'ARCHIVE'
    const newSubItem: SubItemData = {
      id: crypto.randomUUID(),
      content: sourceTask.content,
      completed: isCompleted,
      created_at: now,
      completed_at: isCompleted ? now : null,
      order: existingSubItems.length,
      original_task_id: request.sourceTaskId,
    }

    // 6. 更新 sub_items
    const updatedSubItems = [...existingSubItems, newSubItem]

    // 7. 計算合併後的 start_date (取最早的開始時間)
    let mergedStartDate = targetTask.startDate

    if (sourceTask.startDate && targetTask.startDate) {
      // 兩者都有值,取較早的
      mergedStartDate =
        sourceTask.startDate < targetTask.startDate
          ? sourceTask.startDate
          : targetTask.startDate
    } else if (sourceTask.startDate && !targetTask.startDate) {
      // 只有來源有值
      mergedStartDate = sourceTask.startDate
    }

    // 8. 合併 references (使用統一去重函數)
    const sourceReferences = (sourceTask.references || []) as unknown as Reference[]
    const targetReferences = (targetTask.references || []) as unknown as Reference[]
    const mergedReferences = mergeReferences(targetReferences, sourceReferences)

    // 9. 使用 transaction 確保原子性
    await prisma.$transaction([
      // 更新目標 Task
      prisma.task.update({
        where: { id: request.targetTaskId },
        data: {
          sub_items: updatedSubItems as any,
          start_date: mergedStartDate,
          references: mergedReferences as any,
          updated_at: new Date(),
        },
      }),
      // 軟刪除來源 Task
      prisma.task.update({
        where: { id: request.sourceTaskId },
        data: {
          deleted_at: new Date(),
          updated_at: new Date(),
        },
      }),
    ])

    // 10. 計算統計資訊
    const total = updatedSubItems.length
    const completedCount = updatedSubItems.filter((item) => item.completed).length
    const completionRate = total > 0 ? completedCount / total : 0

    return {
      sourceTaskId: request.sourceTaskId,
      targetTaskId: request.targetTaskId,
      newSubItem,
      meta: {
        total,
        completed: completedCount,
        completionRate,
      },
      message: `Task "${sourceTask.content}" 已合併為 "${targetTask.content}" 的待辦事項`,
    }
  }

  /**
   * 驗證請求資料
   */
  private validateRequest(request: MergeTaskRequest): void {
    if (!request.sourceTaskId) {
      throw new ValidationException('Source task ID is required', 'sourceTaskId')
    }

    if (!request.targetTaskId) {
      throw new ValidationException('Target task ID is required', 'targetTaskId')
    }

    if (request.sourceTaskId === request.targetTaskId) {
      throw new ValidationException(
        'Cannot merge a task into itself',
        'targetTaskId'
      )
    }
  }
}
