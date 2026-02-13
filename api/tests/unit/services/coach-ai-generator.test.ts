/**
 * CoachAIGenerator 單元測試
 *
 * Mock generateObject 來測試 prompt 建構和輸出轉換
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { CoachAIInput } from '@/application/services/coach-ai-generator'

// Mock ai SDK
vi.mock('ai', () => ({
  generateObject: vi.fn(),
}))

vi.mock('@ai-sdk/google', () => ({
  google: vi.fn(() => 'mock-model'),
}))

import { CoachAIGenerator } from '@/application/services/coach-ai-generator'
import { generateObject } from 'ai'

const mockGenerateObject = generateObject as any

function makeInput(overrides: Partial<CoachAIInput> = {}): CoachAIInput {
  return {
    type: 'MORNING',
    calendarEvents: [],
    overdueTasks: [],
    approachingTasks: [],
    conflicts: [],
    stagnations: [],
    completedTasks: [],
    remainingTasks: [],
    tomorrowPreview: [],
    ...overrides,
  }
}

describe('CoachAIGenerator', () => {
  let generator: CoachAIGenerator

  beforeEach(() => {
    generator = new CoachAIGenerator()
    vi.clearAllMocks()
  })

  describe('晨報生成', () => {
    it('應該呼叫 generateObject 並回傳格式化結果', async () => {
      mockGenerateObject.mockResolvedValue({
        object: {
          summary: '今天有 3 個會議和 2 個逾期任務需要處理。',
          recommendations: [
            {
              priority: 1,
              action: '先處理逾期的報告',
              reasoning: '已逾期 3 天',
              related_task_id: 'task-1',
            },
          ],
        },
      })

      const result = await generator.generate(makeInput({ type: 'MORNING' }))

      expect(mockGenerateObject).toHaveBeenCalledTimes(1)
      expect(result.summary).toBe('今天有 3 個會議和 2 個逾期任務需要處理。')
      expect(result.recommendations).toHaveLength(1)
      expect(result.recommendations[0].priority).toBe(1)
      expect(result.deferSuggestions).toHaveLength(0) // 晨報沒有 defer
    })
  })

  describe('晚報生成', () => {
    it('應該包含 defer_suggestions', async () => {
      mockGenerateObject.mockResolvedValue({
        object: {
          summary: '今天完成了 5 個任務，還有 3 個待處理。',
          recommendations: [
            {
              priority: 1,
              action: '明天優先處理客戶回饋',
              reasoning: '已延遲 2 天',
              related_task_id: 'task-2',
            },
          ],
          defer_suggestions: [
            {
              task_id: 'task-3',
              task_content: '更新文件',
              suggested_action: 'defer',
              reasoning: '非緊急，可延後一週',
            },
          ],
        },
      })

      const result = await generator.generate(makeInput({ type: 'EVENING' }))

      expect(result.deferSuggestions).toHaveLength(1)
      expect(result.deferSuggestions[0].suggested_action).toBe('defer')
    })
  })

  describe('Prompt 建構', () => {
    it('逾期任務應該出現在 prompt 中', async () => {
      mockGenerateObject.mockResolvedValue({
        object: {
          summary: 'test',
          recommendations: [{ priority: 1, action: 'test', reasoning: 'test', related_task_id: null }],
        },
      })

      const input = makeInput({
        overdueTasks: [{
          id: 'task-overdue',
          content: '提交報告',
          status: 'ACTIVE',
          due_date: '2026-02-07',
          area_name: '工作',
          product_name: '專案 X',
          days_overdue: 2,
          days_remaining: null,
          days_stagnant: null,
          urgency_level: 'high',
        }],
      })

      await generator.generate(input)

      // 驗證 prompt 中包含逾期任務
      const call = mockGenerateObject.mock.calls[0][0]
      expect(call.prompt).toContain('提交報告')
      expect(call.prompt).toContain('逾期')
    })

    it('衝突應該出現在 prompt 中', async () => {
      mockGenerateObject.mockResolvedValue({
        object: {
          summary: 'test',
          recommendations: [{ priority: 1, action: 'test', reasoning: 'test', related_task_id: null }],
        },
      })

      const input = makeInput({
        conflicts: [{
          type: 'time_overlap',
          severity: 'high',
          description: '「會議 A」和「會議 B」時間重疊',
          involved_items: [],
        }],
      })

      await generator.generate(input)

      const call = mockGenerateObject.mock.calls[0][0]
      expect(call.prompt).toContain('會議 A')
      expect(call.prompt).toContain('衝突')
    })
  })
})
