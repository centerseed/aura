/**
 * Suggest Product API Route - 使用 Clean Architecture
 */

import { NextRequest } from 'next/server'
import { authenticateRequest } from '@/lib/auth-middleware'
import { prisma } from '@/lib/db'
import { ApiResponseBuilder, catchDomainException } from '@/lib/api-response'
import { checkAiRateLimit, incrementAiUsage, DEFAULT_AI_MODEL } from '@/lib/ai-rate-limit'
import { SuggestProductUseCase } from '@/application/use-cases/ai/suggest-product'

// ============================================================================
// POST /api/suggest-product - AI 推薦產品名稱
// ============================================================================

export async function POST(request: NextRequest) {
  return catchDomainException(async () => {
    const userId = await authenticateRequest(request, prisma)
    await checkAiRateLimit(userId)
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
    await incrementAiUsage(userId, { usage: result.usage, feature: 'suggest_product', model: DEFAULT_AI_MODEL })

    return ApiResponseBuilder.success(result, {})
  })
}
