/**
 * AI Usage API Route - 查詢當前用戶的每日 AI 使用量
 */

import { NextRequest } from 'next/server'
import { ApiResponseBuilder, catchDomainException } from '@/lib/api-response'
import { authenticateRequest } from '@/lib/auth-middleware'
import { prisma } from '@/lib/db'
import { DAILY_AI_LIMIT } from '@/lib/ai-rate-limit'

export async function GET(request: NextRequest) {
  return catchDomainException(async () => {
    const userId = await authenticateRequest(request, prisma)

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

    return ApiResponseBuilder.success({
      used: usage?.count ?? 0,
      limit: DAILY_AI_LIMIT,
    })
  })
}
