import type {
  IRecurringTaskRepository,
  RecurringTaskData,
  RecurrenceRule,
} from '@/domain/interfaces/recurring-task-repository'
import { PrismaRecurringTaskRepository } from '@/infrastructure/repositories/prisma-recurring-task-repository'
import { ValidationException } from '@/lib/api-response'
import { computeNextOccurrence } from './recurrence-utils'

export interface CreateRecurringTaskRequest {
  userId: string
  title: string
  recurrenceRule: RecurrenceRule
  leadDays?: number
  productId?: string | null
  topicId?: string | null
  estimatedDurationHours?: number | null
}

export interface CreateRecurringTaskResponse {
  recurringTask: RecurringTaskData
}

export class CreateRecurringTaskUseCase {
  constructor(
    private readonly repo: IRecurringTaskRepository = new PrismaRecurringTaskRepository()
  ) {}

  async execute(req: CreateRecurringTaskRequest): Promise<CreateRecurringTaskResponse> {
    this.validate(req)

    const rule = req.recurrenceRule
    const nextOccurrenceAt = computeNextOccurrence(rule, new Date())

    const recurringTask = await this.repo.create({
      userId: req.userId,
      title: req.title.trim(),
      recurrenceRule: rule,
      leadDays: req.leadDays ?? 1,
      productId: req.productId ?? null,
      topicId: req.topicId ?? null,
      estimatedDurationHours: req.estimatedDurationHours ?? null,
      status: 'ACTIVE',
      nextOccurrenceAt,
    })

    return { recurringTask }
  }

  private validate(req: CreateRecurringTaskRequest): void {
    if (!req.title?.trim()) {
      throw new ValidationException('title is required', 'title')
    }
    if (req.title.length > 500) {
      throw new ValidationException('title must be under 500 characters', 'title')
    }

    const rule = req.recurrenceRule
    if (!rule) {
      throw new ValidationException('recurrenceRule is required', 'recurrenceRule')
    }
    if (!['DAILY', 'WEEKLY', 'MONTHLY'].includes(rule.frequency)) {
      throw new ValidationException(
        'recurrenceRule.frequency must be DAILY, WEEKLY, or MONTHLY',
        'recurrenceRule.frequency'
      )
    }
    if (!rule.interval || rule.interval < 1) {
      throw new ValidationException('recurrenceRule.interval must be >= 1', 'recurrenceRule.interval')
    }
    if (!rule.timezone) {
      throw new ValidationException('recurrenceRule.timezone is required', 'recurrenceRule.timezone')
    }
    if (!rule.startDate || !/^\d{4}-\d{2}-\d{2}$/.test(rule.startDate)) {
      throw new ValidationException(
        'recurrenceRule.startDate must be YYYY-MM-DD',
        'recurrenceRule.startDate'
      )
    }
    if (rule.frequency === 'WEEKLY' && (!rule.daysOfWeek || rule.daysOfWeek.length === 0)) {
      throw new ValidationException(
        'recurrenceRule.daysOfWeek is required for WEEKLY frequency',
        'recurrenceRule.daysOfWeek'
      )
    }
    if (rule.frequency === 'MONTHLY' && !rule.dayOfMonth) {
      throw new ValidationException(
        'recurrenceRule.dayOfMonth is required for MONTHLY frequency',
        'recurrenceRule.dayOfMonth'
      )
    }
  }
}
