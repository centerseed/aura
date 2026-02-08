/**
 * OAuth Service Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { OAuthService } from '@/lib/oauth-service'

// Mock Prisma Client
const mockPrisma = {
  oAuthToken: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}

describe('OAuthService', () => {
  let oauthService: OAuthService

  beforeEach(() => {
    vi.clearAllMocks()
    oauthService = new OAuthService(mockPrisma as any)
  })

  describe('generateAuthorizationUrl', () => {
    it('應該生成正確的 Google Calendar OAuth URL', async () => {
      const userId = 'test-user-id'
      const provider = 'GOOGLE_CALENDAR'

      const authUrl = await oauthService.generateAuthorizationUrl(
        provider,
        userId
      )

      // 驗證 URL 結構
      expect(authUrl).toContain('https://accounts.google.com/o/oauth2/v2/auth')
      expect(authUrl).toContain('client_id=')
      expect(authUrl).toContain('redirect_uri=')
      expect(authUrl).toContain('response_type=code')
      expect(authUrl).toContain('scope=')
      expect(authUrl).toContain('state=')
      expect(authUrl).toContain('access_type=offline')
      expect(authUrl).toContain('prompt=consent')
    })

    it('應該包含正確的 scope', async () => {
      const authUrl = await oauthService.generateAuthorizationUrl(
        'GOOGLE_CALENDAR',
        'test-user-id'
      )

      expect(authUrl).toContain(
        encodeURIComponent('https://www.googleapis.com/auth/calendar')
      )
    })
  })

  describe('getAuthorizationStatus', () => {
    it('應該返回未授權狀態（如果沒有 Token）', async () => {
      mockPrisma.oAuthToken.findUnique.mockResolvedValue(null)

      const status = await oauthService.getAuthorizationStatus(
        'test-user-id',
        'GOOGLE_CALENDAR'
      )

      expect(status).toEqual({
        authorized: false,
        authorized_email: null,
        scopes: [],
        expires_at: null,
      })
    })

    it('應該返回已授權狀態（如果有 Token）', async () => {
      const mockToken = {
        id: 'token-id',
        user_id: 'test-user-id',
        provider: 'GOOGLE_CALENDAR',
        access_token: 'encrypted-access-token',
        refresh_token: 'encrypted-refresh-token',
        expires_at: new Date('2026-02-08T10:00:00Z'),
        scopes: ['https://www.googleapis.com/auth/calendar'],
        authorized_email: 'user@gmail.com',
        created_at: new Date(),
        updated_at: new Date(),
      }

      mockPrisma.oAuthToken.findUnique.mockResolvedValue(mockToken)

      const status = await oauthService.getAuthorizationStatus(
        'test-user-id',
        'GOOGLE_CALENDAR'
      )

      expect(status).toEqual({
        authorized: true,
        authorized_email: 'user@gmail.com',
        scopes: ['https://www.googleapis.com/auth/calendar'],
        expires_at: new Date('2026-02-08T10:00:00Z'),
      })
    })
  })

  describe('State Management', () => {
    it('應該生成和驗證 State', async () => {
      // 此測試驗證 state 的生成和驗證機制
      // 實際測試需要存取 private methods，這裡只做概念驗證

      const authUrl = await oauthService.generateAuthorizationUrl(
        'GOOGLE_CALENDAR',
        'test-user-id'
      )

      // 提取 state 參數
      const url = new URL(authUrl)
      const state = url.searchParams.get('state')

      expect(state).toBeTruthy()
      expect(state!.length).toBeGreaterThan(0)

      // State 應該是 base64url 編碼
      expect(state).toMatch(/^[A-Za-z0-9_-]+$/)
    })
  })
})
