/**
 * Milestones API Client - 里程碑 API 客戶端
 *
 * 提供類型安全的里程碑相關 API 調用
 */

import { apiGet, apiPost, apiPatch, apiDelete } from './client'
import type { Milestone } from '@/domain/entities/milestone.entity'

/**
 * 創建里程碑 DTO
 */
export interface CreateMilestoneDTO {
  name: string
  target_date: string
  entity_type: 'AREA' | 'PRODUCT' | 'TOPIC'
  entity_id: string
  priority?: number
  description?: string
  status?: 'planned' | 'in_progress' | 'completed' | 'delayed'
}

/**
 * 更新里程碑 DTO
 */
export interface UpdateMilestoneDTO {
  name?: string
  target_date?: string
  status?: 'planned' | 'in_progress' | 'completed' | 'delayed'
  priority?: number
  description?: string | null
}

/**
 * Milestones API 客戶端
 *
 * 封裝所有里程碑相關的 API 調用，提供類型安全的介面
 */
export const MilestonesAPI = {
  /**
   * 獲取所有里程碑
   */
  getAll: () => apiGet<Milestone[]>('/api/milestones'),

  /**
   * 獲取單個里程碑
   */
  getById: (id: string) => apiGet<Milestone>(`/api/milestones/${id}`),

  /**
   * 創建里程碑
   */
  create: (data: CreateMilestoneDTO) => apiPost<Milestone>('/api/milestones', data),

  /**
   * 更新里程碑
   */
  update: (id: string, data: UpdateMilestoneDTO) =>
    apiPatch<Milestone>(`/api/milestones/${id}`, data),

  /**
   * 刪除里程碑（軟刪除）
   */
  delete: (id: string) => apiDelete<void>(`/api/milestones/${id}`),
}
