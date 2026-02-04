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

/**
 * Product - 資產/專案（L2）
 */
export interface Product {
  id: string
  user_id: string
  area_id: string
  name: string
  description: string | null
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
  task_ids: string[]
}

export interface TaskConsolidation {
  parent_task_id: string
  sub_task_ids: string[]
  consolidated_title: string
  reasoning: string
}

export interface TaskContext {
  id: string
  title: string
  current_topic: string
  current_due_date: string | null
  c_role?: 'p' | 's' // p=parent, s=sub
}

export interface ReorganizeProposal {
  product_id: string
  product_name: string
  current_topics: string[]
  current_topic_count?: number
  proposed_clusters: TopicCluster[]
  task_consolidations?: TaskConsolidation[]
  tasks_context?: TaskContext[]
  logId?: string
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
