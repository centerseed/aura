import { describe, it, expect } from 'vitest'
import { z } from 'zod'

// 複製後端的 Schema 定義以驗證長度限制
describe('Brain Dump Schema 長度限制驗證', () => {
  const SubItemSchema = z.object({
    content: z.string().max(100), // 更新為 100
  })

  const SourceAttributionSchema = z.object({
    source_type: z.enum(['explicit', 'inferred_from_context', 'inferred_from_system']),
    confidence: z.number().min(0).max(1),
    reasoning: z.string().max(80), // 更新為 80
  })

  const StructuredItemSchema = z.object({
    title: z.string().max(50),
    narrative: z.string().max(100), // 更新為 100
    drawer: z.enum(['INBOX', 'ACTIVE', 'MAINTAIN', 'REFERENCE', 'ARCHIVE']),
    lifecycle: z.enum(['FINITE', 'PERPETUAL']),
    tag: z.object({
      area: z.string().max(30),
      product: z.string().max(50),
      topic: z.string().max(50),
    }),
    strategy_used: z.string().max(50),
    reasoning: z.string().max(100), // 更新為 100
    due_date: z.string().datetime({ offset: true }).optional(),
    due_date_source: SourceAttributionSchema.optional(),
    time_confidence: z.number().min(0).max(1).optional(),
    sub_items: z.array(SubItemSchema).optional(),
  })

  const AppendSubItemActionSchema = z.object({
    action: z.literal('append_sub_item'),
    target_task_id: z.string(),
    sub_items: z.array(SubItemSchema),
    reasoning: z.string().max(100), // 更新為 100
  })

  describe('StructuredItemSchema', () => {
    it('應該接受符合長度限制的資料', () => {
      const validData = {
        title: '準備週報',
        narrative: '整理本週完成的所有功能並準備週報',
        drawer: 'ACTIVE' as const,
        lifecycle: 'FINITE' as const,
        tag: {
          area: '工作',
          product: '專案 A',
          topic: '管理'
        },
        strategy_used: 'boundary_match',
        reasoning: '根據專案名稱判斷為工作相關任務'
      }

      expect(() => StructuredItemSchema.parse(validData)).not.toThrow()
    })

    it('應該拒絕過長的 title（超過 50 字元）', () => {
      const invalidData = {
        title: 'A'.repeat(51), // 51 個字元
        narrative: '測試',
        drawer: 'ACTIVE' as const,
        lifecycle: 'FINITE' as const,
        tag: { area: '工作', product: '專案', topic: '測試' },
        strategy_used: 'test',
        reasoning: '測試'
      }

      expect(() => StructuredItemSchema.parse(invalidData)).toThrow()
    })

    it('應該拒絕過長的 reasoning（超過 100 字元）', () => {
      const invalidData = {
        title: '測試任務',
        narrative: '測試',
        drawer: 'ACTIVE' as const,
        lifecycle: 'FINITE' as const,
        tag: { area: '工作', product: '專案', topic: '測試' },
        strategy_used: 'test',
        reasoning: 'A'.repeat(101) // 101 個字元
      }

      expect(() => StructuredItemSchema.parse(invalidData)).toThrow()
    })

    it('應該拒絕過長的 narrative（超過 100 字元）', () => {
      const invalidData = {
        title: '測試任務',
        narrative: 'A'.repeat(101), // 101 個字元
        drawer: 'ACTIVE' as const,
        lifecycle: 'FINITE' as const,
        tag: { area: '工作', product: '專案', topic: '測試' },
        strategy_used: 'test',
        reasoning: '測試'
      }

      expect(() => StructuredItemSchema.parse(invalidData)).toThrow()
    })

    it('應該拒絕過長的 tag.area（超過 30 字元）', () => {
      const invalidData = {
        title: '測試任務',
        narrative: '測試',
        drawer: 'ACTIVE' as const,
        lifecycle: 'FINITE' as const,
        tag: {
          area: 'A'.repeat(31), // 31 個字元
          product: '專案',
          topic: '測試'
        },
        strategy_used: 'test',
        reasoning: '測試'
      }

      expect(() => StructuredItemSchema.parse(invalidData)).toThrow()
    })

  })

  describe('SubItemSchema', () => {
    it('應該接受符合長度的 sub-item', () => {
      const validSubItem = {
        content: '整理資料'
      }

      expect(() => SubItemSchema.parse(validSubItem)).not.toThrow()
    })

    it('應該拒絕過長的 sub-item content（超過 100 字元）', () => {
      const invalidSubItem = {
        content: 'A'.repeat(101)
      }

      expect(() => SubItemSchema.parse(invalidSubItem)).toThrow()
    })
  })

  describe('AppendSubItemActionSchema', () => {
    it('應該接受符合長度的 append reasoning', () => {
      const validData = {
        action: 'append_sub_item' as const,
        target_task_id: 'task-123',
        sub_items: [{ content: '整理資料' }],
        reasoning: '用戶輸入是簡短的執行步驟，明確是既有任務的子項目'
      }

      expect(() => AppendSubItemActionSchema.parse(validData)).not.toThrow()
    })

    it('應該拒絕過長的 append reasoning（超過 100 字元）', () => {
      const invalidData = {
        action: 'append_sub_item' as const,
        target_task_id: 'task-123',
        sub_items: [{ content: '整理資料' }],
        reasoning: 'A'.repeat(101)
      }

      expect(() => AppendSubItemActionSchema.parse(invalidData)).toThrow()
    })
  })

  describe('SourceAttributionSchema', () => {
    it('應該拒絕過長的 source reasoning（超過 80 字元）', () => {
      const invalidData = {
        source_type: 'explicit' as const,
        confidence: 0.9,
        reasoning: 'A'.repeat(81)
      }

      expect(() => SourceAttributionSchema.parse(invalidData)).toThrow()
    })
  })
})
