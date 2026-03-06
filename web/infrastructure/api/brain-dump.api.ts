/**
 * Brain Dump API Client - Brain Dump API 客戶端
 *
 * 提供類型安全的 Brain Dump 相關 API 調用
 */

import { apiPost } from './client'

/**
 * Sub-item 結構
 */
export interface SubItem {
  content: string
}

/**
 * 來源歸因結構
 */
export interface SourceAttribution {
  source_type: 'explicit' | 'inferred_from_context' | 'inferred_from_system'
  confidence: number
  reasoning: string
}

/**
 * Brain Dump 結構化項目
 */
export interface StructuredItem {
  id: string
  title: string
  narrative: string
  drawer: 'INBOX' | 'ACTIVE' | 'MAINTAIN' | 'REFERENCE' | 'ARCHIVE'
  lifecycle: 'FINITE' | 'PERPETUAL'
  tag: {
    area: string
    product: string
    topic: string
  }
  strategy_used: string
  reasoning: string
  due_date?: string
  due_date_source?: SourceAttribution
  inferred_from_milestone?: string
  time_confidence?: number
  sub_items?: SubItem[]
}

/**
 * Brain Dump 請求 DTO
 */
export interface BrainDumpDTO {
  text: string
  session_context?: string[]
}

/**
 * 追加到現有任務的 sub-item 結構
 */
export interface AppendedSubItem {
  id: string
  content: string
  completed: boolean
  created_at: string
  completed_at: string | null
  order: number
}

/**
 * 目標任務資訊
 */
export interface TargetTask {
  id: string
  content: string
  product: string
}

/**
 * Brain Dump 響應 - 創建新任務
 */
export interface CreateNewTasksResponse {
  success: boolean
  action: 'create_new_tasks'
  items: StructuredItem[]
}

/**
 * Brain Dump 響應 - 追加 sub-item
 */
export interface AppendSubItemResponse {
  success: boolean
  action: 'append_sub_item'
  target_task: TargetTask
  appended_sub_items: AppendedSubItem[]
  reasoning: string
}

/**
 * Brain Dump 響應（判別聯合類型）
 */
export type BrainDumpResponse = CreateNewTasksResponse | AppendSubItemResponse

/**
 * Brain Dump API 客戶端
 *
 * 封裝 Brain Dump 相關的 API 調用，提供類型安全的介面
 */
export const BrainDumpAPI = {
  /**
   * 處理 Brain Dump 輸入
   */
  process: (data: BrainDumpDTO) => apiPost<BrainDumpResponse>('/api/brain-dump', data),
}
