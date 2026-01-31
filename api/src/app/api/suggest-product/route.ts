/**
 * Suggest Product API Route - 使用 Clean Architecture
 */

import { NextRequest } from 'next/server'
import { authenticateRequest } from '@/lib/auth-middleware'
import { prisma } from '@/lib/db'
import { ApiResponseBuilder, catchDomainException } from '@/lib/api-response'
import { SuggestProductUseCase } from '@/application/use-cases/ai/suggest-product'

// ============================================================================
// POST /api/suggest-product - AI 推薦產品名稱
// ============================================================================

export async function POST(request: NextRequest) {
  return catchDomainException(async () => {
    const userId = await authenticateRequest(request, prisma)
    const body = await request.json() as any
    const { taskContent, taskNarrative, areaId, areaName, areaScope } = body

    const useCase = new SuggestProductUseCase()
    const result = await useCase.execute({
      userId,
      taskContent,
      taskNarrative,
      areaId,
      areaName,
      areaScope,
    })

    return ApiResponseBuilder.success(result, {})
  })
}
