/**
 * Recurring Tasks API 整合測試
 *
 * 測試 /api/recurring-tasks 的完整 CRUD + generate
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import {
  setupIntegrationTests,
  cleanupIntegrationTests,
  TEST_USER_ID,
  TEST_FIREBASE_UID,
} from '../setup'
import { GET, POST } from '@/app/api/recurring-tasks/route'
import { GET as GET_ONE, PATCH, DELETE } from '@/app/api/recurring-tasks/[id]/route'
import { POST as GENERATE } from '@/app/api/recurring-tasks/generate/route'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'

vi.mock('@/lib/firebase-admin', () => ({
  getAuth: vi.fn(() => ({
    verifyIdToken: vi.fn().mockResolvedValue({ uid: TEST_FIREBASE_UID }),
  })),
}))

const AUTH_HEADERS = {
  Authorization: 'Bearer test-token',
  'Content-Type': 'application/json',
}

const DAILY_RULE = {
  frequency: 'DAILY',
  interval: 1,
  timezone: 'Asia/Taipei',
  startDate: '2026-01-01',
}

const WEEKLY_RULE = {
  frequency: 'WEEKLY',
  interval: 1,
  daysOfWeek: [1],
  timezone: 'Asia/Taipei',
  startDate: '2026-03-02',
}

describe('Recurring Tasks API - Integration Tests', () => {
  let testAreaId: string
  let testProductId: string

  beforeAll(async () => {
    await setupIntegrationTests()

    const area = await prisma.area.create({
      data: { user_id: TEST_USER_ID, name: 'Test Area', is_custom: true },
    })
    testAreaId = area.id

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
    await prisma.task.deleteMany({ where: { user_id: TEST_USER_ID } })
    await prisma.recurringTask.deleteMany({ where: { user_id: TEST_USER_ID } })
  })

  // -------------------------------------------------------------------------
  describe('POST /api/recurring-tasks', () => {
    it('應該成功建立 DAILY 週期任務', async () => {
      const req = new NextRequest('http://localhost/api/recurring-tasks', {
        method: 'POST',
        headers: AUTH_HEADERS,
        body: JSON.stringify({
          title: '每日晨跑',
          recurrence_rule: DAILY_RULE,
          lead_days: 1,
          product_id: testProductId,
        }),
      })

      const res = await POST(req)
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.recurring_task.title).toBe('每日晨跑')
      expect(data.data.recurring_task.status).toBe('ACTIVE')
      expect(data.data.recurring_task.recurrence_rule.frequency).toBe('DAILY')
      expect(data.data.recurring_task.next_occurrence_at).toBeTruthy()
    })

    it('應該成功建立 WEEKLY 週期任務', async () => {
      const req = new NextRequest('http://localhost/api/recurring-tasks', {
        method: 'POST',
        headers: AUTH_HEADERS,
        body: JSON.stringify({
          title: '每週買菜',
          recurrence_rule: WEEKLY_RULE,
          lead_days: 2,
        }),
      })

      const res = await POST(req)
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.data.recurring_task.recurrence_rule.daysOfWeek).toEqual([1])
    })

    it('缺少 recurrence_rule 時返回 400', async () => {
      const req = new NextRequest('http://localhost/api/recurring-tasks', {
        method: 'POST',
        headers: AUTH_HEADERS,
        body: JSON.stringify({ title: '沒有規則' }),
      })

      const res = await POST(req)
      expect(res.status).toBe(400)
    })

    it('WEEKLY 缺少 daysOfWeek 時返回 400', async () => {
      const req = new NextRequest('http://localhost/api/recurring-tasks', {
        method: 'POST',
        headers: AUTH_HEADERS,
        body: JSON.stringify({
          title: '壞規則',
          recurrence_rule: {
            frequency: 'WEEKLY',
            interval: 1,
            timezone: 'Asia/Taipei',
            startDate: '2026-01-01',
            // daysOfWeek 缺失
          },
        }),
      })

      const res = await POST(req)
      expect(res.status).toBe(400)
    })
  })

  // -------------------------------------------------------------------------
  describe('GET /api/recurring-tasks', () => {
    beforeEach(async () => {
      await prisma.recurringTask.createMany({
        data: [
          {
            user_id: TEST_USER_ID,
            title: '早晨冥想',
            status: 'ACTIVE',
            recurrence_rule: DAILY_RULE,
            lead_days: 1,
          },
          {
            user_id: TEST_USER_ID,
            title: '週日買菜',
            status: 'PAUSED',
            recurrence_rule: WEEKLY_RULE,
            lead_days: 2,
          },
        ],
      })
    })

    it('應該返回該用戶的所有週期任務', async () => {
      const req = new NextRequest('http://localhost/api/recurring-tasks', {
        headers: AUTH_HEADERS,
      })

      const res = await GET(req)
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.data.recurring_tasks).toHaveLength(2)
    })
  })

  // -------------------------------------------------------------------------
  describe('GET /api/recurring-tasks/:id', () => {
    it('應該成功取得單一週期任務', async () => {
      const rt = await prisma.recurringTask.create({
        data: {
          user_id: TEST_USER_ID,
          title: '每日例行',
          status: 'ACTIVE',
          recurrence_rule: DAILY_RULE,
          lead_days: 1,
        },
      })

      const req = new NextRequest(`http://localhost/api/recurring-tasks/${rt.id}`, {
        headers: AUTH_HEADERS,
      })

      const res = await GET_ONE(req, { params: Promise.resolve({ id: rt.id }) })
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.data.recurring_task.id).toBe(rt.id)
      expect(data.data.recurring_task.title).toBe('每日例行')
    })

    it('不存在的 ID 返回 400', async () => {
      const req = new NextRequest('http://localhost/api/recurring-tasks/nonexistent-id', {
        headers: AUTH_HEADERS,
      })

      const res = await GET_ONE(req, {
        params: Promise.resolve({ id: 'nonexistent-id' }),
      })
      expect(res.status).toBe(400)
    })
  })

  // -------------------------------------------------------------------------
  describe('PATCH /api/recurring-tasks/:id', () => {
    it('應該成功更新 title', async () => {
      const rt = await prisma.recurringTask.create({
        data: {
          user_id: TEST_USER_ID,
          title: '原始標題',
          status: 'ACTIVE',
          recurrence_rule: DAILY_RULE,
          lead_days: 1,
        },
      })

      const req = new NextRequest(`http://localhost/api/recurring-tasks/${rt.id}`, {
        method: 'PATCH',
        headers: AUTH_HEADERS,
        body: JSON.stringify({ title: '更新後標題' }),
      })

      const res = await PATCH(req, { params: Promise.resolve({ id: rt.id }) })
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.data.recurring_task.title).toBe('更新後標題')
    })

    it('應該成功暫停（status → PAUSED）', async () => {
      const rt = await prisma.recurringTask.create({
        data: {
          user_id: TEST_USER_ID,
          title: '測試任務',
          status: 'ACTIVE',
          recurrence_rule: DAILY_RULE,
          lead_days: 1,
        },
      })

      const req = new NextRequest(`http://localhost/api/recurring-tasks/${rt.id}`, {
        method: 'PATCH',
        headers: AUTH_HEADERS,
        body: JSON.stringify({ status: 'PAUSED' }),
      })

      const res = await PATCH(req, { params: Promise.resolve({ id: rt.id }) })
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.data.recurring_task.status).toBe('PAUSED')
    })

    it('更新 recurrence_rule 時重新計算 next_occurrence_at', async () => {
      const rt = await prisma.recurringTask.create({
        data: {
          user_id: TEST_USER_ID,
          title: '測試任務',
          status: 'ACTIVE',
          recurrence_rule: DAILY_RULE,
          lead_days: 1,
        },
      })

      const newRule = { ...WEEKLY_RULE }
      const req = new NextRequest(`http://localhost/api/recurring-tasks/${rt.id}`, {
        method: 'PATCH',
        headers: AUTH_HEADERS,
        body: JSON.stringify({ recurrence_rule: newRule }),
      })

      const res = await PATCH(req, { params: Promise.resolve({ id: rt.id }) })
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.data.recurring_task.recurrence_rule.frequency).toBe('WEEKLY')
      expect(data.data.recurring_task.next_occurrence_at).toBeTruthy()
    })

    it('無效 status 返回 400', async () => {
      const rt = await prisma.recurringTask.create({
        data: {
          user_id: TEST_USER_ID,
          title: '測試任務',
          status: 'ACTIVE',
          recurrence_rule: DAILY_RULE,
          lead_days: 1,
        },
      })

      const req = new NextRequest(`http://localhost/api/recurring-tasks/${rt.id}`, {
        method: 'PATCH',
        headers: AUTH_HEADERS,
        body: JSON.stringify({ status: 'INVALID_STATUS' }),
      })

      const res = await PATCH(req, { params: Promise.resolve({ id: rt.id }) })
      expect(res.status).toBe(400)
    })
  })

  // -------------------------------------------------------------------------
  describe('DELETE /api/recurring-tasks/:id', () => {
    it('應該軟刪除（status → ARCHIVED）', async () => {
      const rt = await prisma.recurringTask.create({
        data: {
          user_id: TEST_USER_ID,
          title: '要刪除的任務',
          status: 'ACTIVE',
          recurrence_rule: DAILY_RULE,
          lead_days: 1,
        },
      })

      const req = new NextRequest(`http://localhost/api/recurring-tasks/${rt.id}`, {
        method: 'DELETE',
        headers: AUTH_HEADERS,
      })

      const res = await DELETE(req, { params: Promise.resolve({ id: rt.id }) })
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.data.message).toContain('archived')

      // 確認資料庫已軟刪除
      const deleted = await prisma.recurringTask.findFirst({ where: { id: rt.id } })
      expect(deleted?.deleted_at).not.toBeNull()
      expect(deleted?.status).toBe('ARCHIVED')
    })

    it('GET 不應該返回已軟刪除的任務', async () => {
      const rt = await prisma.recurringTask.create({
        data: {
          user_id: TEST_USER_ID,
          title: '已刪除任務',
          status: 'ARCHIVED',
          deleted_at: new Date(),
          recurrence_rule: DAILY_RULE,
          lead_days: 1,
        },
      })

      const req = new NextRequest(`http://localhost/api/recurring-tasks/${rt.id}`, {
        headers: AUTH_HEADERS,
      })

      const res = await GET_ONE(req, { params: Promise.resolve({ id: rt.id }) })
      expect(res.status).toBe(400)
    })
  })

  // -------------------------------------------------------------------------
  describe('POST /api/recurring-tasks/generate', () => {
    it('valid local_date 時返回生成結果', async () => {
      // 建立一個 nextOccurrenceAt = today 的模板
      const today = new Date()
      const todayUTC = new Date(
        Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
      )
      const todayStr = todayUTC.toISOString().substring(0, 10)

      await prisma.recurringTask.create({
        data: {
          user_id: TEST_USER_ID,
          product_id: testProductId,
          title: '每日生成測試',
          status: 'ACTIVE',
          recurrence_rule: DAILY_RULE,
          lead_days: 1,
          next_occurrence_at: todayUTC,
        },
      })

      const req = new NextRequest('http://localhost/api/recurring-tasks/generate', {
        method: 'POST',
        headers: AUTH_HEADERS,
        body: JSON.stringify({ local_date: todayStr }),
      })

      const res = await GENERATE(req)
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.success).toBe(true)
      expect(typeof data.data.generated).toBe('number')
      expect(typeof data.data.skipped).toBe('number')
      expect(Array.isArray(data.data.details)).toBe(true)
    })

    it('重複生成時應跳過已存在的 task（uuid 型別匹配驗證）', async () => {
      const today = new Date()
      const todayUTC = new Date(
        Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
      )
      const todayStr = todayUTC.toISOString().substring(0, 10)

      const rt = await prisma.recurringTask.create({
        data: {
          user_id: TEST_USER_ID,
          product_id: testProductId,
          title: '重複防護測試',
          status: 'ACTIVE',
          recurrence_rule: DAILY_RULE,
          lead_days: 1,
          next_occurrence_at: todayUTC,
        },
      })

      // 第一次生成 — 應該建立 task
      const req1 = new NextRequest('http://localhost/api/recurring-tasks/generate', {
        method: 'POST',
        headers: AUTH_HEADERS,
        body: JSON.stringify({ local_date: todayStr }),
      })
      const res1 = await GENERATE(req1)
      const data1 = await res1.json()

      expect(res1.status).toBe(200)
      expect(data1.data.generated).toBe(1)

      // 重設 next_occurrence_at 回今天，模擬再次觸發
      await prisma.recurringTask.update({
        where: { id: rt.id },
        data: { next_occurrence_at: todayUTC },
      })

      // 第二次生成 — 應該跳過（重複防護的 $queryRaw 用 ::uuid 比對）
      const req2 = new NextRequest('http://localhost/api/recurring-tasks/generate', {
        method: 'POST',
        headers: AUTH_HEADERS,
        body: JSON.stringify({ local_date: todayStr }),
      })
      const res2 = await GENERATE(req2)
      const data2 = await res2.json()

      expect(res2.status).toBe(200)
      expect(data2.data.generated).toBe(0)
      expect(data2.data.skipped).toBe(1)
    })

    it('local_date 格式錯誤時返回 400', async () => {
      const req = new NextRequest('http://localhost/api/recurring-tasks/generate', {
        method: 'POST',
        headers: AUTH_HEADERS,
        body: JSON.stringify({ local_date: '2026/03/05' }),
      })

      const res = await GENERATE(req)
      expect(res.status).toBe(400)
    })

    it('缺少 local_date 時返回 400', async () => {
      const req = new NextRequest('http://localhost/api/recurring-tasks/generate', {
        method: 'POST',
        headers: AUTH_HEADERS,
        body: JSON.stringify({}),
      })

      const res = await GENERATE(req)
      expect(res.status).toBe(400)
    })
  })
})
