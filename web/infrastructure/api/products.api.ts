/**
 * Products API Client - 產品 API 客戶端
 *
 * 提供類型安全的產品相關 API 調用
 */

import { apiGet, apiPost, apiPatch, apiDelete } from './client'
import type { Product, ReorganizeProposal } from '@/domain/entities/product.entity'

/**
 * 創建產品 DTO
 */
export interface CreateProductDTO {
  areaId: string
  name: string
  description?: string
  status?: 'INBOX' | 'ACTIVE' | 'MAINTAIN' | 'REFERENCE' | 'ARCHIVE'
  lifecycle?: 'FINITE' | 'PERPETUAL'
}

/**
 * 更新產品 DTO
 */
export interface UpdateProductDTO {
  name?: string
  description?: string | null
  status?: 'INBOX' | 'ACTIVE' | 'MAINTAIN' | 'REFERENCE' | 'ARCHIVE'
  lifecycle?: 'FINITE' | 'PERPETUAL'
}

/**
 * 重組建議 DTO
 */
export interface ReorganizeTopicsDTO {
  productName: string
}

/**
 * 應用重組 DTO
 */
export interface ApplyReorganizationDTO {
  proposal: ReorganizeProposal
}

/**
 * 重新排序產品 DTO
 */
export interface ReorderProductsDTO {
  areaId: string
  productIds: string[]
}

/**
 * 恢復最近任務 DTO
 */
export interface RestoreRecentTasksDTO {
  taskIds: string[]
}

/**
 * Products API 客戶端
 *
 * 封裝所有產品相關的 API 調用，提供類型安全的介面
 */
export const ProductsAPI = {
  /**
   * 創建產品
   */
  create: (data: CreateProductDTO) =>
    apiPost<{ success: boolean; product: Product }>('/api/products', data),

  /**
   * 更新產品
   */
  update: (id: string, data: UpdateProductDTO) =>
    apiPatch<Product>(`/api/products/${id}`, data),

  /**
   * 刪除產品（軟刪除）
   */
  delete: (id: string) => apiDelete<void>(`/api/products/${id}`),

  /**
   * 重組主題（獲取 AI 建議）
   */
  reorganizeTopics: (id: string, data: ReorganizeTopicsDTO) =>
    apiPost<ReorganizeProposal>(`/api/products/${id}/reorganize-topics`, data),

  /**
   * 應用重組建議
   */
  applyReorganization: (id: string, data: ApplyReorganizationDTO) =>
    apiPost<{ success: boolean }>(`/api/products/${id}/apply-reorganization`, data),

  /**
   * 恢復最近刪除的任務
   */
  restoreRecentTasks: (id: string, data: RestoreRecentTasksDTO) =>
    apiPost<{ success: boolean; restored: number }>(
      `/api/products/${id}/restore-recent-tasks`,
      data
    ),

  /**
   * 重新排序產品
   */
  reorder: (data: ReorderProductsDTO) =>
    apiPatch<{ success: boolean }>('/api/products/reorder', data),
}
