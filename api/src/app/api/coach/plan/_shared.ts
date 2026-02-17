/**
 * Coach Plan API 共用格式化函式
 */

import type { DailyPlanItemData, DailyPlanData } from '@/domain/interfaces/daily-plan-repository'

export function formatPlanItem(item: DailyPlanItemData) {
  return {
    id: item.id,
    plan_id: item.planId,
    task_id: item.taskId,
    sub_task_id: item.subTaskId,
    item_type: item.itemType,
    content: item.content,
    area_name: item.areaName,
    product_name: item.productName,
    estimated_minutes: item.estimatedMinutes,
    actual_minutes: item.actualMinutes,
    due_date: item.dueDate instanceof Date
      ? item.dueDate.toISOString().substring(0, 10)
      : item.dueDate ? String(item.dueDate).substring(0, 10) : null,
    order: item.order,
    reasoning: item.reasoning,
    completed: item.completed,
    completed_at: item.completedAt instanceof Date
      ? item.completedAt.toISOString()
      : item.completedAt ? String(item.completedAt) : null,
    pinned: item.pinned,
    deferred: item.deferred,
    status: item.status,
    task_name: item.taskName,
    user_adjusted: item.userAdjusted,
    adjusted_at: item.adjustedAt instanceof Date
      ? item.adjustedAt.toISOString()
      : item.adjustedAt ? String(item.adjustedAt) : null,
  }
}

export function formatPlan(plan: DailyPlanData) {
  return {
    id: plan.id,
    user_id: plan.userId,
    plan_date: plan.planDate instanceof Date
      ? plan.planDate.toISOString().substring(0, 10)
      : String(plan.planDate).substring(0, 10),
    coach_message: plan.coachMessage,
    capacity_note: plan.capacityNote,
    available_minutes: plan.availableMinutes,
    meeting_minutes: plan.meetingMinutes,
    planned_minutes: plan.plannedMinutes,
    overflow_items: plan.overflowItems ?? [],
    items: plan.items.map(formatPlanItem),
    created_at: plan.createdAt instanceof Date
      ? plan.createdAt.toISOString()
      : String(plan.createdAt),
    updated_at: plan.updatedAt instanceof Date
      ? plan.updatedAt.toISOString()
      : String(plan.updatedAt),
  }
}
