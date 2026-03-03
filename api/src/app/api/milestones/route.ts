/**
 * Milestones API Routes - 使用 Clean Architecture
 */

import { NextRequest } from 'next/server'
import { authenticateRequest } from '@/lib/auth-middleware'
import { prisma } from '@/lib/db'
import { ApiResponseBuilder, catchDomainException } from '@/lib/api-response'
import { GetMilestonesUseCase } from '@/application/use-cases/milestones/get-milestones'
import { CreateMilestoneUseCase } from '@/application/use-cases/milestones/create-milestone'

// ============================================================================
// GET /api/milestones - 獲取所有里程碑
// ============================================================================

export async function GET(request: NextRequest) {
  return catchDomainException(async () => {
    const userId = await authenticateRequest(request, prisma)

    const useCase = new GetMilestonesUseCase()
    const result = await useCase.execute({ userId })

    return ApiResponseBuilder.success({ milestones: result.milestones }, {})
  })
}

// ============================================================================
// POST /api/milestones - 創建新里程碑
// ============================================================================

export async function POST(request: NextRequest) {
  return catchDomainException(async () => {
    const userId = await authenticateRequest(request, prisma)
    const body = await request.json() as any
    const { name, target_date, entity_type, entity_id, description, status } = body

    const useCase = new CreateMilestoneUseCase()
    const result = await useCase.execute({
      userId,
      name,
      target_date,
      entity_type,
      entity_id,
      description,
      status,
    })

    return ApiResponseBuilder.success(
      {
        milestone: result.milestone,
        message: result.message,
      },
      {}
    )
  })
}
