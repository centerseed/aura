/**
 * CreateMilestoneUseCase - 創建里程碑
 *
 * Application Layer Use Case
 * 處理創建新里程碑的業務邏輯
 */

import { prisma } from '@/lib/db'
import { ValidationException } from '@/lib/api-response'

// ============================================================================
// DTOs (Data Transfer Objects)
// ============================================================================

export interface CreateMilestoneRequest {
  userId: string
  name: string
  target_date: string // ISO 8601 date string
  entity_type: 'AREA' | 'PRODUCT' | 'TOPIC'
  entity_id: string
  priority?: number
  description?: string
  status?: 'planned' | 'in_progress' | 'completed' | 'delayed' | 'cancelled'
}

export interface CreateMilestoneResponse {
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

export class CreateMilestoneUseCase {
  async execute(
    request: CreateMilestoneRequest
  ): Promise<CreateMilestoneResponse> {
    // 1. 驗證輸入
    this.validateRequest(request)

    // 2. 設定預設值
    const priority = request.priority ?? 5
    const status = request.status ?? 'planned'

    // 3. 創建里程碑
    const milestone = await prisma.milestone.create({
      data: {
        user_id: request.userId,
        name: request.name,
        target_date: new Date(request.target_date),
        entity_type: request.entity_type,
        entity_id: request.entity_id,
        priority: priority,
        description: request.description,
        status: status,
      },
    })

    return {
      milestone,
      message: 'Milestone created successfully',
    }
  }

  /**
   * 驗證請求資料
   */
  private validateRequest(request: CreateMilestoneRequest): void {
    if (!request.userId) {
      throw new ValidationException('User ID is required', 'userId')
    }

    if (!request.name || request.name.trim().length === 0) {
      throw new ValidationException('Name is required', 'name')
    }

    if (request.name.length > 200) {
      throw new ValidationException('Name must not exceed 200 characters', 'name')
    }

    if (!request.target_date) {
      throw new ValidationException('Target date is required', 'target_date')
    }

    // 驗證日期格式
    const date = new Date(request.target_date)
    if (isNaN(date.getTime())) {
      throw new ValidationException('Invalid date format', 'target_date')
    }

    if (!request.entity_type) {
      throw new ValidationException('Entity type is required', 'entity_type')
    }

    if (!['AREA', 'PRODUCT', 'TOPIC'].includes(request.entity_type)) {
      throw new ValidationException(
        'Entity type must be AREA, PRODUCT, or TOPIC',
        'entity_type'
      )
    }

    if (!request.entity_id) {
      throw new ValidationException('Entity ID is required', 'entity_id')
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
