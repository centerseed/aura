/**
 * CoachDetectionService 單元測試
 *
 * 純函數偵測引擎，無 DB 依賴
 * 測試：時間衝突、截止日碰撞、容量超載、停滯產品、卡住任務
 */

import { describe, it, expect } from 'vitest'
import {
  detectTimeOverlaps,
  detectDeadlineCollisions,
  detectCapacityOverload,
  detectStagnantProducts,
  detectStuckTasks,
} from '@/application/services/coach-detection'
import type { CalendarEventSummary, TaskSummary } from '@/domain/entities/coach-briefing.entity'

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
    area_name: 'Area A',
    product_name: 'Product A',
    days_overdue: null,
    days_remaining: null,
    days_stagnant: null,
    urgency_level: null,
    ...overrides,
  }
}

interface StagnantProductInput {
  id: string
  name: string
  area_name: string
  last_task_updated_at: string
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
// detectStagnantProducts
// ============================================================================

describe('detectStagnantProducts', () => {
  describe('正常路徑', () => {
    it('應該偵測到超過 7 天沒更新的產品', () => {
      const now = new Date()
      const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000)

      const products: StagnantProductInput[] = [
        {
          id: 'prod-1',
          name: 'Old Product',
          area_name: 'Area A',
          last_task_updated_at: tenDaysAgo.toISOString(),
        },
      ]

      const stagnations = detectStagnantProducts(products)
      expect(stagnations).toHaveLength(1)
      expect(stagnations[0].type).toBe('stagnant_product')
      expect(stagnations[0].entity_name).toBe('Old Product')
      expect(stagnations[0].days_inactive).toBeGreaterThanOrEqual(10)
    })

    it('最近更新的產品不應被標記', () => {
      const now = new Date()
      const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000)

      const products: StagnantProductInput[] = [
        {
          id: 'prod-1',
          name: 'Active Product',
          area_name: 'Area A',
          last_task_updated_at: twoDaysAgo.toISOString(),
        },
      ]

      expect(detectStagnantProducts(products)).toHaveLength(0)
    })
  })

  describe('邊界條件', () => {
    it('空陣列應回傳空結果', () => {
      expect(detectStagnantProducts([])).toHaveLength(0)
    })
  })
})

// ============================================================================
// detectStuckTasks
// ============================================================================

describe('detectStuckTasks', () => {
  describe('正常路徑', () => {
    it('應該偵測到超過 5 天沒更新的 ACTIVE 任務', () => {
      const tasks: TaskSummary[] = [
        makeTask({
          id: 'task-stuck',
          status: 'ACTIVE',
          days_stagnant: 6,
        }),
      ]

      const stagnations = detectStuckTasks(tasks)
      expect(stagnations).toHaveLength(1)
      expect(stagnations[0].type).toBe('stuck_task')
      expect(stagnations[0].entity_name).toBe('Test task')
    })

    it('最近更新的 ACTIVE 任務不應被標記', () => {
      const tasks: TaskSummary[] = [
        makeTask({
          id: 'task-active',
          status: 'ACTIVE',
          days_stagnant: 2,
        }),
      ]

      expect(detectStuckTasks(tasks)).toHaveLength(0)
    })

    it('非 ACTIVE/INBOX 狀態的任務不應被檢查', () => {
      const tasks: TaskSummary[] = [
        makeTask({
          id: 'task-ref',
          status: 'REFERENCE',
          days_stagnant: 30,
        }),
      ]

      expect(detectStuckTasks(tasks)).toHaveLength(0)
    })
  })

  describe('邊界條件', () => {
    it('空陣列應回傳空結果', () => {
      expect(detectStuckTasks([])).toHaveLength(0)
    })

    it('days_stagnant 為 null 的任務不應被標記', () => {
      const tasks: TaskSummary[] = [
        makeTask({
          id: 'task-null',
          status: 'ACTIVE',
          days_stagnant: null,
        }),
      ]

      expect(detectStuckTasks(tasks)).toHaveLength(0)
    })

    it('INBOX 狀態的停滯任務也應被偵測', () => {
      const tasks: TaskSummary[] = [
        makeTask({
          id: 'task-inbox',
          status: 'INBOX',
          days_stagnant: 7,
        }),
      ]

      const stagnations = detectStuckTasks(tasks)
      expect(stagnations).toHaveLength(1)
      expect(stagnations[0].type).toBe('stuck_task')
    })
  })
})
