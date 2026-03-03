/**
 * Product Entity - 產品/專案領域實體
 *
 * 統一定義 Area、Product、Topic 類型
 */

/**
 * Area - 領域/身分（L1）
 */
export interface Area {
  id: string
  user_id: string
  name: string
  scope: string | null
  description: string | null
  is_custom: boolean
  created_at: string
}

export type ProductPriority = 'P0' | 'P1' | 'P2' | 'P3'

/**
 * Product - 資產/專案（L2）
 */
export interface Product {
  id: string
  user_id: string
  area_id: string
  name: string
  description: string | null
  priority: ProductPriority
  created_at: string
  // Relations
  area?: Area
}

/**
 * ReorganizeProposal - 產品重組提案
 *
 * 原本重複定義在：
 * - types/index.ts
 * - components/reorganize-modal.tsx
 */
export interface TopicCluster {
  topic_name: string
  description: string
  task_ids: string[]
  confidence: number
}

export interface TaskTimeInference {
  task_id: string
  suggested_due_date: string | null
  inferred_from_milestone_id: string | null
  time_confidence: number
  urgency_level: 'critical' | 'high' | 'medium' | 'low'
  reasoning: string
}

export interface TaskConsolidation {
  parent_task_id: string
  sub_task_ids: string[]
  consolidated_title: string
  consolidated_narrative: string
  reasoning: string
  confidence: number
}

export interface TaskContext {
  id: string
  title: string
  current_topic: string
  current_due_date: string | null
}

export interface ReorganizeProposal {
  product_id: string
  product_name: string
  current_topics: string[]
  current_topic_count?: number
  proposed_clusters: TopicCluster[]
  time_inferences: TaskTimeInference[]
  task_consolidations?: TaskConsolidation[]
  tasks_context?: TaskContext[]
  reasoning: string
}

/**
 * GovernanceAction - 治理操作（用於產品/區域的調整）
 */
export interface GovernanceAction {
  action_type: string
  target_id?: string
  old_name?: string
  new_name?: string
  target_area?: string
  context?: string
}
