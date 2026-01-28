/**
 * Areas API Client - 區域 API 客戶端
 *
 * 提供類型安全的區域相關 API 調用
 */

import { apiGet, apiPost, apiPatch, apiDelete } from './client'
import type { Area } from '@/domain/entities/product.entity'

/**
 * 創建區域 DTO
 */
export interface CreateAreaDTO {
  name: string
  scope?: string
  description?: string
}

/**
 * 更新區域 DTO
 */
export interface UpdateAreaDTO {
  name?: string
  scope?: string
  description?: string
}

/**
 * Areas API 客戶端
 *
 * 封裝所有區域相關的 API 調用，提供類型安全的介面
 */
export const AreasAPI = {
  /**
   * 獲取所有區域
   */
  getAll: () => apiGet<Area[]>('/api/areas'),

  /**
   * 獲取單個區域
   */
  getById: (id: string) => apiGet<Area>(`/api/areas/${id}`),

  /**
   * 創建區域
   */
  create: (data: CreateAreaDTO) =>
    apiPost<{ success: boolean; area: Area; created?: boolean; updated?: boolean }>(
      '/api/areas',
      data
    ),

  /**
   * 更新區域
   */
  update: (id: string, data: UpdateAreaDTO) => apiPatch<Area>(`/api/areas/${id}`, data),

  /**
   * 刪除區域（軟刪除）
   */
  delete: (id: string) => apiDelete<void>(`/api/areas/${id}`),
}
