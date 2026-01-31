/**
 * DeleteTaskReferenceUseCase - 刪除任務參考資料
 *
 * Application Layer Use Case
 * 處理從任務中刪除 reference 的業務邏輯
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

export interface DeleteTaskReferenceRequest {
  taskId: string
  userId: string
  referenceId: string
}

export interface DeleteTaskReferenceResponse {
  referenceId: string
  total: number
  message: string
}

// ============================================================================
// Use Case
// ============================================================================

export class DeleteTaskReferenceUseCase {
  constructor(
    private readonly taskRepository: ITaskRepository = new PrismaTaskRepository()
  ) {}

  async execute(
    request: DeleteTaskReferenceRequest
  ): Promise<DeleteTaskReferenceResponse> {
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

    // 3. 檢查 reference 是否存在
    const existingReferences = task.references || []
    const referenceExists = existingReferences.some(
      (r) => r.id === request.referenceId
    )

    if (!referenceExists) {
      throw new NotFoundException('Reference')
    }

    // 4. 過濾掉要刪除的 reference
    const updatedReferences = existingReferences
      .filter((r) => r.id !== request.referenceId)
      .map((r) => ({
        id: r.id,
        type: r.type,
        content: r.content,
        title: r.title || null,
        created_at: r.createdAt.toISOString(),
      }))

    // 5. 更新資料庫
    await prisma.task.update({
      where: { id: request.taskId },
      data: {
        references: updatedReferences as any,
        updated_at: new Date(),
      },
    })

    return {
      referenceId: request.referenceId,
      total: updatedReferences.length,
      message: 'Reference deleted successfully',
    }
  }

  /**
   * 驗證請求資料
   */
  private validateRequest(request: DeleteTaskReferenceRequest): void {
    if (!request.taskId) {
      throw new ValidationException('Task ID is required', 'taskId')
    }

    if (!request.referenceId) {
      throw new ValidationException('Reference ID is required', 'referenceId')
    }
  }
}
