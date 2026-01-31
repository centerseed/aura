/**
 * GetCurrentUserUseCase - 獲取當前用戶資訊
 *
 * Application Layer Use Case
 * 根據 Firebase UID 獲取當前登入用戶的完整資訊
 */

import { prisma } from '@/lib/db'
import { ValidationException, NotFoundException } from '@/lib/api-response'

// ============================================================================
// DTOs (Data Transfer Objects)
// ============================================================================

export interface GetCurrentUserRequest {
  firebaseUid: string
}

export interface UserData {
  id: string
  email: string | null
  name: string | null
  displayName: string
  auth_provider: string
  auth_provider_id: string
  areas: Array<{
    id: string
    name: string
    scope: string | null
    description: string | null
  }>
  hasAreas: boolean
}

export interface GetCurrentUserResponse {
  user: UserData
}

// ============================================================================
// Use Case
// ============================================================================

export class GetCurrentUserUseCase {
  async execute(
    request: GetCurrentUserRequest
  ): Promise<GetCurrentUserResponse> {
    // 1. 驗證輸入
    this.validateRequest(request)

    // 2. 根據 Firebase UID 查詢用戶
    const user = await prisma.user.findFirst({
      where: {
        auth_provider_id: request.firebaseUid,
      },
      include: {
        areas: {
          where: { deleted_at: null },
          select: {
            id: true,
            name: true,
            scope: true,
            description: true,
          },
        },
      },
    })

    if (!user) {
      throw new NotFoundException('User')
    }

    // 3. 構建顯示名稱
    const displayName =
      user.name || (user.settings as any)?.displayName || user.email || '未命名用戶'

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        displayName,
        auth_provider: user.auth_provider,
        auth_provider_id: user.auth_provider_id,
        areas: user.areas,
        hasAreas: user.areas.length > 0,
      },
    }
  }

  /**
   * 驗證請求資料
   */
  private validateRequest(request: GetCurrentUserRequest): void {
    if (!request.firebaseUid) {
      throw new ValidationException('Firebase UID is required', 'firebaseUid')
    }
  }
}
