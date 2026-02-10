/**
 * AddSubItemUseCase - 新增任務子項目
 *
 * Application Layer Use Case
 * 寫入 sub_tasks 表 + 雙寫 JSON（過渡期相容）
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

export interface AddSubItemRequest {
  taskId: string
  userId: string
  content: string
}

export interface SubItemData {
  id: string
  content: string
  completed: boolean
  created_at: string
  completed_at: string | null
  order: number
}

export interface AddSubItemResponse {
  subItem: SubItemData
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

export class AddSubItemUseCase {
  constructor(
    private readonly taskRepository: ITaskRepository = new PrismaTaskRepository()
  ) {}

  async execute(
    request: AddSubItemRequest
  ): Promise<AddSubItemResponse> {
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

    // 3. 取得目前最大 order
    const maxOrderResult = await prisma.subTask.aggregate({
      where: { task_id: request.taskId, deleted_at: null },
      _max: { order: true },
    })
    const nextOrder = (maxOrderResult._max.order ?? -1) + 1

    // 4. 建立 sub_task 記錄
    const now = new Date()
    const newId = crypto.randomUUID()

    await prisma.subTask.create({
      data: {
        id: newId,
        task_id: request.taskId,
        user_id: request.userId,
        content: request.content.trim(),
        completed: false,
        order: nextOrder,
        source: 'user',
      },
    })

    // 5. 雙寫：同步到 JSON
    await syncSubTasksToJson(request.taskId)

    // 6. 計算統計資訊
    const meta = await getSubTasksMeta(request.taskId)

    const newSubItem: SubItemData = {
      id: newId,
      content: request.content.trim(),
      completed: false,
      created_at: now.toISOString(),
      completed_at: null,
      order: nextOrder,
    }

    return {
      subItem: newSubItem,
      meta,
      message: 'Sub-item added successfully',
    }
  }

  private validateRequest(request: AddSubItemRequest): void {
    if (!request.taskId) {
      throw new ValidationException('Task ID is required', 'taskId')
    }

    if (!request.content) {
      throw new ValidationException('Content is required', 'content')
    }

    if (request.content.trim().length === 0) {
      throw new ValidationException(
        'Content cannot be empty',
        'content'
      )
    }
  }
}
