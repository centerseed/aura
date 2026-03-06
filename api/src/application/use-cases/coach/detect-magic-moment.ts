/**
 * DetectMagicMomentUseCase - 動能偵測 + 優先度重對齊介入
 *
 * 偵測邏輯：
 * - P0 停滯：P0 產品中，過去 5 天內無任何任務被 ARCHIVE
 * - 動能爆發：非 P0 的 ACTIVE 產品中，過去 7 天完成（ARCHIVE）3 個以上任務
 * - 觸發條件：同時存在 >=1 個停滯 P0 + >=1 個動能爆發產品
 */

import type { PrismaClient } from '@prisma/client'

export interface MagicMomentResult {
  detected: boolean
  stagnant_p0_products: Array<{ id: string; name: string; days_stagnant: number }>
  momentum_products: Array<{ id: string; name: string; priority: string; completed_count: number }>
}

interface ProductRow {
  id: string
  name: string
  priority: string
  completed_count_7d: bigint
  last_archive_at: Date | null
}

export async function detectMagicMoment(
  userId: string,
  prisma: PrismaClient
): Promise<MagicMomentResult> {
  const rows = await prisma.$queryRaw<ProductRow[]>`
    SELECT
      p.id,
      p.name,
      p.priority::text AS priority,
      COUNT(t.id) FILTER (
        WHERE t.status = 'ARCHIVE'
          AND t.updated_at > NOW() - INTERVAL '7 days'
      ) AS completed_count_7d,
      MAX(t.updated_at) FILTER (WHERE t.status = 'ARCHIVE') AS last_archive_at
    FROM products p
    LEFT JOIN tasks t
      ON t.product_id = p.id AND t.deleted_at IS NULL
    WHERE p.user_id = ${userId}::uuid
      AND p.deleted_at IS NULL
      AND p.status = 'ACTIVE'
    GROUP BY p.id, p.name, p.priority
  `

  const now = new Date()
  const P0_STAGNANT_DAYS = 5
  const MOMENTUM_THRESHOLD = 3
  // 從未完成任何任務時的哨兵值（顯示用，表示「永遠未完成」）
  const NEVER_ARCHIVED_DAYS = 999

  const stagnantP0Products: MagicMomentResult['stagnant_p0_products'] = []
  const momentumProducts: MagicMomentResult['momentum_products'] = []

  for (const row of rows) {
    const completedCount = Number(row.completed_count_7d)

    if (row.priority === 'P0') {
      const daysSinceActive = row.last_archive_at
        ? (now.getTime() - row.last_archive_at.getTime()) / (1000 * 60 * 60 * 24)
        : Infinity
      if (daysSinceActive > P0_STAGNANT_DAYS) {
        stagnantP0Products.push({
          id: row.id,
          name: row.name,
          days_stagnant: Math.floor(daysSinceActive === Infinity ? NEVER_ARCHIVED_DAYS : daysSinceActive),
        })
      }
    } else {
      if (completedCount >= MOMENTUM_THRESHOLD) {
        momentumProducts.push({
          id: row.id,
          name: row.name,
          priority: row.priority,
          completed_count: completedCount,
        })
      }
    }
  }

  return {
    detected: stagnantP0Products.length > 0 && momentumProducts.length > 0,
    stagnant_p0_products: stagnantP0Products,
    momentum_products: momentumProducts,
  }
}
