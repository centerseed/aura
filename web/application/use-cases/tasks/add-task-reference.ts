/**
 * AddTaskReferenceUseCase - 新增任務參考資料
 *
 * Application Layer Use Case
 * 處理新增 reference 到任務的業務邏輯
 */

import type {
  ITaskRepository,
  TaskData,
} from '@/domain/interfaces/task-repository'
import { PrismaTaskRepository } from '@/infrastructure/repositories/prisma-task-repository'
import { ValidationException, NotFoundException } from '@/lib/api-response'
import { prisma } from '@/lib/db'

// ============================================================================
// DTOs (Data Transfer Objects)
// ============================================================================

export interface AddTaskReferenceRequest {
  taskId: string
  userId: string
  type: 'url' | 'note'
  content: string
  title?: string | null
}

export interface AddTaskReferenceResponse {
  reference: {
    id: string
    type: 'url' | 'note'
    content: string
    title: string | null
    createdAt: string
  }
  total: number
  message: string
}

// ============================================================================
// Use Case
// ============================================================================

export class AddTaskReferenceUseCase {
  constructor(
    private readonly taskRepository: ITaskRepository = new PrismaTaskRepository()
  ) {}

  async execute(
    request: AddTaskReferenceRequest
  ): Promise<AddTaskReferenceResponse> {
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

    // 3. 建立新 reference
    const newReference = {
      id: crypto.randomUUID(),
      type: request.type,
      content: request.content.trim(),
      title: request.title?.trim() || null,
      createdAt: new Date(),
    }

    // 4. 更新任務的 references (直接使用 Prisma,因為 references 是 JSON 欄位)
    const existingReferences = (task.references || []).map((r) => ({
      id: r.id,
      type: r.type,
      content: r.content,
      title: r.title || null,
      created_at: r.createdAt.toISOString(),
    }))

    const updatedReferences = [
      ...existingReferences,
      {
        id: newReference.id,
        type: newReference.type,
        content: newReference.content,
        title: newReference.title,
        created_at: newReference.createdAt.toISOString(),
      },
    ]

    // 5. 更新資料庫
    await prisma.task.update({
      where: { id: request.taskId },
      data: {
        references: updatedReferences as any,
        updated_at: new Date(),
      },
    })

    return {
      reference: {
        id: newReference.id,
        type: newReference.type,
        content: newReference.content,
        title: newReference.title,
        createdAt: newReference.createdAt.toISOString(),
      },
      total: updatedReferences.length,
      message: 'Reference added successfully',
    }
  }

  /**
   * 驗證請求資料
   */
  private validateRequest(request: AddTaskReferenceRequest): void {
    if (!request.taskId) {
      throw new ValidationException('Task ID is required', 'taskId')
    }

    if (!request.type || !['url', 'note'].includes(request.type)) {
      throw new ValidationException(
        "Type must be 'url' or 'note'",
        'type'
      )
    }

    if (!request.content || request.content.trim().length === 0) {
      throw new ValidationException(
        'Content is required and cannot be empty',
        'content'
      )
    }

    // URL 驗證 (如果是 url 類型)
    if (request.type === 'url') {
      try {
        new URL(request.content.trim())
      } catch {
        throw new ValidationException('Invalid URL format', 'content')
      }
    }
  }
}
