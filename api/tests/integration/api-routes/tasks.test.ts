/**
 * Tasks API 整合測試
 *
 * 測試 /api/tasks 的完整 CRUD 操作
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import {
  setupIntegrationTests,
  cleanupIntegrationTests,
  TEST_USER_ID,
  TEST_FIREBASE_UID,
} from '../setup'
import { GET, POST } from '@/app/api/tasks/route'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'

// Mock Firebase Admin
vi.mock('@/lib/firebase-admin', () => ({
  getAuth: vi.fn(() => ({
    verifyIdToken: vi.fn().mockResolvedValue({ uid: TEST_FIREBASE_UID }),
  })),
}))

describe('Tasks API - Integration Tests', () => {
  let testProductId: string
  let testAreaId: string

  beforeAll(async () => {
    await setupIntegrationTests()

    // 建立測試用的 Area
    const area = await prisma.area.create({
      data: {
        user_id: TEST_USER_ID,
        name: 'Test Area',
        is_custom: true,
      },
    })
    testAreaId = area.id

    // 建立測試用的 Product
    const product = await prisma.product.create({
      data: {
        user_id: TEST_USER_ID,
        area_id: testAreaId,
        name: 'Test Product',
        status: 'ACTIVE',
        lifecycle: 'PERPETUAL',
      },
    })
    testProductId = product.id
  })

  afterAll(async () => {
    await cleanupIntegrationTests()
  })

  beforeEach(async () => {
    // 每個測試前清理 tasks
    await prisma.task.deleteMany({
      where: { user_id: TEST_USER_ID },
    })
  })

  describe('POST /api/tasks', () => {
    it('應該成功建立新任務', async () => {
      const request = new NextRequest('http://localhost/api/tasks', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer test-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          product_id: testProductId,
          content: 'New test task',
          status: 'INBOX',
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('success', true)
      expect(data.data.task).toHaveProperty('id')
      expect(data.data.task.content).toBe('New test task')
      expect(data.data.task.status).toBe('INBOX')
      expect(data.data.task.product_id).toBe(testProductId)
    })

    it('應該拋出錯誤當 product_id 無效', async () => {
      const request = new NextRequest('http://localhost/api/tasks', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer test-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          product_id: 'invalid-uuid',
          content: 'New test task',
          status: 'INBOX',
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data).toHaveProperty('success', false)
    })
  })

  describe('GET /api/tasks', () => {
    beforeEach(async () => {
      // 建立測試任務
      await prisma.task.createMany({
        data: [
          {
            user_id: TEST_USER_ID,
            product_id: testProductId,
            content: 'Task 1',
            status: 'INBOX',
          },
          {
            user_id: TEST_USER_ID,
            product_id: testProductId,
            content: 'Task 2',
            status: 'ACTIVE',
          },
          {
            user_id: TEST_USER_ID,
            product_id: testProductId,
            content: 'Task 3',
            status: 'ARCHIVE',
          },
        ],
      })
    })

    it('應該返回用戶的所有任務', async () => {
      const request = new NextRequest('http://localhost/api/tasks', {
        headers: {
          'Authorization': 'Bearer test-token',
        },
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('success', true)
      expect(data.data.tasks).toBeInstanceOf(Array)
      expect(data.data.tasks.length).toBeGreaterThanOrEqual(3)
    })

    it('應該能夠按狀態篩選任務', async () => {
      const url = new URL('http://localhost/api/tasks?status=ACTIVE')
      const request = new NextRequest(url, {
        headers: {
          'Authorization': 'Bearer test-token',
        },
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.tasks).toBeInstanceOf(Array)
      expect(data.data.tasks.every((task: any) => task.status === 'ACTIVE')).toBe(true)
    })

    it('應該能夠按 product_id 篩選任務', async () => {
      const url = new URL(`http://localhost/api/tasks?product_id=${testProductId}`)
      const request = new NextRequest(url, {
        headers: {
          'Authorization': 'Bearer test-token',
        },
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.tasks).toBeInstanceOf(Array)
      expect(data.data.tasks.every((task: any) => task.product_id === testProductId)).toBe(true)
    })
  })
})

/**
 * 運行指南：
 *
 * 這些整合測試驗證：
 * 1. 真實的資料庫 CRUD 操作
 * 2. API route 的請求/回應格式
 * 3. 資料驗證和錯誤處理
 * 4. 查詢參數和篩選功能
 *
 * 運行前請確保：
 * - 測試資料庫已設置並遷移
 * - 移除 describe 中的 .skip
 */
