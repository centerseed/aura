/**
 * ReorderProductsUseCase - 批量更新產品排序
 *
 * Application Layer Use Case
 * 處理批量更新產品 display_order 的業務邏輯
 */

import { prisma } from '@/lib/db'
import { ValidationException } from '@/lib/api-response'

// ============================================================================
// DTOs (Data Transfer Objects)
// ============================================================================

export interface ProductOrderUpdate {
  id: string
  display_order: number
}

export interface ReorderProductsRequest {
  userId: string
  updates: ProductOrderUpdate[]
}

export interface ReorderProductsResponse {
  updated: number
  message: string
}

// ============================================================================
// Use Case
// ============================================================================

export class ReorderProductsUseCase {
  async execute(
    request: ReorderProductsRequest
  ): Promise<ReorderProductsResponse> {
    // 1. 驗證輸入
    this.validateRequest(request)

    // 2. 在一個 transaction 中更新所有 products
    await prisma.$transaction(
      request.updates.map((update) =>
        prisma.product.update({
          where: { id: update.id },
          data: { display_order: update.display_order },
        })
      )
    )

    return {
      updated: request.updates.length,
      message: `Successfully reordered ${request.updates.length} products`,
    }
  }

  /**
   * 驗證請求資料
   */
  private validateRequest(request: ReorderProductsRequest): void {
    if (!request.userId) {
      throw new ValidationException('User ID is required', 'userId')
    }

    if (!request.updates || !Array.isArray(request.updates)) {
      throw new ValidationException('Updates array is required', 'updates')
    }

    if (request.updates.length === 0) {
      throw new ValidationException('Updates array cannot be empty', 'updates')
    }

    // 驗證每個 update 項目都有 id 和 display_order
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
