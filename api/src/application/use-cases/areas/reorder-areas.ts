/**
 * ReorderAreasUseCase - 批量更新身分排序
 *
 * Application Layer Use Case
 * 處理批量更新身分 display_order 的業務邏輯
 */

import { prisma } from '@/lib/db'
import { ValidationException } from '@/lib/api-response'

// ============================================================================
// DTOs (Data Transfer Objects)
// ============================================================================

export interface AreaOrderUpdate {
  id: string
  display_order: number
}

export interface ReorderAreasRequest {
  userId: string
  updates: AreaOrderUpdate[]
}

export interface ReorderAreasResponse {
  updated: number
  message: string
}

// ============================================================================
// Use Case
// ============================================================================

export class ReorderAreasUseCase {
  async execute(request: ReorderAreasRequest): Promise<ReorderAreasResponse> {
    // 1. 驗證輸入
    this.validateRequest(request)

    // 2. 在一個 transaction 中更新所有 areas
    await prisma.$transaction(
      request.updates.map((update) =>
        prisma.area.update({
          where: { id: update.id },
          data: { display_order: update.display_order },
        })
      )
    )

    return {
      updated: request.updates.length,
      message: `Successfully reordered ${request.updates.length} areas`,
    }
  }

  private validateRequest(request: ReorderAreasRequest): void {
    if (!request.userId) {
      throw new ValidationException('User ID is required', 'userId')
    }

    if (!request.updates || !Array.isArray(request.updates)) {
      throw new ValidationException('Updates array is required', 'updates')
    }

    if (request.updates.length === 0) {
      throw new ValidationException('Updates array cannot be empty', 'updates')
    }

    for (let i = 0; i < request.updates.length; i++) {
      const update = request.updates[i]

      if (!update.id) {
        throw new ValidationException(
          `Update at index ${i} is missing id`,
          `updates[${i}].id`
        )
      }

      if (typeof update.display_order !== 'number') {
        throw new ValidationException(
          `Update at index ${i} has invalid display_order (must be a number)`,
          `updates[${i}].display_order`
        )
      }

      if (!Number.isInteger(update.display_order)) {
        throw new ValidationException(
          `Update at index ${i} has invalid display_order (must be an integer)`,
          `updates[${i}].display_order`
        )
      }
    }
  }
}
