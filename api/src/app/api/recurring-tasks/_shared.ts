import type { RecurringTaskData } from '@/domain/interfaces/recurring-task-repository'

export function formatRecurringTask(rt: RecurringTaskData) {
  return {
    id: rt.id,
    title: rt.title,
    status: rt.status,
    recurrence_rule: rt.recurrenceRule,
    lead_days: rt.leadDays,
    next_occurrence_at: rt.nextOccurrenceAt?.toISOString().substring(0, 10) ?? null,
    product_id: rt.productId,
    topic_id: rt.topicId,
    estimated_duration_hours: rt.estimatedDurationHours,
    created_at: rt.createdAt.toISOString(),
    updated_at: rt.updatedAt.toISOString(),
  }
}
