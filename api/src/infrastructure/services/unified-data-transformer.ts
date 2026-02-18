/**
 * UnifiedDataTransformer - 統一資料轉換器
 *
 * 把 UnifiedRawData 在記憶體中轉換成：
 * 1. BriefingData - CoachDataAggregator 的輸出格式
 * 2. PlanCollectedData - PlanCandidateCollector 的輸出格式
 */

import type { UnifiedRawData } from '@/domain/interfaces/data-collector'
import type { AggregatedData } from './coach-data-aggregator'
import type { CollectedData, PlanCandidate, WeeklyDayInfo } from '@/domain/entities/plan-candidate.entity'
import type { CalendarEventSummary, TaskSummary, SubTaskSummary } from '@/domain/entities/coach-briefing.entity'
import type { IDataTransformer } from '@/domain/interfaces/data-transformer'
import { WORK_HOURS_PER_DAY, MAX_TODAY_CANDIDATES } from '@/lib/coach-constants'

export class UnifiedDataTransformer implements IDataTransformer {
  /**
   * 轉換成 Briefing 需要的格式
   */
  toBriefingData(raw: UnifiedRawData, todayStart: Date, threeDaysLater: Date): AggregatedData {
    const now = new Date()

    // 分類任務
    const overdueTasks: TaskSummary[] = []
    const approachingTasks: TaskSummary[] = []
    const remainingTasks: TaskSummary[] = []

    for (const task of raw.allTasks) {
      const taskSummary = this.rawTaskToSummary(task, now)

      if (task.due_date && task.due_date < todayStart) {
        overdueTasks.push(taskSummary)
      } else if (task.due_date && task.due_date >= todayStart && task.due_date < threeDaysLater) {
        approachingTasks.push(taskSummary)
      }

      remainingTasks.push(taskSummary)
    }

    // 完成任務
    const completedTasks = raw.completedTasks.map(t => this.rawTaskToSummary(t, now))

    // Stuck subtasks (已開始但未完成)
    const stuckSubTasks: SubTaskSummary[] = []
    for (const st of raw.allSubTasks) {
      if (!st.completed && st.start_date && st.start_date <= now) {
        const task = raw.allTasks.find(t => t.id === st.task_id)
        if (task) {
          stuckSubTasks.push(this.rawSubTaskToSummary(st, task, now))
        }
      }
    }

    // 行事曆
    const calendarEvents = raw.todayCalendar.map(this.rawToCalendarEventSummary)
    const tomorrowPreview = raw.tomorrowCalendar.map(this.rawToCalendarEventSummary)

    return {
      calendarEvents,
      overdueTasks,
      approachingTasks,
      completedTasks,
      remainingTasks,
      stuckSubTasks,
      tomorrowPreview,
    }
  }

  /**
   * 轉換成 Plan 需要的格式
   */
  toPlanCollectedData(
    raw: UnifiedRawData,
    todayStart: Date,
    timezone: string,
  ): CollectedData {
    const now = new Date()
    const threeDaysLater = new Date(todayStart.getTime() + 3 * 24 * 60 * 60 * 1000)
    const fifteenDaysLater = new Date(todayStart.getTime() + 15 * 24 * 60 * 60 * 1000)

    // 子任務按 task_id 分組（提前建立，供候選篩選使用）
    const subTasksByTaskForFilter = new Map<string, typeof raw.allSubTasks[0][]>()
    for (const st of raw.allSubTasks) {
      const arr = subTasksByTaskForFilter.get(st.task_id) || []
      arr.push(st)
      subTasksByTaskForFilter.set(st.task_id, arr)
    }

    // 篩選候選任務 (逾期 + 15天內到期 + 已開始 + 子任務到期)
    const candidateTasks = raw.allTasks.filter(task => {
      // 1. 逾期
      if (task.due_date && task.due_date < todayStart) return true
      // 2. 15天內到期 + 可開始
      if (
        task.due_date &&
        task.due_date < fifteenDaysLater &&
        (!task.start_date || task.start_date <= todayStart)
      ) return true
      // 3. 已開始
      if (task.start_date && task.start_date <= todayStart) return true
      // 4. 子任務有自己的 due_date 且在 15 天內到期
      const subTasks = subTasksByTaskForFilter.get(task.id) || []
      const hasUrgentSubTask = subTasks.some(st =>
        !st.completed && st.due_date && st.due_date < fifteenDaysLater
      )
      if (hasUrgentSubTask) return true
      return false
    }).slice(0, MAX_TODAY_CANDIDATES)

    // 展開候選 (Task 有 SubTask 則展開，否則 Task 自己)
    const candidates: PlanCandidate[] = []
    for (const task of candidateTasks) {
      const subTasks = subTasksByTaskForFilter.get(task.id) || []
      const uncompletedSubTasks = subTasks.filter(st => !st.completed)

      if (uncompletedSubTasks.length > 0) {
        // 展開 SubTask
        for (const st of uncompletedSubTasks) {
          candidates.push({
            itemType: 'subtask',
            taskId: task.id,
            subTaskId: st.id,
            content: st.content,
            areaName: task.area_name,
            productName: task.product_name,
            productDescription: task.product_description,
            taskContent: task.content,
            subTaskOrder: st.order,
            estimatedMinutes: st.estimated_minutes,
            dueDate: st.due_date || task.due_date,
            startDate: st.start_date,
            ...this.calcDays(st.due_date || task.due_date, st.updated_at, now),
            milestoneId: task.inferred_from_milestone,
            dateSource: task.date_source,
          })
        }
      } else {
        // Task 自己
        candidates.push({
          itemType: 'task',
          taskId: task.id,
          subTaskId: null,
          content: task.content,
          areaName: task.area_name,
          productName: task.product_name,
          productDescription: task.product_description,
          taskContent: task.content,
          subTaskOrder: null,
          estimatedMinutes: null,
          dueDate: task.due_date,
          startDate: task.start_date,
          ...this.calcDays(task.due_date, task.updated_at, now),
          milestoneId: task.inferred_from_milestone,
          dateSource: task.date_source,
        })
      }
    }

    // 未排程任務
    const unscheduledTasks: PlanCandidate[] = raw.unscheduledTasks.map(task => ({
      itemType: 'task' as const,
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
      dateSource: task.date_source,
    }))

    // 里程碑
    const milestones = raw.milestones.map(m => ({
      id: m.id,
      name: m.name,
      targetDate: m.target_date,
      priority: m.priority,
      entityType: m.entity_type,
      entityName: m.entity_name,
    }))

    // 產品上下文
    const productContexts = this.buildProductContexts(candidateTasks)

    // 容量計算
    const meetingMinutes = raw.todayCalendar.reduce((sum, evt) => {
      const duration = (evt.end_date_time.getTime() - evt.start_date_time.getTime()) / 1000 / 60
      return sum + duration
    }, 0)
    const availableMinutes = WORK_HOURS_PER_DAY * 60 - meetingMinutes

    // 週概覽
    const weeklyOverview = this.buildWeeklyOverview(todayStart, candidates, raw.weeklyCalendar)

    return {
      candidates,
      unscheduledTasks,
      milestones,
      productContexts,
      meetingMinutes,
      availableMinutes,
      weeklyOverview,
    }
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  private rawTaskToSummary(task: any, now: Date): TaskSummary {
    const dueDate = task.due_date ? new Date(task.due_date) : null
    const startDate = task.start_date ? new Date(task.start_date) : null
    const updatedAt = new Date(task.updated_at)

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
      id: task.id,
      content: task.content,
      status: task.status,
      due_date: dueDate ? dueDate.toISOString().substring(0, 10) : null,
      start_date: startDate ? startDate.toISOString().substring(0, 10) : null,
      area_name: task.area_name || 'Unknown',
      product_name: task.product_name || 'Unknown',
      days_overdue: daysOverdue,
      days_remaining: daysRemaining,
      days_stagnant: daysStagnant,
      urgency_level: null,
      estimated_minutes: null,
    }
  }

