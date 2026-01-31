/**
 * Product [id] API Routes - 使用 Clean Architecture
 *
 * Interface Layer: 處理單一產品的操作
 */

import { NextRequest } from 'next/server'
import { authenticateRequest } from '@/lib/auth-middleware'
import { prisma } from '@/lib/db'
import {
  ApiResponseBuilder,
  catchDomainException,
} from '@/lib/api-response'
import { UpdateProductUseCase } from '@/application/use-cases/products/update-product'
import { DeleteProductUseCase } from '@/application/use-cases/products/delete-product'

// ============================================================================
// PATCH /api/products/[id] - 更新 Product (包括移動到新 Area)
// ============================================================================

/**
 * Request body:
 * {
 *   name?: string
 *   description?: string
 *   area_id?: string
 *   status?: 'INBOX' | 'ACTIVE' | 'MAINTAIN' | 'REFERENCE' | 'ARCHIVE'
 *   lifecycle?: 'FINITE' | 'PERPETUAL'
 * }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return catchDomainException(async () => {
    // 1. 認證
    const userId = await authenticateRequest(request, prisma)

    // 2. 解析參數
    const { id: productId } = await params
    const body = await request.json() as any
    const { name, description, area_id, status, lifecycle } = body

    // 3. 執行 Use Case
    const useCase = new UpdateProductUseCase()
    const result = await useCase.execute({
      productId,
      userId,
      name,
      description,
      areaId: area_id,
      status,
      lifecycle,
    })

    // 4. 統一回應格式
    return ApiResponseBuilder.success(
      {
        product: result.product,
        message: result.message,
      },
      {}
    )
  })
}

// ============================================================================
// DELETE /api/products/[id] - 軟刪除 Product
// ============================================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return catchDomainException(async () => {
    // 1. 認證
    const userId = await authenticateRequest(request, prisma)

    // 2. 解析參數
    const { id: productId } = await params

    // 3. 執行 Use Case
    const useCase = new DeleteProductUseCase()
    const result = await useCase.execute({
      productId,
      userId,
    })

    // 4. 統一回應格式
    return ApiResponseBuilder.success(
      {
        productId: result.productId,
        message: result.message,
      },
      {}
    )
  })
}
