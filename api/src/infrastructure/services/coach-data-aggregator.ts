/**
 * CoachDataAggregator - 教練資料聚合服務
 *
 * Infrastructure Layer 服務，負責從資料庫聚合 Coach Briefing 所需的所有資料
 * 7 個 SQL 查詢全部透過 Promise.all() 並行執行
 */

import { prisma } from '@/lib/db'
import { Prisma } from '@prisma/client'
import type { CalendarEventSummary, TaskSummary } from '@/domain/entities/coach-briefing.entity'

// ============================================================================
// Raw SQL 結果型別
// ============================================================================

interface RawCalendarEvent {
  id: string
  summary: string
  start_date_time: Date
  end_date_time: Date
  meet_link: string | null
  event_link: string
  attendees: string[]
  task_id: string | null
}

interface RawTaskRow {
  id: string
  content: string
  status: string
  due_date: Date | null
  updated_at: Date
  area_name: string
  product_name: string
  urgency_level: string | null
}

interface RawStagnantProduct {
  id: string
  name: string
  area_name: string
  last_task_updated_at: Date
}

// ============================================================================
// 聚合結果
// ============================================================================

export interface AggregatedData {
  calendarEvents: CalendarEventSummary[]
  overdueTasks: TaskSummary[]
  approachingTasks: TaskSummary[]
  completedTasks: TaskSummary[]
  remainingTasks: TaskSummary[]
  stagnantProducts: Array<{
    id: string
    name: string
    area_name: string
    last_task_updated_at: string
  }>
  tomorrowPreview: CalendarEventSummary[]
}

// ============================================================================
// Data Aggregator
// ============================================================================

export class CoachDataAggregator {
  /**
   * 聚合所有 Coach Briefing 需要的資料
   * 7 個查詢並行執行
   */
  async aggregate(userId: string, date: Date, timezone: string): Promise<AggregatedData> {
    // 計算日期範圍（根據時區）
    const todayStart = this.getStartOfDay(date, timezone)
    const todayEnd = this.getEndOfDay(date, timezone)
    const tomorrowStart = new Date(todayEnd.getTime())
    const tomorrowEnd = new Date(tomorrowStart.getTime() + 24 * 60 * 60 * 1000)
    const threeDaysLater = new Date(todayEnd.getTime() + 3 * 24 * 60 * 60 * 1000)
    const sevenDaysAgo = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000)

    const [
      calendarEvents,
      overdueTasks,
      approachingTasks,
      completedTasks,
      remainingTasks,
      stagnantProducts,
      tomorrowPreview,
    ] = await Promise.all([
      // 1. 今日行事曆
      this.queryTodayCalendarEvents(userId, todayStart, todayEnd),
      // 2. 逾期任務
      this.queryOverdueTasks(userId, todayStart),
      // 3. 即將到期（3天內）
      this.queryApproachingTasks(userId, todayStart, threeDaysLater),
      // 4. 今日完成
      this.queryCompletedTasks(userId, todayStart, todayEnd),
      // 5. 所有活躍任務
      this.queryRemainingTasks(userId),
      // 6. 停滯產品
      this.queryStagnantProducts(userId, sevenDaysAgo),
      // 7. 明日行事曆
      this.queryTodayCalendarEvents(userId, tomorrowStart, tomorrowEnd),
    ])

