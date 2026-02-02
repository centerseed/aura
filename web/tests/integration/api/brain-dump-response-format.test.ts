import { describe, it, expect } from 'vitest'
import type { BrainDumpResponse } from '@/infrastructure/api/brain-dump.api'

describe('Brain Dump API Response Format', () => {
  it('應該正確解析 create_new_tasks 回應', () => {
    const mockResponse: BrainDumpResponse = {
      success: true,
      action: 'create_new_tasks',
      items: [
        {
          id: 'task-1',
          title: '測試任務',
          narrative: '這是一個測試任務',
          drawer: 'ACTIVE',
          lifecycle: 'FINITE',
          tag: {
            area: '工作',
            product: '專案 A',
            topic: '開發'
          },
          strategy_used: 'explicit',
          reasoning: 'AI 判斷這是一個工作相關的任務'
        }
      ]
    }

    expect(mockResponse.action).toBe('create_new_tasks')
    expect(mockResponse.items).toHaveLength(1)
    expect(mockResponse.items[0].reasoning).toBe('AI 判斷這是一個工作相關的任務')
  })

  it('應該正確解析 append_sub_item 回應', () => {
    const mockResponse: BrainDumpResponse = {
      success: true,
      action: 'append_sub_item',
      target_task: {
        id: 'task-123',
        content: '準備週報',
        product: '專案 A'
      },
      appended_sub_items: [
        {
          id: 'sub-1',
          content: '整理本週完成的功能',
          completed: false,
          created_at: '2026-02-01T10:00:00Z',
          completed_at: null,
          order: 0
        },
        {
          id: 'sub-2',
          content: '列出下週計畫',
          completed: false,
          created_at: '2026-02-01T10:00:01Z',
          completed_at: null,
          order: 1
        }
      ],
      reasoning: '用戶輸入是簡短的執行步驟，明確是既有任務「準備週報」的子項目'
    }

    expect(mockResponse.action).toBe('append_sub_item')
    expect(mockResponse.target_task.id).toBe('task-123')
    expect(mockResponse.appended_sub_items).toHaveLength(2)
    expect(mockResponse.reasoning).toContain('簡短的執行步驟')
  })

  it('應該支持 TypeScript 類型判別', () => {
    const createResponse: BrainDumpResponse = {
      success: true,
      action: 'create_new_tasks',
      items: []
    }

    const appendResponse: BrainDumpResponse = {
      success: true,
      action: 'append_sub_item',
      target_task: { id: 'x', content: 'y', product: 'z' },
      appended_sub_items: [],
      reasoning: 'test'
    }

    // TypeScript 應該能正確推斷類型
    if (createResponse.action === 'create_new_tasks') {
      expect(createResponse.items).toBeDefined()
      expect(() => createResponse.items[0]).not.toThrow()
    }

    if (appendResponse.action === 'append_sub_item') {
      expect(appendResponse.target_task).toBeDefined()
      expect(appendResponse.reasoning).toBeDefined()
    }
  })
})
