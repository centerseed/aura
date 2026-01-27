import { describe, it, expect, beforeEach, vi } from 'vitest'

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

import { GET } from '@/app/api/tasks/route'
import { prismaMock } from '../../mocks/prisma'
import { createMockRequest, createMockTask, createMockUser } from '../../utils/test-helpers'

function mockAuthenticatedUser(userId: string, firebaseUid = 'test-firebase-uid') {
  mockVerifyIdToken.mockResolvedValue({ uid: firebaseUid })
  return { userId, firebaseUid }
}

describe('GET /api/tasks', () => {
  const userId = 'test-user-id'

  beforeEach(() => {
    // 重要：先清除 mock，然後重新設置
    mockVerifyIdToken.mockClear()

    // 設置認證 mock
    const firebaseUid = 'test-firebase-uid'
    mockVerifyIdToken.mockResolvedValue({ uid: firebaseUid })

    // 設置 Prisma user mock
    prismaMock.user.findFirst.mockResolvedValue(
      createMockUser({ id: userId, auth_provider_id: firebaseUid }) as any
    )
  })

  it('應該返回用戶的所有任務（格式化）', async () => {
    const mockTasks = [
      {
        id: 'task-1',
        user_id: userId,
        product_id: 'product-1',
        topic_id: 'topic-1',
        content: '完成專案文件',
        status: 'ACTIVE',
        ai_analysis: {
          narrative: '需要撰寫完整的技術文件',
          lifecycle: 'active',
          strategy_used: 'boundary_match',
          reasoning: '基於專案截止日期',
        },
        start_date: new Date('2024-01-01'),
        due_date: new Date('2024-01-31'),
        time_confidence: 'high',
        inferred_from_milestone: 'milestone-1',
        references: [],
        sub_items: [],
        deleted_at: null,
        product: {
          id: 'product-1',
          name: 'Website Redesign',
          area_id: 'area-1',
          area: {
            id: 'area-1',
            name: 'Work',
          },
        },
        topic: {
          id: 'topic-1',
          name: 'Documentation',
        },
        created_at: new Date('2024-01-01'),
        updated_at: new Date('2024-01-01'),
      },
      {
        id: 'task-2',
        user_id: userId,
        product_id: 'product-2',
        topic_id: null,
        content: '學習 React',
        status: 'INBOX',
        ai_analysis: {
          narrative: '開始學習 React 基礎',
          lifecycle: 'embryo',
        },
        start_date: null,
        due_date: null,
        time_confidence: null,
        inferred_from_milestone: null,
        references: [],
        sub_items: [],
        deleted_at: null,
        product: {
          id: 'product-2',
          name: 'Learning',
          area_id: 'area-2',
          area: {
            id: 'area-2',
            name: 'Personal',
          },
        },
        topic: null,
        created_at: new Date('2024-01-02'),
        updated_at: new Date('2024-01-02'),
      },
    ]

    prismaMock.task.findMany.mockResolvedValue(mockTasks as any)

    const request = createMockRequest({
      headers: { authorization: 'Bearer valid-token' },
    })

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toHaveLength(2)

    // 驗證第一個任務的格式化
    expect(data[0]).toMatchObject({
      id: 'task-1',
      title: '完成專案文件',
      narrative: '需要撰寫完整的技術文件',
      drawer: 'ACTIVE',
      lifecycle: 'active',
      tag: {
        area: 'Work',
        product: 'Website Redesign',
        topic: 'Documentation',
      },
      strategy_used: 'boundary_match',
      reasoning: '基於專案截止日期',
      start_date: '2024-01-01T00:00:00.000Z',
      due_date: '2024-01-31T00:00:00.000Z',
      time_confidence: 'high',
      inferred_from_milestone: 'milestone-1',
    })

    // 驗證第二個任務（未分類 topic）
    expect(data[1]).toMatchObject({
      id: 'task-2',
      title: '學習 React',
      narrative: '開始學習 React 基礎',
      drawer: 'INBOX',
      lifecycle: 'embryo',
      tag: {
        area: 'Personal',
        product: 'Learning',
        topic: '未分類',
      },
      strategy_used: null,
      reasoning: null,
      start_date: null,
      due_date: null,
      time_confidence: null,
      inferred_from_milestone: null,
    })
  })

  it('應該在未認證時返回 401', async () => {
    prismaMock.user.findFirst.mockResolvedValue(null)

    const request = createMockRequest({
      headers: {},
    })

    const response = await GET(request)

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
  })

  it('應該過濾已刪除的任務', async () => {
    prismaMock.task.findMany.mockResolvedValue([])

    const request = createMockRequest({
      headers: { authorization: 'Bearer valid-token' },
    })

    await GET(request)

    expect(prismaMock.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          user_id: userId,
          deleted_at: null,
        }),
      })
    )
  })

  it('應該只返回當前用戶的任務', async () => {
    prismaMock.task.findMany.mockResolvedValue([])

    const request = createMockRequest({
      headers: { authorization: 'Bearer valid-token' },
    })

    await GET(request)

    expect(prismaMock.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          user_id: userId,
        }),
      })
    )
  })

  it('應該包含關聯的 product, area 和 topic', async () => {
    prismaMock.task.findMany.mockResolvedValue([])

    const request = createMockRequest({
      headers: { authorization: 'Bearer valid-token' },
    })

    await GET(request)

    expect(prismaMock.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: {
          product: {
            include: {
              area: true,
            },
          },
          topic: true,
        },
      })
    )
  })

  it('應該按創建時間倒序排列', async () => {
    prismaMock.task.findMany.mockResolvedValue([])

    const request = createMockRequest({
      headers: { authorization: 'Bearer valid-token' },
    })

    await GET(request)

    expect(prismaMock.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: {
          created_at: 'desc',
        },
      })
    )
  })

  it('應該處理空的任務列表', async () => {
    prismaMock.task.findMany.mockResolvedValue([])

    const request = createMockRequest({
      headers: { authorization: 'Bearer valid-token' },
    })

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual([])
  })

  it('應該處理沒有 ai_analysis 的任務', async () => {
    const mockTasks = [
      {
        id: 'task-1',
        user_id: userId,
        product_id: 'product-1',
        topic_id: null,
        content: '簡單任務',
        status: 'INBOX',
        ai_analysis: null,
        start_date: null,
        due_date: null,
        time_confidence: null,
        inferred_from_milestone: null,
        references: [],
        sub_items: [],
        deleted_at: null,
        product: {
          id: 'product-1',
          name: 'Project',
          area_id: 'area-1',
          area: {
            id: 'area-1',
            name: 'Work',
          },
        },
        topic: null,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]

    prismaMock.task.findMany.mockResolvedValue(mockTasks as any)

    const request = createMockRequest({
      headers: { authorization: 'Bearer valid-token' },
    })

    const response = await GET(request)
    const data = await response.json()

    expect(data[0]).toMatchObject({
      narrative: null,
      lifecycle: 'embryo',
      strategy_used: null,
      reasoning: null,
    })
  })

  it('應該在資料庫錯誤時返回 500', async () => {
    prismaMock.task.findMany.mockRejectedValue(new Error('Database connection failed'))

    const request = createMockRequest({
      headers: { authorization: 'Bearer valid-token' },
    })

    const response = await GET(request)

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Failed to fetch tasks' })
  })

  it('應該正確轉換日期為 ISO 字串', async () => {
    const testDate = new Date('2024-06-15T10:30:00.000Z')
    const mockTasks = [
      {
        id: 'task-1',
        user_id: userId,
        product_id: 'product-1',
        topic_id: null,
        content: 'Task with dates',
        status: 'ACTIVE',
        ai_analysis: {},
        start_date: testDate,
        due_date: testDate,
        time_confidence: 'medium',
        inferred_from_milestone: null,
        references: [],
        sub_items: [],
        deleted_at: null,
        product: {
          id: 'product-1',
          name: 'Project',
          area_id: 'area-1',
          area: {
            id: 'area-1',
            name: 'Work',
          },
        },
        topic: null,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]

    prismaMock.task.findMany.mockResolvedValue(mockTasks as any)

    const request = createMockRequest({
      headers: { authorization: 'Bearer valid-token' },
    })

    const response = await GET(request)
    const data = await response.json()

    // 調試：查看實際返回的數據
    console.log('Response status:', response.status)
    console.log('Response data:', JSON.stringify(data, null, 2))

    expect(response.status).toBe(200)
    expect(Array.isArray(data)).toBe(true)
    expect(data.length).toBeGreaterThan(0)
    if (data[0]) {
      expect(data[0].start_date).toBe('2024-06-15T10:30:00.000Z')
      expect(data[0].due_date).toBe('2024-06-15T10:30:00.000Z')
    }
  })

  it('應該處理多個任務並正確排序', async () => {
    const mockTasks = [
      {
        id: 'task-3',
        user_id: userId,
        product_id: 'product-1',
        topic_id: null,
        content: 'Newest task',
        status: 'INBOX',
        ai_analysis: {},
        start_date: null,
        due_date: null,
        time_confidence: null,
        inferred_from_milestone: null,
        references: [],
        sub_items: [],
        deleted_at: null,
        product: {
          id: 'product-1',
          name: 'Project',
          area_id: 'area-1',
          area: { id: 'area-1', name: 'Work' },
        },
        topic: null,
        created_at: new Date('2024-01-03'),
        updated_at: new Date('2024-01-03'),
      },
      {
        id: 'task-2',
        user_id: userId,
        product_id: 'product-1',
        topic_id: null,
        content: 'Middle task',
        status: 'ACTIVE',
        ai_analysis: {},
        start_date: null,
        due_date: null,
        time_confidence: null,
        inferred_from_milestone: null,
        references: [],
        sub_items: [],
        deleted_at: null,
        product: {
          id: 'product-1',
          name: 'Project',
          area_id: 'area-1',
          area: { id: 'area-1', name: 'Work' },
        },
        topic: null,
        created_at: new Date('2024-01-02'),
        updated_at: new Date('2024-01-02'),
      },
      {
        id: 'task-1',
        user_id: userId,
        product_id: 'product-1',
        topic_id: null,
        content: 'Oldest task',
        status: 'REFERENCE',
        ai_analysis: {},
        start_date: null,
        due_date: null,
        time_confidence: null,
        inferred_from_milestone: null,
        references: [],
        sub_items: [],
        deleted_at: null,
        product: {
          id: 'product-1',
          name: 'Project',
          area_id: 'area-1',
          area: { id: 'area-1', name: 'Work' },
        },
        topic: null,
        created_at: new Date('2024-01-01'),
        updated_at: new Date('2024-01-01'),
      },
    ]

    prismaMock.task.findMany.mockResolvedValue(mockTasks as any)

    const request = createMockRequest({
      headers: { authorization: 'Bearer valid-token' },
    })

    const response = await GET(request)
    const data = await response.json()

    expect(data).toHaveLength(3)
    // Prisma 已經按倒序排列，我們只驗證數據完整性
    expect(data[0].id).toBe('task-3')
    expect(data[1].id).toBe('task-2')
    expect(data[2].id).toBe('task-1')
  })
})
