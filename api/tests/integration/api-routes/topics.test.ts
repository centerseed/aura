/**
 * Topics API 整合測試
 *
 * 測試 /api/products/[id]/topics 的 GET 操作
 *
 * 使用 withTestTransaction 確保測試隔離（自動 rollback）
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import {
  setupIntegrationTests,
  cleanupIntegrationTests,
  TEST_USER_ID,
  TEST_FIREBASE_UID,
  withTestTransaction,
} from '../setup'
import { GET } from '@/app/api/products/[id]/topics/route'
import { NextRequest } from 'next/server'

// Mock Firebase Admin
vi.mock('@/lib/firebase-admin', () => ({
  getAuth: vi.fn(() => ({
    verifyIdToken: vi.fn().mockResolvedValue({ uid: TEST_FIREBASE_UID }),
  })),
}))

describe('Topics API - Integration Tests', () => {
  beforeAll(async () => {
    await setupIntegrationTests()
  })

  afterAll(async () => {
    await cleanupIntegrationTests()
  })

  describe('GET /api/products/[id]/topics', () => {
    it('應該成功列出產品的所有 topics', async () => {
      await withTestTransaction(async (tx) => {
        // 建立測試資料：area → product → topics
        const area = await tx.area.create({
          data: {
            user_id: TEST_USER_ID,
            name: 'Test Area',
            is_custom: true,
          },
        })

        const product = await tx.product.create({
          data: {
            user_id: TEST_USER_ID,
            area_id: area.id,
            name: 'Test Product',
            description: 'Test Description',
          },
        })

        const topic1 = await tx.topic.create({
          data: {
            user_id: TEST_USER_ID,
            product_id: product.id,
            name: 'Topic A',
          },
        })

        const topic2 = await tx.topic.create({
          data: {
            user_id: TEST_USER_ID,
            product_id: product.id,
            name: 'Topic B',
          },
        })

        // 發送 GET 請求
        const request = new NextRequest(
          `http://localhost/api/products/${product.id}/topics`,
          {
            method: 'GET',
            headers: {
              'Authorization': 'Bearer test-token',
              'Content-Type': 'application/json',
            },
          }
        )

        const response = await GET(request, { params: Promise.resolve({ id: product.id }) })
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data).toHaveProperty('data')
        expect(data.data).toHaveProperty('topics')
        expect(data.data.topics).toHaveLength(2)

        // 驗證 topic 名稱
        const topicNames = data.data.topics.map((t: any) => t.name).sort()
        expect(topicNames).toEqual(['Topic A', 'Topic B'])

        // 驗證 topic 結構
        expect(data.data.topics[0]).toHaveProperty('id')
        expect(data.data.topics[0]).toHaveProperty('name')
      })
    })

    it('應該返回空陣列當產品沒有 topics', async () => {
      await withTestTransaction(async (tx) => {
        // 建立沒有 topics 的產品
        const area = await tx.area.create({
          data: {
            user_id: TEST_USER_ID,
            name: 'Test Area',
            is_custom: true,
          },
        })

        const product = await tx.product.create({
          data: {
            user_id: TEST_USER_ID,
            area_id: area.id,
            name: 'Product Without Topics',
          },
        })

        // 發送 GET 請求
        const request = new NextRequest(
          `http://localhost/api/products/${product.id}/topics`,
          {
            method: 'GET',
            headers: {
              'Authorization': 'Bearer test-token',
              'Content-Type': 'application/json',
            },
          }
        )

        const response = await GET(request, { params: Promise.resolve({ id: product.id }) })
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data.data.topics).toEqual([])
      })
    })

    it('應該排除已刪除的 topics (soft delete)', async () => {
      await withTestTransaction(async (tx) => {
        const area = await tx.area.create({
          data: {
            user_id: TEST_USER_ID,
            name: 'Test Area',
            is_custom: true,
          },
        })

        const product = await tx.product.create({
          data: {
            user_id: TEST_USER_ID,
            area_id: area.id,
            name: 'Test Product',
          },
        })

        // 建立一個正常 topic 和一個已刪除的 topic
        await tx.topic.create({
          data: {
            user_id: TEST_USER_ID,
            product_id: product.id,
            name: 'Active Topic',
          },
        })

        await tx.topic.create({
          data: {
            user_id: TEST_USER_ID,
            product_id: product.id,
            name: 'Deleted Topic',
            deleted_at: new Date(),
          },
        })

        // 發送 GET 請求
        const request = new NextRequest(
          `http://localhost/api/products/${product.id}/topics`,
          {
            method: 'GET',
            headers: {
              'Authorization': 'Bearer test-token',
              'Content-Type': 'application/json',
            },
          }
        )

        const response = await GET(request, { params: Promise.resolve({ id: product.id }) })
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data.data.topics).toHaveLength(1)
        expect(data.data.topics[0].name).toBe('Active Topic')
      })
    })

    it('應該返回 404 當產品不存在', async () => {
      await withTestTransaction(async (tx) => {
        const fakeProductId = '00000000-0000-0000-0000-000000000099'

        const request = new NextRequest(
          `http://localhost/api/products/${fakeProductId}/topics`,
          {
            method: 'GET',
            headers: {
              'Authorization': 'Bearer test-token',
              'Content-Type': 'application/json',
            },
          }
        )

        const response = await GET(request, { params: Promise.resolve({ id: fakeProductId }) })
        const data = await response.json()

        expect(response.status).toBe(404)
        expect(data).toHaveProperty('error', 'Product not found')
      })
    })

    it('應該返回 404 當產品屬於其他用戶', async () => {
      await withTestTransaction(async (tx) => {
        // 建立另一個用戶的產品
        const otherUserId = '00000000-0000-0000-0000-000000000002'

        await tx.user.create({
          data: {
            id: otherUserId,
            email: 'other@example.com',
            name: 'Other User',
            auth_provider: 'GOOGLE',
            auth_provider_id: 'other-firebase-uid',
          },
        })

        const area = await tx.area.create({
          data: {
            user_id: otherUserId,
            name: 'Other User Area',
            is_custom: true,
          },
        })

        const product = await tx.product.create({
          data: {
            user_id: otherUserId,
            area_id: area.id,
            name: 'Other User Product',
          },
        })

        // TEST_USER_ID 嘗試訪問其他用戶的產品
        const request = new NextRequest(
          `http://localhost/api/products/${product.id}/topics`,
          {
            method: 'GET',
            headers: {
              'Authorization': 'Bearer test-token',
              'Content-Type': 'application/json',
            },
          }
        )

        const response = await GET(request, { params: Promise.resolve({ id: product.id }) })
        const data = await response.json()

        expect(response.status).toBe(404)
        expect(data).toHaveProperty('error', 'Product not found')
      })
    })

    it('應該按 created_at 升序排序 topics', async () => {
      await withTestTransaction(async (tx) => {
        const area = await tx.area.create({
          data: {
            user_id: TEST_USER_ID,
            name: 'Test Area',
            is_custom: true,
          },
        })

        const product = await tx.product.create({
          data: {
            user_id: TEST_USER_ID,
            area_id: area.id,
            name: 'Test Product',
          },
        })

        // 建立三個 topics（時間先後順序）
        const topic1 = await tx.topic.create({
          data: {
            user_id: TEST_USER_ID,
            product_id: product.id,
            name: 'Topic 1',
            created_at: new Date('2024-01-01'),
          },
        })

        const topic2 = await tx.topic.create({
          data: {
            user_id: TEST_USER_ID,
            product_id: product.id,
            name: 'Topic 2',
            created_at: new Date('2024-01-02'),
          },
        })

        const topic3 = await tx.topic.create({
          data: {
            user_id: TEST_USER_ID,
            product_id: product.id,
            name: 'Topic 3',
            created_at: new Date('2024-01-03'),
          },
        })

        const request = new NextRequest(
          `http://localhost/api/products/${product.id}/topics`,
          {
            method: 'GET',
            headers: {
              'Authorization': 'Bearer test-token',
              'Content-Type': 'application/json',
            },
          }
        )

        const response = await GET(request, { params: Promise.resolve({ id: product.id }) })
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data.data.topics).toHaveLength(3)

        // 驗證順序
        const names = data.data.topics.map((t: any) => t.name)
        expect(names).toEqual(['Topic 1', 'Topic 2', 'Topic 3'])
      })
    })
  })
})
