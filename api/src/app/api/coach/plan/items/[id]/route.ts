/**
 * PATCH /api/coach/plan/items/:id  修改計畫項目
 *   { order, completed, pinned, deferred, actualMinutes }
 */

import { NextRequest } from 'next/server'
import { authenticateRequest } from '@/lib/auth-middleware'
import { prisma } from '@/lib/db'
import { ApiResponseBuilder, catchDomainException } from '@/lib/api-response'
import { UpdatePlanItemUseCase } from '@/application/use-cases/coach/update-plan-item'
import { formatPlanItem } from '@/app/api/coach/plan/_shared'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return catchDomainException(async () => {
    const userId = await authenticateRequest(request, prisma)

    const { id } = await params
    const body = await request.json() as any
    const { order, completed, pinned, deferred, actualMinutes } = body || {}

    const useCase = new UpdatePlanItemUseCase()
    const result = await useCase.execute({
      userId,
      itemId: id,
      order,
      completed,
      pinned,
      deferred,
      actualMinutes,
    })

    return ApiResponseBuilder.success({
      item: formatPlanItem(result.item),
    })
  })
}
