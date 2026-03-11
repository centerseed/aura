/**
 * LINE 晨報 Cron Route
 *
 * 由 Cloud Scheduler 在台灣時間 05:00-11:00 每小時觸發，
 * 為命中晨報開始時間的 LINE 綁定用戶推播晨報與今日任務。
 */

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getLineClient, formatMorningBriefingPush } from "@/lib/line-client"
import { PrismaCoachBriefingRepository } from "@/infrastructure/repositories/prisma-coach-briefing-repository"
import { PrismaDailyPlanRepository } from "@/infrastructure/repositories/prisma-daily-plan-repository"
import { PrismaLineMessageDeliveryRepository } from "@/infrastructure/repositories/prisma-line-message-delivery-repository"
import { GenerateBriefingUseCase } from "@/application/use-cases/coach/generate-briefing"
import { getMorningBriefingSchedule } from "@/lib/briefing-schedule"
import { getLocalHour, toDateOnly } from "@/lib/timezone-utils"

const CRON_TIMEZONE = "Asia/Taipei"
const DELIVERY_CHANNEL = "LINE" as const
const DELIVERY_TYPE = "MORNING_BRIEFING" as const

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 })
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const now = new Date()
  const currentHour = getLocalHour(now, CRON_TIMEZONE)
  const deliveryDate = toDateOnly(now, CRON_TIMEZONE)

  const users = await prisma.user.findMany({
    where: {
      line_user_id: { not: null },
      deleted_at: null,
    },
    select: { id: true, line_user_id: true, timezone: true, settings: true },
  })

  const client = getLineClient()
  const uc = new GenerateBriefingUseCase()
  const briefingRepository = new PrismaCoachBriefingRepository()
  const planRepository = new PrismaDailyPlanRepository()
  const deliveryRepository = new PrismaLineMessageDeliveryRepository()

  const results = {
    totalUsers: users.length,
    eligible: 0,
    skipped: 0,
    sent: 0,
    failed: 0,
    reusedBriefing: 0,
    generatedBriefing: 0,
    timestamp: now.toISOString(),
    currentHour,
    timezone: CRON_TIMEZONE,
  }

  if (currentHour < 5 || currentHour > 11) {
    return NextResponse.json({
      ...results,
      skipped: users.length,
      reason: "outside_scheduler_window",
    })
  }

  for (const user of users) {
    const lineUserId = user.line_user_id
    if (!lineUserId) {
      results.skipped++
      continue
    }

    const { enabled, windowStart } = getMorningBriefingSchedule(user.settings)
    if (!enabled || windowStart !== currentHour) {
      results.skipped++
      continue
    }

    results.eligible++

    try {
      const existingDelivery = await deliveryRepository.findByKey({
        userId: user.id,
        channel: DELIVERY_CHANNEL,
        deliveryType: DELIVERY_TYPE,
        deliveryDate,
      })
      if (existingDelivery?.status === "sent") {
        results.skipped++
        continue
      }

      const timezone = user.timezone ?? CRON_TIMEZONE
      let briefing = await briefingRepository.findByDate(user.id, "MORNING", deliveryDate)

      if (briefing) {
        results.reusedBriefing++
      } else {
        const generated = await uc.execute({
          userId: user.id,
          type: "MORNING",
          date: deliveryDate.toISOString().substring(0, 10),
          timezone,
        })
        briefing = generated.briefing
        results.generatedBriefing++
      }

      const plan = await planRepository.findByDate(user.id, deliveryDate)
      const text = formatMorningBriefingPush(briefing, plan)

      await client.pushMessage({
        to: lineUserId,
        messages: [{ type: "text", text }],
      })

      await deliveryRepository.upsert({
        userId: user.id,
        channel: DELIVERY_CHANNEL,
        deliveryType: DELIVERY_TYPE,
        deliveryDate,
        briefingId: briefing.id,
        dailyPlanId: plan?.id ?? null,
        lineUserId,
        status: "sent",
        errorMessage: null,
        sentAt: new Date(),
      })
      results.sent++
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      console.error(JSON.stringify({
        event: "line_morning_briefing_push_failed",
        userId: user.id,
        lineUserId,
        deliveryDate: deliveryDate.toISOString().substring(0, 10),
        error: errorMessage,
      }))

      await deliveryRepository.upsert({
        userId: user.id,
        channel: DELIVERY_CHANNEL,
        deliveryType: DELIVERY_TYPE,
        deliveryDate,
        lineUserId,
        status: "failed",
        errorMessage,
        sentAt: null,
      }).catch((deliveryError) => {
        console.error("[LINE Cron] Failed to persist delivery failure:", deliveryError)
      })
      results.failed++
    }
  }

  console.log("[LINE Cron] Morning briefing done:", results)
  return NextResponse.json(results)
}
