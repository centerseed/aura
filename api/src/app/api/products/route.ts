/**
 * Products API Routes - 使用 Clean Architecture
 *
 * Interface Layer: 處理產品的 CRUD 操作
 */

import { NextRequest } from 'next/server'
import { authenticateRequest } from '@/lib/auth-middleware'
import { prisma } from '@/lib/db'
import {
  ApiResponseBuilder,
  catchDomainException,
} from '@/lib/api-response'
import { GetProductsUseCase } from '@/application/use-cases/products/get-products'
import { CreateProductUseCase } from '@/application/use-cases/products/create-product'

// ============================================================================
// GET /api/products - 獲取用戶的所有 Products
// ============================================================================

export async function GET(request: NextRequest) {
  return catchDomainException(async () => {
    // 1. 認證
    const userId = await authenticateRequest(request, prisma)

    // 2. 執行 Use Case
    const useCase = new GetProductsUseCase()
    const result = await useCase.execute({ userId })

    // 3. 統一回應格式
    return ApiResponseBuilder.success(
      {
        products: result.products,
      },
      {}
    )
  })
}

// ============================================================================
// POST /api/products - 創建新的 Product
// ============================================================================

/**
 * Request body:
 * {
 *   areaId: string
 *   name: string
 *   description?: string
 *   status?: 'INBOX' | 'ACTIVE' | 'MAINTAIN' | 'REFERENCE' | 'ARCHIVE'
 *   lifecycle?: 'FINITE' | 'PERPETUAL'
 * }
 */
export async function POST(request: NextRequest) {
  return catchDomainException(async () => {
    // 1. 認證
    const userId = await authenticateRequest(request, prisma)

    // 2. 解析參數
    const body = await request.json() as any
    const { areaId, name, description, status, lifecycle } = body

    // 3. 執行 Use Case
    const useCase = new CreateProductUseCase()
    const result = await useCase.execute({
      userId,
      areaId,
      name,
      description,
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
