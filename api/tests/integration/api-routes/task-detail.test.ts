/**
 * Task Detail API 整合測試
 *
 * 測試 /api/tasks/[taskId] 的 GET, PATCH, DELETE 操作
 * 特別關注提醒欄位 (remindAt, reminderEnabled, reminderTimezone, notificationId)
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import {
  setupIntegrationTests,
  cleanupIntegrationTests,
  TEST_USER_ID,
  TEST_FIREBASE_UID,
} from '../setup'
import { GET, PATCH, DELETE } from '@/app/api/tasks/[taskId]/route'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'

// Mock Firebase Admin
vi.mock('@/lib/firebase-admin', () => ({
  getAuth: vi.fn(() => ({
    verifyIdToken: vi.fn().mockResolvedValue({ uid: TEST_FIREBASE_UID }),
  })),
}))

describe('Task Detail API - Integration Tests', () => {
  let testProductId: string
  let testAreaId: string
  let testTaskId: string

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
    // 每個測試前清理並創建新的測試任務
    await prisma.task.deleteMany({
      where: { user_id: TEST_USER_ID },
    })

    const task = await prisma.task.create({
      data: {
        user_id: TEST_USER_ID,
        product_id: testProductId,
        content: 'Test Task',
        status: 'ACTIVE',
      },
    })
    testTaskId = task.id
  })

  describe('GET /api/tasks/[taskId]', () => {
    it('應該成功取得任務詳情', async () => {
      const request = new NextRequest(`http://localhost/api/tasks/${testTaskId}`, {
        headers: {
          'Authorization': 'Bearer test-token',
        },
      })

      const response = await GET(request, { params: Promise.resolve({ taskId: testTaskId }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('success', true)
      expect(data.data.task.id).toBe(testTaskId)
      expect(data.data.task.content).toBe('Test Task')
    })

    it('應該包含提醒欄位在回應中', async () => {
      // 先更新任務設定提醒
      await prisma.task.update({
        where: { id: testTaskId },
        data: {
          remind_at: new Date('2024-12-25T09:00:00Z'),
          reminder_enabled: true,
          reminder_timezone: 'Asia/Taipei',
          notification_id: 1001,
        },
      })

      const request = new NextRequest(`http://localhost/api/tasks/${testTaskId}`, {
        headers: {
          'Authorization': 'Bearer test-token',
        },
      })

      const response = await GET(request, { params: Promise.resolve({ taskId: testTaskId }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.task).toHaveProperty('remind_at')
      expect(data.data.task).toHaveProperty('reminder_enabled', true)
      expect(data.data.task).toHaveProperty('reminder_timezone', 'Asia/Taipei')
      expect(data.data.task).toHaveProperty('notification_id', 1001)
    })
  })

  describe('PATCH /api/tasks/[taskId] - 基本欄位更新', () => {
    it('應該成功更新任務內容', async () => {
      const request = new NextRequest(`http://localhost/api/tasks/${testTaskId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': 'Bearer test-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: 'Updated Task Content',
        }),
      })

      const response = await PATCH(request, { params: Promise.resolve({ taskId: testTaskId }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('success', true)
      expect(data.data.task.content).toBe('Updated Task Content')
    })

    it('應該成功更新任務狀態', async () => {
      const request = new NextRequest(`http://localhost/api/tasks/${testTaskId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': 'Bearer test-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'ARCHIVE',
        }),
      })

      const response = await PATCH(request, { params: Promise.resolve({ taskId: testTaskId }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.task.status).toBe('ARCHIVE')
    })
  })

  describe('PATCH /api/tasks/[taskId] - 提醒欄位更新', () => {
    it('應該成功設定提醒時間', async () => {
      const remindAt = '2024-12-25T09:00:00Z'
      const request = new NextRequest(`http://localhost/api/tasks/${testTaskId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': 'Bearer test-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          remind_at: remindAt,
        }),
      })

      const response = await PATCH(request, { params: Promise.resolve({ taskId: testTaskId }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('success', true)
      expect(data.data.task).toHaveProperty('remind_at')
      // 驗證返回的日期是否正確 (比對日期值而非字串格式)
      expect(new Date(data.data.task.remind_at).getTime()).toBe(new Date(remindAt).getTime())
    })

    it('應該成功啟用提醒開關', async () => {
      const request = new NextRequest(`http://localhost/api/tasks/${testTaskId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': 'Bearer test-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reminder_enabled: true,
        }),
      })

      const response = await PATCH(request, { params: Promise.resolve({ taskId: testTaskId }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.task.reminder_enabled).toBe(true)
    })

    it('應該成功設定提醒時區', async () => {
      const request = new NextRequest(`http://localhost/api/tasks/${testTaskId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': 'Bearer test-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reminder_timezone: 'Asia/Taipei',
        }),
      })

      const response = await PATCH(request, { params: Promise.resolve({ taskId: testTaskId }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.task.reminder_timezone).toBe('Asia/Taipei')
    })

    it('應該成功設定通知 ID', async () => {
      const request = new NextRequest(`http://localhost/api/tasks/${testTaskId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': 'Bearer test-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          notification_id: 1001,
        }),
      })

      const response = await PATCH(request, { params: Promise.resolve({ taskId: testTaskId }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.task.notification_id).toBe(1001)
    })

    it('應該成功同時更新多個提醒欄位', async () => {
      const remindAt = '2024-12-25T09:00:00Z'
      const request = new NextRequest(`http://localhost/api/tasks/${testTaskId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': 'Bearer test-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          remind_at: remindAt,
          reminder_enabled: true,
          reminder_timezone: 'Asia/Taipei',
          notification_id: 1001,
        }),
      })

      const response = await PATCH(request, { params: Promise.resolve({ taskId: testTaskId }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      // 驗證日期值而非字串格式
      expect(new Date(data.data.task.remind_at).getTime()).toBe(new Date(remindAt).getTime())
      expect(data.data.task.reminder_enabled).toBe(true)
      expect(data.data.task.reminder_timezone).toBe('Asia/Taipei')
      expect(data.data.task.notification_id).toBe(1001)
    })

    it('應該成功清除提醒時間 (設為 null)', async () => {
      // 先設定提醒
      await prisma.task.update({
        where: { id: testTaskId },
        data: {
          remind_at: new Date('2024-12-25T09:00:00Z'),
          reminder_enabled: true,
        },
      })

      // 清除提醒
      const request = new NextRequest(`http://localhost/api/tasks/${testTaskId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': 'Bearer test-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          remind_at: null,
        }),
      })

      const response = await PATCH(request, { params: Promise.resolve({ taskId: testTaskId }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.task.remind_at).toBeNull()
    })

    it('應該成功關閉提醒開關', async () => {
      // 先啟用提醒
      await prisma.task.update({
        where: { id: testTaskId },
        data: {
          reminder_enabled: true,
        },
      })

      // 關閉提醒
      const request = new NextRequest(`http://localhost/api/tasks/${testTaskId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': 'Bearer test-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reminder_enabled: false,
        }),
      })

      const response = await PATCH(request, { params: Promise.resolve({ taskId: testTaskId }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.task.reminder_enabled).toBe(false)
    })

    it('應該在資料庫中正確儲存提醒欄位', async () => {
      const remindAt = '2024-12-25T09:00:00Z'
      const request = new NextRequest(`http://localhost/api/tasks/${testTaskId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': 'Bearer test-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          remind_at: remindAt,
          reminder_enabled: true,
          reminder_timezone: 'Asia/Taipei',
          notification_id: 1001,
        }),
      })

      await PATCH(request, { params: Promise.resolve({ taskId: testTaskId }) })

      // 從資料庫直接查詢驗證
      const updatedTask = await prisma.task.findUnique({
        where: { id: testTaskId },
      })

      expect(updatedTask).not.toBeNull()
      expect(updatedTask!.remind_at).toEqual(new Date(remindAt))
      expect(updatedTask!.reminder_enabled).toBe(true)
      expect(updatedTask!.reminder_timezone).toBe('Asia/Taipei')
      expect(updatedTask!.notification_id).toBe(1001)
    })
  })

  describe('DELETE /api/tasks/[taskId]', () => {
    it('應該成功軟刪除任務', async () => {
      const request = new NextRequest(`http://localhost/api/tasks/${testTaskId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': 'Bearer test-token',
        },
      })

      const response = await DELETE(request, { params: Promise.resolve({ taskId: testTaskId }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('success', true)

      // 驗證任務已被軟刪除
      const deletedTask = await prisma.task.findUnique({
        where: { id: testTaskId },
      })

      expect(deletedTask).not.toBeNull()
      expect(deletedTask!.deleted_at).not.toBeNull()
    })
  })
})

/**
 * 運行指南：
 *
 * 這些整合測試驗證：
 * 1. GET /api/tasks/[taskId] - 取得任務詳情,包含提醒欄位
 * 2. PATCH /api/tasks/[taskId] - 更新任務,特別是提醒欄位
 * 3. DELETE /api/tasks/[taskId] - 軟刪除任務
 * 4. 提醒欄位的完整 CRUD 流程
 * 5. 資料庫儲存的正確性
 *
 * 運行命令：
 * npm test -- tests/integration/api-routes/task-detail.test.ts
 */
