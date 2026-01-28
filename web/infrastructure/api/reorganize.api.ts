/**
 * Reorganize API Client - 全局重組 API 客戶端
 *
 * 提供類型安全的全局重組相關 API 調用
 */

import { apiPost } from './client'

/**
 * 合併建議
 */
export interface MergeSuggestion {
  reason: string
  target_area: string
  source_areas: string[]
  target_product: string
  source_products: string[]
}

/**
 * 重新分類建議
 */
export interface ReclassificationSuggestion {
  task_id: string
  task_title: string
  current_area: string
  current_product: string
  new_area: string
  new_product: string
  reason: string
}

/**
 * 重組結果
 */
export interface ReorganizeResult {
  analysis: string
  merges: MergeSuggestion[]
  reclassifications: ReclassificationSuggestion[]
}

/**
 * 重組請求 DTO
 */
export interface ReorganizeDTO {
  preview?: boolean
  confirmed?: boolean
  selected_operation_ids?: string[] | null
}

/**
 * 重組響應（預覽模式）
 */
export interface ReorganizePreviewResponse {
  success: boolean
  result: ReorganizeResult
}

/**
 * 重組響應（確認模式）
 */
export interface ReorganizeConfirmResponse {
  success: boolean
  changes: {
    merges: number
    reclassifications: number
  }
}

/**
 * Reorganize API 客戶端
 *
 * 封裝全局重組相關的 API 調用，提供類型安全的介面
 */
export const ReorganizeAPI = {
  /**
   * 獲取重組預覽（preview 模式）
   */
  preview: () =>
    apiPost<ReorganizePreviewResponse>('/api/reorganize', { preview: true }),

  /**
   * 執行重組操作（confirmed 模式）
   */
  confirm: (selectedOperationIds?: string[] | null) =>
    apiPost<ReorganizeConfirmResponse>('/api/reorganize', {
      confirmed: true,
      selected_operation_ids: selectedOperationIds,
    }),
}
