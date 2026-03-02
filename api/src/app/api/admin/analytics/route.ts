/**
 * Admin Analytics API Route
 * GET /api/admin/analytics - Flywheel 健康儀表板
 */

import { NextRequest } from 'next/server'
import { authenticateAdminRequest } from '@/lib/auth-middleware'
import { prisma } from '@/lib/db'
import { ApiResponseBuilder, catchDomainException } from '@/lib/api-response'

// ============================================================================
// Types
// ============================================================================

interface BrainDumpUserRow {
  user_id: string
  total: bigint
  applied: bigint
  edited: bigint
  cancelled: bigint
  edit_rate_pct: string | null
  first_at: Date
  last_at: Date
}

interface DailyTrendRow {
  date: Date
  count: bigint
}

interface CorrectionsRow {
  user_id: string
  correction_count: bigint
  last_correction: Date
}

interface RulesRow {
  user_id: string
  rule_count: bigint
  avg_confidence: string | null
  total_applied: bigint | null
}

type DistillStatus = 'none' | 'building' | 'active' | 'flywheel'

function calcDistillStatus(
  correctionCount: number,
  ruleCount: number,
  avgConfidence: number,
  totalApplied: number
): DistillStatus {
  if (correctionCount === 0) return 'none'
  if (correctionCount < 10) return 'building'
  if (ruleCount > 0 && avgConfidence > 0.7 && totalApplied > 20) return 'flywheel'
  if (ruleCount > 0) return 'active'
  return 'building'
}

// ============================================================================
// GET /api/admin/analytics
// ============================================================================

export async function GET(request: NextRequest) {
  return catchDomainException(async () => {
    await authenticateAdminRequest(request, prisma)

    // --- Brain Dump by user ---
    const brainDumpByUser = await prisma.$queryRaw<BrainDumpUserRow[]>`
      SELECT
        user_id,
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE user_action = 'APPLIED') AS applied,
        COUNT(*) FILTER (WHERE user_action = 'EDITED') AS edited,
        COUNT(*) FILTER (WHERE user_action = 'CANCELLED') AS cancelled,
        ROUND(
          COUNT(*) FILTER (WHERE user_action = 'EDITED')::numeric
          / NULLIF(COUNT(*), 0) * 100, 1
        )::text AS edit_rate_pct,
        MIN(created_at) AS first_at,
        MAX(created_at) AS last_at
      FROM system_evaluation_logs
      WHERE type = 'BRAIN_DUMP'
      GROUP BY user_id
      ORDER BY total DESC
    `

    // --- Daily trend (last 30 days) ---
    const dailyTrend = await prisma.$queryRaw<DailyTrendRow[]>`
      SELECT
        DATE(created_at) AS date,
        COUNT(*) AS count
      FROM system_evaluation_logs
      WHERE type = 'BRAIN_DUMP'
        AND created_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY date
    `

    // --- Librarian corrections & rules (cross-schema, may not exist) ---
    let correctionsRows: CorrectionsRow[] = []
    let rulesRows: RulesRow[] = []
    try {
      correctionsRows = await prisma.$queryRaw<CorrectionsRow[]>`
        SELECT user_id, COUNT(*) AS correction_count, MAX(created_at) AS last_correction
        FROM poc_librarian.corrections
        GROUP BY user_id
      `
      rulesRows = await prisma.$queryRaw<RulesRow[]>`
        SELECT
          user_id,
          COUNT(*) FILTER (WHERE is_active) AS rule_count,
          ROUND(AVG(confidence)::numeric, 3)::text AS avg_confidence,
          SUM(times_applied) AS total_applied
        FROM poc_librarian.rules
        GROUP BY user_id
      `
    } catch (e) {
      console.warn('[admin/analytics] poc_librarian query failed (schema may not exist):', e)
    }

    // --- Look up user emails ---
    const allUserIds = [...new Set(brainDumpByUser.map(r => r.user_id))]
    const users = allUserIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: allUserIds } },
          select: { id: true, email: true, name: true },
        })
      : []
    const userMap = Object.fromEntries(users.map(u => [u.id, u]))

    // --- Build corrections / rules maps ---
    const correctionsMap = Object.fromEntries(
      correctionsRows.map(r => [r.user_id, { correctionCount: Number(r.correction_count) }])
    )
    const rulesMap = Object.fromEntries(
      rulesRows.map(r => [r.user_id, {
        ruleCount: Number(r.rule_count),
        avgConfidence: r.avg_confidence ? parseFloat(r.avg_confidence) : 0,
        totalApplied: Number(r.total_applied ?? 0),
      }])
    )

    // --- Merge per-user stats ---
    const byUser = brainDumpByUser.map(r => {
      const total = Number(r.total)
      const edited = Number(r.edited)
      const corr = correctionsMap[r.user_id] ?? { correctionCount: 0 }
      const rules = rulesMap[r.user_id] ?? { ruleCount: 0, avgConfidence: 0, totalApplied: 0 }
      const u = userMap[r.user_id]
      return {
        userId: r.user_id,
        email: u?.email ?? null,
        name: u?.name ?? null,
        total,
        applied: Number(r.applied),
        edited,
        cancelled: Number(r.cancelled),
        editRatePct: r.edit_rate_pct ? parseFloat(r.edit_rate_pct) : 0,
        firstAt: r.first_at,
        lastAt: r.last_at,
        correctionCount: corr.correctionCount,
        ruleCount: rules.ruleCount,
        avgConfidence: rules.avgConfidence,
        totalApplied: rules.totalApplied,
        distillStatus: calcDistillStatus(
          corr.correctionCount,
          rules.ruleCount,
          rules.avgConfidence,
          rules.totalApplied
        ),
      }
    })

    const totalDumps = byUser.reduce((s, u) => s + u.total, 0)
    const totalEdited = byUser.reduce((s, u) => s + u.edited, 0)

    const flywheelSummary = {
      totalUsers: byUser.length,
      usersWithAnyBrainDump: byUser.filter(u => u.total > 0).length,
      usersOverThreshold: byUser.filter(u => u.correctionCount >= 10).length,
      usersNearThreshold: byUser.filter(u => u.correctionCount >= 5 && u.correctionCount < 10).length,
      overallEditRate: totalDumps > 0 ? Math.round((totalEdited / totalDumps) * 1000) / 1000 : 0,
    }

    return ApiResponseBuilder.success({
      brainDump: {
        total: totalDumps,
        byUser,
        dailyTrend: dailyTrend.map(r => ({
          date: r.date instanceof Date ? r.date.toISOString().slice(0, 10) : String(r.date),
          count: Number(r.count),
        })),
      },
      librarian: {
        byUser: byUser.map(u => ({
          userId: u.userId,
          email: u.email,
          correctionCount: u.correctionCount,
          ruleCount: u.ruleCount,
          avgConfidence: u.avgConfidence,
          totalApplied: u.totalApplied,
          distillStatus: u.distillStatus,
        })),
      },
      flywheelSummary,
    })
  })
}
