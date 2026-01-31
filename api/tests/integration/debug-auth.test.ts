/**
 * Debug 認證問題
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { POST } from '@/app/api/products/route'
import { NextRequest } from 'next/server'

const TEST_USER_ID = '00000000-0000-0000-0000-000000000077'
const TEST_FIREBASE_UID = 'debug-test-firebase-uid'

// Mock Firebase Admin
vi.mock('@/lib/firebase-admin', () => ({
  getAuth: vi.fn(() => ({
    verifyIdToken: vi.fn().mockResolvedValue({ uid: TEST_FIREBASE_UID }),
  })),
}))

describe('Debug 認證流程', () => {
  let testAreaId: string

  beforeAll(async () => {
    // 清理
    await prisma.product.deleteMany({ where: { user_id: TEST_USER_ID } })
    await prisma.area.deleteMany({ where: { user_id: TEST_USER_ID } })
    await prisma.user.deleteMany({ where: { id: TEST_USER_ID } })

    // 建立測試用戶
    const user = await prisma.user.create({
      data: {
        id: TEST_USER_ID,
        email: 'debug@example.com',
        name: 'Debug User',
        auth_provider: 'GOOGLE',
        auth_provider_id: TEST_FIREBASE_UID,
      },
    })
    console.log('✅ 建立測試用戶:', user)

    // 建立測試 Area
    const area = await prisma.area.create({
      data: {
        user_id: TEST_USER_ID,
        name: 'Debug Test Area',
        is_custom: true,
      },
    })
    testAreaId = area.id
    console.log('✅ 建立測試 Area:', area)
  })

  afterAll(async () => {
    await prisma.product.deleteMany({ where: { user_id: TEST_USER_ID } })
    await prisma.area.deleteMany({ where: { user_id: TEST_USER_ID } })
    await prisma.user.deleteMany({ where: { id: TEST_USER_ID } })
  })

  it('應該成功建立產品', async () => {
    console.log('📝 測試開始 - testAreaId:', testAreaId)

    const request = new NextRequest('http://localhost/api/products', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer test-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        areaId: testAreaId,
        name: 'Debug Test Product',
        description: 'Testing authentication',
      }),
    })

    console.log('📤 發送請求...')
    const response = await POST(request)
    const data = await response.json()

    console.log('📥 回應狀態:', response.status)
    console.log('📥 回應內容:', JSON.stringify(data, null, 2))

    expect(response.status).toBe(200)
    expect(data).toHaveProperty('success', true)
  })

  it('驗證用戶是否存在於資料庫', async () => {
    const user = await prisma.user.findFirst({
      where: { auth_provider_id: TEST_FIREBASE_UID },
    })

    console.log('🔍 查詢用戶結果:', user)
    expect(user).toBeDefined()
    expect(user?.id).toBe(TEST_USER_ID)
  })
})
