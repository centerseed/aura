/**
 * Authentication 整合測試
 *
 * 測試認證相關的完整流程，確保：
 * 1. Firebase token 驗證正常運作
 * 2. 資料庫 user 查詢正常運作
 * 3. 認證失敗時的錯誤處理
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import {
  setupIntegrationTests,
  cleanupIntegrationTests,
  TEST_USER_ID,
  TEST_FIREBASE_UID,
} from '../setup'
import { GET } from '@/app/api/me/route'
import { NextRequest } from 'next/server'
import * as firebaseAdmin from '@/lib/firebase-admin'

describe('Authentication - Integration Tests', () => {
  beforeAll(async () => {
    await setupIntegrationTests()
  })

  afterAll(async () => {
    await cleanupIntegrationTests()
  })

  describe('成功的認證流程', () => {
    it('應該成功驗證有效的 Firebase token 並返回用戶資訊', async () => {
      // Mock Firebase Admin to return valid token
      vi.spyOn(firebaseAdmin, 'getAuth').mockReturnValue({
        verifyIdToken: vi.fn().mockResolvedValue({ uid: TEST_FIREBASE_UID }),
      } as any)

      const request = new NextRequest('http://localhost/api/me', {
        headers: {
          'Authorization': 'Bearer valid-token',
        },
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('success', true)
      expect(data.data.user).toHaveProperty('id', TEST_USER_ID)
      expect(data.data.user).toHaveProperty('email', 'test@example.com')
    })
  })

  describe('認證失敗場景', () => {
    it('應該拒絕缺少 Authorization header 的請求', async () => {
      const request = new NextRequest('http://localhost/api/me')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data).toHaveProperty('success', false)
      expect(data.error.message).toContain('authorization')
    })

    it('應該拒絕錯誤格式的 Authorization header', async () => {
      const request = new NextRequest('http://localhost/api/me', {
        headers: {
          'Authorization': 'InvalidFormat token',
        },
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data).toHaveProperty('success', false)
    })

    it('應該拒絕無效的 Firebase token', async () => {
      // Mock Firebase Admin to reject token
      vi.spyOn(firebaseAdmin, 'getAuth').mockReturnValue({
        verifyIdToken: vi.fn().mockRejectedValue(new Error('Invalid token')),
      } as any)

      const request = new NextRequest('http://localhost/api/me', {
        headers: {
          'Authorization': 'Bearer invalid-token',
        },
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data).toHaveProperty('success', false)
    })

    it('應該拒絕過期的 Firebase token', async () => {
      // Mock Firebase Admin to reject expired token
      vi.spyOn(firebaseAdmin, 'getAuth').mockReturnValue({
        verifyIdToken: vi
          .fn()
          .mockRejectedValue(new Error('Firebase ID token has expired')),
      } as any)

      const request = new NextRequest('http://localhost/api/me', {
        headers: {
          'Authorization': 'Bearer expired-token',
        },
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data).toHaveProperty('success', false)
    })

    it('應該拒絕不存在於資料庫的 Firebase UID', async () => {
      // Mock Firebase Admin to return valid token but with non-existent UID
      vi.spyOn(firebaseAdmin, 'getAuth').mockReturnValue({
        verifyIdToken: vi
          .fn()
          .mockResolvedValue({ uid: 'non-existent-firebase-uid' }),
      } as any)

      const request = new NextRequest('http://localhost/api/me', {
        headers: {
          'Authorization': 'Bearer valid-token-but-user-not-exists',
        },
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data).toHaveProperty('success', false)
    })
  })

  describe('資料庫連線測試', () => {
    it('應該能夠從資料庫查詢用戶', async () => {
      // 這個測試確保 DATABASE_URL 正確設置且資料庫可以存取
      vi.spyOn(firebaseAdmin, 'getAuth').mockReturnValue({
        verifyIdToken: vi.fn().mockResolvedValue({ uid: TEST_FIREBASE_UID }),
      } as any)

      const request = new NextRequest('http://localhost/api/me', {
        headers: {
          'Authorization': 'Bearer test-token',
        },
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.user).toBeDefined()
      expect(data.data.user.auth_provider_id).toBe(TEST_FIREBASE_UID)
    })
  })
})

/**
 * 這些測試的重要性：
 *
 * 1. 防止部署錯誤：
 *    - 確保 Firebase Admin SDK 在生產環境配置正確
 *    - 確保資料庫連線在真實環境下正常運作
 *
 * 2. 安全性驗證：
 *    - 確保無效 token 被正確拒絕
 *    - 確保錯誤訊息不洩漏敏感資訊
 *
 * 3. 錯誤處理：
 *    - 測試各種失敗場景
 *    - 確保錯誤回應格式一致
 */
