/**
 * PrismaTaskRepository 整合測試
 *
 * 測試目標：
 * 1. Repository CRUD 操作正確性
 * 2. 型別轉換（Prisma ↔ Domain）
 * 3. JOIN 查詢（product_name, area_name）
 * 4. 過濾邏輯（status, productId, deleted_at）
 * 5. 軟刪除機制
 *
 * 注意：Repository 使用全局 prisma，無法使用 transaction rollback
 * 使用 beforeEach 手動清理測試資料
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import {
  setupIntegrationTests,
  cleanupIntegrationTests,
  TEST_USER_ID,
} from '../setup'
import { prisma } from '@/lib/db'
import { PrismaTaskRepository } from '@/infrastructure/repositories/prisma-task-repository'
import { TaskStatus } from '@/domain/value-objects/task-status'
import { NotFoundException } from '@/lib/api-response'

describe('PrismaTaskRepository 整合測試', () => {
  let testAreaId: string
  let testProductId: string
  const repository = new PrismaTaskRepository()

  beforeAll(async () => {
    await setupIntegrationTests()

    // 建立共用的測試資料
    const area = await prisma.area.create({
      data: {
        user_id: TEST_USER_ID,
        name: 'Repository Test Area',
        is_custom: true,
      },
    })
    testAreaId = area.id

    const product = await prisma.product.create({
      data: {
        user_id: TEST_USER_ID,
        area_id: testAreaId,
        name: 'Repository Test Product',
        status: 'ACTIVE',
        lifecycle: 'FINITE',
      },
    })
    testProductId = product.id
  })

  afterAll(async () => {
    await cleanupIntegrationTests()
  })

  beforeEach(async () => {
    // 每個測試前清理任務資料
    await prisma.task.deleteMany({
      where: { user_id: TEST_USER_ID },
    })
  })

  describe('create()', () => {
    it('應該成功創建任務並返回完整資料', async () => {
      const taskData = {
        userId: TEST_USER_ID,
        productId: testProductId,
        topicId: null,
        content: 'Test Task Content',
        status: 'INBOX' as TaskStatus,
        aiAnalysis: {
          narrative: 'Test narrative',
        },
        references: [],
        subItems: [],
        startDate: null,
        dueDate: new Date('2025-12-31'),
        timeConfidence: null,
        inferredFromMilestone: null,
        remindAt: null,
        reminderEnabled: false,
        reminderTimezone: null,
        notificationId: null,
      }

      const result = await repository.create(taskData)

      // 驗證返回的資料
      expect(result.id).toBeDefined()
      expect(result.content).toBe('Test Task Content')
      expect(result.userId).toBe(TEST_USER_ID)
      expect(result.productId).toBe(testProductId)
      expect(result.status).toBe('INBOX')
      expect(result.aiAnalysis?.narrative).toBe('Test narrative')
      expect(result.dueDate).toEqual(new Date('2025-12-31'))

      // 驗證 JOIN 資料
      expect(result.product).toBeDefined()
      expect(result.product?.name).toBe('Repository Test Product')
      expect(result.product?.area?.name).toBe('Repository Test Area')
    })

    it('應該正確處理日期欄位', async () => {
      const dueDate = new Date('2025-12-31T10:30:00.000Z')
      const startDate = new Date('2025-01-01T00:00:00.000Z')

      const result = await repository.create({
        userId: TEST_USER_ID,
        productId: testProductId,
        topicId: null,
        content: 'Date Test Task',
        status: 'ACTIVE',
        aiAnalysis: {},
        references: [],
        subItems: [],
        startDate,
        dueDate,
        timeConfidence: null,
        inferredFromMilestone: null,
        remindAt: null,
        reminderEnabled: false,
        reminderTimezone: null,
        notificationId: null,
      })

      expect(result.startDate).toEqual(startDate)
      expect(result.dueDate).toEqual(dueDate)
    })

    it('應該正確處理 sub_items（sub_items 由 sub_tasks 表管理，create 後為空）', async () => {
      // sub_items 在 create() 中只存入 JSON 欄位（legacy），
      // enrichWithSubTasks() 從 sub_tasks 表讀取，因此 create 後 subItems 為空陣列
      const result = await repository.create({
        userId: TEST_USER_ID,
        productId: testProductId,
        topicId: null,
        content: 'Task with Sub Items',
        status: 'ACTIVE',
        aiAnalysis: {},
        references: [],
        subItems: [],
        startDate: null,
        dueDate: null,
        timeConfidence: null,
        inferredFromMilestone: null,
        remindAt: null,
        reminderEnabled: false,
        reminderTimezone: null,
        notificationId: null,
      })

      expect(result.subItems).toBeDefined()
      expect(Array.isArray(result.subItems)).toBe(true)
      // sub_tasks 表尚未寫入，所以 subItems 為空
      expect(result.subItems.length).toBe(0)
    })
  })

  describe('findMany()', () => {
    it('應該使用 JOIN 返回完整資料（含 product_name, area_name）', async () => {
      await repository.create({
        userId: TEST_USER_ID,
        productId: testProductId,
        topicId: null,
        content: 'Marketing Task',
        status: 'ACTIVE',
        aiAnalysis: {},
        references: [],
        subItems: [],
        startDate: null,
        dueDate: null,
        timeConfidence: null,
        inferredFromMilestone: null,
        remindAt: null,
        reminderEnabled: false,
        reminderTimezone: null,
        notificationId: null,
      })

      const results = await repository.findMany({ userId: TEST_USER_ID })

      expect(results.length).toBe(1)
      expect(results[0].content).toBe('Marketing Task')
      expect(results[0].product?.name).toBe('Repository Test Product')
      expect(results[0].product?.area?.name).toBe('Repository Test Area')
    })

    it('應該正確過濾 status', async () => {
      // 創建不同 status 的任務
      await repository.create({
        userId: TEST_USER_ID,
        productId: testProductId,
        topicId: null,
        content: 'INBOX Task',
        status: 'INBOX',
        aiAnalysis: {},
        references: [],
        subItems: [],
        startDate: null,
        dueDate: null,
        timeConfidence: null,
        inferredFromMilestone: null,
        remindAt: null,
        reminderEnabled: false,
        reminderTimezone: null,
        notificationId: null,
      })

      await repository.create({
        userId: TEST_USER_ID,
        productId: testProductId,
        topicId: null,
        content: 'ACTIVE Task',
        status: 'ACTIVE',
        aiAnalysis: {},
        references: [],
        subItems: [],
        startDate: null,
        dueDate: null,
        timeConfidence: null,
        inferredFromMilestone: null,
        remindAt: null,
        reminderEnabled: false,
        reminderTimezone: null,
        notificationId: null,
      })

      // 只查詢 INBOX 任務
      const inboxTasks = await repository.findMany({
        userId: TEST_USER_ID,
        status: 'INBOX',
      })

      expect(inboxTasks.length).toBe(1)
      expect(inboxTasks[0].status).toBe('INBOX')
      expect(inboxTasks[0].content).toBe('INBOX Task')
    })

    it('應該正確過濾 productId', async () => {
      // 建立第二個 product
      const product2 = await prisma.product.create({
        data: {
          user_id: TEST_USER_ID,
          area_id: testAreaId,
          name: 'Second Product',
          status: 'ACTIVE',
          lifecycle: 'FINITE',
        },
      })

      // 為不同 products 創建任務
      await repository.create({
        userId: TEST_USER_ID,
        productId: testProductId,
        topicId: null,
        content: 'Product 1 Task',
        status: 'INBOX',
        aiAnalysis: {},
        references: [],
        subItems: [],
        startDate: null,
        dueDate: null,
        timeConfidence: null,
        inferredFromMilestone: null,
        remindAt: null,
        reminderEnabled: false,
        reminderTimezone: null,
        notificationId: null,
      })

      await repository.create({
        userId: TEST_USER_ID,
        productId: product2.id,
        topicId: null,
        content: 'Product 2 Task',
        status: 'INBOX',
        aiAnalysis: {},
        references: [],
        subItems: [],
        startDate: null,
        dueDate: null,
        timeConfidence: null,
        inferredFromMilestone: null,
        remindAt: null,
        reminderEnabled: false,
        reminderTimezone: null,
        notificationId: null,
      })

      // 只查詢 product1 的任務
      const product1Tasks = await repository.findMany({
        userId: TEST_USER_ID,
        productId: testProductId,
      })

      expect(product1Tasks.length).toBe(1)
      expect(product1Tasks[0].content).toBe('Product 1 Task')
    })

    it('應該排除已刪除的任務（預設）', async () => {
      const task = await repository.create({
        userId: TEST_USER_ID,
        productId: testProductId,
        topicId: null,
        content: 'Task to Delete',
        status: 'INBOX',
        aiAnalysis: {},
        references: [],
        subItems: [],
        startDate: null,
        dueDate: null,
        timeConfidence: null,
        inferredFromMilestone: null,
        remindAt: null,
        reminderEnabled: false,
        reminderTimezone: null,
        notificationId: null,
      })

      // 軟刪除
      await repository.softDelete(task.id, TEST_USER_ID)

      // 預設查詢應該排除已刪除的任務
      const tasks = await repository.findMany({ userId: TEST_USER_ID })
      expect(tasks.length).toBe(0)
    })

    it('應該包含已刪除的任務（includeDeleted=true）', async () => {
      const task = await repository.create({
        userId: TEST_USER_ID,
        productId: testProductId,
        topicId: null,
        content: 'Task to Delete and Find',
        status: 'INBOX',
        aiAnalysis: {},
        references: [],
        subItems: [],
        startDate: null,
        dueDate: null,
        timeConfidence: null,
        inferredFromMilestone: null,
        remindAt: null,
        reminderEnabled: false,
        reminderTimezone: null,
        notificationId: null,
      })

      // 軟刪除
      await repository.softDelete(task.id, TEST_USER_ID)

      // includeDeleted=true 應該包含已刪除的任務
      const tasks = await repository.findMany({
        userId: TEST_USER_ID,
        includeDeleted: true,
      })

      expect(tasks.length).toBe(1)
      expect(tasks[0].content).toBe('Task to Delete and Find')
    })
  })

  describe('findById()', () => {
    it('應該根據 ID 查詢任務', async () => {
      const created = await repository.create({
        userId: TEST_USER_ID,
        productId: testProductId,
        topicId: null,
        content: 'Find By ID Task',
        status: 'INBOX',
        aiAnalysis: {},
        references: [],
        subItems: [],
        startDate: null,
        dueDate: null,
        timeConfidence: null,
        inferredFromMilestone: null,
        remindAt: null,
        reminderEnabled: false,
        reminderTimezone: null,
        notificationId: null,
      })

      const found = await repository.findById(created.id, TEST_USER_ID)

      expect(found).not.toBeNull()
      expect(found?.id).toBe(created.id)
      expect(found?.content).toBe('Find By ID Task')
    })

    it('應該返回 null 當任務不存在', async () => {
      const result = await repository.findById(
        '00000000-0000-0000-0000-000000000999',
        TEST_USER_ID
      )

      expect(result).toBeNull()
    })
  })

  describe('update()', () => {
    it('應該成功更新任務', async () => {
      const created = await repository.create({
        userId: TEST_USER_ID,
        productId: testProductId,
        topicId: null,
        content: 'Original Content',
        status: 'INBOX',
        aiAnalysis: {},
        references: [],
        subItems: [],
        startDate: null,
        dueDate: null,
        timeConfidence: null,
        inferredFromMilestone: null,
        remindAt: null,
        reminderEnabled: false,
        reminderTimezone: null,
        notificationId: null,
      })

      const updated = await repository.update(created.id, TEST_USER_ID, {
        content: 'Updated Content',
        status: 'ACTIVE',
      })

      expect(updated.content).toBe('Updated Content')
      expect(updated.status).toBe('ACTIVE')
    })

    it('應該拋出 NotFoundException 當任務不存在', async () => {
      await expect(
        repository.update(
          '00000000-0000-0000-0000-000000000999',
          TEST_USER_ID,
          { content: 'New Content' }
        )
      ).rejects.toThrow(NotFoundException)
    })

    it('應該正確處理部分更新', async () => {
      const created = await repository.create({
        userId: TEST_USER_ID,
        productId: testProductId,
        topicId: null,
        content: 'Original Content',
        status: 'INBOX',
        aiAnalysis: { narrative: 'Original narrative' },
        references: [],
        subItems: [],
        startDate: null,
        dueDate: null,
        timeConfidence: null,
        inferredFromMilestone: null,
        remindAt: null,
        reminderEnabled: false,
        reminderTimezone: null,
        notificationId: null,
      })

      const updated = await repository.update(created.id, TEST_USER_ID, {
        content: 'Updated Content',
      })

      expect(updated.content).toBe('Updated Content')
      expect(updated.status).toBe('INBOX') // 未變
      expect(updated.aiAnalysis?.narrative).toBe('Original narrative') // 未變
    })
  })

  describe('softDelete()', () => {
    it('應該軟刪除任務', async () => {
      const created = await repository.create({
        userId: TEST_USER_ID,
        productId: testProductId,
        topicId: null,
        content: 'Task to Soft Delete',
        status: 'INBOX',
        aiAnalysis: {},
        references: [],
        subItems: [],
        startDate: null,
        dueDate: null,
        timeConfidence: null,
        inferredFromMilestone: null,
        remindAt: null,
        reminderEnabled: false,
        reminderTimezone: null,
        notificationId: null,
      })

      await repository.softDelete(created.id, TEST_USER_ID)

      // 預設查詢找不到
      const found = await repository.findById(created.id, TEST_USER_ID)
      expect(found).toBeNull()

      // 使用 includeDeleted 可以找到
      const allTasks = await repository.findMany({
        userId: TEST_USER_ID,
        includeDeleted: true,
      })
      expect(allTasks.length).toBe(1)
      expect(allTasks[0].id).toBe(created.id)
    })
  })

  describe('count()', () => {
    it('應該正確計數任務數量', async () => {
      // 創建 3 個任務
      for (let i = 0; i < 3; i++) {
        await repository.create({
          userId: TEST_USER_ID,
          productId: testProductId,
          topicId: null,
          content: `Task ${i + 1}`,
          status: 'INBOX',
          aiAnalysis: {},
          references: [],
          subItems: [],
          startDate: null,
          dueDate: null,
          timeConfidence: null,
          inferredFromMilestone: null,
          remindAt: null,
          reminderEnabled: false,
          reminderTimezone: null,
          notificationId: null,
        })
      }

      const count = await repository.count({ userId: TEST_USER_ID })
      expect(count).toBe(3)
    })
  })

  describe('exists()', () => {
    it('應該正確檢查任務是否存在', async () => {
      const created = await repository.create({
        userId: TEST_USER_ID,
        productId: testProductId,
        topicId: null,
        content: 'Exists Test Task',
        status: 'INBOX',
        aiAnalysis: {},
        references: [],
        subItems: [],
        startDate: null,
        dueDate: null,
        timeConfidence: null,
        inferredFromMilestone: null,
        remindAt: null,
        reminderEnabled: false,
        reminderTimezone: null,
        notificationId: null,
      })

      const exists = await repository.exists(created.id, TEST_USER_ID)
      expect(exists).toBe(true)

      const notExists = await repository.exists(
        '00000000-0000-0000-0000-000000000999',
        TEST_USER_ID
      )
      expect(notExists).toBe(false)
    })
  })
})
