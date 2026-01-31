/**
 * Milestone [id] API Routes - 使用 Clean Architecture
 */

import { NextRequest } from 'next/server'
import { authenticateRequest } from '@/lib/auth-middleware'
import { prisma } from '@/lib/db'
import { ApiResponseBuilder, catchDomainException } from '@/lib/api-response'
import { UpdateMilestoneUseCase } from '@/application/use-cases/milestones/update-milestone'
import { DeleteMilestoneUseCase } from '@/application/use-cases/milestones/delete-milestone'

// ============================================================================
// PUT /api/milestones/[id] - 更新里程碑
// ============================================================================

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return catchDomainException(async () => {
    const userId = await authenticateRequest(request, prisma)
    const { id: milestoneId } = await params
    const body = await request.json() as any
    const { name, target_date, entity_type, entity_id, priority, description, status } = body

    const useCase = new UpdateMilestoneUseCase()
    const result = await useCase.execute({
      milestoneId,
      userId,
      name,
      target_date,
      entity_type,
      entity_id,
      priority,
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

// ============================================================================
// DELETE /api/milestones/[id] - 軟刪除里程碑
// ============================================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return catchDomainException(async () => {
    const userId = await authenticateRequest(request, prisma)
    const { id: milestoneId } = await params

    const useCase = new DeleteMilestoneUseCase()
    const result = await useCase.execute({ milestoneId, userId })

    return ApiResponseBuilder.success(
      {
        milestoneId: result.milestoneId,
        message: result.message,
      },
      {}
    )
  })
}
