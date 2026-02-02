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

import { GET, POST } from '@/app/api/areas/route'
import { PUT, DELETE } from '@/app/api/areas/[id]/route'
import { createMockRequest } from '../../utils/test-helpers'
import {
  createTestUser,
  createTestArea,
  createTestProduct,
  cleanupTestData,
  disconnectDb,
} from '../../utils/db-helpers'

describe('Areas API (Integration)', () => {
  let testUserId: string
  let testFirebaseUid: string

  beforeAll(async () => {
    // 創建測試用戶
    testFirebaseUid = `firebase-test-uid-${randomUUID()}`
    const user = await createTestUser({
      auth_provider_id: testFirebaseUid,
    })
    testUserId = user.id
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

  describe('GET /api/areas', () => {
    it('應該返回用戶的所有 Areas', async () => {
      // 創建測試 Areas
      await createTestArea(testUserId, { name: 'Work' })
      await createTestArea(testUserId, { name: 'Personal' })

      const request = createMockRequest({
        method: 'GET',
        headers: { authorization: 'Bearer valid-token' },
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(Array.isArray(data)).toBe(true)
      expect(data.data.length).toBeGreaterThanOrEqual(2)

      // 驗證 Areas 結構
      const workArea = data.find((a: any) => a.name === 'Work')
      expect(workArea).toBeDefined()
      expect(workArea).toHaveProperty('id')
      expect(workArea).toHaveProperty('name')
      expect(workArea).toHaveProperty('user_id')
      expect(workArea.user_id).toBe(testUserId)
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

    it('應該過濾已刪除的 Areas', async () => {
      // 創建 Area 並軟刪除
      const area = await createTestArea(testUserId, { name: 'Deleted Area' })

      const { prisma } = await import('@/lib/db')
      await prisma.area.update({
        where: { id: area.id },
        data: { deleted_at: new Date() },
      })

      const request = createMockRequest({
        method: 'GET',
        headers: { authorization: 'Bearer valid-token' },
      })

      const response = await GET(request)
      const data = await response.json()

      // 確認已刪除的 Area 不在結果中
      const deletedArea = data.find((a: any) => a.name === 'Deleted Area')
      expect(deletedArea).toBeUndefined()
    }, 30000)

    it('應該只返回當前用戶的 Areas', async () => {
      // 創建另一個用戶和 Area
      const otherUser = await createTestUser({
        email: `other-${randomUUID()}@example.com`,
        auth_provider_id: `other-firebase-uid-${randomUUID()}`,
      })
      await createTestArea(otherUser.id, { name: 'Other User Area' })

      const request = createMockRequest({
        method: 'GET',
        headers: { authorization: 'Bearer valid-token' },
      })

      const response = await GET(request)
      const data = await response.json()

      // 確認沒有返回其他用戶的 Area
      const otherUserArea = data.find((a: any) => a.name === 'Other User Area')
      expect(otherUserArea).toBeUndefined()

      // 清理
      await cleanupTestData(otherUser.id)
    }, 30000)
  })

  describe('POST /api/areas', () => {
    it('應該創建新的 Area', async () => {
      const request = createMockRequest({
        method: 'POST',
        headers: { authorization: 'Bearer valid-token' },
        body: {
          name: 'New Area',
          scope: 'Work-related projects',
          description: 'Area for work projects',
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.created).toBe(true)
      expect(data.data.area).toBeDefined()
      expect(data.area.name).toBe('New Area')
      expect(data.area.scope).toBe('Work-related projects')
      expect(data.area.user_id).toBe(testUserId)

      // 驗證資料庫中的 Area
      const { prisma } = await import('@/lib/db')
      const area = await prisma.area.findFirst({
        where: { id: data.area.id, user_id: testUserId },
      })
      expect(area).not.toBeNull()
      expect(area?.name).toBe('New Area')
    }, 30000)

    it('應該在缺少 name 時返回 400', async () => {
      const request = createMockRequest({
        method: 'POST',
        headers: { authorization: 'Bearer valid-token' },
        body: {
          scope: 'Some scope',
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.message).toBe('name is required')
    }, 30000)

    it('應該更新已存在的同名 Area', async () => {
      // 先創建 Area
      const existingArea = await createTestArea(testUserId, {
        name: 'Existing Area',
      })

      // 嘗試創建同名 Area（應該更新）
      const request = createMockRequest({
        method: 'POST',
        headers: { authorization: 'Bearer valid-token' },
        body: {
          name: 'Existing Area',
          scope: 'Updated scope',
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.updated).toBe(true)
      expect(data.area.id).toBe(existingArea.id)
      expect(data.area.scope).toBe('Updated scope')
    }, 30000)

    it('應該在未認證時返回 401', async () => {
      mockVerifyIdToken.mockRejectedValue(new Error('Invalid token'))

      const request = createMockRequest({
        method: 'POST',
        headers: {},
        body: { name: 'Test Area' },
      })

      const response = await POST(request)

      expect(response.status).toBe(401)
      const data = await response.json()
      expect(data.error.message).toBe('Invalid or expired token')
    }, 30000)
  })

  describe('PUT /api/areas/[id]', () => {
    it('應該更新 Area', async () => {
      const area = await createTestArea(testUserId, { name: 'Original Name' })

      const request = createMockRequest({
        method: 'PUT',
        headers: { authorization: 'Bearer valid-token' },
        body: {
          name: 'Updated Name',
          scope: 'Updated scope',
        },
      })

      const params = Promise.resolve({ id: area.id })
      const response = await PUT(request, { params })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.area.name).toBe('Updated Name')
      expect(data.area.scope).toBe('Updated scope')
    }, 30000)

    it('應該在 Area 不存在時返回 404', async () => {
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
      expect(data.error.message).toBe('Area not found')
    }, 30000)

    it('應該在重複名稱時返回 409', async () => {
      const area1 = await createTestArea(testUserId, { name: 'Area 1' })
      await createTestArea(testUserId, { name: 'Area 2' })

      const request = createMockRequest({
        method: 'PUT',
        headers: { authorization: 'Bearer valid-token' },
        body: { name: 'Area 2' }, // 嘗試改為已存在的名稱
      })

      const params = Promise.resolve({ id: area1.id })
      const response = await PUT(request, { params })

      expect(response.status).toBe(409)
      const data = await response.json()
      expect(data.error.message).toBe('Area with this name already exists')
    }, 30000)

    it('應該在無效資料時返回 400', async () => {
      const area = await createTestArea(testUserId, { name: 'Test Area' })

      const request = createMockRequest({
        method: 'PUT',
        headers: { authorization: 'Bearer valid-token' },
        body: { name: '' }, // 空名稱無效
      })

      const params = Promise.resolve({ id: area.id })
      const response = await PUT(request, { params })

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error.message).toBe('Invalid request data')
    }, 30000)
  })

  describe('DELETE /api/areas/[id]', () => {
    it('應該軟刪除 Area', async () => {
      const area = await createTestArea(testUserId, { name: 'To Delete' })

      const request = createMockRequest({
        method: 'DELETE',
        headers: { authorization: 'Bearer valid-token' },
      })

      const params = Promise.resolve({ id: area.id })
      const response = await DELETE(request, { params })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)

      // 驗證資料庫中的 deleted_at
      const { prisma } = await import('@/lib/db')
      const deletedArea = await prisma.area.findFirst({
        where: { id: area.id },
      })
      expect(deletedArea?.deleted_at).not.toBeNull()
    }, 30000)

    it('應該在 Area 不存在時返回 404', async () => {
      const nonExistentId = randomUUID()

      const request = createMockRequest({
        method: 'DELETE',
        headers: { authorization: 'Bearer valid-token' },
      })

      const params = Promise.resolve({ id: nonExistentId })
      const response = await DELETE(request, { params })

      expect(response.status).toBe(404)
      const data = await response.json()
      expect(data.error.message).toBe('Area not found')
    }, 30000)

    it('應該在有關聯 Products 時拒絕刪除', async () => {
      const area = await createTestArea(testUserId, { name: 'Area with Products' })
      // 創建關聯的 Product
      await createTestProduct(testUserId, area.id, { name: 'Related Product' })

      const request = createMockRequest({
        method: 'DELETE',
        headers: { authorization: 'Bearer valid-token' },
      })

      const params = Promise.resolve({ id: area.id })
      const response = await DELETE(request, { params })

      expect(response.status).toBe(409)
      const data = await response.json()
      expect(data.error.message).toBe('Cannot delete area with existing products')
      expect(data.data.details).toContain('1 product(s)')
    }, 30000)
  })
})
