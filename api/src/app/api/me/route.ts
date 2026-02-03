/**
 * Current User API Route - 使用 Clean Architecture
 */

import { NextRequest } from 'next/server'
import { getAuth } from '@/lib/firebase-admin'
import {
  ApiResponseBuilder,
  catchDomainException,
  UnauthorizedException,
  ValidationException,
} from '@/lib/api-response'
import { GetCurrentUserUseCase } from '@/application/use-cases/users/get-current-user'
import { prisma } from '@/lib/db'

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

// ============================================================================
// PATCH /api/me - 更新當前用戶資料
// ============================================================================

export async function PATCH(request: NextRequest) {
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

    // 查詢用戶
    const user = await prisma.user.findFirst({
      where: {
        auth_provider_id: firebaseUid,
        deleted_at: null,
      },
    })

    if (!user) {
      throw new UnauthorizedException('User not found')
    }

    // 解析請求 body
    const body = await request.json() as any
    const { name, settings } = body

    // 驗證輸入
    if (name !== undefined && typeof name !== 'string') {
      throw new ValidationException('Invalid name format')
    }

    if (name !== undefined && name.trim().length === 0) {
      throw new ValidationException('Name cannot be empty')
    }

    if (name !== undefined && name.length > 50) {
      throw new ValidationException('Name cannot exceed 50 characters')
    }

    if (settings !== undefined && typeof settings !== 'object') {
      throw new ValidationException('Invalid settings format')
    }

    // 更新用戶
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(settings !== undefined && { settings }),
        updated_at: new Date(),
      },
    })

    // 構建回應
    const displayName =
      updatedUser.name ||
      ((updatedUser.settings as any)?.displayName as string) ||
      updatedUser.email ||
      '未設定'

    return ApiResponseBuilder.success(
      {
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          name: updatedUser.name,
          displayName,
          auth_provider: updatedUser.auth_provider,
          settings: updatedUser.settings,
          updated_at: updatedUser.updated_at,
        },
      },
      {}
    )
  })
}
