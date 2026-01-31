/**
 * Area [id] API Routes - 使用 Clean Architecture
 */

import { NextRequest } from 'next/server'
import { authenticateRequest } from '@/lib/auth-middleware'
import { prisma } from '@/lib/db'
import { ApiResponseBuilder, catchDomainException } from '@/lib/api-response'
import { UpdateAreaUseCase } from '@/application/use-cases/areas/update-area'
import { DeleteAreaUseCase } from '@/application/use-cases/areas/delete-area'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return catchDomainException(async () => {
    const userId = await authenticateRequest(request, prisma)
    const { id: areaId } = await params
    const body = await request.json() as any
    const { name, scope, description } = body

    const useCase = new UpdateAreaUseCase()
    const result = await useCase.execute({ areaId, userId, name, scope, description })

    return ApiResponseBuilder.success({
      area: result.area,
      message: result.message,
    }, {})
  })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return catchDomainException(async () => {
    const userId = await authenticateRequest(request, prisma)
    const { id: areaId } = await params

    const useCase = new DeleteAreaUseCase()
    const result = await useCase.execute({ areaId, userId })

    return ApiResponseBuilder.success({
      areaId: result.areaId,
      message: result.message,
    }, {})
  })
}
