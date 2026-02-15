/**
 * CoachDetectionService 單元測試
 *
 * 純函數偵測引擎，無 DB 依賴
 * 測試：時間衝突、截止日碰撞、容量超載、卡住任務
 */

import { describe, it, expect } from 'vitest'
import {
  detectTimeOverlaps,
  detectDeadlineCollisions,
  detectCapacityOverload,
  detectStuckTasks,
  detectStuckSubTasks,
} from '@/application/services/coach-detection'
import type { CalendarEventSummary, TaskSummary, SubTaskSummary } from '@/domain/entities/coach-briefing.entity'

// ============================================================================
// Test Helpers
// ============================================================================

function makeEvent(overrides: Partial<CalendarEventSummary> = {}): CalendarEventSummary {
  return {
    id: 'evt-1',
    summary: 'Meeting',
    start_date_time: '2026-02-09T09:00:00+08:00',
    end_date_time: '2026-02-09T10:00:00+08:00',
    meet_link: null,
    event_link: 'https://calendar.google.com/event/1',
    attendees: [],
    linked_task_id: null,
    ...overrides,
  }
}

function makeTask(overrides: Partial<TaskSummary> = {}): TaskSummary {
  return {
    id: 'task-1',
    content: 'Test task',
    status: 'ACTIVE',
    due_date: '2026-02-09',
    start_date: null,
    area_name: 'Area A',
    product_name: 'Product A',
    days_overdue: null,
    days_remaining: null,
    days_stagnant: null,
    urgency_level: null,
    estimated_minutes: null,
    ...overrides,
  }
}

function makeSubTask(overrides: Partial<SubTaskSummary> = {}): SubTaskSummary {
  return {
    id: 'st-1',
    content: 'Test subtask',
    task_id: 'task-1',
    task_content: 'Parent task',
    area_name: 'Area A',
    product_name: 'Product A',
    start_date: '2026-02-01',
    due_date: null,
    days_since_start: 5,
    days_remaining: null,
    ...overrides,
  }
}

// ============================================================================
// detectTimeOverlaps
// ============================================================================

describe('detectTimeOverlaps', () => {
  describe('正常路徑', () => {
    it('應該偵測到兩個事件時間重疊', () => {
      const events: CalendarEventSummary[] = [
        makeEvent({
          id: 'evt-1',
          summary: 'Meeting A',
          start_date_time: '2026-02-09T09:00:00+08:00',
          end_date_time: '2026-02-09T10:00:00+08:00',
        }),
        makeEvent({
          id: 'evt-2',
          summary: 'Meeting B',
          start_date_time: '2026-02-09T09:30:00+08:00',
          end_date_time: '2026-02-09T10:30:00+08:00',
        }),
      ]

      const conflicts = detectTimeOverlaps(events)

      expect(conflicts).toHaveLength(1)
      expect(conflicts[0].type).toBe('time_overlap')
      expect(conflicts[0].severity).toBe('high')
      expect(conflicts[0].involved_items).toHaveLength(2)
      expect(conflicts[0].involved_items[0].id).toBe('evt-1')
      expect(conflicts[0].involved_items[1].id).toBe('evt-2')
    })

    it('應該不偵測到不重疊的事件', () => {
      const events: CalendarEventSummary[] = [
        makeEvent({
          id: 'evt-1',
          start_date_time: '2026-02-09T09:00:00+08:00',
          end_date_time: '2026-02-09T10:00:00+08:00',
        }),
        makeEvent({
          id: 'evt-2',
          start_date_time: '2026-02-09T10:00:00+08:00',
          end_date_time: '2026-02-09T11:00:00+08:00',
        }),
      ]

      const conflicts = detectTimeOverlaps(events)
      expect(conflicts).toHaveLength(0)
    })

    it('應該偵測多組重疊', () => {
      const events: CalendarEventSummary[] = [
        makeEvent({ id: 'evt-1', start_date_time: '2026-02-09T09:00:00+08:00', end_date_time: '2026-02-09T10:00:00+08:00', summary: 'A' }),
        makeEvent({ id: 'evt-2', start_date_time: '2026-02-09T09:30:00+08:00', end_date_time: '2026-02-09T10:30:00+08:00', summary: 'B' }),
        makeEvent({ id: 'evt-3', start_date_time: '2026-02-09T14:00:00+08:00', end_date_time: '2026-02-09T15:00:00+08:00', summary: 'C' }),
        makeEvent({ id: 'evt-4', start_date_time: '2026-02-09T14:30:00+08:00', end_date_time: '2026-02-09T15:30:00+08:00', summary: 'D' }),
      ]

      const conflicts = detectTimeOverlaps(events)
      expect(conflicts).toHaveLength(2)
    })
  })

  describe('邊界條件', () => {
    it('空陣列應該回傳空結果', () => {
      expect(detectTimeOverlaps([])).toHaveLength(0)
    })

    it('單一事件應該沒有衝突', () => {
      expect(detectTimeOverlaps([makeEvent()])).toHaveLength(0)
    })

    it('事件首尾恰好相接不算重疊', () => {
      const events: CalendarEventSummary[] = [
        makeEvent({
          id: 'evt-1',
          start_date_time: '2026-02-09T09:00:00+08:00',
          end_date_time: '2026-02-09T10:00:00+08:00',
        }),
        makeEvent({
          id: 'evt-2',
          start_date_time: '2026-02-09T10:00:00+08:00',
          end_date_time: '2026-02-09T11:00:00+08:00',
        }),
      ]

      expect(detectTimeOverlaps(events)).toHaveLength(0)
    })
  })
})

