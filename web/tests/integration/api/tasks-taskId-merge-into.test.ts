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

import { POST } from '@/app/api/tasks/[taskId]/merge-into/route'
import { createMockRequest } from '../../utils/test-helpers'
import {
  createTestUser,
  createTestArea,
  createTestProduct,
  createTestTask,
  cleanupTestData,
  disconnectDb,
} from '../../utils/db-helpers'
import { prisma } from '@/lib/db'

describe('POST /api/tasks/[taskId]/merge-into (Integration)', () => {
  let testUserId: string
  let testFirebaseUid: string
  let testProductId: string

  beforeAll(async () => {
    // 創建測試用戶
    testFirebaseUid = `firebase-test-uid-${randomUUID()}`
    const user = await createTestUser({
      auth_provider_id: testFirebaseUid,
      email: 'merge-test@example.com',
    })
    testUserId = user.id

    // 創建測試數據結構
    const area = await createTestArea(testUserId, { name: 'Work' })
    const product = await createTestProduct(testUserId, area.id, {
      name: 'Test Project',
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

  it('應該成功將來源任務合併為目標任務的 sub-item', async () => {
    const sourceTask = await createTestTask(testUserId, testProductId, {
      content: 'Source Task',
      status: 'ACTIVE',
    })

    const targetTask = await createTestTask(testUserId, testProductId, {
      content: 'Target Task',
      sub_items: [],
    })

    const request = createMockRequest({
      method: 'POST',
      headers: { authorization: 'Bearer valid-token' },
      body: {
        targetTaskId: targetTask.id,
      },
    })

    const response = await POST(request, {
      params: Promise.resolve({ taskId: sourceTask.id }),
    })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toHaveProperty('success', true)
    expect(data.data).toHaveProperty('source_task_id', sourceTask.id)
    expect(data.data).toHaveProperty('target_task_id', targetTask.id)
    expect(data.data.new_sub_item).toHaveProperty('content', 'Source Task')
    expect(data.data.sub_items_meta).toHaveProperty('total', 1)

    // 驗證來源任務已被軟刪除
    const deletedSource = await prisma.task.findUnique({
      where: { id: sourceTask.id },
    })
    expect(deletedSource?.deleted_at).not.toBeNull()

    // 驗證目標任務的 sub_items 已更新
    const updatedTarget = await prisma.task.findUnique({
      where: { id: targetTask.id },
    })
    const subItems = updatedTarget?.sub_items as any[]
    expect(subItems.length).toBe(1)
    expect(subItems[0].content).toBe('Source Task')
  })

  it('應該正確設置 sub-item 的 completed 狀態', async () => {
    const archivedTask = await createTestTask(testUserId, testProductId, {
      content: 'Archived Task',
      status: 'ARCHIVE',
    })

    const targetTask = await createTestTask(testUserId, testProductId, {
      content: 'Target',
      sub_items: [],
    })

    const request = createMockRequest({
      method: 'POST',
      headers: { authorization: 'Bearer valid-token' },
      body: {
        targetTaskId: targetTask.id,
      },
    })

    const response = await POST(request, {
      params: Promise.resolve({ taskId: archivedTask.id }),
    })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.data.new_sub_item).toHaveProperty('completed', true)
    expect(data.data.new_sub_item).toHaveProperty('completed_at')
  })

  it('應該合並 start_date (取最早的)', async () => {
    const earlyDate = new Date('2024-01-01')
    const lateDate = new Date('2024-12-31')

    const sourceTask = await createTestTask(testUserId, testProductId, {
      content: 'Source with early date',
      start_date: earlyDate,
    })

    const targetTask = await createTestTask(testUserId, testProductId, {
      content: 'Target with late date',
      start_date: lateDate,
    })

    const request = createMockRequest({
      method: 'POST',
      headers: { authorization: 'Bearer valid-token' },
      body: {
        targetTaskId: targetTask.id,
      },
    })

    await POST(request, {
      params: Promise.resolve({ taskId: sourceTask.id }),
    })

    // 驗證目標任務的 start_date 已更新為較早的日期
    const updatedTarget = await prisma.task.findUnique({
      where: { id: targetTask.id },
    })
    expect(updatedTarget?.start_date?.toISOString()).toBe(earlyDate.toISOString())
  })

  it('應該在來源有 start_date 但目標沒有時使用來源的日期', async () => {
    const sourceDate = new Date('2024-06-01')

    const sourceTask = await createTestTask(testUserId, testProductId, {
      content: 'Source with date',
      start_date: sourceDate,
    })

    const targetTask = await createTestTask(testUserId, testProductId, {
      content: 'Target without date',
      start_date: null,
    })

    const request = createMockRequest({
      method: 'POST',
      headers: { authorization: 'Bearer valid-token' },
      body: {
        targetTaskId: targetTask.id,
      },
    })

    await POST(request, {
      params: Promise.resolve({ taskId: sourceTask.id }),
    })

    const updatedTarget = await prisma.task.findUnique({
      where: { id: targetTask.id },
    })
    expect(updatedTarget?.start_date?.toISOString()).toBe(sourceDate.toISOString())
  })

  it('應該合並 references (去重)', async () => {
    const refId1 = randomUUID()
    const refId2 = randomUUID()
    const refId3 = randomUUID()

    const sourceTask = await createTestTask(testUserId, testProductId, {
      content: 'Source with refs',
      references: [
        {
          id: refId1,
          type: 'url',
          content: 'https://source.com',
          title: 'Source Ref',
          created_at: new Date().toISOString(),
        },
        {
          id: refId2,
          type: 'url',
          content: 'https://duplicate.com',
          title: 'Duplicate',
          created_at: new Date().toISOString(),
        },
      ],
    })

    const targetTask = await createTestTask(testUserId, testProductId, {
      content: 'Target with refs',
      references: [
        {
          id: refId2,
          type: 'url',
          content: 'https://duplicate.com',
          title: 'Duplicate',
          created_at: new Date().toISOString(),
        },
        {
          id: refId3,
          type: 'url',
          content: 'https://target.com',
          title: 'Target Ref',
          created_at: new Date().toISOString(),
        },
      ],
    })

    const request = createMockRequest({
      method: 'POST',
      headers: { authorization: 'Bearer valid-token' },
      body: {
        targetTaskId: targetTask.id,
      },
    })

    await POST(request, {
      params: Promise.resolve({ taskId: sourceTask.id }),
    })

    const updatedTarget = await prisma.task.findUnique({
      where: { id: targetTask.id },
    })
    const mergedRefs = updatedTarget?.references as any[]

    // 應該有 3 個去重後的 references (refId1, refId2, refId3)
    expect(mergedRefs.length).toBe(3)
    const refIds = mergedRefs.map((ref: any) => ref.id)
    expect(refIds).toContain(refId1)
    expect(refIds).toContain(refId2)
    expect(refIds).toContain(refId3)
  })

  it('應該在缺少 targetTaskId 時返回 400', async () => {
    const sourceTask = await createTestTask(testUserId, testProductId, {
      content: 'Source',
    })

    const request = createMockRequest({
      method: 'POST',
      headers: { authorization: 'Bearer valid-token' },
      body: {},
    })

    const response = await POST(request, {
      params: Promise.resolve({ taskId: sourceTask.id }),
    })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error.message).toBe('targetTaskId is required')
  })

  it('應該在嘗試將任務合併到自己時返回 400', async () => {
    const task = await createTestTask(testUserId, testProductId, {
      content: 'Self merge attempt',
    })

    const request = createMockRequest({
      method: 'POST',
      headers: { authorization: 'Bearer valid-token' },
      body: {
        targetTaskId: task.id,
      },
    })

    const response = await POST(request, {
      params: Promise.resolve({ taskId: task.id }),
    })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error.message).toBe('Cannot merge a task into itself')
  })

  it('應該在來源任務不存在時返回 404', async () => {
    const nonExistentId = randomUUID()
    const targetTask = await createTestTask(testUserId, testProductId, {
      content: 'Target',
    })

    const request = createMockRequest({
      method: 'POST',
      headers: { authorization: 'Bearer valid-token' },
      body: {
        targetTaskId: targetTask.id,
      },
    })

    const response = await POST(request, {
      params: Promise.resolve({ taskId: nonExistentId }),
    })
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error.message).toBe('Source task not found')
  })

  it('應該在目標任務不存在時返回 404', async () => {
    const nonExistentId = randomUUID()
    const sourceTask = await createTestTask(testUserId, testProductId, {
      content: 'Source',
    })

    const request = createMockRequest({
      method: 'POST',
      headers: { authorization: 'Bearer valid-token' },
      body: {
        targetTaskId: nonExistentId,
      },
    })

    const response = await POST(request, {
      params: Promise.resolve({ taskId: sourceTask.id }),
    })
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error.message).toBe('Target task not found')
  })

  it('應該保留原 task 的元數據', async () => {
    const sourceTask = await createTestTask(testUserId, testProductId, {
      content: 'Source with metadata',
    })

    const targetTask = await createTestTask(testUserId, testProductId, {
      content: 'Target',
      sub_items: [],
    })

    const request = createMockRequest({
      method: 'POST',
      headers: { authorization: 'Bearer valid-token' },
      body: {
        targetTaskId: targetTask.id,
      },
    })

    const response = await POST(request, {
      params: Promise.resolve({ taskId: sourceTask.id }),
    })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.data.new_sub_item).toHaveProperty('original_task_id', sourceTask.id)
  })
})
