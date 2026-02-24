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
import { z } from 'zod'
import { authenticateRequest } from '@/lib/auth-middleware'
import { prisma } from '@/lib/db'
import { ApiResponseBuilder, catchDomainException, ValidationException } from '@/lib/api-response'
import { checkAiRateLimit, incrementAiUsage } from '@/lib/ai-rate-limit'
import { GenerateBriefingUseCase } from '@/application/use-cases/coach/generate-briefing'
import { formatBriefing } from '@/app/api/coach/briefing/_shared'

function isValidTimezone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz })
    return true
  } catch {
    return false
  }
}

const BriefingRequestSchema = z.object({
  type: z.enum(['MORNING', 'EVENING'], {
    required_error: 'type is required (MORNING or EVENING)',
    invalid_type_error: 'type must be MORNING or EVENING',
  }),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD format').optional(),
  timezone: z.string().refine(isValidTimezone, { message: 'Invalid timezone' }).optional(),
})

export async function POST(request: NextRequest) {
  return catchDomainException(async () => {
    const userId = await authenticateRequest(request, prisma)
    await checkAiRateLimit(userId)

    const body = await request.json()
    const parsed = BriefingRequestSchema.safeParse(body)

    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0]
      throw new ValidationException(firstIssue.message, firstIssue.path.join('.'))
    }

    const { type, date, timezone } = parsed.data

    const useCase = new GenerateBriefingUseCase()
    const result = await useCase.execute({
      userId,
      type,
      date,
      timezone,
    })
    await incrementAiUsage(userId)

    return ApiResponseBuilder.success({
      briefing: formatBriefing(result.briefing),
      timings: result.timings,
    })
  })
}
