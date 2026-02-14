/**
 * CoachDetectionService - 衝突與停滯偵測引擎
 *
 * 純函數，無 DB 依賴。負責從聚合資料中偵測：
 * - 時間重疊 (time_overlap)
 * - 截止日碰撞 (deadline_collision)
 * - 容量超載 (capacity_overload)
 * - 停滯產品 (stagnant_product)
 * - 卡住任務 (stuck_task)
 */

import type {
  CalendarEventSummary,
  TaskSummary,
  SubTaskSummary,
  ConflictItem,
  StagnationItem,
} from '@/domain/entities/coach-briefing.entity'
import {
  WORK_HOURS_PER_DAY,
  ESTIMATED_MINUTES_PER_TASK,
  STUCK_TASK_THRESHOLDS,
  STAGNANT_PRODUCT_THRESHOLDS,
  STUCK_SUBTASK_THRESHOLD_DAYS,
} from '@/lib/coach-constants'

// ============================================================================
// 衝突偵測
// ============================================================================

/**
 * 偵測行事曆事件的時間重疊
 *
 * 規則：A.start < B.end AND B.start < A.end
 */
export function detectTimeOverlaps(events: CalendarEventSummary[]): ConflictItem[] {
  const conflicts: ConflictItem[] = []

  for (let i = 0; i < events.length; i++) {
    for (let j = i + 1; j < events.length; j++) {
      const a = events[i]
      const b = events[j]

      const aStart = new Date(a.start_date_time).getTime()
      const aEnd = new Date(a.end_date_time).getTime()
      const bStart = new Date(b.start_date_time).getTime()
      const bEnd = new Date(b.end_date_time).getTime()

      if (aStart < bEnd && bStart < aEnd) {
        conflicts.push({
          type: 'time_overlap',
          severity: 'high',
          description: `「${a.summary}」和「${b.summary}」時間重疊`,
          involved_items: [
            { id: a.id, title: a.summary, type: 'calendar_event', time: a.start_date_time },
            { id: b.id, title: b.summary, type: 'calendar_event', time: b.start_date_time },
          ],
        })
      }
    }
  }

  return conflicts
}

/**
 * 偵測截止日碰撞
 *
 * 規則：同天 ≥3 任務且來自 ≥2 個不同 Area
 */
export function detectDeadlineCollisions(tasks: TaskSummary[]): ConflictItem[] {
  const conflicts: ConflictItem[] = []

  // 按截止日分組
  const byDate = new Map<string, TaskSummary[]>()
  for (const task of tasks) {
    if (!task.due_date) continue
    const dateKey = task.due_date.substring(0, 10) // YYYY-MM-DD
    const group = byDate.get(dateKey) || []
    group.push(task)
    byDate.set(dateKey, group)
  }

  // 檢查每個日期
  for (const [date, dateTasks] of byDate.entries()) {
    if (dateTasks.length < 3) continue

    const uniqueAreas = new Set(dateTasks.map(t => t.area_name))
    if (uniqueAreas.size < 2) continue

    conflicts.push({
      type: 'deadline_collision',
      severity: 'high',
      description: `${date} 有 ${dateTasks.length} 個任務到期，橫跨 ${uniqueAreas.size} 個領域`,
      involved_items: dateTasks.map(t => ({
        id: t.id,
        title: t.content,
        type: 'task' as const,
        time: t.due_date,
      })),
    })
  }

  return conflicts
}

/**
 * 偵測容量超載
 *
 * 規則：任務估計時間 > 可用時間（工作 8 小時 - 會議時間）
 */
export function detectCapacityOverload(
  tasks: TaskSummary[],
  events: CalendarEventSummary[],
): ConflictItem[] {
  if (tasks.length === 0) return []

  // 計算會議總時數（分鐘）
  let meetingMinutes = 0
  for (const event of events) {
    const start = new Date(event.start_date_time).getTime()
    const end = new Date(event.end_date_time).getTime()
    meetingMinutes += (end - start) / (1000 * 60)
  }

  // 計算任務估計時間（優先使用 sub_tasks 估時，fallback 每個任務 60 分鐘）
  let taskMinutes = 0
  for (const task of tasks) {
    taskMinutes += task.estimated_minutes ?? ESTIMATED_MINUTES_PER_TASK
  }

  // 可用時間
  const availableMinutes = WORK_HOURS_PER_DAY * 60 - meetingMinutes

  if (taskMinutes > availableMinutes && availableMinutes >= 0) {
    return [{
      type: 'capacity_overload',
      severity: meetingMinutes >= WORK_HOURS_PER_DAY * 60 * 0.8 ? 'high' : 'medium',
      description: `今日有 ${Math.round(meetingMinutes / 60)} 小時會議 + ${tasks.length} 個待完成任務（估計 ${Math.round(taskMinutes / 60)} 小時），可用時間僅 ${Math.max(0, Math.round(availableMinutes / 60))} 小時`,
      involved_items: [
        ...events.map(e => ({
          id: e.id,
          title: e.summary,
          type: 'calendar_event' as const,
          time: e.start_date_time,
        })),
        ...tasks.map(t => ({
          id: t.id,
          title: t.content,
          type: 'task' as const,
          time: t.due_date,
        })),
      ],
    }]
  }

  return []
}

