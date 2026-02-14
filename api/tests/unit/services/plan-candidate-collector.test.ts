/**
 * PlanCandidateCollector 單元測試
 *
 * 驗證候選展開邏輯與日期計算
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PlanCandidateCollector } from '@/application/services/plan-candidate-collector'

// ============================================================================
// Mock DB — 根據 SQL 內容分辨 query 類型
// ============================================================================

interface MockData {
  candidateTasks: any[]
  meetingMinutes: number
  unscheduledTasks: any[]
  milestones: any[]
  subTasks: any[]
}

let mockData: MockData

// 用呼叫順序追蹤：collect 內部 Promise.all 的 4 個 query + 1 個 subTasks query
// 順序：[candidateTasks, meetingMinutes, unscheduledTasks, milestones] 然後 subTasks
let callCount = 0

vi.mock('@/lib/db', () => ({
  prisma: {
    $queryRaw: (...args: any[]) => {
      const idx = callCount++
      switch (idx) {
        case 0: return Promise.resolve(mockData.candidateTasks)
        case 1: return Promise.resolve([{ total_minutes: mockData.meetingMinutes }])
        case 2: return Promise.resolve(mockData.unscheduledTasks)
        case 3: return Promise.resolve(mockData.milestones)
        case 4: return Promise.resolve(mockData.subTasks)
        default: return Promise.resolve([])
      }
    },
  },
}))

// ============================================================================
// Helpers
// ============================================================================

function makeRawTask(overrides: Record<string, any> = {}) {
  return {
    id: 'task-1',
    content: '測試任務',
    status: 'ACTIVE',
    due_date: null,
    start_date: null,
    updated_at: new Date('2026-02-14T08:00:00Z'),
    inferred_from_milestone: null,
    date_source: null,
    area_name: '事業',
    product_id: 'prod-1',
    product_name: 'Naruvia',
    product_description: null,
    ...overrides,
  }
}

function makeRawSubTask(overrides: Record<string, any> = {}) {
  return {
    id: 'st-1',
    task_id: 'task-1',
    content: '子任務 1',
    completed: false,
    due_date: null,
    start_date: null,
    estimated_minutes: 60,
    order: 0,
    ...overrides,
  }
}

// ============================================================================
// Tests
// ============================================================================

describe('PlanCandidateCollector', () => {
  let collector: PlanCandidateCollector

  beforeEach(() => {
    vi.clearAllMocks()
    callCount = 0
    collector = new PlanCandidateCollector()
    mockData = {
      candidateTasks: [],
      meetingMinutes: 0,
      unscheduledTasks: [],
      milestones: [],
      subTasks: [],
    }
  })

  describe('候選展開邏輯', () => {
    it('Task 有未完成 SubTask 時展開為 SubTask 候選', async () => {
      mockData.candidateTasks = [makeRawTask()]
      mockData.subTasks = [
        makeRawSubTask({ id: 'st-1', content: '步驟一', completed: false }),
        makeRawSubTask({ id: 'st-2', content: '步驟二', completed: false }),
        makeRawSubTask({ id: 'st-3', content: '已完成', completed: true }),
      ]

      const result = await collector.collect('user-1', new Date('2026-02-14'), 'Asia/Tokyo')

      expect(result.candidates).toHaveLength(2)
      expect(result.candidates[0].itemType).toBe('subtask')
      expect(result.candidates[0].content).toBe('步驟一')
      expect(result.candidates[1].content).toBe('步驟二')
    })

    it('Task 沒有 SubTask 時 Task 本身成為候選', async () => {
      mockData.candidateTasks = [makeRawTask({ content: '獨立任務' })]
      mockData.subTasks = []

      const result = await collector.collect('user-1', new Date('2026-02-14'), 'Asia/Tokyo')

      expect(result.candidates).toHaveLength(1)
      expect(result.candidates[0].itemType).toBe('task')
      expect(result.candidates[0].content).toBe('獨立任務')
      expect(result.candidates[0].subTaskId).toBeNull()
    })

    it('SubTask 繼承父 Task 的 due_date（當 SubTask 自身無 due_date）', async () => {
      const parentDue = new Date('2026-02-20')
      mockData.candidateTasks = [makeRawTask({ due_date: parentDue })]
      mockData.subTasks = [makeRawSubTask({ due_date: null })]

      const result = await collector.collect('user-1', new Date('2026-02-14'), 'Asia/Tokyo')

      expect(result.candidates[0].dueDate).toEqual(parentDue)
    })

    it('SubTask 自身有 due_date 時優先使用', async () => {
      const parentDue = new Date('2026-02-20')
      const subDue = new Date('2026-02-16')
      mockData.candidateTasks = [makeRawTask({ due_date: parentDue })]
      mockData.subTasks = [makeRawSubTask({ due_date: subDue })]

      const result = await collector.collect('user-1', new Date('2026-02-14'), 'Asia/Tokyo')

      expect(result.candidates[0].dueDate).toEqual(subDue)
    })
  })

  describe('日期計算', () => {
    it('逾期任務正確計算 daysOverdue', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-02-14T10:00:00Z'))

      mockData.candidateTasks = [makeRawTask({ due_date: new Date('2026-02-11') })]

      const result = await collector.collect('user-1', new Date('2026-02-14'), 'Asia/Tokyo')

      expect(result.candidates[0].daysOverdue).toBe(3)
      expect(result.candidates[0].daysRemaining).toBeNull()

      vi.useRealTimers()
    })

    it('未到期任務正確計算 daysRemaining', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-02-14T10:00:00Z'))

      mockData.candidateTasks = [makeRawTask({ due_date: new Date('2026-02-17') })]

      const result = await collector.collect('user-1', new Date('2026-02-14'), 'Asia/Tokyo')

      expect(result.candidates[0].daysRemaining).toBe(3)
      expect(result.candidates[0].daysOverdue).toBeNull()

      vi.useRealTimers()
    })

    it('停滯天數正確計算', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-02-14T10:00:00Z'))

      mockData.candidateTasks = [makeRawTask({ updated_at: new Date('2026-02-07T10:00:00Z') })]

      const result = await collector.collect('user-1', new Date('2026-02-14'), 'Asia/Tokyo')

      expect(result.candidates[0].daysStagnant).toBe(7)

      vi.useRealTimers()
    })
  })

  describe('容量計算', () => {
    it('可用時間 = 工時 - 會議時間', async () => {
      mockData.meetingMinutes = 120

      const result = await collector.collect('user-1', new Date('2026-02-14'), 'Asia/Tokyo')

      // WORK_HOURS_PER_DAY = 8, so 8*60 - 120 = 360
      expect(result.availableMinutes).toBe(360)
      expect(result.meetingMinutes).toBe(120)
    })
  })

  describe('真實場景: 2/14 數據驗證', () => {
    it('應正確展開多個 Task 的 SubTasks', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-02-14T10:00:00Z'))

      mockData.candidateTasks = [
        makeRawTask({
          id: 'task-mcp',
          content: '開發 Zentropy MCP 與 Coach 功能',
          product_name: 'Zentropy',
          due_date: new Date('2026-02-15'),
        }),
        makeRawTask({
          id: 'task-paceriz',
          content: '確認 Paceriz 部署方式遷移',
          product_name: 'Paceriz',
          due_date: new Date('2026-02-17'),
        }),
      ]
      mockData.meetingMinutes = 300
      mockData.subTasks = [
        makeRawSubTask({ id: 'st-mcp', task_id: 'task-mcp', content: 'MCP實作', estimated_minutes: 90, order: 3 }),
        makeRawSubTask({ id: 'st-zentropy', task_id: 'task-mcp', content: '[M2] Zentropy 無摩擦模式', estimated_minutes: 60, order: 1 }),
        makeRawSubTask({ id: 'st-gcr', task_id: 'task-paceriz', content: '研究 GCR 遷移到 AR', estimated_minutes: 60, order: 0 }),
      ]

      const result = await collector.collect('user-1', new Date('2026-02-14'), 'Asia/Tokyo')

      expect(result.candidates).toHaveLength(3)
      expect(result.meetingMinutes).toBe(300)
      expect(result.availableMinutes).toBe(180) // 8*60 - 300

      // Zentropy subtasks 繼承父 task 的 due_date
      const mcpItem = result.candidates.find(c => c.content === 'MCP實作')
      expect(mcpItem?.dueDate).toEqual(new Date('2026-02-15'))
      expect(mcpItem?.daysRemaining).toBe(1)

      vi.useRealTimers()
    })
  })
})