// ============================================================================
// detectDeadlineCollisions
// ============================================================================

describe('detectDeadlineCollisions', () => {
  describe('正常路徑', () => {
    it('應該偵測同天 ≥3 任務且來自 ≥2 Area 的截止日碰撞', () => {
      const tasks: TaskSummary[] = [
        makeTask({ id: 't1', due_date: '2026-02-09', area_name: 'Area A' }),
        makeTask({ id: 't2', due_date: '2026-02-09', area_name: 'Area B' }),
        makeTask({ id: 't3', due_date: '2026-02-09', area_name: 'Area A' }),
      ]

      const conflicts = detectDeadlineCollisions(tasks)
      expect(conflicts).toHaveLength(1)
      expect(conflicts[0].type).toBe('deadline_collision')
      expect(conflicts[0].severity).toBe('high')
    })

    it('同天 3 任務但只有 1 個 Area 不應觸發', () => {
      const tasks: TaskSummary[] = [
        makeTask({ id: 't1', due_date: '2026-02-09', area_name: 'Area A' }),
        makeTask({ id: 't2', due_date: '2026-02-09', area_name: 'Area A' }),
        makeTask({ id: 't3', due_date: '2026-02-09', area_name: 'Area A' }),
      ]

      expect(detectDeadlineCollisions(tasks)).toHaveLength(0)
    })

    it('同天只有 2 任務不應觸發', () => {
      const tasks: TaskSummary[] = [
        makeTask({ id: 't1', due_date: '2026-02-09', area_name: 'Area A' }),
        makeTask({ id: 't2', due_date: '2026-02-09', area_name: 'Area B' }),
      ]

      expect(detectDeadlineCollisions(tasks)).toHaveLength(0)
    })
  })

  describe('邊界條件', () => {
    it('空陣列應回傳空結果', () => {
      expect(detectDeadlineCollisions([])).toHaveLength(0)
    })

    it('沒有截止日期的任務應被忽略', () => {
      const tasks: TaskSummary[] = [
        makeTask({ id: 't1', due_date: null }),
        makeTask({ id: 't2', due_date: null }),
        makeTask({ id: 't3', due_date: null }),
      ]

      expect(detectDeadlineCollisions(tasks)).toHaveLength(0)
    })
  })
})

// ============================================================================
// detectCapacityOverload
// ============================================================================

