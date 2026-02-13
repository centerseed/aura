/**
 * GET  /api/coach/plan?date=YYYY-MM-DD  取得當日計畫
 * POST /api/coach/plan                   觸發生成/重新生成
 */

import { NextRequest } from 'next/server'
import { authenticateRequest } from '@/lib/auth-middleware'
import { prisma } from '@/lib/db'
import { ApiResponseBuilder, catchDomainException } from '@/lib/api-response'
import { GeneratePlanUseCase } from '@/application/use-cases/coach/generate-plan'
import { GetPlanUseCase } from '@/application/use-cases/coach/get-plan'
import { formatPlan } from '@/app/api/coach/plan/_shared'

export async function GET(request: NextRequest) {
  return catchDomainException(async () => {
    const userId = await authenticateRequest(request, prisma)

    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date') || undefined
    const timezone = searchParams.get('timezone') || undefined

    const useCase = new GetPlanUseCase()
    const result = await useCase.execute({ userId, date, timezone })

    return ApiResponseBuilder.success({
      plan: result.plan ? formatPlan(result.plan) : null,
    })
  })
}

export async function POST(request: NextRequest) {
  return catchDomainException(async () => {
    const userId = await authenticateRequest(request, prisma)

    const body = await request.json() as any
    const { date, timezone } = body || {}

    const useCase = new GeneratePlanUseCase()
    const result = await useCase.execute({ userId, date, timezone })

    return ApiResponseBuilder.success({
      plan: formatPlan(result.plan),
      timings: result.timings,
    })
  })
}
