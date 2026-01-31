/**
 * Areas API Routes - 使用 Clean Architecture
 */

import { NextRequest } from 'next/server'
import { authenticateRequest } from '@/lib/auth-middleware'
import { prisma } from '@/lib/db'
import { ApiResponseBuilder, catchDomainException } from '@/lib/api-response'
import { GetAreasUseCase } from '@/application/use-cases/areas/get-areas'
import { CreateAreaUseCase } from '@/application/use-cases/areas/create-area'

export async function GET(request: NextRequest) {
  return catchDomainException(async () => {
    const userId = await authenticateRequest(request, prisma)
    const useCase = new GetAreasUseCase()
    const result = await useCase.execute({ userId })
    return ApiResponseBuilder.success({ areas: result.areas }, {})
  })
}

export async function POST(request: NextRequest) {
  return catchDomainException(async () => {
    const userId = await authenticateRequest(request, prisma)
    const body = await request.json() as any
    const { name, scope, description } = body

    const useCase = new CreateAreaUseCase()
    const result = await useCase.execute({ userId, name, scope, description })

    return ApiResponseBuilder.success({
      area: result.area,
      created: result.created,
      updated: result.updated,
      message: result.message,
    }, {})
  })
}
