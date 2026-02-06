/**
 * reorganize-prompt 單元測試
 */

import { describe, it, expect } from 'vitest'
import {
  buildReorganizePrompt,
  type ReorganizePromptContext,
} from '@/lib/reorganize-prompt'

describe('buildReorganizePrompt', () => {
  // 建立標準測試資料
  const baseContext: ReorganizePromptContext = {
    product_name: '測試產品',
    area_name: '測試領域',
    current_topics: ['UI 改進', 'Bug 修復', '效能優化'],
    tasks: [
      {
        id: 'task-001',
        content: '實作登入頁面',
        narrative: '需要設計 UI 與驗證邏輯',
        current_topic: 'UI 改進',
        status: 'ACTIVE',
        current_due_date: '2025-01-20',
        has_sub_items: false,
        completed_sub_items: [],
        pending_sub_items: [],
      },
      {
        id: 'task-002',
        content: '修復資料庫連線問題',
        narrative: '',
        current_topic: 'Bug 修復',
        status: 'ACTIVE',
        current_due_date: null,
        has_sub_items: false,
        completed_sub_items: [],
        pending_sub_items: [],
      },
      {
        id: 'task-003',
        content: '優化查詢效能',
        narrative: '減少 N+1 查詢',
        current_topic: '效能優化',
        status: 'MAINTAIN',
        current_due_date: null,
        has_sub_items: true,
        completed_sub_items: ['分析慢查詢', '新增索引'],
        pending_sub_items: [
          { id: 'sub-003-001', content: '測試效能改善' },
          { id: 'sub-003-002', content: '更新文件' },
        ],
      },
    ],
    milestones: [
      {
        id: 'milestone-001',
        name: 'MVP 上線',
        target_date: '2025-02-01',
        status: 'ACTIVE',
        priority: 1,
        description: '最小可行產品',
      },
    ],
    today: '2025-01-15',
  }

  describe('Snapshot 測試（確保格式穩定）', () => {
    it('應該生成完整的重組 prompt（包含所有必要章節）', () => {
      const prompt = buildReorganizePrompt(baseContext)

      // Snapshot 測試
      expect(prompt).toMatchSnapshot()

      // 額外驗證關鍵章節都存在
      expect(prompt).toContain('你是任務組織專家')
      expect(prompt).toContain('# 背景')
      expect(prompt).toContain('## Tasks')
      expect(prompt).toContain('# ⚠️ 核心原則')
      expect(prompt).toContain('# 任務 1: Topic 分群')
      expect(prompt).toContain('# 任務 2: 結構優化')
      expect(prompt).toContain('# 輸出規則')
    })
  })

  describe('結構驗證（不依賴完全相等）', () => {
    it('應該包含 Product 和 Area 資訊', () => {
      const prompt = buildReorganizePrompt(baseContext)

      expect(prompt).toContain('Product: "測試產品"')
      expect(prompt).toContain('Area: 測試領域')
    })

    it('應該顯示現有分類資訊', () => {
      const prompt = buildReorganizePrompt(baseContext)

      expect(prompt).toContain('**現有分類數量**: 3 個')
      expect(prompt).toContain('**現有分類**: UI 改進、Bug 修復、效能優化')
    })

    it('應該顯示任務總數', () => {
      const prompt = buildReorganizePrompt(baseContext)

      expect(prompt).toContain('## Tasks (共 3 個)')
    })
  })

  describe('核心業務邏輯', () => {
    it('應該正確分類「可整合任務」和「已有結構任務」', () => {
      const prompt = buildReorganizePrompt(baseContext)

      // 驗證章節標題
      expect(prompt).toContain('## 可整合的任務（只能使用這些 task_id）')
      expect(prompt).toContain('## 已有結構的任務（絕對不可整合）')

      // 驗證可整合任務（無 sub_items）
      expect(prompt).toContain('[task-001] 實作登入頁面')
      expect(prompt).toContain('[task-002] 修復資料庫連線問題')

      // 驗證已有結構任務（has_sub_items = true）
      expect(prompt).toContain('[task-003] 優化查詢效能')
      expect(prompt).toContain('已有結構，不可整合')
    })

    it('應該正確編號任務（可整合在前，不可整合在後）', () => {
      const prompt = buildReorganizePrompt(baseContext)

      // 可整合任務：1, 2
      const match1 = prompt.match(/1\. \[task-001\]/)
      const match2 = prompt.match(/2\. \[task-002\]/)

      expect(match1).not.toBeNull()
      expect(match2).not.toBeNull()

      // 已有結構任務：3（2 + 1）
      const match3 = prompt.match(/3\. \[task-003\]/)
      expect(match3).not.toBeNull()
    })

    it('應該為「已有結構任務」顯示完整的 sub-items 樹狀圖', () => {
      const prompt = buildReorganizePrompt(baseContext)

      // 驗證樹狀結構符號
      expect(prompt).toContain('├─')
      expect(prompt).toContain('└─')

      // 驗證 completed_sub_items（前面的項目用 ├─）
      expect(prompt).toContain('├─ 分析慢查詢')
      expect(prompt).toContain('├─ 新增索引')

      // 驗證 pending_sub_items（倒數第二個用 ├─，最後一個用 └─）
      expect(prompt).toContain('├─ 測試效能改善')
      expect(prompt).toContain('└─ 更新文件')
    })

    it('應該正確處理沒有 narrative 的任務', () => {
      const prompt = buildReorganizePrompt(baseContext)

      // task-001 有 narrative
      expect(prompt).toContain('[task-001] 實作登入頁面 - 需要設計 UI 與驗證邏輯')

      // task-002 無 narrative（不應該有多餘的 " - "）
      expect(prompt).toContain('[task-002] 修復資料庫連線問題 (Bug 修復)')
      expect(prompt).not.toContain('[task-002] 修復資料庫連線問題 -  (Bug 修復)')
    })
  })

  describe('邊界條件', () => {
    it('應該處理空任務列表（不崩潰）', () => {
      const emptyContext: ReorganizePromptContext = {
        ...baseContext,
        tasks: [],
      }

      const prompt = buildReorganizePrompt(emptyContext)

      expect(prompt).toContain('## Tasks (共 0 個)')
      expect(prompt).toBeDefined()
      expect(prompt.length).toBeGreaterThan(0)
    })

    it('應該處理空 milestones 列表', () => {
      const context: ReorganizePromptContext = {
        ...baseContext,
        milestones: [],
      }

      const prompt = buildReorganizePrompt(context)

      expect(prompt).toBeDefined()
      expect(prompt.length).toBeGreaterThan(0)
    })

    it('應該處理只有「可整合任務」的情況', () => {
      const context: ReorganizePromptContext = {
        ...baseContext,
        tasks: [
          {
            id: 'task-001',
            content: '任務 1',
            narrative: '',
            current_topic: 'Topic A',
            status: 'ACTIVE',
            current_due_date: null,
            has_sub_items: false,
            completed_sub_items: [],
            pending_sub_items: [],
          },
        ],
      }

      const prompt = buildReorganizePrompt(context)

      expect(prompt).toContain('## 可整合的任務')
      expect(prompt).not.toContain('## 已有結構的任務')
    })

    it('應該處理只有「已有結構任務」的情況', () => {
      const context: ReorganizePromptContext = {
        ...baseContext,
        tasks: [
          {
            id: 'task-003',
            content: '任務 3',
            narrative: '',
            current_topic: 'Topic C',
            status: 'ACTIVE',
            current_due_date: null,
            has_sub_items: true,
            completed_sub_items: ['子項目 1'],
            pending_sub_items: [{ id: 'sub-001', content: '子項目 2' }],
          },
        ],
      }

      const prompt = buildReorganizePrompt(context)

      expect(prompt).not.toContain('## 可整合的任務')
      expect(prompt).toContain('## 已有結構的任務')
      // 編號從 1 開始（即使沒有可整合任務）
      expect(prompt).toContain('1. [task-003]')
    })

    it('應該處理空 current_topics 列表', () => {
      const context: ReorganizePromptContext = {
        ...baseContext,
        current_topics: [],
      }

      const prompt = buildReorganizePrompt(context)

      expect(prompt).toContain('**現有分類數量**: 0 個')
      expect(prompt).toContain('**現有分類**: ')
    })
  })

  describe('樹狀圖邏輯驗證', () => {
    it('應該正確處理只有一個 sub-item 的任務（使用 └─）', () => {
      const context: ReorganizePromptContext = {
        ...baseContext,
        tasks: [
          {
            id: 'task-single',
            content: '單子項目任務',
            narrative: '',
            current_topic: 'Topic',
            status: 'ACTIVE',
            current_due_date: null,
            has_sub_items: true,
            completed_sub_items: [],
            pending_sub_items: [{ id: 'sub-001', content: '唯一的子項目' }],
          },
        ],
      }

      const prompt = buildReorganizePrompt(context)

      // 只有一個子項目時應該用 └─
      expect(prompt).toContain('└─ 唯一的子項目')
      expect(prompt).not.toContain('├─ 唯一的子項目')
    })

    it('應該正確處理混合 completed 和 pending sub-items', () => {
      const context: ReorganizePromptContext = {
        ...baseContext,
        tasks: [
          {
            id: 'task-mixed',
            content: '混合子項目任務',
            narrative: '',
            current_topic: 'Topic',
            status: 'ACTIVE',
            current_due_date: null,
            has_sub_items: true,
            completed_sub_items: ['已完成 1', '已完成 2'],
            pending_sub_items: [
              { id: 'sub-001', content: '進行中 1' },
              { id: 'sub-002', content: '進行中 2' },
            ],
          },
        ],
      }

      const prompt = buildReorganizePrompt(context)

      // completed 在前
      expect(prompt).toContain('├─ 已完成 1')
      expect(prompt).toContain('├─ 已完成 2')

      // pending 在後（最後一個用 └─）
      expect(prompt).toContain('├─ 進行中 1')
      expect(prompt).toContain('└─ 進行中 2')
    })
  })
})
