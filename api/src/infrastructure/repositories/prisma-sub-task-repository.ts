/**
 * PrismaSubTaskRepository - Prisma 子任務儲存庫實作
 *
 * Infrastructure Layer 實作 Domain Layer 的 ISubTaskRepository 介面
 */

import { prisma } from '@/lib/db'
import type { SubTaskData, SubTaskSource } from '@/domain/entities/sub-task.entity'
import type {
  ISubTaskRepository,
  CreateSubTaskInput,
  UpdateSubTaskInput,
} from '@/domain/interfaces/sub-task-repository'

function toDomain(row: any): SubTaskData {
  return {
    id: row.id,
    taskId: row.task_id,
    userId: row.user_id,
    content: row.content,
    completed: row.completed,
    completedAt: row.completed_at ? new Date(row.completed_at) : null,
    order: row.order,
    startDate: row.start_date ? new Date(row.start_date) : null,
    dueDate: row.due_date ? new Date(row.due_date) : null,
    estimatedMinutes: row.estimated_minutes,
    source: (row.source || 'user') as SubTaskSource,
    originalTaskId: row.original_task_id,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  }
}

export class PrismaSubTaskRepository implements ISubTaskRepository {
  async findById(id: string): Promise<SubTaskData | null> {
    const row = await prisma.subTask.findFirst({
      where: { id, deleted_at: null },
    })
    return row ? toDomain(row) : null
  }

  async findByTaskId(taskId: string): Promise<SubTaskData[]> {
    const rows = await prisma.subTask.findMany({
      where: { task_id: taskId, deleted_at: null },
      orderBy: { order: 'asc' },
    })
    return rows.map(toDomain)
  }

  async findByUserAndDueDate(
    userId: string,
    dateStart: Date,
    dateEnd: Date
  ): Promise<SubTaskData[]> {
    const rows = await prisma.subTask.findMany({
      where: {
        user_id: userId,
        deleted_at: null,
        completed: false,
        due_date: { gte: dateStart, lt: dateEnd },
      },
      orderBy: [{ due_date: 'asc' }, { order: 'asc' }],
    })
    return rows.map(toDomain)
  }

  async create(input: CreateSubTaskInput): Promise<SubTaskData> {
    const row = await prisma.subTask.create({
      data: {
        ...(input.id ? { id: input.id } : {}),
        task_id: input.taskId,
        user_id: input.userId,
        content: input.content,
        completed: input.completed ?? false,
        completed_at: input.completedAt ?? null,
        order: input.order ?? 0,
        start_date: input.startDate ?? null,
        due_date: input.dueDate ?? null,
        estimated_minutes: input.estimatedMinutes ?? null,
        source: input.source ?? 'user',
        original_task_id: input.originalTaskId ?? null,
      },
    })
    return toDomain(row)
  }

  async createMany(inputs: CreateSubTaskInput[]): Promise<SubTaskData[]> {
    const results: SubTaskData[] = []
    for (const input of inputs) {
      results.push(await this.create(input))
    }
    return results
  }

  async update(id: string, input: UpdateSubTaskInput): Promise<SubTaskData> {
    const data: any = {}
    if (input.content !== undefined) data.content = input.content
    if (input.completed !== undefined) {
      data.completed = input.completed
      data.completed_at = input.completed ? new Date() : null
    }
    if (input.completedAt !== undefined) data.completed_at = input.completedAt
    if (input.order !== undefined) data.order = input.order
    if (input.startDate !== undefined) data.start_date = input.startDate
    if (input.dueDate !== undefined) data.due_date = input.dueDate
    if (input.estimatedMinutes !== undefined) data.estimated_minutes = input.estimatedMinutes

    const row = await prisma.subTask.update({
      where: { id },
      data,
    })
    return toDomain(row)
  }

  async softDelete(id: string): Promise<void> {
    await prisma.subTask.update({
      where: { id },
      data: { deleted_at: new Date() },
    })
  }

  async updateTaskId(id: string, newTaskId: string, newOrder: number): Promise<SubTaskData> {
    const row = await prisma.subTask.update({
      where: { id },
      data: { task_id: newTaskId, order: newOrder },
    })
    return toDomain(row)
  }

  async reorder(taskId: string, orderedIds: string[]): Promise<void> {
    await prisma.$transaction(
      orderedIds.map((id, index) =>
        prisma.subTask.update({
          where: { id },
          data: { order: index },
        })
      )
    )
  }
}
