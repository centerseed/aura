/**
 * POST /api/coach/briefing - 手動生成教練簡報
 *
 * Request body:
 * {
 *   type: 'MORNING' | 'EVENING'
 *   date?: string (ISO date, defaults to today)
 *   timezone?: string (defaults to user's timezone)
 * }
 */

import { NextRequest } from 'next/server'
import { authenticateRequest } from '@/lib/auth-middleware'
import { prisma } from '@/lib/db'
import { ApiResponseBuilder, catchDomainException, ValidationException } from '@/lib/api-response'
import { GenerateBriefingUseCase } from '@/application/use-cases/coach/generate-briefing'
import { formatBriefing } from '@/app/api/coach/briefing/_shared'

export async function POST(request: NextRequest) {
  return catchDomainException(async () => {
    const userId = await authenticateRequest(request, prisma)

    const body = await request.json() as any
    const { type, date, timezone } = body

    if (!type) {
      throw new ValidationException('type is required (MORNING or EVENING)', 'type')
    }

    const useCase = new GenerateBriefingUseCase()
    const result = await useCase.execute({
      userId,
      type,
      date,
      timezone,
    })

    return ApiResponseBuilder.success({
      briefing: formatBriefing(result.briefing),
      timings: result.timings,
    })
  })
}
