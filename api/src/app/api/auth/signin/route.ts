/**
 * Auth SignIn API Route - 使用 Clean Architecture
 */

import { NextRequest } from 'next/server'
import { ApiResponseBuilder, catchDomainException } from '@/lib/api-response'
import { SignInUseCase } from '@/application/use-cases/auth/signin'

// ============================================================================
// POST /api/auth/signin - 多種認證方式登入
// ============================================================================

export async function POST(request: NextRequest) {
  return catchDomainException(async () => {
    const body = await request.json() as any
    const { provider, providerId, email, name } = body

    const useCase = new SignInUseCase()
    const result = await useCase.execute({
      provider,
      providerId,
      email,
      name,
    })

    return ApiResponseBuilder.success({ user: result }, {})
  })
}
