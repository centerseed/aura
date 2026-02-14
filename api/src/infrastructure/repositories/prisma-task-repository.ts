/**
 * PrismaTaskRepository - Prisma 任務儲存庫實作
 *
 * Infrastructure Layer 實作 Domain Layer 的 ITaskRepository 介面
 * 負責 Prisma Model ↔ Domain Entity 的轉換
 *
 * 🚀 優化：使用 raw SQL JOIN 取代 nested include，減少 DB round-trips
 */

import { prisma } from '@/lib/db'
import { Prisma, Status as PrismaStatus } from '@prisma/client'
import type {
  ITaskRepository,
  TaskData,
  TaskFilters,
  TaskUpdateData,
} from '@/domain/interfaces/task-repository'
import { TaskStatus } from '@/domain/value-objects/task-status'
import { NotFoundException } from '@/lib/api-response'

// Raw SQL 查詢結果的型別
interface RawTaskRow {
  id: string
  user_id: string
  product_id: string
  topic_id: string | null
  content: string
  status: string
  ai_analysis: unknown
  references: unknown
  sub_items: unknown
  start_date: Date | null
  due_date: Date | null
  time_confidence: number | null
  inferred_from_milestone: string | null
  remind_at: Date | null
  reminder_enabled: boolean
  date_source: string | null
  reminder_timezone: string | null
  notification_id: number | null
  created_at: Date
  updated_at: Date
  // JOIN 結果
  product_name: string | null
  area_id: string | null
  area_name: string | null
  topic_name: string | null
}

export class PrismaTaskRepository implements ITaskRepository {
  // ============================================================================
  // Query Methods (使用 raw SQL JOIN 優化)
  // ============================================================================

  async findMany(filters: TaskFilters): Promise<TaskData[]> {
    const { conditions, params } = this.buildSqlConditions(filters)

    // 🚀 單一 SQL 查詢：tasks JOIN products JOIN areas JOIN topics
    const rawTasks = await prisma.$queryRaw<RawTaskRow[]>`
      SELECT
        t.id::text,
        t.user_id::text,
        t.product_id::text,
        t.topic_id::text,
        t.content,
        t.status::text,
        t.ai_analysis,
        t.references,
        t.sub_items,
        t.start_date,
        t.due_date,
        t.time_confidence,
        t.inferred_from_milestone,
        t.date_source,
        t.remind_at,
        t.reminder_enabled,
        t.reminder_timezone,
        t.notification_id,
        t.created_at,
        t.updated_at,
        p.name as product_name,
        p.area_id::text as area_id,
        a.name as area_name,
        top.name as topic_name
      FROM tasks t
      LEFT JOIN products p ON p.id = t.product_id
      LEFT JOIN areas a ON a.id = p.area_id
      LEFT JOIN topics top ON top.id = t.topic_id
      WHERE t.user_id = ${filters.userId}::uuid
        ${filters.includeDeleted ? Prisma.empty : Prisma.sql`AND t.deleted_at IS NULL`}
        ${filters.status ? Prisma.sql`AND t.status = ${filters.status}::text::"statusenum"` : Prisma.empty}
        ${filters.productId ? Prisma.sql`AND t.product_id = ${filters.productId}::uuid` : Prisma.empty}
        ${filters.topicId ? Prisma.sql`AND t.topic_id = ${filters.topicId}::uuid` : Prisma.empty}
        ${filters.content ? Prisma.sql`AND TRIM(t.content) = TRIM(${filters.content})` : Prisma.empty}
        ${filters.createdAtFrom ? Prisma.sql`AND t.created_at >= ${filters.createdAtFrom}` : Prisma.empty}
        ${this.buildDateConditionsSql(filters)}
      ORDER BY t.updated_at DESC
    `

    const tasks = rawTasks.map((row) => this.rawToDomain(row))
    return this.enrichWithSubTasks(tasks)
  }

  async findById(id: string, userId: string): Promise<TaskData | null> {
    // 🚀 單一 SQL 查詢
    const rawTasks = await prisma.$queryRaw<RawTaskRow[]>`
      SELECT
        t.id::text,
        t.user_id::text,
        t.product_id::text,
        t.topic_id::text,
        t.content,
        t.status::text,
        t.ai_analysis,
        t.references,
        t.sub_items,
        t.start_date,
        t.due_date,
        t.time_confidence,
        t.inferred_from_milestone,
        t.date_source,
        t.remind_at,
        t.reminder_enabled,
        t.reminder_timezone,
        t.notification_id,
        t.created_at,
        t.updated_at,
        p.name as product_name,
        p.area_id::text as area_id,
        a.name as area_name,
        top.name as topic_name
      FROM tasks t
      LEFT JOIN products p ON p.id = t.product_id
      LEFT JOIN areas a ON a.id = p.area_id
      LEFT JOIN topics top ON top.id = t.topic_id
      WHERE t.id = ${id}::uuid
        AND t.user_id = ${userId}::uuid
        AND t.deleted_at IS NULL
    `

    if (rawTasks.length === 0) return null
    const tasks = await this.enrichWithSubTasks([this.rawToDomain(rawTasks[0])])
    return tasks[0]
  }

