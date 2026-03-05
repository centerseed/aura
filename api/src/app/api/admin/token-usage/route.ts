/**
 * Admin Token Usage API Route
 * GET /api/admin/token-usage?userId=<uid>&days=30
 */

import { NextRequest } from 'next/server'
import { authenticateAdminRequest } from '@/lib/auth-middleware'
import { prisma } from '@/lib/db'
import { ApiResponseBuilder, catchDomainException } from '@/lib/api-response'

interface DailyRow {
  date: Date
  input_tokens: bigint
  output_tokens: bigint
  total_tokens: bigint
  count: bigint
}

interface FeatureRow {
  feature: string
  total_tokens: bigint
  count: bigint
}

export async function GET(request: NextRequest) {
  return catchDomainException(async () => {
    await authenticateAdminRequest(request, prisma)

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const days = Math.min(parseInt(searchParams.get('days') ?? '30', 10), 90)

    if (!userId) {
      return ApiResponseBuilder.success({ daily: [], byFeature: [] })
    }

    const [dailyRows, featureRows] = await Promise.all([
      prisma.$queryRaw<DailyRow[]>`
        SELECT
          DATE(created_at) AS date,
          SUM(input_tokens) AS input_tokens,
          SUM(output_tokens) AS output_tokens,
          SUM(input_tokens + output_tokens) AS total_tokens,
          COUNT(*) AS count
        FROM ai_token_log
        WHERE user_id = ${userId}::uuid
          AND created_at >= NOW() - (${days} || ' days')::interval
        GROUP BY DATE(created_at)
        ORDER BY date
      `,
      prisma.$queryRaw<FeatureRow[]>`
        SELECT
          feature,
          SUM(input_tokens + output_tokens) AS total_tokens,
          COUNT(*) AS count
        FROM ai_token_log
        WHERE user_id = ${userId}::uuid
          AND created_at >= NOW() - (${days} || ' days')::interval
        GROUP BY feature
        ORDER BY total_tokens DESC
      `,
    ])

    return ApiResponseBuilder.success({
      daily: dailyRows.map(r => ({
        date: r.date instanceof Date ? r.date.toISOString().slice(0, 10) : String(r.date),
        input_tokens: Number(r.input_tokens),
        output_tokens: Number(r.output_tokens),
        total_tokens: Number(r.total_tokens),
        count: Number(r.count),
      })),
      byFeature: featureRows.map(r => ({
        feature: r.feature,
        total_tokens: Number(r.total_tokens),
        count: Number(r.count),
        avg_tokens_per_call: Number(r.count) > 0
          ? Math.round(Number(r.total_tokens) / Number(r.count))
          : 0,
      })),
    })
  })
}
