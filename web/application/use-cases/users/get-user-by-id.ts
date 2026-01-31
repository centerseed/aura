/**
 * GetUserByIdUseCase - 根據用戶 ID 獲取用戶資訊
 *
 * Application Layer Use Case
 * 根據用戶 ID 獲取用戶的完整資訊
 */

import { prisma } from '@/lib/db'
import { ValidationException, NotFoundException } from '@/lib/api-response'

// ============================================================================
// DTOs (Data Transfer Objects)
// ============================================================================

export interface GetUserByIdRequest {
  userId: string
}

export interface GetUserByIdResponse {
  id: string
  email: string | null
  name: string | null
  displayName: string
  areas: Array<{
    id: string
    name: string
    scope: string | null
    description: string | null
  }>
  hasAreas: boolean
}

// ============================================================================
// Use Case
// ============================================================================

export class GetUserByIdUseCase {
  async execute(
    request: GetUserByIdRequest
  ): Promise<GetUserByIdResponse> {
    // 1. 驗證輸入
    this.validateRequest(request)

    // 2. 根據 ID 查詢用戶
    const user = await prisma.user.findUnique({
      where: { id: request.userId },
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
      id: user.id,
      email: user.email,
      name: user.name,
      displayName,
      areas: user.areas,
      hasAreas: user.areas.length > 0,
    }
  }

  /**
   * 驗證請求資料
   */
  private validateRequest(request: GetUserByIdRequest): void {
    if (!request.userId) {
      throw new ValidationException('User ID is required', 'userId')
    }
  }
}
