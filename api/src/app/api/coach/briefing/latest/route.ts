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

export async function GET(request: NextRequest) {
  return catchDomainException(async () => {
    // 1. 認證
    const userId = await authenticateRequest(request, prisma)

    // 2. 解析查詢參數
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') as BriefingType | null

    // 3. 執行 Use Case
    const useCase = new GetLatestBriefingUseCase()
    const result = await useCase.execute({
      userId,
      type: type || undefined,
    })

    // 4. 回傳
    return ApiResponseBuilder.success({
      briefing: result.briefing ? formatBriefing(result.briefing) : null,
    })
  })
}
