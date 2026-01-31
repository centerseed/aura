/**
 * UpdateProductUseCase - 更新產品
 *
 * Application Layer Use Case
 * 處理更新產品資訊的業務邏輯(包括移動到新 Area)
 */

import { prisma } from '@/lib/db'
import { ValidationException, NotFoundException } from '@/lib/api-response'

// ============================================================================
// DTOs (Data Transfer Objects)
// ============================================================================

export interface UpdateProductRequest {
  productId: string
  userId: string
  name?: string
  description?: string
  areaId?: string
  status?: 'INBOX' | 'ACTIVE' | 'MAINTAIN' | 'REFERENCE' | 'ARCHIVE'
  lifecycle?: 'FINITE' | 'PERPETUAL'
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
}

export interface UpdateProductResponse {
  product: ProductData
  message: string
}

// ============================================================================
// Use Case
// ============================================================================

export class UpdateProductUseCase {
  async execute(
    request: UpdateProductRequest
  ): Promise<UpdateProductResponse> {
    // 1. 驗證輸入
    this.validateRequest(request)

    // 2. 檢查 product 是否存在且屬於當前用戶
    const existing = await prisma.product.findFirst({
      where: {
        id: request.productId,
        user_id: request.userId,
        deleted_at: null,
      },
    })

    if (!existing) {
      throw new NotFoundException('Product')
    }

    // 3. 如果要修改名稱,檢查是否在目標 Area 中重複
    if (request.name && request.name !== existing.name) {
      const targetAreaId = request.areaId || existing.area_id

      const duplicate = await prisma.product.findFirst({
        where: {
          area_id: targetAreaId,
          name: request.name,
          deleted_at: null,
          id: { not: request.productId },
        },
      })

      if (duplicate) {
        throw new ValidationException(
          'Product with this name already exists in this area',
          'name'
        )
      }
    }

    // 4. 更新 Product
    const updated = await prisma.product.update({
      where: { id: request.productId },
      data: {
        name: request.name,
        description: request.description,
        area_id: request.areaId,
        status: request.status as any,
        lifecycle: request.lifecycle as any,
      },
    })

    return {
      product: updated,
      message: 'Product updated successfully',
    }
  }

  /**
   * 驗證請求資料
   */
  private validateRequest(request: UpdateProductRequest): void {
    if (!request.productId) {
      throw new ValidationException('Product ID is required', 'productId')
    }

    if (!request.userId) {
      throw new ValidationException('User ID is required', 'userId')
    }

    if (request.name !== undefined) {
      if (request.name.length === 0 || request.name.length > 200) {
        throw new ValidationException(
          'Name must be between 1 and 200 characters',
          'name'
        )
      }
    }
  }
}
