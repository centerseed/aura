/**
 * DeleteMilestoneUseCase - 刪除里程碑
 *
 * Application Layer Use Case
 * 處理軟刪除里程碑的業務邏輯
 */

import { prisma } from '@/lib/db'
import { ValidationException, NotFoundException } from '@/lib/api-response'

// ============================================================================
// DTOs (Data Transfer Objects)
// ============================================================================

export interface DeleteMilestoneRequest {
  milestoneId: string
  userId: string
}

export interface DeleteMilestoneResponse {
  milestoneId: string
  message: string
}

// ============================================================================
// Use Case
// ============================================================================

export class DeleteMilestoneUseCase {
  async execute(
    request: DeleteMilestoneRequest
  ): Promise<DeleteMilestoneResponse> {
    // 1. 驗證輸入
    this.validateRequest(request)

    // 2. 檢查 milestone 是否存在且屬於當前用戶
    const existing = await prisma.milestone.findFirst({
      where: {
        id: request.milestoneId,
        user_id: request.userId,
        deleted_at: null,
      },
    })

    if (!existing) {
      throw new NotFoundException('Milestone')
    }

    // 3. 軟刪除
    await prisma.milestone.update({
      where: { id: request.milestoneId },
      data: { deleted_at: new Date() },
    })

    return {
      milestoneId: request.milestoneId,
      message: 'Milestone deleted successfully',
    }
  }

  /**
   * 驗證請求資料
   */
  private validateRequest(request: DeleteMilestoneRequest): void {
    if (!request.milestoneId) {
      throw new ValidationException('Milestone ID is required', 'milestoneId')
    }

    if (!request.userId) {
      throw new ValidationException('User ID is required', 'userId')
    }
  }
}
