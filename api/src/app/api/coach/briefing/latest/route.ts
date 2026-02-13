/**
 * GET /api/coach/briefing/latest - 取得最新教練簡報
 *
 * Query params:
 * - type?: 'MORNING' | 'EVENING' (optional filter)
 */

import { NextRequest } from 'next/server'
import { authenticateRequest } from '@/lib/auth-middleware'
import { prisma } from '@/lib/db'
import { ApiResponseBuilder, catchDomainException } from '@/lib/api-response'
import { GetLatestBriefingUseCase } from '@/application/use-cases/coach/get-latest-briefing'
import type { BriefingType } from '@/domain/entities/coach-briefing.entity'
import { formatBriefing } from '@/app/api/coach/briefing/_shared'

export async function GET(request: NextRequest) {
  return catchDomainException(async () => {
    const userId = await authenticateRequest(request, prisma)

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') as BriefingType | null

    const useCase = new GetLatestBriefingUseCase()
    const result = await useCase.execute({
      userId,
      type: type || undefined,
    })

    return ApiResponseBuilder.success({
      briefing: result.briefing ? formatBriefing(result.briefing) : null,
    })
  })
}