// ============================================================================
// 停滯偵測
// ============================================================================

export interface StagnantProductInput {
  id: string
  name: string
  area_name: string
  lifecycle: string
  last_task_updated_at: string
  nearest_due_date: string | null
}

/**
 * 偵測停滯產品
 *
 * 規則：
 * - FINITE 產品：門檻 7 天
 * - PERPETUAL 產品：門檻 14 天
 * - 如果產品下最近的 task due_date > 14 天後，門檻也放寬到 14 天
 */
export function detectStagnantProducts(products: StagnantProductInput[]): StagnationItem[] {
  const now = new Date()
  const stagnations: StagnationItem[] = []

  for (const product of products) {
    const lastActivity = new Date(product.last_task_updated_at)
    const daysInactive = Math.floor((now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24))

    let threshold: number = product.lifecycle === 'PERPETUAL'
      ? STAGNANT_PRODUCT_THRESHOLDS.PERPETUAL
      : STAGNANT_PRODUCT_THRESHOLDS.FINITE

    // 如果最近的任務截止日 > 14 天後，放寬門檻
    if (product.nearest_due_date) {
      const daysUntilDue = Math.floor((new Date(product.nearest_due_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      if (daysUntilDue > 14) {
        threshold = Math.max(threshold, STAGNANT_PRODUCT_THRESHOLDS.PERPETUAL)
      }
    }

    if (daysInactive >= threshold) {
      stagnations.push({
        type: 'stagnant_product',
        entity_id: product.id,
        entity_name: product.name,
        area_name: product.area_name,
        days_inactive: daysInactive,
        last_activity: product.last_task_updated_at,
        suggestion: `「${product.name}」已 ${daysInactive} 天未更新，建議檢視是否需要推進或歸檔`,
      })
    }
  }

  return stagnations
}

/**
 * 根據 days_remaining 取得動態停滯門檻
 */
function getStuckThreshold(task: TaskSummary): number {
  if (task.days_remaining == null) return STUCK_TASK_THRESHOLDS.NO_DUE_DATE
  if (task.days_remaining <= 3) return STUCK_TASK_THRESHOLDS.URGENT
  if (task.days_remaining <= 7) return STUCK_TASK_THRESHOLDS.APPROACHING
  if (task.days_remaining <= 14) return STUCK_TASK_THRESHOLDS.NORMAL
  return STUCK_TASK_THRESHOLDS.RELAXED
}

/**
 * 偵測卡住的任務
 *
 * 規則：
 * 1. 只看 ACTIVE / INBOX 狀態
 * 2. 已逾期（days_overdue > 0）→ 不在停滯顯示（已在逾期區）
 * 3. start_date 在未來 → 不算停滯（還沒到開始日）
 * 4. 根據 due_date 距離選擇動態門檻
 */
export function detectStuckTasks(tasks: TaskSummary[]): StagnationItem[] {
  const stagnations: StagnationItem[] = []
  const activeStatuses = new Set(['ACTIVE', 'INBOX'])
  const now = new Date()

  for (const task of tasks) {
    if (!activeStatuses.has(task.status)) continue
    if (task.days_stagnant == null) continue

    // 已逾期的不在停滯顯示
    if (task.days_overdue != null && task.days_overdue > 0) continue

    // start_date 在未來的不算停滯
    if (task.start_date) {
      const startDate = new Date(task.start_date)
      if (startDate.getTime() > now.getTime()) continue
    }

    const threshold = getStuckThreshold(task)
    if (task.days_stagnant < threshold) continue

    stagnations.push({
      type: 'stuck_task',
      entity_id: task.id,
      entity_name: task.content,
      area_name: task.area_name,
      days_inactive: task.days_stagnant,
      last_activity: '',
      suggestion: `「${task.content}」已 ${task.days_stagnant} 天未更新，建議拆解或延後`,
    })
  }

  return stagnations
}

/**
 * 偵測卡住的子任務
 *
 * 規則：
 * - start_date <= today 且未完成 → 計算已開始天數
 * - 超過 STUCK_SUBTASK_THRESHOLD_DAYS (3天) → stuck
 * - 有 due_date 且已逾期 → severity high
 */
export function detectStuckSubTasks(subTasks: SubTaskSummary[]): StagnationItem[] {
  const stagnations: StagnationItem[] = []

  for (const st of subTasks) {
    if (st.days_since_start < STUCK_SUBTASK_THRESHOLD_DAYS) continue

    const isOverdue = st.days_remaining != null && st.days_remaining < 0

    stagnations.push({
      type: 'stuck_subtask',
      entity_id: st.id,
      entity_name: st.content,
      area_name: st.area_name,
      days_inactive: st.days_since_start,
      last_activity: st.start_date || '',
      suggestion: isOverdue
        ? `子任務「${st.content}」已逾期且開始 ${st.days_since_start} 天未完成，需立即處理`
        : `子任務「${st.content}」已開始 ${st.days_since_start} 天未完成，建議拆解或重新評估`,
      parent_task_content: st.task_content,
    })
  }

  return stagnations
}
