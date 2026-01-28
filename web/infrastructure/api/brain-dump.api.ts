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
  time_reasoning?: string
  sub_items?: SubItem[]
}

/**
 * Brain Dump 請求 DTO
 */
export interface BrainDumpDTO {
  text: string
}

/**
 * Brain Dump 響應
 */
export interface BrainDumpResponse {
  success: boolean
  items: StructuredItem[]
}

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