describe('detectCapacityOverload', () => {
  describe('正常路徑', () => {
    it('會議太多加上到期任務應觸發容量超載', () => {
      // 8 小時會議 = 整天都在開會
      const events: CalendarEventSummary[] = [
        makeEvent({ id: 'evt-1', start_date_time: '2026-02-09T09:00:00+08:00', end_date_time: '2026-02-09T13:00:00+08:00' }),
        makeEvent({ id: 'evt-2', start_date_time: '2026-02-09T14:00:00+08:00', end_date_time: '2026-02-09T18:00:00+08:00' }),
      ]

      // 3 個到期任務（每個預估 60 分鐘）
      const tasks: TaskSummary[] = [
        makeTask({ id: 't1', due_date: '2026-02-09' }),
        makeTask({ id: 't2', due_date: '2026-02-09' }),
        makeTask({ id: 't3', due_date: '2026-02-09' }),
      ]

      const conflicts = detectCapacityOverload(tasks, events)
      expect(conflicts).toHaveLength(1)
      expect(conflicts[0].type).toBe('capacity_overload')
    })

    it('有足夠空閒時間不應觸發', () => {
      // 只有 1 小時會議
      const events: CalendarEventSummary[] = [
        makeEvent({ id: 'evt-1', start_date_time: '2026-02-09T09:00:00+08:00', end_date_time: '2026-02-09T10:00:00+08:00' }),
      ]

      // 1 個到期任務
      const tasks: TaskSummary[] = [
        makeTask({ id: 't1', due_date: '2026-02-09' }),
      ]

      const conflicts = detectCapacityOverload(tasks, events)
      expect(conflicts).toHaveLength(0)
    })
  })

  describe('邊界條件', () => {
    it('沒有會議和任務時回傳空結果', () => {
      expect(detectCapacityOverload([], [])).toHaveLength(0)
    })

    it('沒有到期任務時不應觸發', () => {
      const events: CalendarEventSummary[] = [
        makeEvent({ id: 'evt-1', start_date_time: '2026-02-09T09:00:00+08:00', end_date_time: '2026-02-09T18:00:00+08:00' }),
      ]
      expect(detectCapacityOverload([], events)).toHaveLength(0)
    })
  })
})

// ============================================================================
// detectStuckTasks
// ============================================================================

describe('detectStuckTasks', () => {
  describe('正常路徑', () => {
    it('無 due_date 任務停滯 10 天以上才觸發', () => {
      // 9 天 → 不觸發（門檻 10）
      expect(detectStuckTasks([
        makeTask({ due_date: null, days_stagnant: 9, days_remaining: null }),
      ])).toHaveLength(0)

      // 11 天 → 觸發
      const result = detectStuckTasks([
        makeTask({ due_date: null, days_stagnant: 11, days_remaining: null }),
      ])
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('stuck_task')
    })

    it('due_date <= 3 天用門檻 2', () => {
      expect(detectStuckTasks([
        makeTask({ days_stagnant: 2, days_remaining: 2 }),
      ])).toHaveLength(1)
    })

    it('due_date <= 7 天用門檻 3', () => {
      expect(detectStuckTasks([
        makeTask({ days_stagnant: 3, days_remaining: 5 }),
      ])).toHaveLength(1)

      expect(detectStuckTasks([
        makeTask({ days_stagnant: 2, days_remaining: 5 }),
      ])).toHaveLength(0)
    })

    it('due_date <= 14 天用門檻 5', () => {
      expect(detectStuckTasks([
        makeTask({ days_stagnant: 5, days_remaining: 10 }),
      ])).toHaveLength(1)

      expect(detectStuckTasks([
        makeTask({ days_stagnant: 4, days_remaining: 10 }),
      ])).toHaveLength(0)
    })

    it('due_date > 14 天用門檻 7', () => {
      expect(detectStuckTasks([
        makeTask({ days_stagnant: 7, days_remaining: 20 }),
      ])).toHaveLength(1)

      expect(detectStuckTasks([
        makeTask({ days_stagnant: 6, days_remaining: 20 }),
      ])).toHaveLength(0)
    })

    it('非 ACTIVE/INBOX 狀態的任務不應被檢查', () => {
      expect(detectStuckTasks([
        makeTask({ status: 'REFERENCE', days_stagnant: 30 }),
      ])).toHaveLength(0)
    })
  })

  describe('過濾邏輯', () => {
    it('已逾期任務不出現在停滯', () => {
      expect(detectStuckTasks([
        makeTask({ days_stagnant: 10, days_overdue: 3, days_remaining: null }),
      ])).toHaveLength(0)
    })

    it('start_date 在未來的不出現', () => {
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().substring(0, 10)
      expect(detectStuckTasks([
        makeTask({ days_stagnant: 10, start_date: tomorrow, due_date: null, days_remaining: null }),
      ])).toHaveLength(0)
    })

    it('start_date 在過去的正常偵測', () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().substring(0, 10)
      expect(detectStuckTasks([
        makeTask({ days_stagnant: 11, start_date: yesterday, due_date: null, days_remaining: null }),
      ])).toHaveLength(1)
    })
  })

  describe('邊界條件', () => {
    it('空陣列應回傳空結果', () => {
      expect(detectStuckTasks([])).toHaveLength(0)
    })

    it('days_stagnant 為 null 的任務不應被標記', () => {
      expect(detectStuckTasks([
        makeTask({ status: 'ACTIVE', days_stagnant: null }),
      ])).toHaveLength(0)
    })

    it('INBOX 狀態的停滯任務也應被偵測', () => {
      const result = detectStuckTasks([
        makeTask({ status: 'INBOX', days_stagnant: 11, due_date: null, days_remaining: null }),
      ])
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('stuck_task')
    })
  })
})

