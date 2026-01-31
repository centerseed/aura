/**
 * GetProductsUseCase - 獲取產品列表
 *
 * Application Layer Use Case
 * 處理獲取用戶所有產品的業務邏輯
 */

import { prisma } from '@/lib/db'
import { ValidationException } from '@/lib/api-response'

// ============================================================================
// DTOs (Data Transfer Objects)
// ============================================================================

export interface GetProductsRequest {
  userId: string
}

export interface ProductData {
  id: string
  user_id: string
  area_id: string
  name: string
  description: string | null
  status: string
  lifecycle: string
  display_order: number
  created_at: Date
  updated_at: Date
  area?: {
    id: string
    name: string
    scope: string | null
    description: string | null
  }
}

export interface GetProductsResponse {
  products: ProductData[]
}

// ============================================================================
// Use Case
// ============================================================================

export class GetProductsUseCase {
  async execute(
    request: GetProductsRequest
  ): Promise<GetProductsResponse> {
    // 1. 驗證輸入
    this.validateRequest(request)

    // 2. 查詢所有未軟刪除的 Product,並做排序
    const products = await prisma.product.findMany({
      where: {
        user_id: request.userId,
        deleted_at: null,
      },
      include: {
        area: {
          select: {
            id: true,
            name: true,
            scope: true,
            description: true,
          },
        },
      },
      orderBy: [
        { display_order: 'asc' },
        { created_at: 'desc' },
      ],
    })

    return {
      products,
    }
  }

  /**
   * 驗證請求資料
   */
  private validateRequest(request: GetProductsRequest): void {
    if (!request.userId) {
      throw new ValidationException('User ID is required', 'userId')
    }
  }
}
