import { prisma } from '@/lib/db'
import { RateLimitException } from '@/lib/api-response'

export const DAILY_AI_LIMIT = 50

/**
 * 檢查 AI 使用額度（不消耗 quota）
 * 搭配 incrementAiUsage() 在 AI 呼叫成功後才遞增
 */
export async function checkAiRateLimit(userId: string): Promise<void> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const usage = await prisma.dailyAiUsage.findUnique({
    where: {
      user_id_usage_date: {
        user_id: userId,
        usage_date: today,
      },
    },
  })

  if (usage && usage.count >= DAILY_AI_LIMIT) {
    throw new RateLimitException(
      `Daily AI usage limit exceeded (${DAILY_AI_LIMIT}/day). Resets at midnight.`
    )
  }
}

/**
 * AI 呼叫成功後遞增 quota（先檢查再遞增模式）
 * 此操作不應阻斷 AI 回應：DB 短暫失敗時只記錄 warning，不拋出例外
 */
export async function incrementAiUsage(userId: string): Promise<void> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  try {
    await prisma.dailyAiUsage.upsert({
      where: {
        user_id_usage_date: {
          user_id: userId,
          usage_date: today,
        },
      },
      update: {
        count: { increment: 1 },
      },
      create: {
        user_id: userId,
        usage_date: today,
        count: 1,
      },
    })
  } catch (err) {
    console.warn('[ai-rate-limit] incrementAiUsage failed (non-fatal):', err)
  }
}
