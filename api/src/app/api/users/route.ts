/**
 * Users API Route - 使用 Clean Architecture
 */

import { NextRequest } from 'next/server'
import { authenticateRequest } from '@/lib/auth-middleware'
import { prisma } from '@/lib/db'
import { ApiResponseBuilder, catchDomainException } from '@/lib/api-response'
import { GetUserByIdUseCase } from '@/application/use-cases/users/get-user-by-id'

// ============================================================================
// GET /api/users - 根據 Firebase Token 獲取用戶資訊
// ============================================================================

export async function GET(request: NextRequest) {
  return catchDomainException(async () => {
    const userId = await authenticateRequest(request, prisma)

    const useCase = new GetUserByIdUseCase()
    const result = await useCase.execute({ userId })

    return ApiResponseBuilder.success({ user: result }, {})
  })
}
