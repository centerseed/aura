/**
 * Topics API 整合測試
 *
 * 測試 /api/products/[id]/topics 的 GET 操作
 *
 * 注意：呼叫 API Route 的測試不能使用 withTestTransaction，
 * 因為 API Route 使用獨立的 Prisma 連線，看不到未 commit 的 transaction 資料。
 * 改用 prisma 直接建立資料（committed），afterEach 清理。
 */

import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import {
  setupIntegrationTests,
  cleanupIntegrationTests,
  TEST_USER_ID,
  TEST_FIREBASE_UID,
  withTestTransaction,
} from '../setup'
import { prisma } from '@/lib/db'
import { GET } from '@/app/api/products/[id]/topics/route'
import { NextRequest } from 'next/server'

// Mock Firebase Admin
vi.mock('@/lib/firebase-admin', () => ({
  getAuth: vi.fn(() => ({
    verifyIdToken: vi.fn().mockResolvedValue({ uid: TEST_FIREBASE_UID }),
  })),
}))

// 記錄每個測試建立的資料 ID，用於清理
let testAreaIds: string[] = []
let testProductIds: string[] = []
let testTopicIds: string[] = []

async function cleanupTestData() {
  if (testTopicIds.length > 0) {
    await prisma.topic.deleteMany({ where: { id: { in: testTopicIds } } }).catch(() => {})
    testTopicIds = []
  }
  if (testProductIds.length > 0) {
    await prisma.product.deleteMany({ where: { id: { in: testProductIds } } }).catch(() => {})
    testProductIds = []
  }
  if (testAreaIds.length > 0) {
    await prisma.area.deleteMany({ where: { id: { in: testAreaIds } } }).catch(() => {})
    testAreaIds = []
  }
}

