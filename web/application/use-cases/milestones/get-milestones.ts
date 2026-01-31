/**
 * GetMilestonesUseCase - 獲取所有里程碑
 *
 * Application Layer Use Case
 * 處理獲取用戶所有里程碑的業務邏輯,包括多態關聯處理
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
  priority: number
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

export class GetMilestonesUseCase {
  async execute(
    request: GetMilestonesRequest
  ): Promise<GetMilestonesResponse> {
    // 1. 驗證輸入
    this.validateRequest(request)

    // 2. 查詢所有未刪除的里程碑
    const milestones = await prisma.milestone.findMany({
      where: {
        user_id: request.userId,
        deleted_at: null,
      },
      orderBy: {
        target_date: 'asc',
      },
    })

    // 3. 手動處理多態關聯 - 根據 entity_type 批次查詢關聯實體
    const productIds = milestones
      .filter((m) => m.entity_type === 'PRODUCT')
      .map((m) => m.entity_id)
    const areaIds = milestones
      .filter((m) => m.entity_type === 'AREA')
      .map((m) => m.entity_id)
    const topicIds = milestones
      .filter((m) => m.entity_type === 'TOPIC')
      .map((m) => m.entity_id)

    // 4. 批次查詢所有關聯實體 (性能優化)
    const [products, areas, topics] = await Promise.all([
      productIds.length > 0
        ? prisma.product.findMany({
            where: { id: { in: productIds } },
            select: { id: true, name: true },
          })
        : [],
      areaIds.length > 0
        ? prisma.area.findMany({
            where: { id: { in: areaIds } },
            select: { id: true, name: true },
          })
        : [],
      topicIds.length > 0
        ? prisma.topic.findMany({
            where: { id: { in: topicIds } },
            select: { id: true, name: true },
          })
        : [],
    ])

    // 5. 建立 ID -> Entity 的 Map 以便快速查找
    const productMap = new Map(products.map((p) => [p.id, p]))
    const areaMap = new Map(areas.map((a) => [a.id, a]))
    const topicMap = new Map(topics.map((t) => [t.id, t]))

    // 6. 組合最終結果
    const milestonesWithEntities = milestones.map((milestone) => {
      let entity = null
      if (milestone.entity_type === 'PRODUCT') {
        entity = productMap.get(milestone.entity_id) || null
      } else if (milestone.entity_type === 'AREA') {
        entity = areaMap.get(milestone.entity_id) || null
      } else if (milestone.entity_type === 'TOPIC') {
        entity = topicMap.get(milestone.entity_id) || null
      }

      return {
        ...milestone,
        product: milestone.entity_type === 'PRODUCT' ? entity : null,
        area: milestone.entity_type === 'AREA' ? entity : null,
        topic: milestone.entity_type === 'TOPIC' ? entity : null,
      } as MilestoneWithEntity
    })

    return {
      milestones: milestonesWithEntities,
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