  async findByIds(ids: string[], userId: string): Promise<TaskData[]> {
    if (ids.length === 0) return []

    // 🚀 單一 SQL 查詢
    const rawTasks = await prisma.$queryRaw<RawTaskRow[]>`
      SELECT
        t.id::text,
        t.user_id::text,
        t.product_id::text,
        t.topic_id::text,
        t.content,
        t.status::text,
        t.ai_analysis,
        t.references,
        t.sub_items,
        t.start_date,
        t.due_date,
        t.time_confidence,
        t.inferred_from_milestone,
        t.date_source,
        t.remind_at,
        t.reminder_enabled,
        t.reminder_timezone,
        t.notification_id,
        t.created_at,
        t.updated_at,
        p.name as product_name,
        p.area_id::text as area_id,
        a.name as area_name,
        top.name as topic_name
      FROM tasks t
      LEFT JOIN products p ON p.id = t.product_id
      LEFT JOIN areas a ON a.id = p.area_id
      LEFT JOIN topics top ON top.id = t.topic_id
      WHERE t.id = ANY(${ids}::uuid[])
        AND t.user_id = ${userId}::uuid
        AND t.deleted_at IS NULL
    `

    const tasks = rawTasks.map((row) => this.rawToDomain(row))
    return this.enrichWithSubTasks(tasks)
  }

  // ============================================================================
  // Mutation Methods (優化：mutation + 單一查詢返回)
  // ============================================================================

