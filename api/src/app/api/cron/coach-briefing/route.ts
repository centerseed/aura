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

  // 2. 判斷晨報或晚報（依據 UTC 時間）
  const nowUTC = new Date()
  const hourUTC = nowUTC.getUTCHours()

  // UTC 0-6 → 台北 8-14 → 晨報
  // UTC 7-23 → 台北 15-7 → 晚報
  const briefingType: BriefingType = hourUTC < 7 ? 'MORNING' : 'EVENING'

  // 3. 查詢活躍用戶（近 7 天有任務更新）
  const sevenDaysAgo = new Date(nowUTC.getTime() - 7 * 24 * 60 * 60 * 1000)

  const activeUsers = await prisma.$queryRaw<Array<{ id: string; timezone: string | null }>>`
    SELECT DISTINCT u.id::text, u.timezone
    FROM users u
    JOIN tasks t ON t.user_id = u.id
    WHERE t.updated_at > ${sevenDaysAgo}
      AND t.deleted_at IS NULL
  `

  // 4. 為每位用戶生成簡報（並發限制 3，避免 Gemini API rate limit）
  const CONCURRENCY_LIMIT = 3
  const useCase = new GenerateBriefingUseCase()
  const results: PromiseSettledResult<{ userId: string; briefingId: string }>[] = []

  for (let i = 0; i < activeUsers.length; i += CONCURRENCY_LIMIT) {
    const batch = activeUsers.slice(i, i + CONCURRENCY_LIMIT)
    const batchResults = await Promise.allSettled(
      batch.map(async (user) => {
        const result = await useCase.execute({
          userId: user.id,
          type: briefingType,
          timezone: user.timezone || 'Asia/Taipei',
        })
        return { userId: user.id, briefingId: result.briefing.id }
      }),
    )
    results.push(...batchResults)
  }

  // 5. 統計結果
  const succeeded = results.filter(r => r.status === 'fulfilled').length
  const failed = results.filter(r => r.status === 'rejected').length

  // Log failures
  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      console.error(`[Cron] Failed to generate briefing for user ${activeUsers[i].id}:`, r.reason)
    }
  })

  return NextResponse.json({
    success: true,
    type: briefingType,
    total_users: activeUsers.length,
    succeeded,
    failed,
    timestamp: nowUTC.toISOString(),
  })
}
