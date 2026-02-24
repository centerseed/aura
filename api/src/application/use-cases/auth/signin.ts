/**
 * SignInUseCase - 用戶登入
 *
 * Application Layer Use Case
 * 處理多種認證方式的用戶登入或創建
 */

import { prisma } from '@/lib/db'
import { ValidationException } from '@/lib/api-response'

// ============================================================================
// DTOs (Data Transfer Objects)
// ============================================================================

export interface SignInRequest {
  provider: 'google' | 'email' | 'apple'
  providerId?: string | null
  email?: string | null
  name?: string | null
}

export interface SignInResponse {
  id: string
  email: string | null
  name: string | null
  authProvider: string
  created: boolean // 是否為新創建的用戶
}

// ============================================================================
// Use Case
// ============================================================================

export class SignInUseCase {
  async execute(request: SignInRequest): Promise<SignInResponse> {
    // 1. 驗證輸入
    this.validateRequest(request)

    let user
    let created = false

    // 2. 根據不同的認證方式處理
    if (request.provider === 'google') {
      const result = await this.handleGoogleSignIn(request)
      user = result.user
      created = result.created
    } else if (request.provider === 'email') {
      const result = await this.handleEmailSignIn(request)
      user = result.user
      created = result.created
    } else if (request.provider === 'apple') {
      const result = await this.handleAppleSignIn(request)
      user = result.user
      created = result.created
    } else {
      throw new ValidationException('Unsupported auth provider', 'provider')
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      authProvider: user.auth_provider,
      created,
    }
  }

  /**
   * 處理 Google SSO 登入
   */
  private async handleGoogleSignIn(request: SignInRequest) {
    if (!request.providerId || !request.email) {
      throw new ValidationException(
        'Google login requires providerId and email',
        'providerId'
      )
    }

    // 嘗試查找現有用戶
    let user = await prisma.user.findFirst({
      where: {
        auth_provider: 'GOOGLE',
        auth_provider_id: request.providerId,
      },
    })

    let created = false

    if (!user) {
      // 創建新用戶
      user = await prisma.user.create({
        data: {
          email: request.email,
          name: request.name || request.email.split('@')[0],
          auth_provider: 'GOOGLE',
          auth_provider_id: request.providerId,
        },
      })
      created = true
    } else {
      // 更新用戶資訊(如果有變更)
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          email: request.email,
          name: request.name || user.name,
          updated_at: new Date(),
        },
      })
    }

    return { user, created }
  }

  /**
   * 處理 Email 登入(支援 Firebase Email/Password 認證)
   */
  private async handleEmailSignIn(request: SignInRequest) {
    if (!request.email || !request.name) {
      throw new ValidationException(
        'Email login requires email and name',
        'email'
      )
    }

    // 如果有 providerId，優先通過 providerId 查找用戶（Firebase Email/Password）
    let user = null
    if (request.providerId) {
      user = await prisma.user.findFirst({
        where: {
          auth_provider: 'EMAIL',
          auth_provider_id: request.providerId,
        },
      })
    }

    // 如果沒找到，再嘗試通過 email 查找（舊有方式相容）
    if (!user) {
      user = await prisma.user.findUnique({
        where: { email: request.email },
      })
    }

    let created = false

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: request.email,
          name: request.name,
          auth_provider: 'EMAIL',
          auth_provider_id: request.providerId || null,
        },
      })
      created = true
    } else {
      // 更新用戶資訊（包括 providerId，如果之前沒有的話）
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          name: request.name,
          auth_provider_id: request.providerId || user.auth_provider_id,
          updated_at: new Date(),
        },
      })
    }

    return { user, created }
  }

  /**
   * 處理 Apple ID 登入
   */
  private async handleAppleSignIn(request: SignInRequest) {
    if (!request.providerId) {
      throw new ValidationException(
        'Apple login requires providerId',
        'providerId'
      )
    }

    let user = await prisma.user.findFirst({
      where: {
        auth_provider: 'APPLE',
        auth_provider_id: request.providerId,
      },
    })

    let created = false

    if (!user) {
      // Apple Hide My Email：email 可能為 null，用 providerId 衍生 placeholder
      const email = request.email || `${request.providerId}@privaterelay.appleid.com`
      const name = request.name || email.split('@')[0]
      user = await prisma.user.create({
        data: {
          email,
          name,
          auth_provider: 'APPLE',
          auth_provider_id: request.providerId,
        },
      })
      created = true
    } else {
      // 有新資訊才更新（Apple 只在首次登入回傳 name/email）
      const updateData: any = { updated_at: new Date() }
      if (request.name && !user.name) updateData.name = request.name
      if (request.email && !user.email) updateData.email = request.email
      user = await prisma.user.update({
        where: { id: user.id },
        data: updateData,
      })
    }

    return { user, created }
  }

  /**
   * 驗證請求資料
   */
  private validateRequest(request: SignInRequest): void {
    if (!request.provider) {
      throw new ValidationException('Provider is required', 'provider')
    }

    const validProviders = ['google', 'email', 'apple']
    if (!validProviders.includes(request.provider)) {
      throw new ValidationException(
        `Provider must be one of: ${validProviders.join(', ')}`,
        'provider'
      )
    }
  }
}
