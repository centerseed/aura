import { prisma } from '@/lib/db'
import type { IRecurringTaskRepository, RecurrenceRule } from '@/domain/interfaces/recurring-task-repository'
import type { ITaskRepository } from '@/domain/interfaces/task-repository'
import { PrismaRecurringTaskRepository } from '@/infrastructure/repositories/prisma-recurring-task-repository'
import { PrismaTaskRepository } from '@/infrastructure/repositories/prisma-task-repository'
import { TaskStatus } from '@/domain/value-objects/task-status'
import { computeNextOccurrenceAfter } from './recurrence-utils'

export interface GenerateRequest {
  userId: string
  localDate: string  // 'YYYY-MM-DD'，客戶端當地日期
}

export interface GenerateResult {
  generated: number
  skipped: number
  details: Array<{ recurringTaskId: string; title: string; dueDate: string; taskId?: string }>
}

export class GenerateRecurringTaskInstancesUseCase {
  constructor(
    private readonly recurringRepo: IRecurringTaskRepository = new PrismaRecurringTaskRepository(),
    private readonly taskRepo: ITaskRepository = new PrismaTaskRepository()
  ) {}

  async execute(req: GenerateRequest): Promise<GenerateResult> {
    const [year, month, day] = req.localDate.split('-').map(Number)
    const today = new Date(Date.UTC(year, month - 1, day))

    const result: GenerateResult = { generated: 0, skipped: 0, details: [] }

    const lookAhead = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000)
    const pendingTemplates = await this.recurringRepo.findPendingForUser(req.userId, lookAhead)

    if (pendingTemplates.length === 0) return result

    // 快取：避免 N 個 template 各自查一次預設 product
    let defaultProductId: string | undefined

    for (const template of pendingTemplates) {
      const occurrence = template.nextOccurrenceAt
      if (!occurrence) continue

      const occurrenceUTC = new Date(
        Date.UTC(occurrence.getUTCFullYear(), occurrence.getUTCMonth(), occurrence.getUTCDate())
      )

      // 只建立 due_date >= today - 1（避免積壓過多舊任務）
      const cutoff = new Date(today.getTime() - 24 * 60 * 60 * 1000)
      if (occurrenceUTC < cutoff) {
        result.skipped++
        result.details.push({
          recurringTaskId: template.id,
          title: template.title,
          dueDate: occurrenceUTC.toISOString().substring(0, 10),
        })
        await this.advanceNextOccurrence(template.id, req.userId, occurrenceUTC, template.recurrenceRule)
        continue
      }

      // 生成條件：occurrence <= today + lead_days
      const generateThreshold = new Date(
        today.getTime() + template.leadDays * 24 * 60 * 60 * 1000
      )
      if (occurrenceUTC > generateThreshold) {
        continue
      }

      // 防重複：檢查同 recurring_task_id + due_date 是否已存在
      const dueDateStart = occurrenceUTC
      const dueDateEnd = new Date(occurrenceUTC.getTime() + 24 * 60 * 60 * 1000)
      const existing = await prisma.task.findFirst({
        where: {
          recurring_task_id: template.id,
          due_date: { gte: dueDateStart, lt: dueDateEnd },
          deleted_at: null,
        },
        select: { id: true },
      })

      if (existing) {
        result.skipped++
        result.details.push({
          recurringTaskId: template.id,
          title: template.title,
          dueDate: occurrenceUTC.toISOString().substring(0, 10),
          taskId: existing.id,
        })
      } else {
        const productId = await this.resolveProductId(
          template.userId,
          template.productId,
          () => defaultProductId,
          (id) => { defaultProductId = id }
        )

        const task = await this.taskRepo.create({
          userId: template.userId,
          productId,
          topicId: template.topicId,
          content: template.title,
          status: TaskStatus.INBOX,
          aiAnalysis: null,
          references: [],
          subItems: [],
          startDate: null,
          dueDate: occurrenceUTC,
          timeConfidence: null,
          inferredFromMilestone: null,
          remindAt: null,
          reminderEnabled: false,
          reminderTimezone: null,
          notificationId: null,
          dateSource: 'recurring',
          estimatedDurationHours: template.estimatedDurationHours,
          actualDurationHours: null,
          recurringTaskId: template.id,
        })

        result.generated++
        result.details.push({
          recurringTaskId: template.id,
          title: template.title,
          dueDate: occurrenceUTC.toISOString().substring(0, 10),
          taskId: task.id,
        })
      }

      await this.advanceNextOccurrence(template.id, req.userId, occurrenceUTC, template.recurrenceRule)
    }

    return result
  }

  private async advanceNextOccurrence(
    id: string,
    userId: string,
    currentOccurrence: Date,
    rule: RecurrenceRule
  ): Promise<void> {
    const next = computeNextOccurrenceAfter(rule, currentOccurrence)
    await this.recurringRepo.update(id, userId, { nextOccurrenceAt: next })
  }

  private async resolveProductId(
    userId: string,
    productId: string | null,
    getCache: () => string | undefined,
    setCache: (id: string) => void
  ): Promise<string> {
    if (productId) return productId
    const cached = getCache()
    if (cached) return cached
    const product = await prisma.product.findFirst({
      where: { user_id: userId, deleted_at: null },
      orderBy: { created_at: 'asc' },
      select: { id: true },
    })
    if (!product) throw new Error('No product found for user')
    setCache(product.id)
    return product.id
  }
}
