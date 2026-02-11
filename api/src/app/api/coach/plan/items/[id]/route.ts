/**
 * PATCH /api/coach/plan/items/:id  修改計畫項目
 *   { order, completed, pinned, deferred }
 */

import { NextRequest } from 'next/server'
import { authenticateRequest } from '@/lib/auth-middleware'
import { prisma } from '@/lib/db'
import { ApiResponseBuilder, catchDomainException } from '@/lib/api-response'
import { UpdatePlanItemUseCase } from '@/application/use-cases/coach/update-plan-item'
import type { DailyPlanItemData } from '@/domain/interfaces/daily-plan-repository'

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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return catchDomainException(async () => {
    await authenticateRequest(request, prisma)

    const { id } = await params
    const body = await request.json() as any
    const { order, completed, pinned, deferred } = body || {}

    const useCase = new UpdatePlanItemUseCase()
    const result = await useCase.execute({
      itemId: id,
      order,
      completed,
      pinned,
      deferred,
    })

    return ApiResponseBuilder.success({
      item: formatPlanItem(result.item),
    })
  })
}
