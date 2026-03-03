/**
 * Milestone Entity - 里程碑領域實體
 *
 * 統一定義 Milestone 類型
 * 原本重複定義在：
 * - types/index.ts
 * - components/gantt-view.tsx
 */

export type MilestoneStatus =
  | 'planned'
  | 'in_progress'
  | 'completed'
  | 'delayed'

export type EntityType = 'AREA' | 'PRODUCT' | 'TOPIC'

/**
 * Milestone - 里程碑
 */
export interface Milestone {
  id: string
  user_id: string
  name: string
  target_date: string
  status: MilestoneStatus
  entity_type: EntityType
  entity_id: string
  description: string | null
  created_at: string
  updated_at: string
  // 關聯實體 (根據 entity_type 其中一個會有值)
  product?: { id: string; name: string } | null
  area?: { id: string; name: string } | null
  topic?: { id: string; name: string } | null
}
