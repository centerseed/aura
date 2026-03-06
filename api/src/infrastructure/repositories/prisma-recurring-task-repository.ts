import { prisma } from '@/lib/db'
import { NotFoundException } from '@/lib/api-response'
import type {
  IRecurringTaskRepository,
  RecurringTaskData,
  RecurringTaskCreateData,
  RecurringTaskUpdateData,
  RecurrenceRule,
  RecurringTaskStatus,
} from '@/domain/interfaces/recurring-task-repository'

type PrismaRecurringTask = {
  id: string
  created_at: Date
  updated_at: Date
  deleted_at: Date | null
  user_id: string
  product_id: string | null
  topic_id: string | null
  title: string
  status: string
  recurrence_rule: unknown
  lead_days: number
  next_occurrence_at: Date | null
  estimated_duration_hours: number | null
}

export class PrismaRecurringTaskRepository implements IRecurringTaskRepository {
  async create(data: RecurringTaskCreateData): Promise<RecurringTaskData> {
    const record = await prisma.recurringTask.create({
      data: {
        user_id: data.userId,
        product_id: data.productId,
        topic_id: data.topicId,
        title: data.title,
        status: data.status as any,
        recurrence_rule: data.recurrenceRule as any,
        lead_days: data.leadDays,
        next_occurrence_at: data.nextOccurrenceAt,
        estimated_duration_hours: data.estimatedDurationHours,
      },
    })
    return this.toDomain(record as PrismaRecurringTask)
  }

  async findById(id: string, userId: string): Promise<RecurringTaskData | null> {
    const record = await prisma.recurringTask.findFirst({
      where: { id, user_id: userId, deleted_at: null },
    })
    if (!record) return null
    return this.toDomain(record as PrismaRecurringTask)
  }

  async findByUserId(userId: string): Promise<RecurringTaskData[]> {
    const records = await prisma.recurringTask.findMany({
      where: { user_id: userId, deleted_at: null },
      orderBy: { created_at: 'desc' },
    })
    return records.map((r) => this.toDomain(r as PrismaRecurringTask))
  }

  async findPendingForUser(userId: string, beforeDate: Date): Promise<RecurringTaskData[]> {
    const records = await prisma.recurringTask.findMany({
      where: {
        user_id: userId,
        status: 'ACTIVE' as any,
        deleted_at: null,
        OR: [
          { next_occurrence_at: null },
          { next_occurrence_at: { lte: beforeDate } },
        ],
      },
    })
    return records.map((r) => this.toDomain(r as PrismaRecurringTask))
  }

  async update(
    id: string,
    userId: string,
    data: RecurringTaskUpdateData
  ): Promise<RecurringTaskData> {
    // Use updateMany with ownership filter to avoid a pre-flight SELECT
    const { count } = await prisma.recurringTask.updateMany({
      where: { id, user_id: userId, deleted_at: null },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.status !== undefined && { status: data.status as any }),
        ...(data.recurrenceRule !== undefined && { recurrence_rule: data.recurrenceRule as any }),
        ...(data.leadDays !== undefined && { lead_days: data.leadDays }),
        ...(data.nextOccurrenceAt !== undefined && { next_occurrence_at: data.nextOccurrenceAt }),
        ...(data.productId !== undefined && { product_id: data.productId }),
        ...(data.topicId !== undefined && { topic_id: data.topicId }),
        ...(data.estimatedDurationHours !== undefined && {
          estimated_duration_hours: data.estimatedDurationHours,
        }),
      },
    })
    if (count === 0) throw new NotFoundException('RecurringTask')

    const record = await prisma.recurringTask.findFirst({ where: { id } })
    return this.toDomain(record as PrismaRecurringTask)
  }

  async softDelete(id: string, userId: string): Promise<void> {
    const { count } = await prisma.recurringTask.updateMany({
      where: { id, user_id: userId, deleted_at: null },
      data: { deleted_at: new Date(), status: 'ARCHIVED' as any },
    })
    if (count === 0) throw new NotFoundException('RecurringTask')
  }

  private toDomain(record: PrismaRecurringTask): RecurringTaskData {
    return {
      id: record.id,
      userId: record.user_id,
      productId: record.product_id,
      topicId: record.topic_id,
      title: record.title,
      status: record.status as RecurringTaskStatus,
      recurrenceRule: record.recurrence_rule as RecurrenceRule,
      leadDays: record.lead_days,
      nextOccurrenceAt: record.next_occurrence_at,
      estimatedDurationHours: record.estimated_duration_hours,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
    }
  }
}
