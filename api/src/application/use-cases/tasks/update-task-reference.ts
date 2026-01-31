/**
 * UpdateTaskReferenceUseCase - 更新任務參考資料
 *
 * Application Layer Use Case
 * 處理更新任務 reference 的業務邏輯
 */

import type {
  ITaskRepository,
} from '@/domain/interfaces/task-repository'
import { PrismaTaskRepository } from '@/infrastructure/repositories/prisma-task-repository'
import { ValidationException, NotFoundException } from '@/lib/api-response'
import { prisma } from '@/lib/db'

// ============================================================================
// DTOs (Data Transfer Objects)
// ============================================================================

export interface UpdateTaskReferenceRequest {
  taskId: string
  userId: string
  referenceId: string
  content?: string
  title?: string | null
}

export interface UpdateTaskReferenceResponse {
  reference: {
    id: string
    type: 'url' | 'note'
    content: string
    title: string | null
    created_at: string
  }
  message: string
}

// ============================================================================
// Use Case
// ============================================================================

export class UpdateTaskReferenceUseCase {
  constructor(
    private readonly taskRepository: ITaskRepository = new PrismaTaskRepository()
  ) {}

  async execute(
    request: UpdateTaskReferenceRequest
  ): Promise<UpdateTaskReferenceResponse> {
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

    // 3. 找到要更新的 reference
    const existingReferences = task.references || []
    const referenceIndex = existingReferences.findIndex(
      (r) => r.id === request.referenceId
    )

    if (referenceIndex === -1) {
      throw new NotFoundException('Reference')
    }

    // 4. 更新 reference
    const existingReference = existingReferences[referenceIndex]
    const updatedReference = {
      id: existingReference.id,
      type: existingReference.type,
      content:
        request.content !== undefined
          ? request.content.trim()
          : existingReference.content,
      title:
        request.title !== undefined
          ? request.title?.trim() || null
          : existingReference.title,
      created_at: existingReference.createdAt.toISOString(),
    }

    // 5. URL 驗證 (如果是 url 類型且更新了 content)
    if (
      existingReference.type === 'url' &&
      request.content !== undefined
    ) {
      try {
        new URL(updatedReference.content)
      } catch {
        throw new ValidationException('Invalid URL format', 'content')
      }
    }

    // 6. 更新資料庫
    const updatedReferences = existingReferences.map((r) => ({
      id: r.id,
      type: r.type,
      content: r.content,
      title: r.title || null,
      created_at: r.createdAt.toISOString(),
    }))

    updatedReferences[referenceIndex] = updatedReference

    await prisma.task.update({
      where: { id: request.taskId },
      data: {
        references: updatedReferences as any,
        updated_at: new Date(),
      },
    })

    return {
      reference: updatedReference,
      message: 'Reference updated successfully',
    }
  }

  /**
   * 驗證請求資料
   */
  private validateRequest(request: UpdateTaskReferenceRequest): void {
    if (!request.taskId) {
      throw new ValidationException('Task ID is required', 'taskId')
    }

    if (!request.referenceId) {
      throw new ValidationException('Reference ID is required', 'referenceId')
    }

    if (request.content !== undefined && request.content.trim().length === 0) {
      throw new ValidationException(
        'Content cannot be empty',
        'content'
      )
    }
  }
}
