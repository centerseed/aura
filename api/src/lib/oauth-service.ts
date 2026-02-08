/**
 * OAuth Service - 處理 Google OAuth 2.0 授權流程
 *
 * 功能：
 * - 生成 OAuth 授權 URL
 * - 處理 OAuth Callback（用 code 換取 token）
 * - Token 加密儲存
 * - 自動刷新 Access Token
 * - 撤銷授權
 */

import { PrismaClient } from '@prisma/client'
import crypto from 'crypto'

// ============================================================================
// Types
// ============================================================================

export type OAuthProvider = 'GOOGLE_CALENDAR' | 'GOOGLE_DRIVE' | 'ZOOM'

export interface OAuthConfig {
  clientId: string
  clientSecret: string
  redirectUri: string
  scopes: string[]
}

export interface OAuthToken {
  access_token: string
  refresh_token?: string
  expires_in: number
  scope: string
  token_type: string
}

export interface StoredOAuthToken {
  id: string
  user_id: string
  provider: OAuthProvider
  access_token: string
  refresh_token: string | null
  expires_at: Date
  scopes: string[]
  authorized_email: string | null
  created_at: Date
  updated_at: Date
}

// ============================================================================
// Configuration
// ============================================================================

const GOOGLE_OAUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'
const GOOGLE_REVOKE_ENDPOINT = 'https://oauth2.googleapis.com/revoke'

// 加密密鑰（從環境變數讀取，用於加密 Token）
const ENCRYPTION_KEY = process.env.OAUTH_ENCRYPTION_KEY ||
  crypto.randomBytes(32).toString('hex')

if (!process.env.OAUTH_ENCRYPTION_KEY) {
  console.warn('⚠️  OAUTH_ENCRYPTION_KEY not set, using random key (not suitable for production)')
}

// ============================================================================
// OAuth Configuration
// ============================================================================

function getOAuthConfig(provider: OAuthProvider): OAuthConfig {
  switch (provider) {
    case 'GOOGLE_CALENDAR':
      return {
        clientId: process.env.GOOGLE_OAUTH_CLIENT_ID || '',
        clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET || '',
        redirectUri: process.env.GOOGLE_OAUTH_REDIRECT_URI ||
          `${process.env.NEXT_PUBLIC_API_URL}/api/oauth/callback`,
        scopes: ['https://www.googleapis.com/auth/calendar'],
      }
    case 'GOOGLE_DRIVE':
      return {
        clientId: process.env.GOOGLE_OAUTH_CLIENT_ID || '',
        clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET || '',
        redirectUri: process.env.GOOGLE_OAUTH_REDIRECT_URI ||
          `${process.env.NEXT_PUBLIC_API_URL}/api/oauth/callback`,
        scopes: ['https://www.googleapis.com/auth/drive.file'],
      }
    default:
      throw new Error(`Unsupported OAuth provider: ${provider}`)
  }
}

// ============================================================================
// Token Encryption (加密 Token)
// ============================================================================

function encrypt(text: string): string {
  const algorithm = 'aes-256-cbc'
  const key = Buffer.from(ENCRYPTION_KEY.slice(0, 64), 'hex')
  const iv = crypto.randomBytes(16)

  const cipher = crypto.createCipheriv(algorithm, key, iv)
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')

  return iv.toString('hex') + ':' + encrypted
}

export function decrypt(text: string): string {
  const algorithm = 'aes-256-cbc'
  const key = Buffer.from(ENCRYPTION_KEY.slice(0, 64), 'hex')
  const parts = text.split(':')
  const iv = Buffer.from(parts.shift()!, 'hex')
  const encrypted = parts.join(':')

  const decipher = crypto.createDecipheriv(algorithm, key, iv)
  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}

// ============================================================================
// OAuth Service Class
// ============================================================================

export class OAuthService {
  constructor(private prisma: PrismaClient) {}

