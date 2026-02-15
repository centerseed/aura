/**
 * UnifiedDataCollector - 統一資料收集器
 *
 * 一次查詢所有 briefing 和 plan 需要的資料，避免重複查詢
 *
 * 策略：
 * 1. 8 個並行 DB 查詢取得原始資料
 * 2. 在記憶體中分類、篩選、計算（極快）
 * 3. briefing 和 plan 共用同一份資料
 */

import { prisma } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { getStartOfDay, getEndOfDay } from '@/lib/timezone-utils'
import type { UnifiedRawData } from '@/domain/interfaces/data-collector'
import { WORK_HOURS_PER_DAY, MAX_UNSCHEDULED_TASKS, MAX_MILESTONES, MAX_TODAY_CANDIDATES } from '@/lib/coach-constants'

// ============================================================================
// Types - Task
// ============================================================================

interface RawTask {
  id: string
  content: string
  status: string
  due_date: Date | null
  start_date: Date | null
  updated_at: Date
  completed_at: Date | null
  area_name: string
  product_id: string
  product_name: string
  product_description: string | null
  inferred_from_milestone: string | null
  date_source: string | null
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
  updated_at: Date
}

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

interface RawMilestone {
  id: string
  name: string
  target_date: Date
  priority: number
  entity_type: string
  entity_name: string
}

// ============================================================================
// Internal Type Mapping
// ============================================================================

// UnifiedRawData 來自 @/domain/interfaces/data-collector
// 以下是內部 RawTask/RawSubTask 與 UnifiedRawData 之間的轉換器

// ============================================================================
// Collector
// ============================================================================

import type { IDataCollector } from '@/domain/interfaces/data-collector'

export class UnifiedDataCollector implements IDataCollector {
  async collect(userId: string, date: Date, timezone: string): Promise<UnifiedRawData> {
    const todayStart = getStartOfDay(date, timezone)
    const todayEnd = getEndOfDay(date, timezone)
    const tomorrowStart = new Date(todayEnd.getTime())
    const tomorrowEnd = new Date(tomorrowStart.getTime() + 24 * 60 * 60 * 1000)
    const fiveDaysLater = new Date(todayStart.getTime() + 5 * 24 * 60 * 60 * 1000)

    // 3 個並行查詢（任務全部一次查出，行事曆一次查出）
    const queryStart = Date.now()
    const [taskResult, calendarResult, milestoneResult] = await Promise.all([
      (async () => {
        const start = Date.now()
        const result = await this.queryAllTasksAndSubTasks(userId, todayStart, todayEnd)
        console.log('[UnifiedCollector] queryAllTasksAndSubTasks:', Date.now() - start, 'ms')
        return result
      })(),
      (async () => {
        const start = Date.now()
        const result = await this.queryWeeklyCalendarEvents(userId, todayStart, fiveDaysLater)
        console.log('[UnifiedCollector] queryWeeklyCalendarEvents:', Date.now() - start, 'ms')
        return result
      })(),
      (async () => {
        const start = Date.now()
        const result = await this.queryMilestones(userId, todayStart)
        console.log('[UnifiedCollector] queryMilestones:', Date.now() - start, 'ms')
        return result
      })(),
    ])
    const { allTasks, allSubTasks, completedTasks, unscheduledTasks } = taskResult
    const weeklyCalendar = calendarResult
    const milestones = milestoneResult
    const queryTime = Date.now() - queryStart
    console.log('[UnifiedCollector] Total parallel queries:', queryTime, 'ms')

    // 從週行事曆中篩選出今日和明日（記憶體操作，極快）
    const todayCalendar = weeklyCalendar.filter(evt => {
      const evtDate = new Date(evt.start_date_time)
      return evtDate >= todayStart && evtDate < todayEnd
    })
    const tomorrowCalendar = weeklyCalendar.filter(evt => {
      const evtDate = new Date(evt.start_date_time)
      return evtDate >= tomorrowStart && evtDate < tomorrowEnd
    })

    // 建立週會議分鐘數 Map（從完整事件計算）
    const weeklyMeetingMinutes = this.buildWeeklyMeetingMap(weeklyCalendar, todayStart)

    return {
      allTasks,
      allSubTasks,
      todayCalendar,
      tomorrowCalendar,
      weeklyCalendar: weeklyMeetingMinutes,
      completedTasks,
      unscheduledTasks,
      milestones,
    }
  }

