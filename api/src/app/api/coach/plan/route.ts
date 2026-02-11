/**
 * GET  /api/coach/plan?date=YYYY-MM-DD  取得當日計畫
 * POST /api/coach/plan                   觸發生成/重新生成
 */

import { NextRequest } from 'next/server'
import { authenticateRequest } from '@/lib/auth-middleware'
import { prisma } from '@/lib/db'
import { ApiResponseBuilder, catchDomainException, ValidationException } from '@/lib/api-response'
import { GeneratePlanUseCase } from '@/application/use-cases/coach/generate-plan'
import { GetPlanUseCase } from '@/application/use-cases/coach/get-plan'
import type { DailyPlanData, DailyPlanItemData } from '@/domain/interfaces/daily-plan-repository'

function formatPlan(plan: DailyPlanData) {
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
    items: plan.items.map(formatPlanItem),
    created_at: plan.createdAt instanceof Date
      ? plan.createdAt.toISOString()
      : String(plan.createdAt),
    updated_at: plan.updatedAt instanceof Date
      ? plan.updatedAt.toISOString()
      : String(plan.updatedAt),
  }
}

function formatPlanItem(item: DailyPlanItemData) {
  return {
    id: item.id,
    plan_id: item.planId,
    task_id: item.taskId,
    sub_task_id: item.subTaskId,
    item_type: item.subTaskId ? 'subtask' : 'task',
    content: item.content,
    area_name: item.areaName,
    product_name: item.productName,
    estimated_minutes: item.estimatedMinutes,
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
  }
}

export async function GET(request: NextRequest) {
  return catchDomainException(async () => {
    const userId = await authenticateRequest(request, prisma)

    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date') || undefined
    const timezone = searchParams.get('timezone') || undefined

    const useCase = new GetPlanUseCase()
    const result = await useCase.execute({ userId, date, timezone })

    return ApiResponseBuilder.success({
      plan: result.plan ? formatPlan(result.plan) : null,
    })
  })
}

export async function POST(request: NextRequest) {
  return catchDomainException(async () => {
    const userId = await authenticateRequest(request, prisma)

    const body = await request.json() as any
    const { date, timezone } = body || {}

    const useCase = new GeneratePlanUseCase()
    const result = await useCase.execute({ userId, date, timezone })

    return ApiResponseBuilder.success({
      plan: formatPlan(result.plan),
      timings: result.timings,
    })
  })
}
