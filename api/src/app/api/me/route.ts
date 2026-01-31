/**
 * Current User API Route - 使用 Clean Architecture
 */

import { NextRequest } from 'next/server'
import { getAuth } from '@/lib/firebase-admin'
import {
  ApiResponseBuilder,
  catchDomainException,
  UnauthorizedException,
} from '@/lib/api-response'
import { GetCurrentUserUseCase } from '@/application/use-cases/users/get-current-user'

// ============================================================================
// GET /api/me - 獲取當前登入用戶的資訊
// ============================================================================

export async function GET(request: NextRequest) {
  return catchDomainException(async () => {
    // 驗證 Firebase ID Token
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid authorization header')
    }

    const token = authHeader.substring(7)
    const auth = getAuth()
    let decodedToken
    try {
      decodedToken = await auth.verifyIdToken(token)
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired token')
    }
    const firebaseUid = decodedToken.uid

    // 執行 Use Case
    const useCase = new GetCurrentUserUseCase()
    const result = await useCase.execute({ firebaseUid })

    return ApiResponseBuilder.success(result, {})
  })
}
