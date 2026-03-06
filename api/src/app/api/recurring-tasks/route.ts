import { NextRequest } from 'next/server'
import { authenticateRequest } from '@/lib/auth-middleware'
import { prisma } from '@/lib/db'
import { ApiResponseBuilder, catchDomainException, ValidationException } from '@/lib/api-response'
import { CreateRecurringTaskUseCase } from '@/application/use-cases/recurring/create-recurring-task'
import { PrismaRecurringTaskRepository } from '@/infrastructure/repositories/prisma-recurring-task-repository'
import { formatRecurringTask } from './_shared'

// GET /api/recurring-tasks
export async function GET(request: NextRequest) {
  return catchDomainException(async () => {
    const userId = await authenticateRequest(request, prisma)
    const repo = new PrismaRecurringTaskRepository()
    const templates = await repo.findByUserId(userId)
    return ApiResponseBuilder.success({ recurring_tasks: templates.map(formatRecurringTask) })
  })
}

// POST /api/recurring-tasks
export async function POST(request: NextRequest) {
  return catchDomainException(async () => {
    const userId = await authenticateRequest(request, prisma)
    const body = await request.json() as any

    if (!body.recurrence_rule) {
      throw new ValidationException('recurrence_rule is required', 'recurrence_rule')
    }

    const useCase = new CreateRecurringTaskUseCase()
    const result = await useCase.execute({
      userId,
      title: body.title,
      recurrenceRule: body.recurrence_rule,
      leadDays: body.lead_days,
      productId: body.product_id,
      topicId: body.topic_id,
      estimatedDurationHours: body.estimated_duration_hours,
    })

    return ApiResponseBuilder.success({ recurring_task: formatRecurringTask(result.recurringTask) })
  })
}