    return {
      calendarEvents,
      overdueTasks,
      approachingTasks,
      completedTasks,
      remainingTasks,
      stagnantProducts,
      tomorrowPreview,
    }
  }

  // ============================================================================
  // 查詢方法
  // ============================================================================

  private async queryTodayCalendarEvents(
    userId: string,
    start: Date,
    end: Date,
  ): Promise<CalendarEventSummary[]> {
    const rows = await prisma.$queryRaw<RawCalendarEvent[]>`
      SELECT
        ce.id::text,
        ce.summary,
        ce.start_date_time,
        ce.end_date_time,
        ce.meet_link,
        ce.event_link,
        ce.attendees,
        ce.task_id::text
      FROM calendar_events ce
      WHERE ce.user_id = ${userId}::uuid
        AND ce.deleted_at IS NULL
        AND ce.start_date_time >= ${start}
        AND ce.start_date_time < ${end}
      ORDER BY ce.start_date_time ASC
    `

    return rows.map(this.rawToCalendarEventSummary)
  }

  private async queryOverdueTasks(userId: string, now: Date): Promise<TaskSummary[]> {
    const rows = await prisma.$queryRaw<RawTaskRow[]>`
      SELECT
        t.id::text,
        t.content,
        t.status::text,
        t.due_date,
        t.updated_at,
        a.name as area_name,
        p.name as product_name,
        tam.urgency_level
      FROM tasks t
      JOIN products p ON p.id = t.product_id
      JOIN areas a ON a.id = p.area_id
      LEFT JOIN task_ai_metadata tam ON tam.task_id = t.id
      WHERE t.user_id = ${userId}::uuid
        AND t.deleted_at IS NULL
        AND t.status NOT IN ('ARCHIVE', 'REFERENCE')
        AND t.due_date IS NOT NULL
        AND t.due_date < ${now}
      ORDER BY t.due_date ASC
    `

    return rows.map(row => this.rawToTaskSummary(row, now))
  }

  private async queryApproachingTasks(
    userId: string,
    now: Date,
    threeDaysLater: Date,
  ): Promise<TaskSummary[]> {
    const rows = await prisma.$queryRaw<RawTaskRow[]>`
      SELECT
        t.id::text,
        t.content,
        t.status::text,
        t.due_date,
        t.updated_at,
        a.name as area_name,
        p.name as product_name,
        tam.urgency_level
      FROM tasks t
      JOIN products p ON p.id = t.product_id
      JOIN areas a ON a.id = p.area_id
      LEFT JOIN task_ai_metadata tam ON tam.task_id = t.id
      WHERE t.user_id = ${userId}::uuid
        AND t.deleted_at IS NULL
        AND t.status NOT IN ('ARCHIVE', 'REFERENCE')
        AND t.due_date IS NOT NULL
        AND t.due_date >= ${now}
        AND t.due_date < ${threeDaysLater}
      ORDER BY t.due_date ASC
    `

    return rows.map(row => this.rawToTaskSummary(row, now))
  }

  private async queryCompletedTasks(
    userId: string,
    todayStart: Date,
    todayEnd: Date,
  ): Promise<TaskSummary[]> {
    const rows = await prisma.$queryRaw<RawTaskRow[]>`
      SELECT
        t.id::text,
        t.content,
        t.status::text,
        t.due_date,
        t.updated_at,
        a.name as area_name,
        p.name as product_name,
        tam.urgency_level
      FROM tasks t
      JOIN products p ON p.id = t.product_id
      JOIN areas a ON a.id = p.area_id
      LEFT JOIN task_ai_metadata tam ON tam.task_id = t.id
      WHERE t.user_id = ${userId}::uuid
        AND t.deleted_at IS NULL
        AND t.status = 'ARCHIVE'
        AND t.updated_at >= ${todayStart}
        AND t.updated_at < ${todayEnd}
      ORDER BY t.updated_at DESC
    `

    return rows.map(row => this.rawToTaskSummary(row, new Date()))
  }

  private async queryRemainingTasks(userId: string): Promise<TaskSummary[]> {
    const now = new Date()
    const rows = await prisma.$queryRaw<RawTaskRow[]>`
      SELECT
        t.id::text,
        t.content,
        t.status::text,
        t.due_date,
        t.updated_at,
        a.name as area_name,
        p.name as product_name,
        tam.urgency_level
      FROM tasks t
      JOIN products p ON p.id = t.product_id
      JOIN areas a ON a.id = p.area_id
      LEFT JOIN task_ai_metadata tam ON tam.task_id = t.id
      WHERE t.user_id = ${userId}::uuid
        AND t.deleted_at IS NULL
        AND t.status IN ('ACTIVE', 'INBOX')
      ORDER BY t.due_date ASC NULLS LAST, t.updated_at DESC
    `

    return rows.map(row => this.rawToTaskSummary(row, now))
  }

  private async queryStagnantProducts(
    userId: string,
    sevenDaysAgo: Date,
  ): Promise<AggregatedData['stagnantProducts']> {
    const rows = await prisma.$queryRaw<RawStagnantProduct[]>`
      SELECT
        p.id::text,
        p.name,
        a.name as area_name,
        MAX(t.updated_at) as last_task_updated_at
      FROM products p
      JOIN areas a ON a.id = p.area_id
      LEFT JOIN tasks t ON t.product_id = p.id AND t.deleted_at IS NULL
      WHERE p.user_id = ${userId}::uuid
        AND p.deleted_at IS NULL
        AND p.status IN ('ACTIVE', 'INBOX')
      GROUP BY p.id, p.name, a.name
      HAVING MAX(t.updated_at) IS NOT NULL
        AND MAX(t.updated_at) < ${sevenDaysAgo}
      ORDER BY MAX(t.updated_at) ASC
    `

    return rows.map(row => ({
      id: row.id,
      name: row.name,
      area_name: row.area_name,
      last_task_updated_at: row.last_task_updated_at.toISOString(),
    }))
  }

  // ============================================================================
  // 轉換方法
  // ============================================================================

  private rawToCalendarEventSummary(row: RawCalendarEvent): CalendarEventSummary {
    return {
      id: row.id,
      summary: row.summary,
      start_date_time: row.start_date_time.toISOString(),
      end_date_time: row.end_date_time.toISOString(),
      meet_link: row.meet_link,
      event_link: row.event_link,
      attendees: row.attendees || [],
      linked_task_id: row.task_id,
    }
  }

  private rawToTaskSummary(row: RawTaskRow, now: Date): TaskSummary {
    const dueDate = row.due_date ? new Date(row.due_date) : null
    const updatedAt = new Date(row.updated_at)

    let daysOverdue: number | null = null
    let daysRemaining: number | null = null
    if (dueDate) {
      const diffDays = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
      if (diffDays > 0) {
        daysOverdue = diffDays
      } else {
        daysRemaining = Math.abs(diffDays)
      }
    }

    const daysStagnant = Math.floor((now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60 * 24))

    return {
      id: row.id,
      content: row.content,
      status: row.status,
      due_date: dueDate ? dueDate.toISOString().substring(0, 10) : null,
      area_name: row.area_name || 'Unknown',
      product_name: row.product_name || 'Unknown',
      days_overdue: daysOverdue,
      days_remaining: daysRemaining,
      days_stagnant: daysStagnant,
      urgency_level: row.urgency_level,
    }
  }

  // ============================================================================
  // 日期工具
  // ============================================================================

  private getStartOfDay(date: Date, timezone: string): Date {
    const dateStr = date.toLocaleDateString('en-CA', { timeZone: timezone }) // YYYY-MM-DD
    return new Date(`${dateStr}T00:00:00.000+08:00`) // 台北時區
  }

  private getEndOfDay(date: Date, timezone: string): Date {
    const start = this.getStartOfDay(date, timezone)
    return new Date(start.getTime() + 24 * 60 * 60 * 1000)
  }
}
