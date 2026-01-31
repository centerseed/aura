/**
 * UpdateMilestoneUseCase - 更新里程碑
 *
 * Application Layer Use Case
 * 處理更新里程碑的業務邏輯
 */

import { prisma } from '@/lib/db'
import { ValidationException, NotFoundException } from '@/lib/api-response'

// ============================================================================
// DTOs (Data Transfer Objects)
// ============================================================================

export interface UpdateMilestoneRequest {
  milestoneId: string
  userId: string
  name?: string
  target_date?: string // ISO 8601 date string
  entity_type?: 'AREA' | 'PRODUCT' | 'TOPIC'
  entity_id?: string
  priority?: number
  description?: string
  status?: 'planned' | 'in_progress' | 'completed' | 'delayed' | 'cancelled'
}

export interface UpdateMilestoneResponse {
  milestone: {
    id: string
    user_id: string
    name: string
    target_date: Date
    entity_type: string
    entity_id: string
    priority: number
    description: string | null
    status: string
    created_at: Date
    updated_at: Date
    deleted_at: Date | null
  }
  message: string
}

// ============================================================================
// Use Case
// ============================================================================

export class UpdateMilestoneUseCase {
  async execute(
    request: UpdateMilestoneRequest
  ): Promise<UpdateMilestoneResponse> {
    // 1. 驗證輸入
    this.validateRequest(request)

    // 2. 檢查 milestone 是否存在且屬於當前用戶
    const existing = await prisma.milestone.findFirst({
      where: { id: request.milestoneId, user_id: request.userId, deleted_at: null },
    })

    if (!existing) {
      throw new NotFoundException('Milestone')
    }

    // 3. 準備更新資料
    const updateData: any = {}
    if (request.name !== undefined) updateData.name = request.name
    if (request.target_date !== undefined) updateData.target_date = new Date(request.target_date)
    if (request.entity_type !== undefined) updateData.entity_type = request.entity_type
    if (request.entity_id !== undefined) updateData.entity_id = request.entity_id
    if (request.priority !== undefined) updateData.priority = request.priority
    if (request.description !== undefined) updateData.description = request.description
    if (request.status !== undefined) updateData.status = request.status

    // 4. 執行更新
    const milestone = await prisma.milestone.update({
      where: { id: request.milestoneId },
      data: updateData,
    })

    return {
      milestone,
      message: 'Milestone updated successfully',
    }
  }

  /**
   * 驗證請求資料
   */
  private validateRequest(request: UpdateMilestoneRequest): void {
    if (!request.milestoneId) {
      throw new ValidationException('Milestone ID is required', 'milestoneId')
    }

    if (!request.userId) {
      throw new ValidationException('User ID is required', 'userId')
    }

    if (request.name !== undefined) {
      if (request.name.trim().length === 0) {
        throw new ValidationException('Name cannot be empty', 'name')
      }
      if (request.name.length > 200) {
        throw new ValidationException('Name must not exceed 200 characters', 'name')
      }
    }

    if (request.target_date !== undefined) {
      const date = new Date(request.target_date)
      if (isNaN(date.getTime())) {
        throw new ValidationException('Invalid date format', 'target_date')
      }
    }

    if (request.entity_type !== undefined) {
      if (!['AREA', 'PRODUCT', 'TOPIC'].includes(request.entity_type)) {
        throw new ValidationException(
          'Entity type must be AREA, PRODUCT, or TOPIC',
          'entity_type'
        )
      }
    }

    if (request.priority !== undefined) {
      if (!Number.isInteger(request.priority) || request.priority < 1 || request.priority > 10) {
        throw new ValidationException('Priority must be an integer between 1 and 10', 'priority')
      }
    }

    if (request.status !== undefined) {
      const validStatuses = ['planned', 'in_progress', 'completed', 'delayed', 'cancelled']
      if (!validStatuses.includes(request.status)) {
        throw new ValidationException(
          `Status must be one of: ${validStatuses.join(', ')}`,
          'status'
        )
      }
    }
  }
}
