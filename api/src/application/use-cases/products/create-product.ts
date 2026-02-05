/**
 * CreateProductUseCase - 創建產品
 *
 * Application Layer Use Case
 * 處理創建新產品的業務邏輯
 */

import { prisma } from '@/lib/db'
import { ValidationException, NotFoundException } from '@/lib/api-response'
import { Status, Lifecycle } from '@prisma/client'
import { ensureProductEmbedding } from '@/lib/embedding'

// ============================================================================
// DTOs (Data Transfer Objects)
// ============================================================================

export interface CreateProductRequest {
  userId: string
  areaId: string
  name: string
  description?: string
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

export interface CreateProductResponse {
  product: ProductData
  message: string
}

// ============================================================================
// Use Case
// ============================================================================

export class CreateProductUseCase {
  async execute(
    request: CreateProductRequest
  ): Promise<CreateProductResponse> {
    // 1. 驗證輸入
    this.validateRequest(request)

    // 2. 檢查 Area 是否存在
    const area = await prisma.area.findFirst({
      where: {
        id: request.areaId,
        user_id: request.userId,
        deleted_at: null,
      },
    })

    if (!area) {
      throw new NotFoundException('Area')
    }

    // 3. 檢查是否已存在同名 Product
    const existing = await prisma.product.findFirst({
      where: {
        user_id: request.userId,
        area_id: request.areaId,
        name: request.name,
        deleted_at: null,
      },
    })

    if (existing) {
      throw new ValidationException(
        'Product with this name already exists in this area',
        'name'
      )
    }

    // 4. 創建新 Product
    const product = await prisma.product.create({
      data: {
        user_id: request.userId,
        area_id: request.areaId,
        name: request.name,
        description: request.description,
        status: request.status
          ? Status[request.status as keyof typeof Status]
          : Status.ACTIVE,
        lifecycle: request.lifecycle
          ? Lifecycle[request.lifecycle as keyof typeof Lifecycle]
          : Lifecycle.FINITE,
      },
    })

    // 5. 計算並存儲 embedding（非同步，不阻塞回應）
    ensureProductEmbedding(
      product.id,
      product.name,
      product.description
    ).catch(err => {
      console.error(`❌ [embedding] Failed to compute embedding for Product ${product.name}:`, err)
    })

    return {
      product,
      message: 'Product created successfully',
    }
  }

  /**
   * 驗證請求資料
   */
  private validateRequest(request: CreateProductRequest): void {
    if (!request.userId) {
      throw new ValidationException('User ID is required', 'userId')
    }

    if (!request.areaId) {
      throw new ValidationException('Area ID is required', 'areaId')
    }

    // 驗證 UUID 格式
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(request.areaId)) {
      throw new ValidationException('Invalid Area ID format', 'areaId')
    }

    if (!request.name) {
      throw new ValidationException('Name is required', 'name')
    }

    if (request.name.length === 0 || request.name.length > 200) {
      throw new ValidationException(
        'Name must be between 1 and 200 characters',
        'name'
      )
    }
  }
}
