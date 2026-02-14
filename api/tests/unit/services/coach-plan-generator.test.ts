/**
 * CoachPlanGenerator prompt 品質測試
 *
 * 驗證 prompt 包含關鍵上下文，確保 AI 能做出合理決策
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CoachPlanGenerator } from '@/application/services/coach-plan-generator'
import type { PlanCandidate, MilestoneContext } from '@/application/services/plan-candidate-collector'

// Mock AI SDK — 攔截 prompt，不實際呼叫 AI
vi.mock('ai', () => ({
  generateObject: vi.fn().mockResolvedValue({
    object: {
      daily_plan: [],
      capacity_note: '',
      coach_message: '',
      overflow_items: [],
      scheduling: [],
    },
  }),
}))

vi.mock('@ai-sdk/google', () => ({
  google: vi.fn().mockReturnValue('mock-model'),
}))

// ============================================================================
// Helpers
// ============================================================================

function makeCandidate(overrides: Partial<PlanCandidate> = {}): PlanCandidate {
  return {
    itemType: 'subtask',
    taskId: 'task-1',
    subTaskId: 'st-1',
    content: '測試任務',
    areaName: '產品',
    productName: 'Naruvia',
    productDescription: null,
    taskContent: '父任務',
    subTaskOrder: 1,
    estimatedMinutes: 60,
    dueDate: null,
    startDate: null,
    daysOverdue: null,
    daysRemaining: null,
    daysStagnant: 0,
    milestoneId: null,
    dateSource: null,
    ...overrides,
  }
}

// ============================================================================
// Tests
// ============================================================================

describe('CoachPlanGenerator', () => {
  let generator: CoachPlanGenerator

  beforeEach(() => {
    generator = new CoachPlanGenerator()
  })

  describe('prompt 包含日期上下文', () => {
    it('prompt 應包含今天的日期和星期幾', async () => {
      const { prompt } = await generator.generate(
        [makeCandidate()], 480, 0,
      )

      // 應包含日期
      const today = new Date()
      const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
      expect(prompt).toContain(dateStr)

      // 應包含星期幾
      expect(prompt).toMatch(/星期[日一二三四五六]/)
    })

    it('週末時 prompt 應包含週末提醒', async () => {
      // 用 fake timer 模擬週六
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-02-14T10:00:00')) // 星期六

      const { prompt } = await generator.generate(
        [makeCandidate()], 480, 0,
      )

      expect(prompt).toContain('今天是週末')
      expect(prompt).toContain('政府機關')
      expect(prompt).toContain('週末不開放')

      vi.useRealTimers()
    })

    it('週間時 prompt 不應包含週末提醒', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-02-16T10:00:00')) // 星期一

      const { prompt } = await generator.generate(
        [makeCandidate()], 480, 0,
      )

      expect(prompt).not.toContain('今天是週末')

      vi.useRealTimers()
    })
  })

  describe('prompt 包含容量警告', () => {
    it('可用時間 <= 180 分鐘時應有警告', async () => {
      const { prompt } = await generator.generate(
        [makeCandidate()], 180, 300,
      )

      expect(prompt).toContain('可用時間很少')
      expect(prompt).toContain('1-3 項')
    })

    it('可用時間充足時不應有警告', async () => {
      const { prompt } = await generator.generate(
        [makeCandidate()], 480, 0,
      )

      expect(prompt).not.toContain('可用時間很少')
    })
  })

  describe('prompt 排序原則品質', () => {
    it('應指示 AI 考慮任務的現實可行性', async () => {
      const { prompt } = await generator.generate(
        [makeCandidate()], 480, 0,
      )

      expect(prompt).toContain('現實可行性')
    })

    it('應指示剩餘天數 > 7 天的任務放入 overflow', async () => {
      const { prompt } = await generator.generate(
        [makeCandidate()], 480, 0,
      )

      expect(prompt).toContain('7 天')
      expect(prompt).toContain('overflow_items')
    })
  })

  describe('候選項目緊急度標記', () => {
    it('逾期任務應標記 ⚠️', async () => {
      const { prompt } = await generator.generate(
        [makeCandidate({ daysOverdue: 3, daysRemaining: null })],
        480, 0,
      )

      expect(prompt).toContain('⚠️ 逾期 3 天')
    })

    it('3天內到期應標記 🔶', async () => {
      const { prompt } = await generator.generate(
        [makeCandidate({ daysRemaining: 2 })],
        480, 0,
      )

      expect(prompt).toContain('🔶 剩 2 天')
    })

    it('超過3天的只顯示剩餘天數', async () => {
      const { prompt } = await generator.generate(
        [makeCandidate({ daysRemaining: 5 })],
        480, 0,
      )

      expect(prompt).toContain('剩 5 天')
      expect(prompt).not.toContain('🔶 剩 5 天')
    })
  })

  describe('真實場景: 2/14 星期六，3小時可用', () => {
    it('prompt 應讓 AI 有足夠資訊做出合理判斷', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-02-14T10:00:00'))

      // 模擬真實候選數據
      const candidates: PlanCandidate[] = [
        makeCandidate({
          subTaskId: 'st-mcp',
          content: 'MCP實作',
          productName: 'Zentropy',
          daysRemaining: 1,
          estimatedMinutes: 90,
        }),
        makeCandidate({
          subTaskId: 'st-zentropy',
          content: '[M2] Zentropy 無摩擦模式',
          productName: 'Zentropy',
          daysRemaining: 1,
          estimatedMinutes: 60,
        }),
        makeCandidate({
          subTaskId: 'st-paceriz',
          content: '研究 GCR 遷移到 AR 的可行性與影響',
          productName: 'Paceriz',
          daysRemaining: 3,
          estimatedMinutes: 60,
        }),
      ]

      const { prompt } = await generator.generate(
        candidates, 180, 300,
      )

      // 應包含關鍵判斷資訊
      expect(prompt).toContain('星期六')
      expect(prompt).toContain('今天是週末')
      expect(prompt).toContain('可用時間很少')
      expect(prompt).toContain('180 分鐘')
      expect(prompt).toContain('🔶 剩 1 天')
      expect(prompt).toContain('🔶 剩 3 天')

      vi.useRealTimers()
    })
  })
})
