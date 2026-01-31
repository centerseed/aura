/**
 * PrismaTaskRepository - Prisma 任務儲存庫實作
 *
 * Infrastructure Layer 實作 Domain Layer 的 ITaskRepository 介面
 * 負責 Prisma Model ↔ Domain Entity 的轉換
 */

import { prisma } from '@/lib/db'
import { Status as PrismaStatus } from '@prisma/client'
import type {
  ITaskRepository,
  TaskData,
  TaskFilters,
  TaskUpdateData,
} from '@/domain/interfaces/task-repository'
import { TaskStatus } from '@/domain/value-objects/task-status'
import { NotFoundException } from '@/lib/api-response'

export class PrismaTaskRepository implements ITaskRepository {
  // ============================================================================
  // Query Methods
  // ============================================================================

  async findMany(filters: TaskFilters): Promise<TaskData[]> {
    const whereClause = this.buildWhereClause(filters)

    const tasks = await prisma.task.findMany({
      where: whereClause,
      include: {
        product: {
          include: {
            area: true,
          },
        },
        topic: true,
      },
      orderBy: {
        updated_at: 'desc',
      },
    })

    return tasks.map((task) => this.toDomain(task))
  }

  async findById(id: string, userId: string): Promise<TaskData | null> {
    const task = await prisma.task.findFirst({
      where: {
        id,
        user_id: userId,
        deleted_at: null,
      },
      include: {
        product: {
          include: {
            area: true,
          },
        },
        topic: true,
      },
    })

    return task ? this.toDomain(task) : null
  }

  async findByIds(ids: string[], userId: string): Promise<TaskData[]> {
    const tasks = await prisma.task.findMany({
      where: {
        id: { in: ids },
        user_id: userId,
        deleted_at: null,
      },
      include: {
        product: {
          include: {
            area: true,
          },
        },
        topic: true,
      },
    })

    return tasks.map((task) => this.toDomain(task))
  }

  // ============================================================================
  // Mutation Methods
  // ============================================================================

