/**
 * Task Entity - 任務領域實體
 *
 * 統一定義 Task、SubItem、Reference 類型
 * 消除重複定義（原本在 types/index.ts 和多個 API 路由中重複）
 */

import type { DrawerStatus } from '../value-objects/drawer-status'
import type { LifecycleStatus } from '../value-objects/lifecycle'
import type { Product } from './product.entity'

/**
 * Reference - 參考資料
 *
 * 原本重複定義在：
 * - types/index.ts
 * - app/api/tasks/[taskId]/references/route.ts
 * - app/api/tasks/[taskId]/merge-into/route.ts
 */
export interface Reference {
  id: string
  type: 'url' | 'note'
  content: string
  title?: string | null
  created_at: string
}

/**
 * SubItem - 子任務項目
 *
 * 原本重複定義在：
 * - types/index.ts
 * - app/api/tasks/[taskId]/sub-items/route.ts
 * - app/api/brain-dump/route.ts
 */
export interface SubItem {
  id: string
  content: string
  completed: boolean
  created_at: string
  completed_at: string | null
  order: number
  start_date?: string | null
  due_date?: string | null
}

/**
 * SubItemsMeta - 子任務統計資訊
 */
export interface SubItemsMeta {
  total: number
  completed: number
  completion_rate: number // 0.0-1.0
}

/**
 * Task - 任務核心實體
 */
export interface Task {
  id: string
  user_id: string
  product_id: string
  topic_id: string | null
  content: string
  status: DrawerStatus
  lifecycle: LifecycleStatus
  ai_analysis: {
    narrative?: string
    strategy_used?: string
    reasoning?: string
    merged_items?: string[]
    sub_items?: SubItem[]
    sub_items_meta?: SubItemsMeta
  }
  references: Reference[]
  created_at: string
  updated_at: string
  // Relations
  product?: Product
  topic?: Topic
}

/**
 * Topic - 主題模組
 */
export interface Topic {
  id: string
  user_id: string
  product_id: string
  name: string
  created_at: string
  // Relations
  product?: Product
}

/**
 * TaskTag - 任務標籤（用於 UI 顯示）
 */
export interface TaskTag {
  area: string
  product: string
  topic: string
}

/**
 * TaskCard - 任務卡片（UI 視圖模型）
 *
 * 用於 Kanban 和其他 UI 組件的簡化任務表示
 */
export interface TaskCard {
  id: string
  title: string
  narrative: string | null
  drawer: DrawerStatus
  lifecycle: LifecycleStatus
  tag: TaskTag
  strategy_used: string | null
  reasoning: string | null
  start_date?: string | null
  due_date?: string | null
  time_confidence?: number | null
  inferred_from_milestone?: string | null
  // Raw fields for matching
  product_id?: string
  // Timestamps
  created_at?: string | null
  updated_at?: string | null
  // Sub-items support
  sub_items?: SubItem[]
  sub_items_meta?: SubItemsMeta
  // References support
  references?: Reference[]
  // AI analysis 完整結構
  ai_analysis?: {
    narrative?: string
    strategy_used?: string
    reasoning?: string
    merged_items?: string[]
    sub_items?: SubItem[]
    sub_items_meta?: SubItemsMeta
  }
}

/**
 * Kanban Column 結構
 */
export interface KanbanColumn {
  id: string
  title: string
  tasks: TaskCard[]
}

/**
 * StructuredOutput - AI 處理後的結構化輸出
 */
export interface StructuredOutput {
  items: Array<{
    title: string
    narrative: string
    drawer: DrawerStatus
    lifecycle: LifecycleStatus
    tag: TaskTag
    strategy_used: string
    reasoning: string
  }>
}
