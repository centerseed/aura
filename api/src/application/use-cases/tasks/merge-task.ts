/**
 * MergeTaskUseCase - 合併任務
 *
 * Application Layer Use Case
 * 將來源任務合併為目標任務的 sub_task
 */

import type {
  ITaskRepository,
} from '@/domain/interfaces/task-repository'
import { PrismaTaskRepository } from '@/infrastructure/repositories/prisma-task-repository'
import { ValidationException, NotFoundException } from '@/lib/api-response'
import { prisma } from '@/lib/db'
import { mergeReferences } from '@/application/use-cases/merge-references'
import type { Reference } from '@/domain/entities/task.entity'
import { getSubTasksMeta } from '@/infrastructure/repositories/sub-task-utils'

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

    // 4. 取得目前最大 order
    const maxOrderResult = await prisma.subTask.aggregate({
      where: { task_id: request.targetTaskId, deleted_at: null },
      _max: { order: true },
    })
    const nextOrder = (maxOrderResult._max.order ?? -1) + 1

    // 5. 建立 sub_task 記錄
    const now = new Date()
    const isCompleted = sourceTask.status === 'ARCHIVE'
    const newId = crypto.randomUUID()

    await prisma.subTask.create({
      data: {
        id: newId,
        task_id: request.targetTaskId,
        user_id: request.userId,
        content: sourceTask.content,
        completed: isCompleted,
        completed_at: isCompleted ? now : null,
        order: nextOrder,
        source: 'reorganize',
        original_task_id: request.sourceTaskId,
      },
    })

    // 6. 計算合併後的 start_date
    let mergedStartDate = targetTask.startDate

    if (sourceTask.startDate && targetTask.startDate) {
      mergedStartDate =
        sourceTask.startDate < targetTask.startDate
          ? sourceTask.startDate
          : targetTask.startDate
    } else if (sourceTask.startDate && !targetTask.startDate) {
      mergedStartDate = sourceTask.startDate
    }

    // 7. 合併 references
    const sourceReferences = (sourceTask.references || []) as unknown as Reference[]
    const targetReferences = (targetTask.references || []) as unknown as Reference[]
    const mergedReferences = mergeReferences(targetReferences, sourceReferences)

    // 8. 更新 target task + 軟刪除 source task
    await prisma.$transaction([
      prisma.task.update({
        where: { id: request.targetTaskId },
        data: {
          start_date: mergedStartDate,
          references: mergedReferences as any,
        },
      }),
      prisma.task.update({
        where: { id: request.sourceTaskId },
        data: {
          deleted_at: now,
          updated_at: now,
        },
      }),
    ])

    // 9. 計算統計資訊
    const meta = await getSubTasksMeta(request.targetTaskId)

    const newSubItem: SubItemData = {
      id: newId,
      content: sourceTask.content,
      completed: isCompleted,
      created_at: now.toISOString(),
      completed_at: isCompleted ? now.toISOString() : null,
      order: nextOrder,
      original_task_id: request.sourceTaskId,
    }

    return {
      sourceTaskId: request.sourceTaskId,
      targetTaskId: request.targetTaskId,
      newSubItem,
      meta,
      message: `Task "${sourceTask.content}" 已合併為 "${targetTask.content}" 的待辦事項`,
    }
  }

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
