/**
 * GetMilestonesUseCase - 獲取所有里程碑
 *
 * Application Layer Use Case
 * 處理獲取用戶所有里程碑的業務邏輯,包括多態關聯處理
 *
 * 🚀 優化：使用單一 JOIN 查詢取代批次查詢，減少網路往返次數
 */

import { prisma } from '@/lib/db'
import { ValidationException } from '@/lib/api-response'

// ============================================================================
// DTOs (Data Transfer Objects)
// ============================================================================

export interface GetMilestonesRequest {
  userId: string
}

export interface MilestoneWithEntity {
  id: string
  user_id: string
  name: string
  target_date: Date
  entity_type: 'AREA' | 'PRODUCT' | 'TOPIC'
  entity_id: string
  description: string | null
  status: string
  created_at: Date
  updated_at: Date
  deleted_at: Date | null
  product: { id: string; name: string } | null
  area: { id: string; name: string } | null
  topic: { id: string; name: string } | null
}

export interface GetMilestonesResponse {
  milestones: MilestoneWithEntity[]
}

// ============================================================================
// Use Case
// ============================================================================

// Raw SQL 查詢結果的型別
interface RawMilestoneRow {
  milestone_id: string
  milestone_user_id: string
  milestone_name: string
  milestone_target_date: Date
  milestone_entity_type: string
  milestone_entity_id: string
  milestone_description: string | null
  milestone_status: string
  milestone_created_at: Date
  milestone_updated_at: Date
  milestone_deleted_at: Date | null
  product_id: string | null
  product_name: string | null
  area_id: string | null
  area_name: string | null
  topic_id: string | null
  topic_name: string | null
}

export class GetMilestonesUseCase {
  async execute(
    request: GetMilestonesRequest
  ): Promise<GetMilestonesResponse> {
    // 1. 驗證輸入
    this.validateRequest(request)

    // 2. 🚀 使用單一 JOIN 查詢，一次載入所有資料
    const rawRows = await prisma.$queryRaw<RawMilestoneRow[]>`
      SELECT
        m.id::text as milestone_id,
        m.user_id::text as milestone_user_id,
        m.name as milestone_name,
        m.target_date as milestone_target_date,
        m.entity_type::text as milestone_entity_type,
        m.entity_id as milestone_entity_id,
        m.description as milestone_description,
        m.status as milestone_status,
        m.created_at as milestone_created_at,
        m.updated_at as milestone_updated_at,
        m.deleted_at as milestone_deleted_at,
        p.id::text as product_id,
        p.name as product_name,
        a.id::text as area_id,
        a.name as area_name,
        t.id::text as topic_id,
        t.name as topic_name
      FROM milestones m
      LEFT JOIN products p ON m.entity_type = 'PRODUCT' AND m.entity_id::uuid = p.id
      LEFT JOIN areas a ON m.entity_type = 'AREA' AND m.entity_id::uuid = a.id
      LEFT JOIN topics t ON m.entity_type = 'TOPIC' AND m.entity_id::uuid = t.id
      WHERE m.user_id = ${request.userId}::uuid
        AND m.deleted_at IS NULL
      ORDER BY m.target_date ASC
    `

    // 3. 轉換為 Domain 格式
    const milestonesWithEntities = rawRows.map((row) =>
      this.transformToMilestone(row)
    )

    return {
      milestones: milestonesWithEntities,
    }
  }

  /**
   * 將 Raw SQL 結果轉換為 MilestoneWithEntity 格式
   */
  private transformToMilestone(row: RawMilestoneRow): MilestoneWithEntity {
    return {
      id: row.milestone_id,
      user_id: row.milestone_user_id,
      name: row.milestone_name,
      target_date: row.milestone_target_date,
      entity_type: row.milestone_entity_type as 'AREA' | 'PRODUCT' | 'TOPIC',
      entity_id: row.milestone_entity_id,
      description: row.milestone_description,
      status: row.milestone_status,
      created_at: row.milestone_created_at,
      updated_at: row.milestone_updated_at,
      deleted_at: row.milestone_deleted_at,
      product:
        row.milestone_entity_type === 'PRODUCT' && row.product_id
          ? { id: row.product_id, name: row.product_name! }
          : null,
      area:
        row.milestone_entity_type === 'AREA' && row.area_id
          ? { id: row.area_id, name: row.area_name! }
          : null,
      topic:
        row.milestone_entity_type === 'TOPIC' && row.topic_id
          ? { id: row.topic_id, name: row.topic_name! }
          : null,
    }
  }

  /**
   * 驗證請求資料
   */
  private validateRequest(request: GetMilestonesRequest): void {
    if (!request.userId) {
      throw new ValidationException('User ID is required', 'userId')
    }
  }
}
