/**
 * Coach Briefing API 共用格式化函式
 */

import type { CoachBriefingData } from '@/domain/interfaces/coach-briefing-repository'

export function formatBriefing(briefing: CoachBriefingData) {
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
