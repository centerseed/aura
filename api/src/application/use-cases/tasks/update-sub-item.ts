/**
 * UpdateSubItemUseCase - 更新任務子項目
 *
 * Application Layer Use Case
 * 操作 sub_tasks 表 + 雙寫 JSON（過渡期相容）
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

export interface UpdateSubItemRequest {
  taskId: string
  userId: string
  subItemId: string
  completed?: boolean
  content?: string
  startDate?: string | null
  dueDate?: string | null
}

export interface SubItemData {
  id: string
  content: string
  completed: boolean
  created_at: string
  completed_at: string | null
  order: number
  start_date: string | null
  due_date: string | null
}

export interface UpdateSubItemResponse {
  subItem: SubItemData
  meta: {
    total: number
    completed: number
    completionRate: number
  }
  taskCompleted: boolean
  message: string
}

// ============================================================================
// Use Case
// ============================================================================

export class UpdateSubItemUseCase {
  constructor(
    private readonly taskRepository: ITaskRepository = new PrismaTaskRepository()
  ) {}

  async execute(
    request: UpdateSubItemRequest
  ): Promise<UpdateSubItemResponse> {
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

    // 4. 更新 sub_task 記錄
    const now = new Date()
    const updateData: any = {}

    if (request.content !== undefined) {
      updateData.content = request.content.trim()
    }

    if (request.completed !== undefined) {
      updateData.completed = request.completed
      updateData.completed_at = request.completed ? now : null
    }

    if (request.startDate !== undefined) {
      updateData.start_date = request.startDate ? new Date(request.startDate) : null
    }

    if (request.dueDate !== undefined) {
      if (request.dueDate) {
        const subDueDate = new Date(request.dueDate)
        // 驗證：sub-item dueDate 不能晚於 task 的 due_date
        const taskDueDate = (task as any).due_date || (task as any).dueDate
        if (taskDueDate) {
          const taskDue = typeof taskDueDate === 'string' ? new Date(taskDueDate) : taskDueDate
          if (subDueDate > taskDue) {
            throw new ValidationException(
              'Sub-item due date cannot be later than the task due date',
              'dueDate'
            )
          }
        }
        updateData.due_date = subDueDate
      } else {
        updateData.due_date = null
      }
    }

    const updated = await prisma.subTask.update({
      where: { id: request.subItemId },
      data: updateData,
    })

    // 5. 雙寫：同步到 JSON
    await syncSubTasksToJson(request.taskId)

    // 6. 計算統計資訊
    const meta = await getSubTasksMeta(request.taskId)
    const allCompleted = meta.completed === meta.total && meta.total > 0

    const updatedSubItem: SubItemData = {
      id: updated.id,
      content: updated.content,
      completed: updated.completed,
      created_at: updated.created_at.toISOString(),
      completed_at: updated.completed_at?.toISOString() ?? null,
      order: updated.order,
      start_date: (updated as any).start_date?.toISOString() ?? null,
      due_date: (updated as any).due_date?.toISOString() ?? null,
    }

    return {
      subItem: updatedSubItem,
      meta,
      taskCompleted: allCompleted,
      message: 'Sub-item updated successfully',
    }
  }

  private validateRequest(request: UpdateSubItemRequest): void {
    if (!request.taskId) {
      throw new ValidationException('Task ID is required', 'taskId')
    }

    if (!request.subItemId) {
      throw new ValidationException('Sub-item ID is required', 'subItemId')
    }

    if (
      request.completed === undefined &&
      request.content === undefined &&
      request.startDate === undefined &&
      request.dueDate === undefined
    ) {
      throw new ValidationException(
        'At least one field (completed, content, startDate, dueDate) is required',
        'body'
      )
    }

    if (request.content !== undefined && request.content.trim().length === 0) {
      throw new ValidationException(
        'Content cannot be empty',
        'content'
      )
    }
  }
}
