/**
 * Areas Reorder API Route - 使用 Clean Architecture
 */

import { NextRequest } from 'next/server'
import { authenticateRequest } from '@/lib/auth-middleware'
import { prisma } from '@/lib/db'
import { ApiResponseBuilder, catchDomainException } from '@/lib/api-response'
import { ReorderAreasUseCase } from '@/application/use-cases/areas/reorder-areas'

// ============================================================================
// POST /api/areas/reorder - 批量更新身分排序
// ============================================================================

export async function POST(request: NextRequest) {
  return catchDomainException(async () => {
    const userId = await authenticateRequest(request, prisma)
    const body = await request.json() as any
    const { updates } = body

    const useCase = new ReorderAreasUseCase()
    const result = await useCase.execute({ userId, updates })

    return ApiResponseBuilder.success(
      {
        updated: result.updated,
        message: result.message,
      },
      {}
    )
  })
}
