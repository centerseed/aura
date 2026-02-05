/**
 * DeleteProductUseCase - 刪除產品
 *
 * Application Layer Use Case
 * 處理軟刪除產品的業務邏輯
 */

import { prisma } from '@/lib/db'
import { ValidationException, NotFoundException, ConflictException } from '@/lib/api-response'

// ============================================================================
// DTOs (Data Transfer Objects)
// ============================================================================

export interface DeleteProductRequest {
  productId: string
  userId: string
}

export interface DeleteProductResponse {
  productId: string
  message: string
}

// ============================================================================
// Use Case
// ============================================================================

export class DeleteProductUseCase {
  async execute(
    request: DeleteProductRequest
  ): Promise<DeleteProductResponse> {
    // 1. 驗證輸入
    this.validateRequest(request)

    // 2. 檢查 product 是否存在且屬於當前用戶，使用 _count 避免載入完整 tasks 記錄
    const existing = await prisma.product.findFirst({
      where: {
        id: request.productId,
        user_id: request.userId,
        deleted_at: null,
      },
      select: {
        id: true,
        _count: {
          select: {
            tasks: {
              where: {
                deleted_at: null,
                status: { not: 'ARCHIVE' }, // 只計算未歸檔的 tasks
              },
            },
          },
        },
      },
    })

    if (!existing) {
      throw new NotFoundException('Product')
    }

    // 3. 檢查是否有關聯的未完成 Tasks
    if (existing._count.tasks > 0) {
      throw new ConflictException(
        `無法刪除此專案，因為還有 ${existing._count.tasks} 個進行中的任務。請先完成、刪除或移動這些任務。`
      )
    }

    // 4. 軟刪除
    await prisma.product.update({
      where: { id: request.productId },
      data: { deleted_at: new Date() },
    })

    return {
      productId: request.productId,
      message: 'Product deleted successfully',
    }
  }

  /**
   * 驗證請求資料
   */
  private validateRequest(request: DeleteProductRequest): void {
    if (!request.productId) {
      throw new ValidationException('Product ID is required', 'productId')
    }

    if (!request.userId) {
      throw new ValidationException('User ID is required', 'userId')
    }
  }
}
