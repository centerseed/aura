/**
 * GET /api/coach/focus-bias?days=7
 *
 * 回傳各 Product（按 Priority 分組）的過去 N 天完成任務數，
 * 以及焦點偏差（Focus Drift）偵測結果。
 */

import { NextRequest } from 'next/server'
import { authenticateRequest } from '@/lib/auth-middleware'
import { prisma } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { ApiResponseBuilder, catchDomainException } from '@/lib/api-response'

interface ProductFocusRow {
  id: string
  name: string
  priority: string
  completed_count: bigint
  last_active_at: Date | null
}

export async function GET(request: NextRequest) {
  return catchDomainException(async () => {
    const userId = await authenticateRequest(request, prisma)

    const { searchParams } = new URL(request.url)
    const days = Math.min(Math.max(parseInt(searchParams.get('days') ?? '7', 10), 1), 90)

    const rows = await prisma.$queryRaw<ProductFocusRow[]>`
      SELECT
        p.id,
        p.name,
        p.priority::text AS priority,
        COUNT(t.id) FILTER (
          WHERE t.status = 'ARCHIVE'
            AND t.updated_at > NOW() - INTERVAL '1 day' * ${days}
        ) AS completed_count,
        MAX(t.updated_at) FILTER (WHERE t.status = 'ARCHIVE') AS last_active_at
      FROM products p
      LEFT JOIN tasks t
        ON t.product_id = p.id AND t.deleted_at IS NULL
      WHERE p.user_id = ${userId}::uuid
        AND p.deleted_at IS NULL
        AND p.status != 'ARCHIVE'
      GROUP BY p.id, p.name, p.priority
      ORDER BY
        CASE p.priority::text
          WHEN 'P0' THEN 0 WHEN 'P1' THEN 1 WHEN 'P2' THEN 2 WHEN 'P3' THEN 3
          ELSE 1
        END ASC,
        p.display_order ASC
    `

    const stagnantThresholdDays = 5
    const now = new Date()

    const products = rows.map((row) => {
      const completedCount = Number(row.completed_count)
      const isHighPriority = row.priority === 'P0' || row.priority === 'P1'
      const daysSinceActive = row.last_active_at
        ? (now.getTime() - row.last_active_at.getTime()) / (1000 * 60 * 60 * 24)
        : Infinity
      const isStagnant = isHighPriority && daysSinceActive > stagnantThresholdDays

      return {
        id: row.id,
        name: row.name,
        priority: row.priority,
        completed_count: completedCount,
        last_active_at: row.last_active_at?.toISOString() ?? null,
        is_stagnant: isStagnant,
      }
    })

    // Focus Drift 偵測
    const totalCompleted = products.reduce((sum, p) => sum + p.completed_count, 0)
    const lowPriorityCompleted = products
      .filter((p) => p.priority === 'P2' || p.priority === 'P3')
      .reduce((sum, p) => sum + p.completed_count, 0)
    const lowPriorityRatio = totalCompleted > 0 ? lowPriorityCompleted / totalCompleted : 0
    const stagnantHighPriorityProducts = products.filter((p) => p.is_stagnant)
    const focusDriftDetected =
      stagnantHighPriorityProducts.length > 0 && lowPriorityRatio > 0.7

    return ApiResponseBuilder.success({
      period_days: days,
      products,
      focus_drift_detected: focusDriftDetected,
      drift_summary: {
        low_priority_completed_ratio: Math.round(lowPriorityRatio * 100) / 100,
        stagnant_high_priority_products: stagnantHighPriorityProducts.map((p) => ({
          id: p.id,
          name: p.name,
          priority: p.priority,
        })),
      },
    })
  })
}