// ============================================================================
// detectStuckSubTasks
// ============================================================================

describe('detectStuckSubTasks', () => {
  describe('正常路徑', () => {
    it('超過 3 天未完成的 subtask 應觸發停滯', () => {
      const result = detectStuckSubTasks([makeSubTask({ days_since_start: 4 })])
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('stuck_subtask')
      expect(result[0].entity_name).toBe('Test subtask')
      expect(result[0].parent_task_content).toBe('Parent task')
      expect(result[0].days_inactive).toBe(4)
    })

    it('剛好 3 天的 subtask 應觸發停滯', () => {
      const result = detectStuckSubTasks([makeSubTask({ days_since_start: 3 })])
      expect(result).toHaveLength(1)
    })

    it('不到 3 天的 subtask 不應觸發', () => {
      const result = detectStuckSubTasks([makeSubTask({ days_since_start: 2 })])
      expect(result).toHaveLength(0)
    })

    it('已逾期的 subtask 應在建議中提到逾期', () => {
      const result = detectStuckSubTasks([
        makeSubTask({ days_since_start: 5, days_remaining: -2, due_date: '2026-02-10' }),
      ])
      expect(result).toHaveLength(1)
      expect(result[0].suggestion).toContain('已逾期')
    })

    it('未逾期的 subtask 建議拆解或重新評估', () => {
      const result = detectStuckSubTasks([
        makeSubTask({ days_since_start: 5, days_remaining: 3, due_date: '2026-02-20' }),
      ])
      expect(result).toHaveLength(1)
      expect(result[0].suggestion).toContain('拆解或重新評估')
    })
  })

  describe('邊界條件', () => {
    it('空陣列應回傳空結果', () => {
      expect(detectStuckSubTasks([])).toHaveLength(0)
    })

    it('多個 subtask 應分別偵測', () => {
      const result = detectStuckSubTasks([
        makeSubTask({ id: 'st-1', days_since_start: 5 }),
        makeSubTask({ id: 'st-2', days_since_start: 1 }),
        makeSubTask({ id: 'st-3', days_since_start: 10 }),
      ])
      expect(result).toHaveLength(2)
      expect(result.map(r => r.entity_id)).toEqual(['st-1', 'st-3'])
    })

    it('days_remaining 為 null 不應算逾期', () => {
      const result = detectStuckSubTasks([
        makeSubTask({ days_since_start: 5, days_remaining: null }),
      ])
      expect(result).toHaveLength(1)
      expect(result[0].suggestion).not.toContain('已逾期')
    })
  })
})