  async create(
    data: Omit<TaskData, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<TaskData> {
    const task = await prisma.task.create({
      data: {
        user_id: data.userId,
        product_id: data.productId,
        topic_id: data.topicId,
        content: data.content,
        status: this.toPrismaStatus(data.status),
        ai_analysis: this.serializeAIAnalysis(data.aiAnalysis) as any,
        references: data.references || [] as any,
        sub_items: data.subItems || [],
        start_date: data.startDate,
        due_date: data.dueDate,
        time_confidence: data.timeConfidence,
        inferred_from_milestone: data.inferredFromMilestone,
      },
      include: {
        product: {
          include: {
            area: true,
          },
        },
        topic: true,
      },
    })

    return this.toDomain(task)
  }

  async update(
    id: string,
    userId: string,
    data: TaskUpdateData
  ): Promise<TaskData> {
    // 先檢查任務是否存在
    const exists = await this.exists(id, userId)
    if (!exists) {
      throw new NotFoundException('Task')
    }

    // 如果需要更新 narrative，先取得現有的 ai_analysis
    let aiAnalysisUpdate: unknown = undefined
    if (data.narrative !== undefined) {
      const existingTask = await prisma.task.findUnique({
        where: { id },
        select: { ai_analysis: true },
      })
      const currentAnalysis = (existingTask?.ai_analysis as Record<
        string,
        unknown
      >) || {}
      aiAnalysisUpdate = {
        ...currentAnalysis,
        narrative: data.narrative || null,
      }
    }

    const task = await prisma.task.update({
      where: { id },
      data: {
        ...(data.status && { status: this.toPrismaStatus(data.status) }),
        ...(data.productId && { product_id: data.productId }),
        ...(data.topicId !== undefined && { topic_id: data.topicId }),
        ...(data.content && { content: data.content.trim() }),
        ...(aiAnalysisUpdate && { ai_analysis: aiAnalysisUpdate }),
        ...(data.startDate !== undefined && { start_date: data.startDate }),
        ...(data.dueDate !== undefined && { due_date: data.dueDate }),
        ...(data.timeConfidence !== undefined && {
          time_confidence: data.timeConfidence,
        }),
        ...(data.inferredFromMilestone !== undefined && {
          inferred_from_milestone: data.inferredFromMilestone,
        }),
      } as any,
      include: {
        product: {
          include: {
            area: true,
          },
        },
        topic: true,
      },
    })

    return this.toDomain(task)
  }

  async softDelete(id: string, userId: string): Promise<void> {
    await prisma.task.update({
      where: {
        id,
        user_id: userId,
      },
      data: {
        deleted_at: new Date(),
      },
    })
  }

  async hardDelete(id: string, userId: string): Promise<void> {
    await prisma.task.delete({
      where: {
        id,
        user_id: userId,
      },
    })
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  async count(filters: Omit<TaskFilters, 'includeDeleted'>): Promise<number> {
    const whereClause = this.buildWhereClause({
      ...filters,
      includeDeleted: false,
    })

    return prisma.task.count({
      where: whereClause,
    })
  }

  async exists(id: string, userId: string): Promise<boolean> {
    const count = await prisma.task.count({
      where: {
        id,
        user_id: userId,
        deleted_at: null,
      },
    })

    return count > 0
  }

  async batchUpdateStatus(
    taskIds: string[],
    userId: string,
    status: TaskStatus
  ): Promise<void> {
    await prisma.task.updateMany({
      where: {
        id: { in: taskIds },
        user_id: userId,
        deleted_at: null,
      },
      data: {
        status: this.toPrismaStatus(status),
        updated_at: new Date(),
      },
    })
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * 建立 Prisma WHERE 條件
   */
  private buildWhereClause(filters: TaskFilters) {
    const where: any = {
      user_id: filters.userId,
      deleted_at: filters.includeDeleted ? undefined : null,
    }

    if (filters.status) {
      where.status = this.toPrismaStatus(filters.status)
    }

    if (filters.productId) {
      where.product_id = filters.productId
    }

    if (filters.topicId) {
      where.topic_id = filters.topicId
    }

    // 今日完成篩選
    if (filters.completedToday) {
      const now = new Date()
      const todayStart = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
      )
      const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000)

      where.status = PrismaStatus.ARCHIVE
      where.updated_at = {
        gte: todayStart,
        lt: todayEnd,
      }
    }

    // 日期範圍篩選
    if (filters.updatedAtFrom || filters.updatedAtTo) {
      where.updated_at = {}
      if (filters.updatedAtFrom) {
        where.updated_at.gte = filters.updatedAtFrom
      }
      if (filters.updatedAtTo) {
        where.updated_at.lt = filters.updatedAtTo
      }
    }

    if (filters.startDateFrom || filters.startDateTo) {
      where.start_date = {}
      if (filters.startDateFrom) {
        where.start_date.gte = filters.startDateFrom
      }
      if (filters.startDateTo) {
        where.start_date.lte = filters.startDateTo
      }
    }

    if (filters.dueDateFrom || filters.dueDateTo) {
      where.due_date = {}
      if (filters.dueDateFrom) {
        where.due_date.gte = filters.dueDateFrom
      }
      if (filters.dueDateTo) {
        where.due_date.lte = filters.dueDateTo
      }
    }

    return where
  }

  /**
   * Prisma Model → Domain Entity
   */
  private toDomain(prismaTask: any): TaskData {
    const analysis = (prismaTask.ai_analysis as Record<string, unknown>) || {}
    const subItems = (prismaTask.sub_items as Array<any>) || []
    const references = (prismaTask.references as Array<any>) || []

    return {
      id: prismaTask.id,
      userId: prismaTask.user_id,
      productId: prismaTask.product_id,
      topicId: prismaTask.topic_id,
      content: prismaTask.content,
      status: this.fromPrismaStatus(prismaTask.status),
      aiAnalysis: {
        narrative: (analysis.narrative as string) || undefined,
        lifecycle: (analysis.lifecycle as string) || undefined,
        strategyUsed: (analysis.strategy_used as string) || undefined,
        reasoning: (analysis.reasoning as string) || undefined,
        mergedItems: (analysis.merged_items as string[]) || undefined,
      },
      references: references.map((r) => ({
        id: r.id,
        type: r.type,
        content: r.content,
        title: r.title,
        createdAt: new Date(r.created_at),
      })),
      subItems: subItems.map((s) => ({
        id: s.id,
        content: s.content,
        completed: s.completed,
        createdAt: new Date(s.created_at),
        completedAt: s.completed_at ? new Date(s.completed_at) : null,
        order: s.order,
      })),
      startDate: prismaTask.start_date,
      dueDate: prismaTask.due_date,
      timeConfidence: prismaTask.time_confidence,
      inferredFromMilestone: prismaTask.inferred_from_milestone,
      createdAt: prismaTask.created_at,
      updatedAt: prismaTask.updated_at,
      // Relations
      product: prismaTask.product
        ? {
            id: prismaTask.product.id,
            name: prismaTask.product.name,
            areaId: prismaTask.product.area_id,
            area: {
              id: prismaTask.product.area.id,
              name: prismaTask.product.area.name,
            },
          }
        : undefined,
      topic: prismaTask.topic
        ? {
            id: prismaTask.topic.id,
            name: prismaTask.topic.name,
          }
        : undefined,
    }
  }

  /**
   * Domain Status → Prisma Status
   */
  private toPrismaStatus(status: TaskStatus): PrismaStatus {
    return PrismaStatus[status]
  }

  /**
   * Prisma Status → Domain Status
   */
  private fromPrismaStatus(status: PrismaStatus): TaskStatus {
    return status as unknown as TaskStatus
  }

  /**
   * 序列化 AI Analysis 為 JSON
   */
  private serializeAIAnalysis(
    analysis: TaskData['aiAnalysis']
  ): Record<string, unknown> | null {
    if (!analysis) return null

    return {
      narrative: analysis.narrative,
      lifecycle: analysis.lifecycle,
      strategy_used: analysis.strategyUsed,
      reasoning: analysis.reasoning,
      merged_items: analysis.mergedItems,
    }
  }
}