  async create(
    data: Omit<TaskData, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<TaskData> {
    // 🚀 Step 1: 執行 INSERT（不帶 include）
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
        remind_at: data.remindAt,
        reminder_enabled: data.reminderEnabled,
        reminder_timezone: data.reminderTimezone,
        notification_id: data.notificationId,
      },
    })

    // 🚀 Step 2: 用優化的查詢返回完整資料
    const result = await this.findById(task.id, data.userId)
    return result!
  }

  async update(
    id: string,
    userId: string,
    data: TaskUpdateData
  ): Promise<TaskData> {
    // 🚀 優化：合併 exists 檢查和 narrative 查詢為單一查詢
    const existingTask = await prisma.task.findFirst({
      where: { id, user_id: userId, deleted_at: null },
      select: { id: true, ai_analysis: true },
    })

    if (!existingTask) {
      throw new NotFoundException('Task')
    }

    // 如果需要更新 narrative，合併現有的 ai_analysis
    let aiAnalysisUpdate: unknown = undefined
    if (data.narrative !== undefined) {
      const currentAnalysis = (existingTask.ai_analysis as Record<
        string,
        unknown
      >) || {}
      aiAnalysisUpdate = {
        ...currentAnalysis,
        narrative: data.narrative || null,
      }
    }

    // 🚀 Step 1: 執行 UPDATE（不帶 include）
    await prisma.task.update({
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
        ...(data.remindAt !== undefined && { remind_at: data.remindAt }),
        ...(data.reminderEnabled !== undefined && {
          reminder_enabled: data.reminderEnabled,
        }),
        ...(data.reminderTimezone !== undefined && {
          reminder_timezone: data.reminderTimezone,
        }),
        ...(data.notificationId !== undefined && {
          notification_id: data.notificationId,
        }),
        ...(data.dateSource !== undefined && {
          date_source: data.dateSource,
        }),
      } as any,
    })

    // 🚀 Step 2: 用優化的查詢返回完整資料
    const result = await this.findById(id, userId)
    return result!
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
   * 🚀 Raw SQL 查詢結果 → Domain Entity
   */
  private rawToDomain(row: RawTaskRow): TaskData {
    const analysis = (row.ai_analysis as Record<string, unknown>) || {}
    const references = (row.references as Array<any>) || []

    return {
      id: row.id,
      userId: row.user_id,
      productId: row.product_id,
      topicId: row.topic_id,
      content: row.content,
      status: row.status as TaskStatus,
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
        createdAt: r.created_at ? new Date(r.created_at) : row.created_at,
      })),
      subItems: [], // populated by enrichWithSubTasks() from sub_tasks table
      startDate: row.start_date,
      dueDate: row.due_date,
      timeConfidence: row.time_confidence,
      inferredFromMilestone: row.inferred_from_milestone,
      dateSource: row.date_source,
      remindAt: row.remind_at,
      reminderEnabled: row.reminder_enabled || false,
      reminderTimezone: row.reminder_timezone,
      notificationId: row.notification_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      // Relations (from JOIN)
      product: row.product_name
        ? {
            id: row.product_id,
            name: row.product_name,
            areaId: row.area_id!,
            area: row.area_name
              ? {
                  id: row.area_id!,
                  name: row.area_name,
                }
              : undefined,
          }
        : undefined,
      topic: row.topic_name
        ? {
            id: row.topic_id!,
            name: row.topic_name,
          }
        : undefined,
    }
  }

  /**
   * 批次查詢 sub_tasks 表，替換每個 task 的 subItems
   */
  private async enrichWithSubTasks(tasks: TaskData[]): Promise<TaskData[]> {
    if (tasks.length === 0) return tasks

    const taskIds = tasks.map((t) => t.id)
    const subTasks = await prisma.subTask.findMany({
      where: { task_id: { in: taskIds }, deleted_at: null },
      orderBy: { order: 'asc' },
    })

    const grouped = new Map<string, typeof subTasks>()
    for (const st of subTasks) {
      const list = grouped.get(st.task_id) || []
      list.push(st)
      grouped.set(st.task_id, list)
    }

    for (const task of tasks) {
      const items = grouped.get(task.id) || []
      task.subItems = items.map((s) => ({
        id: s.id,
        content: s.content,
        completed: s.completed,
        createdAt: s.created_at,
        completedAt: s.completed_at,
        order: s.order,
        startDate: s.start_date,
        dueDate: s.due_date,
      }))
    }

    return tasks
  }

  /**
   * 🚀 建立日期相關的 SQL 條件
   */
  private buildDateConditionsSql(filters: TaskFilters): Prisma.Sql {
    const conditions: Prisma.Sql[] = []

    // 今日完成篩選
    if (filters.completedToday) {
      const now = new Date()
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000)
      const archiveStatus = 'ARCHIVE'

      conditions.push(Prisma.sql`AND t.status = ${archiveStatus}::text::"statusenum"`)
      conditions.push(Prisma.sql`AND t.updated_at >= ${todayStart}`)
      conditions.push(Prisma.sql`AND t.updated_at < ${todayEnd}`)
    }

    // 更新時間範圍
    if (filters.updatedAtFrom) {
      conditions.push(Prisma.sql`AND t.updated_at >= ${filters.updatedAtFrom}`)
    }
    if (filters.updatedAtTo) {
      conditions.push(Prisma.sql`AND t.updated_at < ${filters.updatedAtTo}`)
    }

    // 開始日期範圍
    if (filters.startDateFrom) {
      conditions.push(Prisma.sql`AND t.start_date >= ${filters.startDateFrom}`)
    }
    if (filters.startDateTo) {
      conditions.push(Prisma.sql`AND t.start_date <= ${filters.startDateTo}`)
    }

    // 截止日期範圍
    if (filters.dueDateFrom) {
      conditions.push(Prisma.sql`AND t.due_date >= ${filters.dueDateFrom}`)
    }
    if (filters.dueDateTo) {
      conditions.push(Prisma.sql`AND t.due_date <= ${filters.dueDateTo}`)
    }

    return conditions.length > 0 ? Prisma.join(conditions, ' ') : Prisma.empty
  }

  /**
   * 🚀 建立 SQL 條件（備用，用於更複雜的查詢）
   */
  private buildSqlConditions(filters: TaskFilters): { conditions: Prisma.Sql; params: any[] } {
    // 主要條件已內聯到查詢中，此方法用於擴展
    return { conditions: Prisma.empty, params: [] }
  }

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
        createdAt: r.created_at ? new Date(r.created_at) : prismaTask.created_at,
      })),
      subItems: [], // populated by enrichWithSubTasks() from sub_tasks table
      startDate: prismaTask.start_date,
      dueDate: prismaTask.due_date,
      timeConfidence: prismaTask.time_confidence,
      inferredFromMilestone: prismaTask.inferred_from_milestone,
      dateSource: prismaTask.date_source ?? null,
      remindAt: prismaTask.remind_at,
      reminderEnabled: prismaTask.reminder_enabled || false,
      reminderTimezone: prismaTask.reminder_timezone,
      notificationId: prismaTask.notification_id,
      createdAt: prismaTask.created_at,
      updatedAt: prismaTask.updated_at,
      // Relations
      product: prismaTask.product
        ? {
            id: prismaTask.product.id,
            name: prismaTask.product.name,
            areaId: prismaTask.product.area_id,
            area: prismaTask.product.area
              ? {
                  id: prismaTask.product.area.id,
                  name: prismaTask.product.area.name,
                }
              : undefined,
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
