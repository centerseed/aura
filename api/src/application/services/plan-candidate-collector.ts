/**
 * PlanCandidateCollector - 候選任務篩選與 SubTask 展開
 *
 * 篩選邏輯：
 * 1. 逾期任務 (due_date < today)
 * 2. 今日到期 (due_date = today)
 * 3. 即將到期 (due_date <= today + 3 days)
 * 4. 活躍任務 (ACTIVE, 無 due_date 但最近有更新)
 * 5. 已開始任務 (start_date <= today)
 *
 * 展開邏輯：
 * - Task 有未完成的 SubTask → 取出各 SubTask 作為排程單位
 * - Task 沒有 SubTask → Task 本身作為排程單位
 */

import { prisma } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { getStartOfDay, getEndOfDay } from '@/lib/timezone-utils'

// ============================================================================
// Types
// ============================================================================

export interface PlanCandidate {
  itemType: 'task' | 'subtask'
  taskId: string
  subTaskId: string | null
  content: string
  areaName: string
  productName: string
  productDescription: string | null
  taskContent: string
  subTaskOrder: number | null
  estimatedMinutes: number | null
  dueDate: Date | null
  startDate: Date | null
  daysOverdue: number | null
  daysRemaining: number | null
  daysStagnant: number
  milestoneId: string | null
}

export interface ProductContext {
  productId: string
  productName: string
  productDescription: string | null
  areaName: string
  taskSummaries: Array<{
    id: string
    content: string
    status: string
    dueDate: string | null
  }>
}

export interface CollectedData {
  candidates: PlanCandidate[]
  productContexts: ProductContext[]
  meetingMinutes: number
  availableMinutes: number
}

// ============================================================================
// Raw Types
// ============================================================================

interface RawCandidateTask {
  id: string
  content: string
  status: string
  due_date: Date | null
  start_date: Date | null
  updated_at: Date
  area_name: string
  product_id: string
  product_name: string
  product_description: string | null
  inferred_from_milestone: string | null
}

interface RawSubTask {
  id: string
  task_id: string
  content: string
  completed: boolean
  due_date: Date | null
  start_date: Date | null
  estimated_minutes: number | null
  order: number
}

// ============================================================================
// Collector
// ============================================================================

const WORK_HOURS_PER_DAY = 8


export class PlanCandidateCollector {
  async collect(userId: string, date: Date, timezone: string): Promise<CollectedData> {
    const todayStart = getStartOfDay(date, timezone)
    const todayEnd = getEndOfDay(date, timezone)
    const threeDaysLater = new Date(todayEnd.getTime() + 3 * 24 * 60 * 60 * 1000)

    const [candidateTasks, calendarEvents] = await Promise.all([
      this.queryCandidateTasks(userId, todayStart, threeDaysLater),
      this.queryMeetingMinutes(userId, todayStart, todayEnd),
    ])

    // Fetch subtasks for all candidate tasks
    const taskIds = candidateTasks.map(t => t.id)
    const subTasks = taskIds.length > 0
      ? await this.querySubTasks(taskIds)
      : []

    // Group subtasks by task_id
    const subTasksByTask = new Map<string, RawSubTask[]>()
    for (const st of subTasks) {
      const arr = subTasksByTask.get(st.task_id) || []
      arr.push(st)
      subTasksByTask.set(st.task_id, arr)
    }

    // Expand into candidates
    const now = new Date()
    const candidates: PlanCandidate[] = []

    for (const task of candidateTasks) {
      const taskSubTasks = subTasksByTask.get(task.id) || []
      const uncompletedSubTasks = taskSubTasks.filter(st => !st.completed)

      if (uncompletedSubTasks.length > 0) {
        // Expand subtasks as candidates
        for (const st of uncompletedSubTasks) {
          candidates.push({
            itemType: 'subtask',
            taskId: task.id,
            subTaskId: st.id,
            content: st.content,
            taskContent: task.content,
            subTaskOrder: st.order,
            areaName: task.area_name,
            productName: task.product_name,
            productDescription: task.product_description,
            estimatedMinutes: st.estimated_minutes,
            dueDate: st.due_date ?? task.due_date,
            startDate: st.start_date ?? task.start_date,
            ...this.calcDays(st.due_date ?? task.due_date, task.updated_at, now),
            milestoneId: task.inferred_from_milestone,
          })
        }
      } else {
        // Task itself as candidate
        candidates.push({
          itemType: 'task',
          taskId: task.id,
          subTaskId: null,
          content: task.content,
          taskContent: task.content,
          subTaskOrder: null,
          areaName: task.area_name,
          productName: task.product_name,
          productDescription: task.product_description,
          estimatedMinutes: null,
          dueDate: task.due_date,
          startDate: task.start_date,
          ...this.calcDays(task.due_date, task.updated_at, now),
          milestoneId: task.inferred_from_milestone,
        })
      }
    }

    // Build product contexts
    const productContexts = this.buildProductContexts(candidateTasks)

    // Calculate capacity
    const meetingMinutes = calendarEvents
    const availableMinutes = WORK_HOURS_PER_DAY * 60 - meetingMinutes

    return {
      candidates,
      productContexts,
      meetingMinutes,
      availableMinutes,
    }
  }

