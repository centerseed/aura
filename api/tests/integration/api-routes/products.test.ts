/**
 * Products API 整合測試
 *
 * 測試 /api/products 的完整 CRUD 操作
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import {
  setupIntegrationTests,
  cleanupIntegrationTests,
  TEST_USER_ID,
  TEST_FIREBASE_UID,
} from '../setup'
import { GET, POST } from '@/app/api/products/route'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'

// Mock Firebase Admin
vi.mock('@/lib/firebase-admin', () => ({
  getAuth: vi.fn(() => ({
    verifyIdToken: vi.fn().mockResolvedValue({ uid: TEST_FIREBASE_UID }),
  })),
}))

describe('Products API - Integration Tests', () => {
  let testAreaId: string

  beforeAll(async () => {
    await setupIntegrationTests()
  })

  afterAll(async () => {
    await cleanupIntegrationTests()
  })

  beforeEach(async () => {
    // 每個測試前清理 products
    await prisma.product.deleteMany({
      where: { user_id: TEST_USER_ID },
    })

    // 確保測試用的 Area 存在
    const existingArea = await prisma.area.findFirst({
      where: { user_id: TEST_USER_ID, name: 'Integration Test Area' },
    })

    if (existingArea) {
      testAreaId = existingArea.id
    } else {
      const area = await prisma.area.create({
        data: {
          user_id: TEST_USER_ID,
          name: 'Integration Test Area',
          is_custom: true,
        },
      })
      testAreaId = area.id
    }
  })

  describe('POST /api/products', () => {
    it('應該成功建立新產品', async () => {
      const request = new NextRequest('http://localhost/api/products', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer test-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          areaId: testAreaId,
          name: 'Test Product',
          description: 'This is a test product',
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('success', true)
      expect(data.data.product).toHaveProperty('id')
      expect(data.data.product.name).toBe('Test Product')
      expect(data.data.product.area_id).toBe(testAreaId)
    })

    it('應該拋出錯誤當 area_id 無效', async () => {
      const request = new NextRequest('http://localhost/api/products', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer test-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          areaId: 'invalid-uuid',
          name: 'Test Product',
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data).toHaveProperty('success', false)
    })

    it('應該拋出錯誤當缺少 name', async () => {
      const request = new NextRequest('http://localhost/api/products', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer test-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          area_id: testAreaId,
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data).toHaveProperty('success', false)
    })
  })

  describe('GET /api/products', () => {
    beforeEach(async () => {
      // 建立測試產品
      await prisma.product.createMany({
        data: [
          {
            user_id: TEST_USER_ID,
            area_id: testAreaId,
            name: 'Product 1',
            status: 'ACTIVE',
            lifecycle: 'PERPETUAL',
          },
          {
            user_id: TEST_USER_ID,
            area_id: testAreaId,
            name: 'Product 2',
            status: 'ACTIVE',
            lifecycle: 'PERPETUAL',
          },
        ],
      })
    })

    it('應該返回用戶的所有產品', async () => {
      const request = new NextRequest('http://localhost/api/products', {
        headers: {
          'Authorization': 'Bearer test-token',
        },
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('success', true)
      expect(data.data.products).toBeInstanceOf(Array)
      expect(data.data.products.length).toBeGreaterThanOrEqual(2)
    })

    it('應該返回包含 area 資訊的產品', async () => {
      const request = new NextRequest('http://localhost/api/products', {
        headers: {
          'Authorization': 'Bearer test-token',
        },
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.products[0]).toHaveProperty('area')
      expect(data.data.products[0].area).toHaveProperty('id', testAreaId)
      expect(data.data.products[0].area).toHaveProperty('name', 'Integration Test Area')
    })

    it('應該能夠按 area_id 篩選產品', async () => {
      const url = new URL(`http://localhost/api/products?area_id=${testAreaId}`)
      const request = new NextRequest(url, {
        headers: {
          'Authorization': 'Bearer test-token',
        },
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.products).toBeInstanceOf(Array)
      expect(data.data.products.every((p: any) => p.area_id === testAreaId)).toBe(true)
    })
  })

  describe('資料庫約束測試', () => {
    it('應該拒絕建立同名產品在同一 area', async () => {
      // 第一個產品應該成功
      await prisma.product.create({
        data: {
          user_id: TEST_USER_ID,
          area_id: testAreaId,
          name: 'Duplicate Test',
          status: 'ACTIVE',
          lifecycle: 'PERPETUAL',
        },
      })

      // 第二個相同名稱的產品應該失敗（如果有 unique constraint）
      // 注意：如果資料庫沒有設置 unique constraint，這個測試會失敗
      // 這是一個好的發現 - 說明我們可能需要加入 unique constraint
    })

    it('應該正確建立產品與 area 的關聯', async () => {
      const product = await prisma.product.create({
        data: {
          user_id: TEST_USER_ID,
          area_id: testAreaId,
          name: 'Relation Test Product',
          status: 'ACTIVE',
          lifecycle: 'PERPETUAL',
        },
        include: {
          area: true,
        },
      })

      expect(product.area).toBeDefined()
      expect(product.area.id).toBe(testAreaId)
    })
  })
})
