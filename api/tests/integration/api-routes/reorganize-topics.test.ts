/**
 * Reorganize Topics API 整合測試
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import {
  setupIntegrationTests,
  cleanupIntegrationTests,
  TEST_USER_ID,
  TEST_FIREBASE_UID,
} from '../setup'
import { POST } from '@/app/api/products/[id]/reorganize-topics/route'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'

vi.mock('@/lib/firebase-admin', () => ({
  getAuth: vi.fn(() => ({
    verifyIdToken: vi.fn().mockResolvedValue({ uid: TEST_FIREBASE_UID }),
  })),
}))

vi.mock('@/lib/ai-rate-limit', () => ({
  checkAiRateLimit: vi.fn().mockResolvedValue(undefined),
  incrementAiUsage: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('ai', () => ({
  generateObject: vi.fn(),
}))

vi.mock('@ai-sdk/google', () => ({
  google: vi.fn(() => 'mock-model'),
}))

describe('POST /api/products/[id]/reorganize-topics - Integration Tests', () => {
  let testAreaId: string
  let testProductId: string

  beforeAll(async () => {
    await setupIntegrationTests()

    const area = await prisma.area.create({
      data: {
        user_id: TEST_USER_ID,
        name: 'Reorganize Topics Test Area',
        is_custom: true,
      },
    })
    testAreaId = area.id

    const product = await prisma.product.create({
      data: {
        user_id: TEST_USER_ID,
        area_id: testAreaId,
        name: 'Reorganize Topics Test Product',
        status: 'ACTIVE',
        lifecycle: 'PERPETUAL',
      },
    })
    testProductId = product.id

    // 建立幾個 tasks 讓 AI 有資料可以分析
    await prisma.task.createMany({
      data: [
        {
          user_id: TEST_USER_ID,
          product_id: testProductId,
          title: '設計登入頁面',
          status: 'ACTIVE',
        },
        {
          user_id: TEST_USER_ID,
          product_id: testProductId,
          title: '實作登入 API',
          status: 'ACTIVE',
        },
      ],
    })

    const { generateObject } = await import('ai')
    ;(generateObject as any).mockResolvedValue({
      object: {
        topic_operations: [
          {
            action: 'keep',
            topic_name: '登入功能',
          },
        ],
        proposed_clusters: [
          {
            topic_name: '登入功能',
            task_ids: [],
          },
        ],
        task_consolidations: [],
      },
    })
  })

  afterAll(async () => {
    await cleanupIntegrationTests()
  })

  it('200 + 回傳 current_topics[] + topic_operations[]', async () => {
    const request = new NextRequest(
      `http://localhost/api/products/${testProductId}/reorganize-topics`,
      {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer test-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      }
    )

    const response = await POST(request, {
      params: Promise.resolve({ id: testProductId }),
    })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toHaveProperty('current_topics')
    expect(data).toHaveProperty('topic_operations')
    expect(Array.isArray(data.current_topics)).toBe(true)
    expect(Array.isArray(data.topic_operations)).toBe(true)
  })

  it('productId 不存在 → 404', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000999'
    const request = new NextRequest(
      `http://localhost/api/products/${fakeId}/reorganize-topics`,
      {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer test-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      }
    )

    const response = await POST(request, {
      params: Promise.resolve({ id: fakeId }),
    })

    expect(response.status).toBe(404)
  })
})
