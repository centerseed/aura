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

import { POST } from '@/app/api/products/route'
import { PATCH, DELETE } from '@/app/api/products/[id]/route'
import { createMockRequest } from '../../utils/test-helpers'
import {
  createTestUser,
  createTestArea,
  createTestProduct,
  createTestTask,
  cleanupTestData,
  disconnectDb,
} from '../../utils/db-helpers'

describe('Products API (Integration)', () => {
  let testUserId: string
  let testFirebaseUid: string
  let testAreaId: string

  beforeAll(async () => {
    // 創建測試用戶
    testFirebaseUid = `firebase-test-uid-${randomUUID()}`
    const user = await createTestUser({
      auth_provider_id: testFirebaseUid,
    })
    testUserId = user.id

    // 創建測試 Area
    const area = await createTestArea(testUserId, { name: 'Work' })
    testAreaId = area.id
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

  describe('POST /api/products', () => {
    it('應該創建新的 Product', async () => {
      const request = createMockRequest({
        method: 'POST',
        headers: { authorization: 'Bearer valid-token' },
        body: {
          areaId: testAreaId,
          name: 'New Product',
          description: 'Product description',
          status: 'ACTIVE',
          lifecycle: 'FINITE',
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.product).toBeDefined()
      expect(data.product.name).toBe('New Product')
      expect(data.product.area_id).toBe(testAreaId)
      expect(data.product.user_id).toBe(testUserId)
      expect(data.product.status).toBe('ACTIVE')
      expect(data.product.lifecycle).toBe('FINITE')

      // 驗證資料庫中的 Product
      const { prisma } = await import('@/lib/db')
      const product = await prisma.product.findFirst({
        where: { id: data.product.id, user_id: testUserId },
      })
      expect(product).not.toBeNull()
      expect(product?.name).toBe('New Product')
    }, 30000)

    it('應該使用預設值創建 Product', async () => {
      const request = createMockRequest({
        method: 'POST',
        headers: { authorization: 'Bearer valid-token' },
        body: {
          areaId: testAreaId,
          name: 'Product with Defaults',
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.product.status).toBe('ACTIVE') // 預設值
      expect(data.product.lifecycle).toBe('FINITE') // 預設值
    }, 30000)

    it('應該在缺少 areaId 時返回 400', async () => {
      const request = createMockRequest({
        method: 'POST',
        headers: { authorization: 'Bearer valid-token' },
        body: {
          name: 'Product without Area',
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid request data')
    }, 30000)

    it('應該在缺少 name 時返回 400', async () => {
      const request = createMockRequest({
        method: 'POST',
        headers: { authorization: 'Bearer valid-token' },
        body: {
          areaId: testAreaId,
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid request data')
    }, 30000)

    it('應該在 Area 不存在時返回 404', async () => {
      const nonExistentAreaId = randomUUID()

      const request = createMockRequest({
        method: 'POST',
        headers: { authorization: 'Bearer valid-token' },
        body: {
          areaId: nonExistentAreaId,
          name: 'Product with Non-existent Area',
        },
      })

      const response = await POST(request)

      expect(response.status).toBe(404)
      const data = await response.json()
      expect(data.error).toBe('Area not found')
    }, 30000)

    it('應該在重複名稱時返回 409', async () => {
      // 先創建 Product
      await createTestProduct(testUserId, testAreaId, { name: 'Existing Product' })

      // 嘗試創建同名 Product
      const request = createMockRequest({
        method: 'POST',
        headers: { authorization: 'Bearer valid-token' },
        body: {
          areaId: testAreaId,
          name: 'Existing Product',
        },
      })

      const response = await POST(request)

      expect(response.status).toBe(409)
      const data = await response.json()
      expect(data.error).toBe('Product with this name already exists in this area')
    }, 30000)

    it('應該允許不同 Areas 有同名 Product', async () => {
      // 創建另一個 Area
      const area2 = await createTestArea(testUserId, { name: 'Personal' })

      // 在第一個 Area 創建 Product
      await createTestProduct(testUserId, testAreaId, { name: 'Shared Name' })

      // 在第二個 Area 創建同名 Product（應該成功）
      const request = createMockRequest({
        method: 'POST',
        headers: { authorization: 'Bearer valid-token' },
        body: {
          areaId: area2.id,
          name: 'Shared Name',
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.product.name).toBe('Shared Name')
      expect(data.product.area_id).toBe(area2.id)
    }, 30000)

    it('應該在未認證時返回 401', async () => {
      mockVerifyIdToken.mockRejectedValue(new Error('Invalid token'))

      const request = createMockRequest({
        method: 'POST',
        headers: {},
        body: { areaId: testAreaId, name: 'Test Product' },
      })

      const response = await POST(request)

      expect(response.status).toBe(401)
      const data = await response.json()
      expect(data.error).toBe('Unauthorized')
    }, 30000)
  })

  describe('PATCH /api/products/[id]', () => {
    it('應該更新 Product', async () => {
      const product = await createTestProduct(testUserId, testAreaId, {
        name: 'Original Name',
      })

      const request = createMockRequest({
        method: 'PATCH',
        headers: { authorization: 'Bearer valid-token' },
        body: {
          name: 'Updated Name',
          description: 'Updated description',
          status: 'MAINTAIN',
        },
      })

      const params = Promise.resolve({ id: product.id })
      const response = await PATCH(request, { params })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.product.name).toBe('Updated Name')
      expect(data.product.description).toBe('Updated description')
      expect(data.product.status).toBe('MAINTAIN')
    }, 30000)

    it('應該移動 Product 到新 Area', async () => {
      const product = await createTestProduct(testUserId, testAreaId, {
        name: 'Product to Move',
      })

      // 創建新 Area
      const newArea = await createTestArea(testUserId, { name: 'New Area' })

      const request = createMockRequest({
        method: 'PATCH',
        headers: { authorization: 'Bearer valid-token' },
        body: {
          area_id: newArea.id,
        },
      })

      const params = Promise.resolve({ id: product.id })
      const response = await PATCH(request, { params })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.product.area_id).toBe(newArea.id)
    }, 30000)

    it('應該在 Product 不存在時返回 404', async () => {
      const nonExistentId = randomUUID()

      const request = createMockRequest({
        method: 'PATCH',
        headers: { authorization: 'Bearer valid-token' },
        body: { name: 'New Name' },
      })

      const params = Promise.resolve({ id: nonExistentId })
      const response = await PATCH(request, { params })

      expect(response.status).toBe(404)
      const data = await response.json()
      expect(data.error).toBe('Product not found')
    }, 30000)

    it('應該在重複名稱時返回 409', async () => {
      const product1 = await createTestProduct(testUserId, testAreaId, {
        name: 'Product 1',
      })
      await createTestProduct(testUserId, testAreaId, { name: 'Product 2' })

      const request = createMockRequest({
        method: 'PATCH',
        headers: { authorization: 'Bearer valid-token' },
        body: { name: 'Product 2' }, // 嘗試改為已存在的名稱
      })

      const params = Promise.resolve({ id: product1.id })
      const response = await PATCH(request, { params })

      expect(response.status).toBe(409)
      const data = await response.json()
      expect(data.error).toBe('Product with this name already exists in this area')
    }, 30000)

    it('應該在無效資料時返回 400', async () => {
      const product = await createTestProduct(testUserId, testAreaId, {
        name: 'Test Product',
      })

      const request = createMockRequest({
        method: 'PATCH',
        headers: { authorization: 'Bearer valid-token' },
        body: { name: '' }, // 空名稱無效
      })

      const params = Promise.resolve({ id: product.id })
      const response = await PATCH(request, { params })

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBe('Invalid request data')
    }, 30000)
  })

  describe('DELETE /api/products/[id]', () => {
    it('應該軟刪除 Product', async () => {
      const product = await createTestProduct(testUserId, testAreaId, {
        name: 'To Delete',
      })

      const request = createMockRequest({
        method: 'DELETE',
        headers: { authorization: 'Bearer valid-token' },
      })

      const params = Promise.resolve({ id: product.id })
      const response = await DELETE(request, { params })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)

      // 驗證資料庫中的 deleted_at
      const { prisma } = await import('@/lib/db')
      const deletedProduct = await prisma.product.findFirst({
        where: { id: product.id },
      })
      expect(deletedProduct?.deleted_at).not.toBeNull()
    }, 30000)

    it('應該在 Product 不存在時返回 404', async () => {
      const nonExistentId = randomUUID()

      const request = createMockRequest({
        method: 'DELETE',
        headers: { authorization: 'Bearer valid-token' },
      })

      const params = Promise.resolve({ id: nonExistentId })
      const response = await DELETE(request, { params })

      expect(response.status).toBe(404)
      const data = await response.json()
      expect(data.error).toBe('Product not found')
    }, 30000)

    it('應該在有 active tasks 時拒絕刪除', async () => {
      const product = await createTestProduct(testUserId, testAreaId, {
        name: 'Product with Tasks',
      })

      // 創建關聯的 active task
      await createTestTask(testUserId, product.id, {
        content: 'Active Task',
        status: 'ACTIVE',
      })

      const request = createMockRequest({
        method: 'DELETE',
        headers: { authorization: 'Bearer valid-token' },
      })

      const params = Promise.resolve({ id: product.id })
      const response = await DELETE(request, { params })

      expect(response.status).toBe(409)
      const data = await response.json()
      expect(data.error).toBe('Cannot delete product with active tasks')
      expect(data.details).toContain('1 active task(s)')
    }, 30000)

    it('應該允許刪除有 ARCHIVE 任務的 Product', async () => {
      const product = await createTestProduct(testUserId, testAreaId, {
        name: 'Product with Archived Tasks',
      })

      // 創建 ARCHIVE 狀態的 task（應該不會阻止刪除）
      const { prisma } = await import('@/lib/db')
      await prisma.task.create({
        data: {
          id: randomUUID(),
          user_id: testUserId,
          product_id: product.id,
          content: 'Archived Task',
          status: 'ARCHIVE',
          references: [],
          sub_items: [],
          deleted_at: null,
          created_at: new Date(),
          updated_at: new Date(),
        },
      })

      const request = createMockRequest({
        method: 'DELETE',
        headers: { authorization: 'Bearer valid-token' },
      })

      const params = Promise.resolve({ id: product.id })
      const response = await DELETE(request, { params })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    }, 30000)
  })
})
