/**
 * Evaluation Logs API Route - 使用 Clean Architecture
 */

import { NextRequest } from 'next/server'
import { authenticateAdminRequest } from '@/lib/auth-middleware'
import { prisma } from '@/lib/db'
import { ApiResponseBuilder, catchDomainException } from '@/lib/api-response'
import { GetEvaluationLogsUseCase } from '@/application/use-cases/evaluation/get-logs'
import { UpdateEvaluationLogUseCase } from '@/application/use-cases/evaluation/update-log'

// ============================================================================
// GET /api/evaluation/logs - 獲取評估紀錄列表(支援分頁、過濾)
// ============================================================================

export async function GET(request: NextRequest) {
  return catchDomainException(async () => {
    const userId = await authenticateAdminRequest(request, prisma)
    const { searchParams } = new URL(request.url)

    const type = searchParams.get('type') || undefined
    const userAction = searchParams.get('userAction') || undefined
    const limit = searchParams.get('limit')
      ? parseInt(searchParams.get('limit')!)
      : undefined
    const offset = searchParams.get('offset')
      ? parseInt(searchParams.get('offset')!)
      : undefined

    const useCase = new GetEvaluationLogsUseCase()
    const result = await useCase.execute({
      userId,
      type,
      userAction,
      limit,
      offset,
    })

    return ApiResponseBuilder.success(result, {})
  })
}

// ============================================================================
// PATCH /api/evaluation/logs - 更新 Log 狀態
// ============================================================================

export async function PATCH(request: NextRequest) {
  return catchDomainException(async () => {
    const body = await request.json() as any
    const { logId, userAction, metadata } = body

    const useCase = new UpdateEvaluationLogUseCase()
    const result = await useCase.execute({
      logId,
      userAction,
      metadata,
    })

    return ApiResponseBuilder.success(result, {})
  })
}