  private rawSubTaskToSummary(st: any, task: any, now: Date): SubTaskSummary {
    const startDate = new Date(st.start_date)
    const dueDate = st.due_date ? new Date(st.due_date) : null
    const daysSinceStart = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))

    let daysRemaining: number | null = null
    if (dueDate) {
      daysRemaining = Math.floor((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    }

    return {
      id: st.id,
      content: st.content,
      task_id: st.task_id,
      task_content: task.content,
      area_name: task.area_name,
      product_name: task.product_name,
      start_date: startDate.toISOString().substring(0, 10),
      due_date: dueDate ? dueDate.toISOString().substring(0, 10) : null,
      days_since_start: daysSinceStart,
      days_remaining: daysRemaining,
    }
  }

  private rawToCalendarEventSummary(evt: any): CalendarEventSummary {
    return {
      id: evt.id,
      summary: evt.summary,
      start_date_time: evt.start_date_time.toISOString(),
      end_date_time: evt.end_date_time.toISOString(),
      meet_link: evt.meet_link,
      event_link: evt.event_link,
      attendees: evt.attendees || [],
      linked_task_id: evt.task_id,
    }
  }

  private calcDays(dueDate: Date | null, updatedAt: Date, now: Date) {
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
    return { daysOverdue, daysRemaining, daysStagnant }
  }

  private buildProductContexts(tasks: any[]) {
    const productMap = new Map<string, any>()
    for (const task of tasks) {
      if (!productMap.has(task.product_id)) {
        productMap.set(task.product_id, {
          productId: task.product_id,
          productName: task.product_name,
          productDescription: task.product_description,
          areaName: task.area_name,
          taskSummaries: [],
        })
      }
      const product = productMap.get(task.product_id)!
      product.taskSummaries.push({
        id: task.id,
        content: task.content,
        status: task.status,
        dueDate: task.due_date ? new Date(task.due_date).toISOString().substring(0, 10) : null,
      })
    }
    return Array.from(productMap.values())
  }

  private buildWeeklyOverview(
    todayStart: Date,
    candidates: PlanCandidate[],
    weeklyMeetings: Map<string, number>,
  ): WeeklyDayInfo[] {
    const weekDays = ['日', '一', '二', '三', '四', '五', '六']
    const overview: WeeklyDayInfo[] = []

    for (let i = 0; i < 10; i++) {
      const dayDate = new Date(todayStart.getTime() + i * 24 * 60 * 60 * 1000)
      const dateStr = dayDate.toISOString().substring(0, 10)
      const dayOfWeek = `星期${weekDays[dayDate.getDay()]}`
      const meetingMinutes = weeklyMeetings.get(dateStr) || 0
      const availableMinutes = WORK_HOURS_PER_DAY * 60 - meetingMinutes

      const tasksDue = candidates.filter(c => {
        if (!c.dueDate) return false
        const dueStr = c.dueDate.toISOString().substring(0, 10)
        return dueStr === dateStr
      }).length

      const totalEstimatedMinutes = candidates
        .filter(c => {
          if (!c.dueDate) return false
          const dueStr = c.dueDate.toISOString().substring(0, 10)
          return dueStr === dateStr
        })
        .reduce((sum, c) => sum + (c.estimatedMinutes ?? 30), 0)

      overview.push({
        date: dateStr,
        dayOfWeek,
        meetingMinutes,
        availableMinutes,
        tasksDue,
        totalEstimatedMinutes,
      })
    }

    return overview
  }
}
