import { NextRequest } from 'next/server'
import { authenticateRequest } from '@/lib/auth-middleware'
import { prisma } from '@/lib/db'
import { ApiResponseBuilder, catchDomainException, ValidationException } from '@/lib/api-response'
import { PrismaRecurringTaskRepository } from '@/infrastructure/repositories/prisma-recurring-task-repository'
import { computeNextOccurrence } from '@/application/use-cases/recurring/recurrence-utils'
import type { RecurringTaskUpdateData, RecurringTaskStatus } from '@/domain/interfaces/recurring-task-repository'
import { formatRecurringTask } from '../_shared'

// GET /api/recurring-tasks/:id
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return catchDomainException(async () => {
    const userId = await authenticateRequest(request, prisma)
    const { id } = await params
    const repo = new PrismaRecurringTaskRepository()
    const template = await repo.findById(id, userId)
    if (!template) throw new ValidationException('RecurringTask not found', 'id')
    return ApiResponseBuilder.success({ recurring_task: formatRecurringTask(template) })
  })
}

const VALID_STATUSES: RecurringTaskStatus[] = ['ACTIVE', 'PAUSED', 'ARCHIVED']

// PATCH /api/recurring-tasks/:id
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return catchDomainException(async () => {
    const userId = await authenticateRequest(request, prisma)
    const { id } = await params
    const body = await request.json() as any
    const repo = new PrismaRecurringTaskRepository()

    const updateData: RecurringTaskUpdateData = {}
    if (body.title !== undefined) updateData.title = body.title
    if (body.status !== undefined) {
      if (!VALID_STATUSES.includes(body.status)) {
        throw new ValidationException('Invalid status', 'status')
      }
      updateData.status = body.status as RecurringTaskStatus
    }
    if (body.lead_days !== undefined) updateData.leadDays = body.lead_days
    if (body.product_id !== undefined) updateData.productId = body.product_id
    if (body.topic_id !== undefined) updateData.topicId = body.topic_id
    if (body.estimated_duration_hours !== undefined) {
      updateData.estimatedDurationHours = body.estimated_duration_hours
    }
    if (body.recurrence_rule !== undefined) {
      updateData.recurrenceRule = body.recurrence_rule
      updateData.nextOccurrenceAt = computeNextOccurrence(body.recurrence_rule, new Date())
    }

    const updated = await repo.update(id, userId, updateData)
    return ApiResponseBuilder.success({ recurring_task: formatRecurringTask(updated) })
  })
}

// DELETE /api/recurring-tasks/:id
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return catchDomainException(async () => {
    const userId = await authenticateRequest(request, prisma)
    const { id } = await params
    const repo = new PrismaRecurringTaskRepository()
    await repo.softDelete(id, userId)
    return ApiResponseBuilder.success({ message: 'Recurring task archived' })
  })
}
