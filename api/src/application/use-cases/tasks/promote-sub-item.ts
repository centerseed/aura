/**
 * PromoteSubItemUseCase - 將 sub-item 升級為獨立任務
 *
 * Application Layer Use Case
 * 從 sub_tasks 表讀取、soft-delete、建立新 Task + 雙寫 JSON（過渡期相容）
 */

import type { ITaskRepository } from '@/domain/interfaces/task-repository'
import { PrismaTaskRepository } from '@/infrastructure/repositories/prisma-task-repository'
import { ValidationException, NotFoundException } from '@/lib/api-response'
import { prisma } from '@/lib/db'
import { syncSubTasksToJson, getSubTasksMeta } from '@/infrastructure/repositories/sub-task-sync'

// ============================================================================
// DTOs (Data Transfer Objects)
// ============================================================================

export interface PromoteSubItemRequest {
  taskId: string
  subItemId: string
  userId: string
}

export interface SubItemData {
  id: string
  content: string
  completed: boolean
  created_at: string
  completed_at: string | null
  order: number
  original_task_id?: string
}

export interface TaskData {
  id: string
  content: string
  status: string
  product_id: string
  topic_id: string | null
  created_at: string
  updated_at: string
}

export interface PromoteSubItemResponse {
  newTask: TaskData
  parentTaskId: string
  removedSubItemId: string
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

export class PromoteSubItemUseCase {
  private static readonly MAX_TASK_CONTENT_LENGTH = 500

  constructor(
    private readonly taskRepository: ITaskRepository = new PrismaTaskRepository()
  ) {}

  async execute(request: PromoteSubItemRequest): Promise<PromoteSubItemResponse> {
    // 1. 驗證輸入
    this.validateRequest(request)

    // 2. 查詢 parent task 並驗證權限
    const parentTask = await this.taskRepository.findById(
      request.taskId,
      request.userId
    )

    if (!parentTask) {
      throw new NotFoundException('Parent task')
    }

    // 3. 從 sub_tasks 表查詢目標
    const subTask = await prisma.subTask.findFirst({
      where: { id: request.subItemId, task_id: request.taskId, deleted_at: null },
    })

    if (!subTask) {
      throw new NotFoundException('Sub-item')
    }

    // 4. 準備新 Task 資料
    const now = new Date()
    const newTaskId = crypto.randomUUID()
    const newTaskStatus = subTask.completed ? 'ARCHIVE' : 'INBOX'
    const newTaskContent = this.truncateContent(subTask.content)

    const aiAnalysis = {
      promoted_from: {
        parent_task_id: request.taskId,
        sub_item_id: request.subItemId,
        ...(subTask.original_task_id && {
          original_task_id: subTask.original_task_id,
        }),
      },
    }

    // 5. Transaction: 建立新 Task + soft-delete sub_task
    const [createdTask] = await prisma.$transaction([
      prisma.task.create({
        data: {
          id: newTaskId,
          user_id: request.userId,
          content: newTaskContent,
          status: newTaskStatus,
          product_id: parentTask.productId,
          topic_id: parentTask.topicId || null,
          sub_items: [],
          references: [],
          ai_analysis: aiAnalysis,
          created_at: now,
          updated_at: now,
        },
      }),
      prisma.subTask.update({
        where: { id: request.subItemId },
        data: { deleted_at: now },
      }),
    ])

    // 6. 重新排序剩餘 sub_tasks
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

    // 7. 雙寫：同步到 JSON
    await syncSubTasksToJson(request.taskId)

    // 8. 計算統計資訊
    const meta = await getSubTasksMeta(request.taskId)

    return {
      newTask: {
        id: createdTask.id,
        content: createdTask.content,
        status: createdTask.status,
        product_id: createdTask.product_id,
        topic_id: createdTask.topic_id,
        created_at: createdTask.created_at.toISOString(),
        updated_at: createdTask.updated_at.toISOString(),
      },
      parentTaskId: request.taskId,
      removedSubItemId: request.subItemId,
      meta,
      message: `Sub-item "${newTaskContent}" 已升級為獨立任務`,
    }
  }

  private validateRequest(request: PromoteSubItemRequest): void {
    if (!request.taskId) {
      throw new ValidationException('Task ID is required', 'taskId')
    }

    if (!request.subItemId) {
      throw new ValidationException('Sub-item ID is required', 'subItemId')
    }
  }

  private truncateContent(content: string): string {
    const trimmed = content.trim()
    if (trimmed.length <= PromoteSubItemUseCase.MAX_TASK_CONTENT_LENGTH) {
      return trimmed
    }
    return trimmed.substring(0, PromoteSubItemUseCase.MAX_TASK_CONTENT_LENGTH - 3) + '...'
  }
}
