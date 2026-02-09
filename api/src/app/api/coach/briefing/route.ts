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
import type { CoachBriefingData } from '@/domain/interfaces/coach-briefing-repository'

function formatBriefing(briefing: CoachBriefingData) {
  return {
    id: briefing.id,
    user_id: briefing.userId,
    type: briefing.type,
    briefing_date: briefing.briefingDate instanceof Date
      ? briefing.briefingDate.toISOString().substring(0, 10)
      : String(briefing.briefingDate).substring(0, 10),
    calendar_events: briefing.calendarEvents,
    overdue_tasks: briefing.overdueTasks,
    approaching_tasks: briefing.approachingTasks,
    conflicts: briefing.conflicts,
    stagnations: briefing.stagnations,
    completed_tasks: briefing.completedTasks,
    remaining_tasks: briefing.remainingTasks,
    tomorrow_preview: briefing.tomorrowPreview,
    summary: briefing.summary,
    recommendations: briefing.recommendations,
    defer_suggestions: briefing.deferSuggestions,
    created_at: briefing.createdAt instanceof Date
      ? briefing.createdAt.toISOString()
      : String(briefing.createdAt),
    updated_at: briefing.updatedAt instanceof Date
      ? briefing.updatedAt.toISOString()
      : String(briefing.updatedAt),
  }
}

export async function POST(request: NextRequest) {
  return catchDomainException(async () => {
    // 1. 認證
    const userId = await authenticateRequest(request, prisma)

    // 2. 解析請求體
    const body = await request.json() as any
    const { type, date, timezone } = body

    if (!type) {
      throw new ValidationException('type is required (MORNING or EVENING)', 'type')
    }

    // 3. 執行 Use Case
    const useCase = new GenerateBriefingUseCase()
    const result = await useCase.execute({
      userId,
      type,
      date,
      timezone,
    })

    // 4. 回傳
    return ApiResponseBuilder.success({
      briefing: formatBriefing(result.briefing),
      timings: result.timings,
    })
  })
}
