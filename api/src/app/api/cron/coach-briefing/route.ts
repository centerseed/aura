/**
 * GET /api/cron/coach-briefing - Cron 觸發教練簡報生成
 *
 * 由 Vercel Cron 觸發：
 * - UTC 00:30 (Taipei 08:30) → 晨報
 * - UTC 13:00 (Taipei 21:00) → 晚報
 *
 * 需要 CRON_SECRET 驗證
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getLocalHour } from '@/lib/timezone-utils'
import { GenerateBriefingUseCase } from '@/application/use-cases/coach/generate-briefing'
import type { BriefingType } from '@/domain/entities/coach-briefing.entity'

export async function GET(request: NextRequest) {
  // 1. 驗證 CRON_SECRET
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    return NextResponse.json(
      { error: 'CRON_SECRET not configured' },
      { status: 500 },
    )
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 },
    )
  }

  // 2. 查詢活躍用戶（近 7 天有任務更新）
  const nowUTC = new Date()
  const sevenDaysAgo = new Date(nowUTC.getTime() - 7 * 24 * 60 * 60 * 1000)

  const activeUsers = await prisma.$queryRaw<Array<{ id: string; timezone: string | null }>>`
    SELECT DISTINCT u.id::text, u.timezone
    FROM users u
    JOIN tasks t ON t.user_id = u.id
    WHERE t.updated_at > ${sevenDaysAgo}
      AND t.deleted_at IS NULL
  `

  // 3. 為每位用戶根據其時區判斷簡報類型，跳過不在簡報窗口的用戶
  const CONCURRENCY_LIMIT = 3
  const useCase = new GenerateBriefingUseCase()

  interface CronResult { userId: string; briefingType?: BriefingType; briefingId?: string; skipped?: boolean; error?: unknown }

  // 預先計算每位用戶的簡報類型，過濾不在窗口的用戶
  const usersWithType: Array<{ id: string; timezone: string; briefingType: BriefingType }> = []
  const skippedUsers: CronResult[] = []

  for (const user of activeUsers) {
    const tz = user.timezone || 'Asia/Taipei'
    const localHour = getLocalHour(nowUTC, tz)

    // 晨報窗口: 7-13 (local), 晚報窗口: 19-23 (local)
    if (localHour >= 7 && localHour < 14) {
      usersWithType.push({ id: user.id, timezone: tz, briefingType: 'MORNING' })
    } else if (localHour >= 19 && localHour <= 23) {
      usersWithType.push({ id: user.id, timezone: tz, briefingType: 'EVENING' })
    } else {
      skippedUsers.push({ userId: user.id, skipped: true })
    }
  }

  const results: CronResult[] = [...skippedUsers]

  for (let i = 0; i < usersWithType.length; i += CONCURRENCY_LIMIT) {
    const batch = usersWithType.slice(i, i + CONCURRENCY_LIMIT)
    const batchResults = await Promise.allSettled(
      batch.map(async (user): Promise<CronResult> => {
        const result = await useCase.execute({
          userId: user.id,
          type: user.briefingType,
          timezone: user.timezone,
        })
        return { userId: user.id, briefingType: user.briefingType, briefingId: result.briefing.id }
      }),
    )
    for (let j = 0; j < batchResults.length; j++) {
      const r = batchResults[j]
      if (r.status === 'fulfilled') {
        results.push(r.value)
      } else {
        results.push({ userId: batch[j].id, briefingType: batch[j].briefingType, error: r.reason })
      }
    }
  }

  // 4. 統計結果
  const succeeded = results.filter(r => r.briefingId).length
  const failed = results.filter(r => r.error).length
  const skipped = results.filter(r => r.skipped).length

  // Log failures
  for (const r of results) {
    if (r.error) {
      console.error(`[Cron] Failed to generate briefing for user ${r.userId}:`, r.error)
    }
  }

  return NextResponse.json({
    success: true,
    total_users: activeUsers.length,
    succeeded,
    failed,
    skipped,
    timestamp: nowUTC.toISOString(),
  })
}
