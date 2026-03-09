/**
 * LINE 晨報 Cron Route
 *
 * 由 Cloud Scheduler 每天 07:30 JST 觸發，
 * 為所有已綁定 LINE 的用戶推播晨報。
 */

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getLineClient, formatMorningBriefing } from "@/lib/line-client"
import { GenerateBriefingUseCase } from "@/application/use-cases/coach/generate-briefing"

export async function POST(req: NextRequest) {
  // Cloud Scheduler 認證
  const secret = req.headers.get("x-cron-secret")
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const users = await prisma.user.findMany({
    where: {
      line_user_id: { not: null },
      deleted_at: null,
    },
    select: { id: true, line_user_id: true, timezone: true },
  })

  const client = getLineClient()
  const uc = new GenerateBriefingUseCase()
  const results = { sent: 0, failed: 0, total: users.length }

  for (const user of users) {
    try {
      const { briefing } = await uc.execute({
        userId: user.id,
        type: "MORNING",
        timezone: user.timezone ?? "Asia/Taipei",
      })

      const text = formatMorningBriefing(briefing)

      await client.pushMessage({
        to: user.line_user_id!,
        messages: [{ type: "text", text }],
      })
      results.sent++
    } catch (err) {
      console.error(`[LINE Cron] Failed for user ${user.id}:`, err)
      results.failed++
    }
  }

  console.log("[LINE Cron] Morning briefing done:", results)
  return NextResponse.json(results)
}