  // ============================================================================
  // Queries (3 parallel queries - 最優化版本)
  // ============================================================================

  /**
   * 一次查詢所有需要的任務（活躍、今日完成、未排程）+ 子任務
   * 用記憶體分類，取代 3 個獨立查詢
   */
  private async queryAllTasksAndSubTasks(
    userId: string,
    todayStart: Date,
    todayEnd: Date,
  ): Promise<{
    allTasks: RawTask[]
    allSubTasks: RawSubTask[]
    completedTasks: RawTask[]
    unscheduledTasks: RawTask[]
  }> {
    interface TaskRow {
      task_id: string
      task_content: string
      task_status: string
      task_due_date: Date | null
      task_start_date: Date | null
      task_updated_at: Date
      task_completed_at: Date | null
      task_milestone: string | null
      task_date_source: string | null
      area_name: string
      product_id: string
      product_name: string
      product_description: string | null
    }

    // 分開查詢 tasks 和 subtasks（避免 JOIN 的 cartesian product）
    const [taskRows, subTaskRows] = await Promise.all([
      // 查詢 tasks（不 JOIN subtasks，避免重複資料）
      prisma.$queryRaw<TaskRow[]>`
        SELECT
          t.id::text as task_id,
          t.content as task_content,
          t.status::text as task_status,
          t.due_date as task_due_date,
          t.start_date as task_start_date,
          t.updated_at as task_updated_at,
          t.completed_at as task_completed_at,
          t.inferred_from_milestone::text as task_milestone,
          t.date_source as task_date_source,
          a.name as area_name,
          p.id::text as product_id,
          p.name as product_name,
          p.description as product_description
        FROM tasks t
        JOIN products p ON p.id = t.product_id
        JOIN areas a ON a.id = p.area_id
        WHERE t.user_id = ${userId}::uuid
          AND t.deleted_at IS NULL
          AND (
            t.status IN ('ACTIVE', 'INBOX')
            OR (t.status = 'ARCHIVE' AND t.completed_at >= ${todayStart} AND t.completed_at < ${todayEnd})
          )
        ORDER BY
          CASE WHEN t.due_date IS NOT NULL AND t.due_date < NOW() THEN 0 ELSE 1 END,
          t.due_date ASC NULLS LAST,
          t.updated_at DESC
      `,
      // 查詢 subtasks（只查詢活躍任務的 subtasks）
      prisma.$queryRaw<RawSubTask[]>`
        SELECT
          st.id::text,
          st.task_id::text,
          st.content,
          st.completed,
          st.due_date,
          st.start_date,
          st.estimated_minutes,
          st.order,
          st.updated_at
        FROM sub_tasks st
        JOIN tasks t ON t.id = st.task_id
        WHERE t.user_id = ${userId}::uuid
          AND st.deleted_at IS NULL
          AND t.deleted_at IS NULL
          AND (
            t.status IN ('ACTIVE', 'INBOX')
            OR (t.status = 'ARCHIVE' AND t.completed_at >= ${todayStart} AND t.completed_at < ${todayEnd})
          )
        ORDER BY st.order ASC
      `
    ])

    // 轉換 task rows 為 RawTask[]
    const allTasksArray: RawTask[] = taskRows.map(row => ({
      id: row.task_id,
      content: row.task_content,
      status: row.task_status,
      due_date: row.task_due_date,
      start_date: row.task_start_date,
      updated_at: row.task_updated_at,
      completed_at: row.task_completed_at,
      inferred_from_milestone: row.task_milestone,
      date_source: row.task_date_source,
      area_name: row.area_name,
      product_id: row.product_id,
      product_name: row.product_name,
      product_description: row.product_description,
    }))

    // 記憶體分類（極快）
    const allTasks = allTasksArray.filter(t => t.status === 'ACTIVE' || t.status === 'INBOX')
    const completedTasks = allTasksArray.filter(
      t => t.status === 'ARCHIVE' && t.completed_at && t.completed_at >= todayStart && t.completed_at < todayEnd
    )
    const unscheduledTasks = allTasksArray.filter(
      t => (t.status === 'ACTIVE' || t.status === 'INBOX') && !t.due_date && !t.start_date
    ).slice(0, MAX_UNSCHEDULED_TASKS)

    return {
      allTasks,
      allSubTasks: subTaskRows,
      completedTasks,
      unscheduledTasks,
    }
  }

