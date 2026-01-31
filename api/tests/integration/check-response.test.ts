/**
 * 檢查實際的 API 回應內容
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { POST, GET } from '@/app/api/products/route'
import { NextRequest } from 'next/server'

const TEST_USER_ID = '00000000-0000-0000-0000-000000000066'
const TEST_FIREBASE_UID = 'check-response-uid'

vi.mock('@/lib/firebase-admin', () => ({
  getAuth: vi.fn(() => ({
    verifyIdToken: vi.fn().mockResolvedValue({ uid: TEST_FIREBASE_UID }),
  })),
}))

describe('檢查 API 實際回應', () => {
  let testAreaId: string

  beforeAll(async () => {
    await prisma.product.deleteMany({ where: { user_id: TEST_USER_ID } })
    await prisma.area.deleteMany({ where: { user_id: TEST_USER_ID } })
    await prisma.user.deleteMany({ where: { id: TEST_USER_ID } })

    await prisma.user.create({
      data: {
        id: TEST_USER_ID,
        email: 'check@example.com',
        name: 'Check User',
        auth_provider: 'GOOGLE',
        auth_provider_id: TEST_FIREBASE_UID,
      },
    })

    const area = await prisma.area.create({
      data: {
        user_id: TEST_USER_ID,
        name: 'Check Area',
        is_custom: true,
      },
    })
    testAreaId = area.id
  })

  afterAll(async () => {
    await prisma.product.deleteMany({ where: { user_id: TEST_USER_ID } })
    await prisma.area.deleteMany({ where: { user_id: TEST_USER_ID } })
    await prisma.user.deleteMany({ where: { id: TEST_USER_ID } })
  })

  it('POST /api/products - 查看完整回應', async () => {
    const request = new NextRequest('http://localhost/api/products', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer test-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        areaId: testAreaId,
        name: 'Check Product',
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    console.log('\n=== POST /api/products 回應 ===')
    console.log('Status:', response.status)
    console.log('Data:', JSON.stringify(data, null, 2))
    console.log('================================\n')

    // 不檢查結果，只輸出
  })

  it('GET /api/products - 查看完整回應', async () => {
    const request = new NextRequest('http://localhost/api/products', {
      headers: {
        'Authorization': 'Bearer test-token',
      },
    })

    const response = await GET(request)
    const data = await response.json()

    console.log('\n=== GET /api/products 回應 ===')
    console.log('Status:', response.status)
    console.log('Data:', JSON.stringify(data, null, 2))
    console.log('================================\n')

    // 不檢查結果，只輸出
  })
})