describe('Topics API - Integration Tests', () => {
  beforeAll(async () => {
    await setupIntegrationTests()
  })

  afterAll(async () => {
    await cleanupTestData()
    await cleanupIntegrationTests()
  })

  afterEach(async () => {
    await cleanupTestData()
  })

  describe('GET /api/products/[id]/topics', () => {
    it('應該成功列出產品的所有 topics', async () => {
      // 建立測試資料（committed，API Route 可見）
      const area = await prisma.area.create({
        data: { user_id: TEST_USER_ID, name: 'Test Area', is_custom: true },
      })
      testAreaIds.push(area.id)

      const product = await prisma.product.create({
        data: {
          user_id: TEST_USER_ID,
          area_id: area.id,
          name: 'Test Product',
          description: 'Test Description',
          status: 'ACTIVE',
          lifecycle: 'FINITE',
        },
      })
      testProductIds.push(product.id)

      const topic1 = await prisma.topic.create({
        data: { user_id: TEST_USER_ID, product_id: product.id, name: 'Topic A' },
      })
      const topic2 = await prisma.topic.create({
        data: { user_id: TEST_USER_ID, product_id: product.id, name: 'Topic B' },
      })
      testTopicIds.push(topic1.id, topic2.id)

      const request = new NextRequest(
        `http://localhost/api/products/${product.id}/topics`,
        {
          method: 'GET',
          headers: { 'Authorization': 'Bearer test-token', 'Content-Type': 'application/json' },
        }
      )

      const response = await GET(request, { params: Promise.resolve({ id: product.id }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('data')
      expect(data.data).toHaveProperty('topics')
      expect(data.data.topics).toHaveLength(2)

      const topicNames = data.data.topics.map((t: any) => t.name).sort()
      expect(topicNames).toEqual(['Topic A', 'Topic B'])
      expect(data.data.topics[0]).toHaveProperty('id')
      expect(data.data.topics[0]).toHaveProperty('name')
    })

    it('應該返回空陣列當產品沒有 topics', async () => {
      const area = await prisma.area.create({
        data: { user_id: TEST_USER_ID, name: 'Test Area', is_custom: true },
      })
      testAreaIds.push(area.id)

      const product = await prisma.product.create({
        data: {
          user_id: TEST_USER_ID,
          area_id: area.id,
          name: 'Product Without Topics',
          status: 'ACTIVE',
          lifecycle: 'FINITE',
        },
      })
      testProductIds.push(product.id)

      const request = new NextRequest(
        `http://localhost/api/products/${product.id}/topics`,
        {
          method: 'GET',
          headers: { 'Authorization': 'Bearer test-token', 'Content-Type': 'application/json' },
        }
      )

      const response = await GET(request, { params: Promise.resolve({ id: product.id }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.topics).toEqual([])
    })

    it('應該排除已刪除的 topics (soft delete)', async () => {
      const area = await prisma.area.create({
        data: { user_id: TEST_USER_ID, name: 'Test Area', is_custom: true },
      })
      testAreaIds.push(area.id)

      const product = await prisma.product.create({
        data: {
          user_id: TEST_USER_ID,
          area_id: area.id,
          name: 'Test Product',
          status: 'ACTIVE',
          lifecycle: 'FINITE',
        },
      })
      testProductIds.push(product.id)

      const activeTopic = await prisma.topic.create({
        data: { user_id: TEST_USER_ID, product_id: product.id, name: 'Active Topic' },
      })
      const deletedTopic = await prisma.topic.create({
        data: { user_id: TEST_USER_ID, product_id: product.id, name: 'Deleted Topic', deleted_at: new Date() },
      })
      testTopicIds.push(activeTopic.id, deletedTopic.id)

      const request = new NextRequest(
        `http://localhost/api/products/${product.id}/topics`,
        {
          method: 'GET',
          headers: { 'Authorization': 'Bearer test-token', 'Content-Type': 'application/json' },
        }
      )

      const response = await GET(request, { params: Promise.resolve({ id: product.id }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.topics).toHaveLength(1)
      expect(data.data.topics[0].name).toBe('Active Topic')
    })

    it('應該返回 404 當產品不存在', async () => {
      // 不需要建立任何資料，直接用 fake ID
      await withTestTransaction(async () => {
        const fakeProductId = '00000000-0000-0000-0000-000000000099'

        const request = new NextRequest(
          `http://localhost/api/products/${fakeProductId}/topics`,
          {
            method: 'GET',
            headers: { 'Authorization': 'Bearer test-token', 'Content-Type': 'application/json' },
          }
        )

        const response = await GET(request, { params: Promise.resolve({ id: fakeProductId }) })
        const data = await response.json()

        expect(response.status).toBe(404)
        expect(data).toHaveProperty('error', 'Product not found')
      })
    })

    it('應該返回 404 當產品屬於其他用戶', async () => {
      const otherUserId = '00000000-0000-0000-0000-000000000002'

      // 建立另一個用戶
      await prisma.user.upsert({
        where: { id: otherUserId },
        create: {
          id: otherUserId,
          email: 'other@example.com',
          name: 'Other User',
          auth_provider: 'GOOGLE',
          auth_provider_id: 'other-firebase-uid',
        },
        update: {},
      })

      const area = await prisma.area.create({
        data: { user_id: otherUserId, name: 'Other User Area', is_custom: true },
      })
      testAreaIds.push(area.id)

      const product = await prisma.product.create({
        data: {
          user_id: otherUserId,
          area_id: area.id,
          name: 'Other User Product',
          status: 'ACTIVE',
          lifecycle: 'FINITE',
        },
      })
      testProductIds.push(product.id)

      const request = new NextRequest(
        `http://localhost/api/products/${product.id}/topics`,
        {
          method: 'GET',
          headers: { 'Authorization': 'Bearer test-token', 'Content-Type': 'application/json' },
        }
      )

      const response = await GET(request, { params: Promise.resolve({ id: product.id }) })
      const data = await response.json()

      // 清理 other user（需要先清 products/areas）
      await prisma.user.delete({ where: { id: otherUserId } }).catch(() => {})

      expect(response.status).toBe(404)
      expect(data).toHaveProperty('error', 'Product not found')
    })

    it('應該按 created_at 升序排序 topics', async () => {
      const area = await prisma.area.create({
        data: { user_id: TEST_USER_ID, name: 'Test Area', is_custom: true },
      })
      testAreaIds.push(area.id)

      const product = await prisma.product.create({
        data: {
          user_id: TEST_USER_ID,
          area_id: area.id,
          name: 'Test Product',
          status: 'ACTIVE',
          lifecycle: 'FINITE',
        },
      })
      testProductIds.push(product.id)

      const topic1 = await prisma.topic.create({
        data: { user_id: TEST_USER_ID, product_id: product.id, name: 'Topic 1', created_at: new Date('2024-01-01') },
      })
      const topic2 = await prisma.topic.create({
        data: { user_id: TEST_USER_ID, product_id: product.id, name: 'Topic 2', created_at: new Date('2024-01-02') },
      })
      const topic3 = await prisma.topic.create({
        data: { user_id: TEST_USER_ID, product_id: product.id, name: 'Topic 3', created_at: new Date('2024-01-03') },
      })
      testTopicIds.push(topic1.id, topic2.id, topic3.id)

      const request = new NextRequest(
        `http://localhost/api/products/${product.id}/topics`,
        {
          method: 'GET',
          headers: { 'Authorization': 'Bearer test-token', 'Content-Type': 'application/json' },
        }
      )

      const response = await GET(request, { params: Promise.resolve({ id: product.id }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.topics).toHaveLength(3)

      const names = data.data.topics.map((t: any) => t.name)
      expect(names).toEqual(['Topic 1', 'Topic 2', 'Topic 3'])
    })
  })
})