  // ============================================================================
  // Queries
  // ============================================================================

  private async queryCandidateTasks(
    userId: string,
    todayStart: Date,
    threeDaysLater: Date,
  ): Promise<RawCandidateTask[]> {
    return prisma.$queryRaw<RawCandidateTask[]>`
      SELECT
        t.id::text,
        t.content,
        t.status::text,
        t.due_date,
        t.start_date,
        t.updated_at,
        t.inferred_from_milestone::text,
        a.name as area_name,
        p.id::text as product_id,
        p.name as product_name,
        p.description as product_description
      FROM tasks t
      JOIN products p ON p.id = t.product_id
      JOIN areas a ON a.id = p.area_id
      WHERE t.user_id = ${userId}::uuid
        AND t.deleted_at IS NULL
        AND t.status IN ('ACTIVE', 'INBOX')
        AND (
          t.due_date IS NOT NULL AND t.due_date < ${threeDaysLater}
          OR t.start_date IS NOT NULL AND t.start_date <= ${todayStart}
          OR t.status = 'ACTIVE' AND t.updated_at >= ${new Date(todayStart.getTime() - 14 * 24 * 60 * 60 * 1000)}
        )
      ORDER BY
        CASE WHEN t.due_date IS NOT NULL AND t.due_date < ${todayStart} THEN 0 ELSE 1 END,
        t.due_date ASC NULLS LAST,
        t.updated_at DESC
    `
  }

  private async querySubTasks(taskIds: string[]): Promise<RawSubTask[]> {
    return prisma.$queryRaw<RawSubTask[]>`
      SELECT
        st.id::text,
        st.task_id::text,
        st.content,
        st.completed,
        st.due_date,
        st.start_date,
        st.estimated_minutes,
        st.order
      FROM sub_tasks st
      WHERE st.task_id = ANY(${taskIds}::uuid[])
        AND st.deleted_at IS NULL
      ORDER BY st.order ASC
    `
  }

  private async queryMeetingMinutes(
    userId: string,
    todayStart: Date,
    todayEnd: Date,
  ): Promise<number> {
    const result = await prisma.$queryRaw<[{ total_minutes: number }]>`
      SELECT COALESCE(
        SUM(EXTRACT(EPOCH FROM (ce.end_date_time - ce.start_date_time)) / 60),
        0
      )::int as total_minutes
      FROM calendar_events ce
      WHERE ce.user_id = ${userId}::uuid
        AND ce.deleted_at IS NULL
        AND ce.start_date_time >= ${todayStart}
        AND ce.start_date_time < ${todayEnd}
    `
    return result[0]?.total_minutes ?? 0
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  private calcDays(
    dueDate: Date | null,
    updatedAt: Date,
    now: Date,
  ): { daysOverdue: number | null; daysRemaining: number | null; daysStagnant: number } {
    let daysOverdue: number | null = null
    let daysRemaining: number | null = null

    if (dueDate) {
      const diffDays = Math.floor((now.getTime() - new Date(dueDate).getTime()) / (1000 * 60 * 60 * 24))
      if (diffDays > 0) {
        daysOverdue = diffDays
      } else {
        daysRemaining = Math.abs(diffDays)
      }
    }

    const daysStagnant = Math.floor((now.getTime() - new Date(updatedAt).getTime()) / (1000 * 60 * 60 * 24))

    return { daysOverdue, daysRemaining, daysStagnant }
  }

  private buildProductContexts(tasks: RawCandidateTask[]): ProductContext[] {
    const byProduct = new Map<string, ProductContext>()

    for (const task of tasks) {
      let ctx = byProduct.get(task.product_id)
      if (!ctx) {
        ctx = {
          productId: task.product_id,
          productName: task.product_name,
          productDescription: task.product_description,
          areaName: task.area_name,
          taskSummaries: [],
        }
        byProduct.set(task.product_id, ctx)
      }
      ctx.taskSummaries.push({
        id: task.id,
        content: task.content,
        status: task.status,
        dueDate: task.due_date ? task.due_date.toISOString().substring(0, 10) : null,
      })
    }

    return Array.from(byProduct.values())
  }

}
