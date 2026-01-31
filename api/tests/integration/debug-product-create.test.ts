/**
 * Debug 產品創建失敗
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { POST } from '@/app/api/products/route'
import { NextRequest } from 'next/server'

const TEST_USER_ID = '00000000-0000-0000-0000-000000000099'
const TEST_FIREBASE_UID = 'debug-product-create-uid'

vi.mock('@/lib/firebase-admin', () => ({
  getAuth: vi.fn(() => ({
    verifyIdToken: vi.fn().mockResolvedValue({ uid: TEST_FIREBASE_UID }),
  })),
}))

describe('Debug 產品創建', () => {
  let testAreaId: string

  beforeAll(async () => {
    // 清理
    await prisma.product.deleteMany({ where: { user_id: TEST_USER_ID } })
    await prisma.area.deleteMany({ where: { user_id: TEST_USER_ID } })
    await prisma.user.deleteMany({ where: { id: TEST_USER_ID } })

    // 建立測試用戶
    await prisma.user.create({
      data: {
        id: TEST_USER_ID,
        email: 'debug-product@example.com',
        name: 'Debug Product User',
        auth_provider: 'GOOGLE',
        auth_provider_id: TEST_FIREBASE_UID,
      },
    })
    console.log('✅ 建立測試用戶:', TEST_USER_ID)

    // 建立測試 Area
    const area = await prisma.area.create({
      data: {
        user_id: TEST_USER_ID,
        name: 'Debug Product Area',
        is_custom: true,
      },
    })
    testAreaId = area.id
    console.log('✅ 建立測試 Area:', testAreaId)
  })

  afterAll(async () => {
    await prisma.product.deleteMany({ where: { user_id: TEST_USER_ID } })
    await prisma.area.deleteMany({ where: { user_id: TEST_USER_ID } })
    await prisma.user.deleteMany({ where: { id: TEST_USER_ID } })
  })

  it('測試創建產品', async () => {
    const requestBody = {
      areaId: testAreaId,
      name: 'Debug Test Product',
    }
    
    console.log('📤 請求內容:', JSON.stringify(requestBody, null, 2))

    const request = new NextRequest('http://localhost/api/products', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer test-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })

    const response = await POST(request)
    const data = await response.json()

    console.log('📥 狀態碼:', response.status)
    console.log('📥 回應:', JSON.stringify(data, null, 2))
  })
})