  /**
   * 生成 OAuth 授權 URL
   *
   * @param provider - OAuth Provider
   * @param userId - 使用者 ID（用於 state 參數）
   * @returns 授權 URL
   */
  async generateAuthorizationUrl(
    provider: OAuthProvider,
    userId: string
  ): Promise<string> {
    const config = getOAuthConfig(provider)

    // 生成 state（用於 CSRF 防護）
    const state = this.generateState(userId, provider)

    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      scope: config.scopes.join(' '),
      state,
      access_type: 'offline', // 請求 Refresh Token
      prompt: 'consent', // 強制顯示同意畫面（確保取得 Refresh Token）
    })

    return `${GOOGLE_OAUTH_ENDPOINT}?${params.toString()}`
  }

  /**
   * 處理 OAuth Callback（用 code 換取 token）
   *
   * @param code - Authorization Code
   * @param state - State 參數（用於驗證）
   * @returns 儲存的 Token 資訊
   */
  async handleCallback(
    code: string,
    state: string
  ): Promise<StoredOAuthToken> {
    // 驗證並解析 state
    const { userId, provider } = this.verifyState(state)

    const config = getOAuthConfig(provider)

    // 用 code 換取 token
    const tokenResponse = await fetch(GOOGLE_TOKEN_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
        grant_type: 'authorization_code',
      }),
    })

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text()
      throw new Error(`Failed to exchange code for token: ${error}`)
    }

    const tokenData = await tokenResponse.json() as OAuthToken

    // 儲存 Token（加密）
    return await this.storeToken(userId, provider, tokenData)
  }

  /**
   * 儲存 OAuth Token（加密儲存）
   */
  private async storeToken(
    userId: string,
    provider: OAuthProvider,
    tokenData: OAuthToken
  ): Promise<StoredOAuthToken> {
    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000)
    const scopes = tokenData.scope.split(' ')

    // 加密 Token
    const encryptedAccessToken = encrypt(tokenData.access_token)
    const encryptedRefreshToken = tokenData.refresh_token
      ? encrypt(tokenData.refresh_token)
      : null

    // Upsert（如果已存在則更新）
    const stored = await this.prisma.oAuthToken.upsert({
      where: {
        user_id_provider: {
          user_id: userId,
          provider,
        },
      },
      update: {
        access_token: encryptedAccessToken,
        refresh_token: encryptedRefreshToken,
        expires_at: expiresAt,
        scopes,
        updated_at: new Date(),
      },
      create: {
        user_id: userId,
        provider,
        access_token: encryptedAccessToken,
        refresh_token: encryptedRefreshToken,
        expires_at: expiresAt,
        scopes,
      },
    })

    console.log(`✅ OAuth Token stored for user ${userId}, provider ${provider}`)

    return stored as StoredOAuthToken
  }

  /**
   * 取得 Access Token（自動刷新如果過期）
   *
   * @param userId - 使用者 ID
   * @param provider - OAuth Provider
   * @returns Decrypted Access Token
   */
  async getAccessToken(
    userId: string,
    provider: OAuthProvider
  ): Promise<string | null> {
    const tokenRecord = await this.prisma.oAuthToken.findUnique({
      where: {
        user_id_provider: {
          user_id: userId,
          provider,
        },
      },
    })

    if (!tokenRecord) {
      return null
    }

    // 檢查是否即將過期（提前 5 分鐘刷新）
    const expiresIn = tokenRecord.expires_at.getTime() - Date.now()
    const shouldRefresh = expiresIn < 5 * 60 * 1000 // 5 分鐘

    if (shouldRefresh && tokenRecord.refresh_token) {
      console.log(`🔄 Refreshing token for user ${userId}, provider ${provider}`)
      await this.refreshToken(userId, provider, decrypt(tokenRecord.refresh_token))

      // 重新取得
      const refreshed = await this.prisma.oAuthToken.findUnique({
        where: {
          user_id_provider: {
            user_id: userId,
            provider,
          },
        },
      })

      if (!refreshed) {
        throw new Error('Failed to retrieve refreshed token')
      }

      return decrypt(refreshed.access_token)
    }

    return decrypt(tokenRecord.access_token)
  }

  /**
   * 刷新 Access Token
   */
  private async refreshToken(
    userId: string,
    provider: OAuthProvider,
    refreshToken: string
  ): Promise<void> {
    const config = getOAuthConfig(provider)

    const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error(`Failed to refresh token: ${error}`)
      throw new Error('Failed to refresh access token')
    }

    const tokenData = await response.json() as OAuthToken

    // 更新 Access Token
    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000)

    await this.prisma.oAuthToken.update({
      where: {
        user_id_provider: {
          user_id: userId,
          provider,
        },
      },
      data: {
        access_token: encrypt(tokenData.access_token),
        expires_at: expiresAt,
        updated_at: new Date(),
      },
    })

    console.log(`✅ Token refreshed for user ${userId}, provider ${provider}`)
  }

  /**
   * 撤銷 OAuth 授權
   */
  async revokeAuthorization(
    userId: string,
    provider: OAuthProvider
  ): Promise<void> {
    const tokenRecord = await this.prisma.oAuthToken.findUnique({
      where: {
        user_id_provider: {
          user_id: userId,
          provider,
        },
      },
    })

    if (!tokenRecord) {
      return
    }

    // 撤銷 Google OAuth Token
    const accessToken = decrypt(tokenRecord.access_token)

    try {
      await fetch(GOOGLE_REVOKE_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          token: accessToken,
        }),
      })
    } catch (error) {
      console.error('Failed to revoke token from Google:', error)
      // 繼續執行，仍然刪除本地記錄
    }

    // 刪除本地記錄
    await this.prisma.oAuthToken.delete({
      where: {
        user_id_provider: {
          user_id: userId,
          provider,
        },
      },
    })

    console.log(`✅ Authorization revoked for user ${userId}, provider ${provider}`)
  }

  /**
   * 檢查授權狀態
   */
  async getAuthorizationStatus(
    userId: string,
    provider: OAuthProvider
  ): Promise<{
    authorized: boolean
    authorized_email: string | null
    scopes: string[]
    expires_at: Date | null
  }> {
    const tokenRecord = await this.prisma.oAuthToken.findUnique({
      where: {
        user_id_provider: {
          user_id: userId,
          provider,
        },
      },
    })

    if (!tokenRecord) {
      return {
        authorized: false,
        authorized_email: null,
        scopes: [],
        expires_at: null,
      }
    }

    return {
      authorized: true,
      authorized_email: tokenRecord.authorized_email,
      scopes: tokenRecord.scopes,
      expires_at: tokenRecord.expires_at,
    }
  }

  // ==========================================================================
  // State Management (CSRF Protection)
  // ==========================================================================

  /**
   * 生成 State（用於 CSRF 防護）
   * Format: base64(userId:provider:timestamp:hmac)
   */
  private generateState(userId: string, provider: OAuthProvider): string {
    const timestamp = Date.now()
    const data = `${userId}:${provider}:${timestamp}`
    const hmac = crypto
      .createHmac('sha256', ENCRYPTION_KEY)
      .update(data)
      .digest('hex')

    const state = `${data}:${hmac}`
    return Buffer.from(state).toString('base64url')
  }

  /**
   * 驗證並解析 State
   */
  private verifyState(state: string): { userId: string; provider: OAuthProvider } {
    try {
      const decoded = Buffer.from(state, 'base64url').toString('utf8')
      const parts = decoded.split(':')

      if (parts.length !== 4) {
        throw new Error('Invalid state format')
      }

      const [userId, provider, timestamp, hmac] = parts

      // 驗證 HMAC
      const data = `${userId}:${provider}:${timestamp}`
      const expectedHmac = crypto
        .createHmac('sha256', ENCRYPTION_KEY)
        .update(data)
        .digest('hex')

      if (hmac !== expectedHmac) {
        throw new Error('Invalid state HMAC')
      }

      // 檢查時間戳（防止重放攻擊，10 分鐘內有效）
      const age = Date.now() - parseInt(timestamp)
      if (age > 10 * 60 * 1000) {
        throw new Error('State expired')
      }

      return {
        userId,
        provider: provider as OAuthProvider,
      }
    } catch (error) {
      throw new Error(`Invalid or expired state: ${error}`)
    }
  }
}