  /**
   * 查詢行事曆事件
   */
  private async queryCalendarEvents(
    userId: string,
    start: Date,
    end: Date,
  ): Promise<RawCalendarEvent[]> {
    return prisma.$queryRaw<RawCalendarEvent[]>`
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
  }

  /**
   * 查詢週行事曆事件（5 天，完整事件）
   */
  private async queryWeeklyCalendarEvents(
    userId: string,
    rangeStart: Date,
    rangeEnd: Date,
  ): Promise<RawCalendarEvent[]> {
    return this.queryCalendarEvents(userId, rangeStart, rangeEnd)
  }

  /**
   * 從事件列表建立週會議分鐘數 Map（記憶體操作）
   *
   * ⚠️ 重要：返回的 Map key 是「本地時區日期字串」(YYYY-MM-DD)
   * 基於 todayStart 計算每天的邊界（todayStart 已是本地時區的 00:00）
   */
  private buildWeeklyMeetingMap(events: RawCalendarEvent[], todayStart: Date): Map<string, number> {
    const map = new Map<string, number>()

    // 計算 5 天的邊界（基於 todayStart 的時區）
    const dayBoundaries: Array<{ start: Date; dateStr: string }> = []
    for (let i = 0; i < 5; i++) {
      const dayStart = new Date(todayStart.getTime() + i * 24 * 60 * 60 * 1000)
      const dateStr = dayStart.toISOString().substring(0, 10)
      dayBoundaries.push({ start: dayStart, dateStr })
    }

    // 將事件歸類到對應日期
    for (const evt of events) {
      for (let i = 0; i < dayBoundaries.length - 1; i++) {
        const dayStart = dayBoundaries[i].start
        const nextDayStart = dayBoundaries[i + 1].start
        const dateStr = dayBoundaries[i].dateStr

        if (evt.start_date_time >= dayStart && evt.start_date_time < nextDayStart) {
          const durationMinutes = (evt.end_date_time.getTime() - evt.start_date_time.getTime()) / 1000 / 60
          map.set(dateStr, (map.get(dateStr) || 0) + durationMinutes)
          break
        }
      }
    }

    return map
  }


  /**
   * 查詢里程碑
   */
  private async queryMilestones(userId: string, todayStart: Date): Promise<RawMilestone[]> {
    const threeMonthsLater = new Date(todayStart.getTime() + 90 * 24 * 60 * 60 * 1000)
    return prisma.$queryRaw<RawMilestone[]>`
      SELECT
        m.id::text,
        m.name,
        m.target_date,
        m.priority,
        m.entity_type,
        COALESCE(p.name, a.name, 'General') as entity_name
      FROM milestones m
      LEFT JOIN products p ON p.id = m.entity_id AND m.entity_type = 'PRODUCT'
      LEFT JOIN areas a ON a.id = m.entity_id AND m.entity_type = 'AREA'
      WHERE m.user_id = ${userId}::uuid
        AND m.deleted_at IS NULL
        AND m.target_date >= ${todayStart}
        AND m.target_date < ${threeMonthsLater}
      ORDER BY m.target_date ASC, m.priority DESC
      LIMIT ${MAX_MILESTONES}
    `
  }
}
