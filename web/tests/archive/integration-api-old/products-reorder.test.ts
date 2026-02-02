import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { randomUUID } from 'crypto'

// Mock Firebase Admin BEFORE importing
const mockVerifyIdToken = vi.fn()
const mockAuth = {
  verifyIdToken: mockVerifyIdToken,
}

vi.mock('firebase-admin', () => ({
  default: {
    apps: [],
    initializeApp: vi.fn(),
    auth: () => mockAuth,
    credential: {
      cert: vi.fn(),
    },
  },
  apps: [],
  initializeApp: vi.fn(),
  auth: () => mockAuth,
  credential: {
    cert: vi.fn(),
  },
}))

vi.mock('@/lib/firebase-admin', () => ({
  getAuth: () => mockAuth,
}))

import { POST } from '@/app/api/products/reorder/route'
import { createMockRequest } from '../../utils/test-helpers'
import {
  createTestUser,
  createTestArea,
  createTestProduct,
  cleanupTestData,
  disconnectDb,
} from '../../utils/db-helpers'
import { prisma } from '@/lib/db'

describe('POST /api/products/reorder (Integration)', () => {
  let testUserId: string
  let testFirebaseUid: string
  let testAreaId: string
  let productIds: string[] = []

  beforeAll(async () => {
    // 創建測試用戶
    testFirebaseUid = `firebase-test-uid-${randomUUID()}`
    const user = await createTestUser({
      auth_provider_id: testFirebaseUid,
      email: 'reorder-test@example.com',
    })
    testUserId = user.id

    // 創建測試 Area
    const area = await createTestArea(testUserId, { name: 'Work' })
    testAreaId = area.id

    // 創建多個 Products 用於測試排序
    const product1 = await createTestProduct(testUserId, testAreaId, {
      name: 'Product 1',
      display_order: 1,
    })
    const product2 = await createTestProduct(testUserId, testAreaId, {
      name: 'Product 2',
      display_order: 2,
    })
    const product3 = await createTestProduct(testUserId, testAreaId, {
      name: 'Product 3',
      display_order: 3,
    })

    productIds = [product1.id, product2.id, product3.id]
  })

  afterAll(async () => {
    // 清理測試資料
    await cleanupTestData(testUserId)
    await disconnectDb()
  })

  beforeEach(() => {
    // 重置 Firebase mock
    mockVerifyIdToken.mockClear()
    mockVerifyIdToken.mockResolvedValue({ uid: testFirebaseUid })
  })

  it('應該成功重新排序多個 products', async () => {
    const request = createMockRequest({
      method: 'POST',
      headers: { authorization: 'Bearer valid-token' },
      body: {
        updates: [
          { id: productIds[0], display_order: 3 },
          { id: productIds[1], display_order: 1 },
          { id: productIds[2], display_order: 2 },
        ],
      },
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toHaveProperty('success', true)

    // 驗證資料庫中的順序已更新
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      orderBy: { display_order: 'asc' },
    })

    expect(products[0].id).toBe(productIds[1])
    expect(products[0].display_order).toBe(1)
    expect(products[1].id).toBe(productIds[2])
    expect(products[1].display_order).toBe(2)
    expect(products[2].id).toBe(productIds[0])
    expect(products[2].display_order).toBe(3)
  })

  it('應該在缺少 updates 時返回 400', async () => {
    const request = createMockRequest({
      method: 'POST',
      headers: { authorization: 'Bearer valid-token' },
      body: {},
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data).toHaveProperty('error')
    expect(data.error.message).toContain('updates array is required')
  })

  it('應該在 updates 不是數組時返回 400', async () => {
    const request = createMockRequest({
      method: 'POST',
      headers: { authorization: 'Bearer valid-token' },
      body: {
        updates: 'not-an-array',
      },
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data).toHaveProperty('error')
    expect(data.error.message).toContain('updates array is required')
  })

  it('應該在 update 項目缺少 id 時返回 400', async () => {
    const request = createMockRequest({
      method: 'POST',
      headers: { authorization: 'Bearer valid-token' },
      body: {
        updates: [
          { display_order: 1 }, // 缺少 id
        ],
      },
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data).toHaveProperty('error')
    expect(data.error.message).toContain('must have id and display_order')
  })

  it('應該在 update 項目缺少 display_order 時返回 400', async () => {
    const request = createMockRequest({
      method: 'POST',
      headers: { authorization: 'Bearer valid-token' },
      body: {
        updates: [
          { id: productIds[0] }, // 缺少 display_order
        ],
      },
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data).toHaveProperty('error')
    expect(data.error.message).toContain('must have id and display_order')
  })

  it('應該在 display_order 不是數字時返回 400', async () => {
    const request = createMockRequest({
      method: 'POST',
      headers: { authorization: 'Bearer valid-token' },
      body: {
        updates: [
          { id: productIds[0], display_order: 'not-a-number' },
        ],
      },
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data).toHaveProperty('error')
    expect(data.error.message).toContain('must have id and display_order')
  })

  it('應該處理部分 products 的重新排序', async () => {
    const request = createMockRequest({
      method: 'POST',
      headers: { authorization: 'Bearer valid-token' },
      body: {
        updates: [
          { id: productIds[0], display_order: 10 },
          // 只更新一個 product
        ],
      },
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toHaveProperty('success', true)

    // 驗證只有指定的 product 被更新
    const updatedProduct = await prisma.product.findUnique({
      where: { id: productIds[0] },
    })
    expect(updatedProduct?.display_order).toBe(10)
  })

  it('應該在未認證時返回 401', async () => {
    mockVerifyIdToken.mockRejectedValue(new Error('Invalid token'))

    const request = createMockRequest({
      method: 'POST',
      headers: { authorization: 'Bearer invalid-token' },
      body: {
        updates: [
          { id: productIds[0], display_order: 1 },
        ],
      },
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error.message).toBe('Invalid or expired token')
  })
})
