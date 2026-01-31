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

import { GET, POST } from '@/app/api/milestones/route'
import { PUT, DELETE } from '@/app/api/milestones/[id]/route'
import { createMockRequest } from '../../utils/test-helpers'
import {
  createTestUser,
  createTestArea,
  createTestProduct,
  cleanupTestData,
  disconnectDb,
} from '../../utils/db-helpers'

describe('Milestones API (Integration)', () => {
  let testUserId: string
  let testFirebaseUid: string
  let testAreaId: string
  let testProductId: string

  beforeAll(async () => {
    // 創建測試用戶
    testFirebaseUid = `firebase-test-uid-${randomUUID()}`
    const user = await createTestUser({
      auth_provider_id: testFirebaseUid,
    })
    testUserId = user.id

    // 創建測試 Area 和 Product
    const area = await createTestArea(testUserId, { name: 'Work' })
    testAreaId = area.id

    const product = await createTestProduct(testUserId, testAreaId, {
      name: 'Test Product',
    })
    testProductId = product.id
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

  describe('GET /api/milestones', () => {
    it('應該返回用戶的所有 Milestones', async () => {
      // 創建測試 Milestones
      const { prisma } = await import('@/lib/db')
      await prisma.milestone.create({
        data: {
          id: randomUUID(),
          user_id: testUserId,
          name: 'Product Launch',
          entity_type: 'PRODUCT',
          entity_id: testProductId,
          target_date: new Date('2024-12-31'),
          status: 'PENDING',
          priority: 5,
          created_at: new Date(),
          updated_at: new Date(),
        },
      })

      await prisma.milestone.create({
        data: {
          id: randomUUID(),
          user_id: testUserId,
          name: 'Area Goal',
          entity_type: 'AREA',
          entity_id: testAreaId,
          target_date: new Date('2024-11-30'),
          status: 'PENDING',
          priority: 3,
          created_at: new Date(),
          updated_at: new Date(),
        },
      })

      const request = createMockRequest({
        method: 'GET',
        headers: { authorization: 'Bearer valid-token' },
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(Array.isArray(data)).toBe(true)
      expect(data.data.length).toBeGreaterThanOrEqual(2)

      // 驗證 Product Milestone
      const productMilestone = data.find((m: any) => m.name === 'Product Launch')
      expect(productMilestone).toBeDefined()
      expect(productMilestone.entity_type).toBe('PRODUCT')
      expect(productMilestone.entity_id).toBe(testProductId)
      expect(productMilestone.product).toBeDefined()
      expect(productMilestone.product.name).toBe('Test Product')
      expect(productMilestone.area).toBeNull()
      expect(productMilestone.topic).toBeNull()

      // 驗證 Area Milestone
      const areaMilestone = data.find((m: any) => m.name === 'Area Goal')
      expect(areaMilestone).toBeDefined()
      expect(areaMilestone.entity_type).toBe('AREA')
      expect(areaMilestone.entity_id).toBe(testAreaId)
      expect(areaMilestone.area).toBeDefined()
      expect(areaMilestone.area.name).toBe('Work')
      expect(areaMilestone.product).toBeNull()
      expect(areaMilestone.topic).toBeNull()
    }, 30000)

    it('應該按 target_date 排序', async () => {
      const { prisma } = await import('@/lib/db')

      // 創建不同日期的 Milestones
      await prisma.milestone.create({
        data: {
          id: randomUUID(),
          user_id: testUserId,
          name: 'Later Milestone',
          entity_type: 'AREA',
          entity_id: testAreaId,
          target_date: new Date('2025-06-30'),
          status: 'PENDING',
          priority: 5,
          created_at: new Date(),
          updated_at: new Date(),
        },
      })

      await prisma.milestone.create({
        data: {
          id: randomUUID(),
          user_id: testUserId,
          name: 'Earlier Milestone',
          entity_type: 'AREA',
          entity_id: testAreaId,
          target_date: new Date('2024-06-30'),
          status: 'PENDING',
          priority: 5,
          created_at: new Date(),
          updated_at: new Date(),
        },
      })

      const request = createMockRequest({
        method: 'GET',
        headers: { authorization: 'Bearer valid-token' },
      })

      const response = await GET(request)
      const data = await response.json()

      // 找到這兩個 Milestones 的索引
      const earlierIndex = data.findIndex((m: any) => m.name === 'Earlier Milestone')
      const laterIndex = data.findIndex((m: any) => m.name === 'Later Milestone')

      // 早的應該在前面
      expect(earlierIndex).toBeLessThan(laterIndex)
    }, 30000)

    it('應該在未認證時返回 401', async () => {
      mockVerifyIdToken.mockRejectedValue(new Error('Invalid token'))

      const request = createMockRequest({
        method: 'GET',
        headers: {},
      })

      const response = await GET(request)

      expect(response.status).toBe(401)
      const data = await response.json()
      expect(data.error.message).toBe('Invalid or expired token')
    }, 30000)

    it('應該過濾已刪除的 Milestones', async () => {
      const { prisma } = await import('@/lib/db')

      // 創建並軟刪除 Milestone
      const milestone = await prisma.milestone.create({
        data: {
          id: randomUUID(),
          user_id: testUserId,
          name: 'Deleted Milestone',
          entity_type: 'AREA',
          entity_id: testAreaId,
          target_date: new Date('2024-12-31'),
          status: 'PENDING',
          priority: 5,
          created_at: new Date(),
          updated_at: new Date(),
        },
      })

      await prisma.milestone.update({
        where: { id: milestone.id },
        data: { deleted_at: new Date() },
      })

      const request = createMockRequest({
        method: 'GET',
        headers: { authorization: 'Bearer valid-token' },
      })

      const response = await GET(request)
      const data = await response.json()

      // 確認已刪除的 Milestone 不在結果中
      const deletedMilestone = data.find((m: any) => m.name === 'Deleted Milestone')
      expect(deletedMilestone).toBeUndefined()
    }, 30000)
  })

  describe('POST /api/milestones', () => {
    it('應該創建新的 Milestone', async () => {
      const request = createMockRequest({
        method: 'POST',
        headers: { authorization: 'Bearer valid-token' },
        body: {
          name: 'New Milestone',
          target_date: '2024-12-31T23:59:59Z',
          entity_type: 'PRODUCT',
          entity_id: testProductId,
          priority: 7,
          description: 'Important milestone',
          status: 'planned',
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data).toBeDefined()
      expect(data.data.name).toBe('New Milestone')
      expect(data.data.entity_type).toBe('PRODUCT')
      expect(data.data.entity_id).toBe(testProductId)
      expect(data.data.priority).toBe(7)
      expect(data.data.status).toBe('planned')

      // 驗證資料庫中的 Milestone
      const { prisma } = await import('@/lib/db')
      const milestone = await prisma.milestone.findFirst({
        where: { id: data.id, user_id: testUserId },
      })
      expect(milestone).not.toBeNull()
      expect(milestone?.name).toBe('New Milestone')
    }, 30000)

    it('應該使用預設值創建 Milestone', async () => {
      const request = createMockRequest({
        method: 'POST',
        headers: { authorization: 'Bearer valid-token' },
        body: {
          name: 'Milestone with Defaults',
          target_date: '2024-12-31T23:59:59Z',
          entity_type: 'AREA',
          entity_id: testAreaId,
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.data.priority).toBe(5) // 預設值
      expect(data.data.status).toBe('planned') // 預設值
    }, 30000)

    it('應該在缺少必填欄位時返回 400', async () => {
      const request = createMockRequest({
        method: 'POST',
        headers: { authorization: 'Bearer valid-token' },
        body: {
          name: 'Incomplete Milestone',
          // 缺少 target_date, entity_type, entity_id
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.message).toBe('Validation failed')
    }, 30000)

    it('應該在無效日期格式時返回 400', async () => {
      const request = createMockRequest({
        method: 'POST',
        headers: { authorization: 'Bearer valid-token' },
        body: {
          name: 'Invalid Date Milestone',
          target_date: 'not-a-date',
          entity_type: 'PRODUCT',
          entity_id: testProductId,
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.message).toBe('Validation failed')
    }, 30000)

    it('應該在未認證時返回 401', async () => {
      mockVerifyIdToken.mockRejectedValue(new Error('Invalid token'))

      const request = createMockRequest({
        method: 'POST',
        headers: {},
        body: {
          name: 'Test Milestone',
          target_date: '2024-12-31T23:59:59Z',
          entity_type: 'PRODUCT',
          entity_id: testProductId,
        },
      })

      const response = await POST(request)

      expect(response.status).toBe(401)
      const data = await response.json()
      expect(data.error.message).toBe('Invalid or expired token')
    }, 30000)
  })

  describe('PUT /api/milestones/[id]', () => {
    it('應該更新 Milestone', async () => {
      // 先創建 Milestone
      const { prisma } = await import('@/lib/db')
      const milestone = await prisma.milestone.create({
        data: {
          id: randomUUID(),
          user_id: testUserId,
          name: 'Original Name',
          entity_type: 'PRODUCT',
          entity_id: testProductId,
          target_date: new Date('2024-12-31'),
          status: 'PENDING',
          priority: 5,
          created_at: new Date(),
          updated_at: new Date(),
        },
      })

      const request = createMockRequest({
        method: 'PUT',
        headers: { authorization: 'Bearer valid-token' },
        body: {
          name: 'Updated Name',
          priority: 8,
          status: 'in_progress',
        },
      })

      const params = Promise.resolve({ id: milestone.id })
      const response = await PUT(request, { params })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.name).toBe('Updated Name')
      expect(data.data.priority).toBe(8)
      expect(data.data.status).toBe('in_progress')
    }, 30000)

    it('應該在 Milestone 不存在時返回 404', async () => {
      const nonExistentId = randomUUID()

      const request = createMockRequest({
        method: 'PUT',
        headers: { authorization: 'Bearer valid-token' },
        body: { name: 'New Name' },
      })

      const params = Promise.resolve({ id: nonExistentId })
      const response = await PUT(request, { params })

      expect(response.status).toBe(404)
      const data = await response.json()
      expect(data.error.message).toBe('Milestone not found')
    }, 30000)

    it('應該在無效資料時返回 400', async () => {
      const { prisma } = await import('@/lib/db')
      const milestone = await prisma.milestone.create({
        data: {
          id: randomUUID(),
          user_id: testUserId,
          name: 'Test Milestone',
          entity_type: 'PRODUCT',
          entity_id: testProductId,
          target_date: new Date('2024-12-31'),
          status: 'PENDING',
          priority: 5,
          created_at: new Date(),
          updated_at: new Date(),
        },
      })

      const request = createMockRequest({
        method: 'PUT',
        headers: { authorization: 'Bearer valid-token' },
        body: { priority: 15 }, // 超出範圍 (1-10)
      })

      const params = Promise.resolve({ id: milestone.id })
      const response = await PUT(request, { params })

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error.message).toBe('Validation failed')
    }, 30000)
  })

  describe('DELETE /api/milestones/[id]', () => {
    it('應該軟刪除 Milestone', async () => {
      const { prisma } = await import('@/lib/db')
      const milestone = await prisma.milestone.create({
        data: {
          id: randomUUID(),
          user_id: testUserId,
          name: 'To Delete',
          entity_type: 'PRODUCT',
          entity_id: testProductId,
          target_date: new Date('2024-12-31'),
          status: 'PENDING',
          priority: 5,
          created_at: new Date(),
          updated_at: new Date(),
        },
      })

      const request = createMockRequest({
        method: 'DELETE',
        headers: { authorization: 'Bearer valid-token' },
      })

      const params = Promise.resolve({ id: milestone.id })
      const response = await DELETE(request, { params })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)

      // 驗證資料庫中的 deleted_at
      const deletedMilestone = await prisma.milestone.findFirst({
        where: { id: milestone.id },
      })
      expect(deletedMilestone?.deleted_at).not.toBeNull()
    }, 30000)

    it('應該在 Milestone 不存在時返回 404', async () => {
      const nonExistentId = randomUUID()

      const request = createMockRequest({
        method: 'DELETE',
        headers: { authorization: 'Bearer valid-token' },
      })

      const params = Promise.resolve({ id: nonExistentId })
      const response = await DELETE(request, { params })

      expect(response.status).toBe(404)
      const data = await response.json()
      expect(data.error.message).toBe('Milestone not found')
    }, 30000)
  })
})
