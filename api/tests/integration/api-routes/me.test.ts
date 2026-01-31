/**
 * GET /api/me 整合測試
 *
 * 注意：這些測試需要真實的資料庫連線
 * 運行前請確保：
 * 1. DATABASE_URL 環境變數已設置
 * 2. 資料庫已遷移（npx prisma migrate deploy）
 * 3. Firebase Admin 已正確配置
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

// Mock Firebase Admin for integration tests
vi.mock('@/lib/firebase-admin', () => ({
  getAuth: vi.fn(() => ({
    verifyIdToken: vi.fn().mockResolvedValue({ uid: TEST_FIREBASE_UID }),
  })),
}))

describe('GET /api/me - Integration Test', () => {
  beforeAll(async () => {
    await setupIntegrationTests()
  })

  afterAll(async () => {
    await cleanupIntegrationTests()
  })

  it('應該返回當前登入用戶的資訊', async () => {
    const request = new NextRequest('http://localhost/api/me', {
      headers: {
        'Authorization': 'Bearer test-token',
      },
    })

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toHaveProperty('success', true)
    expect(data.data.user).toHaveProperty('id', TEST_USER_ID)
    expect(data.data.user).toHaveProperty('email', 'test@example.com')
    expect(data.data.user).toHaveProperty('name', 'Test User')
  })

  it('應該拋出錯誤當缺少 Authorization header', async () => {
    const request = new NextRequest('http://localhost/api/me')

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data).toHaveProperty('success', false)
  })

  it('應該拋出錯誤當 token 格式錯誤', async () => {
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
})

/**
 * 如何運行這些測試：
 *
 * 1. 設置測試資料庫：
 *    export DATABASE_URL="postgresql://test:test@localhost:5432/zentropy_test"
 *
 * 2. 運行資料庫遷移：
 *    npx prisma migrate deploy
 *
 * 3. 移除 describe 中的 .skip
 *
 * 4. 運行測試：
 *    npm run test tests/integration/api-routes/me.test.ts
 */
