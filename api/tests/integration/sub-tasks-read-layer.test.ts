/**
 * Sub-tasks 讀取層整合測試
 *
 * 驗證 Repository 從 sub_tasks 表讀取（而非 sub_items JSON）
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import {
  setupIntegrationTests,
  cleanupIntegrationTests,
  TEST_USER_ID,
} from './setup'
import { prisma } from '@/lib/db'
import { PrismaTaskRepository } from '@/infrastructure/repositories/prisma-task-repository'

describe('Sub-tasks 讀取層', () => {
  let testAreaId: string
  let testProductId: string
  const repository = new PrismaTaskRepository()

  beforeAll(async () => {
    await setupIntegrationTests()

    const area = await prisma.area.create({
      data: {
        user_id: TEST_USER_ID,
        name: 'SubTask Read Test Area',
        is_custom: true,
      },
    })
    testAreaId = area.id

    const product = await prisma.product.create({
      data: {
        user_id: TEST_USER_ID,
        area_id: testAreaId,
        name: 'SubTask Read Test Product',
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
    await prisma.subTask.deleteMany({
      where: { user_id: TEST_USER_ID },
    })
    await prisma.task.deleteMany({
      where: { user_id: TEST_USER_ID },
    })
  })

  it('task + sub_tasks 記錄 → GET task 回傳正確 subItems', async () => {
    const task = await prisma.task.create({
      data: {
        user_id: TEST_USER_ID,
        product_id: testProductId,
        content: 'Test task with sub-tasks',
        status: 'ACTIVE',
        sub_items: [], // JSON 欄位為空
      },
    })

    await prisma.subTask.createMany({
      data: [
        { task_id: task.id, user_id: TEST_USER_ID, content: 'Sub 1', order: 0 },
        { task_id: task.id, user_id: TEST_USER_ID, content: 'Sub 2', order: 1, completed: true },
      ],
    })

    const result = await repository.findById(task.id, TEST_USER_ID)

    expect(result).not.toBeNull()
    expect(result!.subItems).toHaveLength(2)
    expect(result!.subItems[0].content).toBe('Sub 1')
    expect(result!.subItems[0].completed).toBe(false)
    expect(result!.subItems[1].content).toBe('Sub 2')
    expect(result!.subItems[1].completed).toBe(true)
  })

  it('sub_tasks 有 deleted_at → 不出現在回傳', async () => {
    const task = await prisma.task.create({
      data: {
        user_id: TEST_USER_ID,
        product_id: testProductId,
        content: 'Task with deleted sub-task',
        status: 'ACTIVE',
        sub_items: [],
      },
    })

    await prisma.subTask.createMany({
      data: [
        { task_id: task.id, user_id: TEST_USER_ID, content: 'Visible', order: 0 },
        { task_id: task.id, user_id: TEST_USER_ID, content: 'Deleted', order: 1, deleted_at: new Date() },
      ],
    })

    const result = await repository.findById(task.id, TEST_USER_ID)

    expect(result!.subItems).toHaveLength(1)
    expect(result!.subItems[0].content).toBe('Visible')
  })

  it('多 task 各有不同 sub_tasks → 批次查詢正確分組', async () => {
    const task1 = await prisma.task.create({
      data: {
        user_id: TEST_USER_ID,
        product_id: testProductId,
        content: 'Task 1',
        status: 'ACTIVE',
        sub_items: [],
      },
    })
    const task2 = await prisma.task.create({
      data: {
        user_id: TEST_USER_ID,
        product_id: testProductId,
        content: 'Task 2',
        status: 'ACTIVE',
        sub_items: [],
      },
    })

    await prisma.subTask.createMany({
      data: [
        { task_id: task1.id, user_id: TEST_USER_ID, content: 'T1-Sub1', order: 0 },
        { task_id: task2.id, user_id: TEST_USER_ID, content: 'T2-Sub1', order: 0 },
        { task_id: task2.id, user_id: TEST_USER_ID, content: 'T2-Sub2', order: 1 },
      ],
    })

    const results = await repository.findMany({ userId: TEST_USER_ID })

    const r1 = results.find(t => t.content === 'Task 1')!
    const r2 = results.find(t => t.content === 'Task 2')!

    expect(r1.subItems).toHaveLength(1)
    expect(r1.subItems[0].content).toBe('T1-Sub1')
    expect(r2.subItems).toHaveLength(2)
    expect(r2.subItems[0].content).toBe('T2-Sub1')
    expect(r2.subItems[1].content).toBe('T2-Sub2')
  })

  it('空 sub_tasks → 回傳空陣列', async () => {
    const task = await prisma.task.create({
      data: {
        user_id: TEST_USER_ID,
        product_id: testProductId,
        content: 'Task with no sub-tasks',
        status: 'ACTIVE',
        sub_items: [{ id: 'old', content: 'old json item', completed: false }],
      },
    })

    const result = await repository.findById(task.id, TEST_USER_ID)

    // Should be empty (from sub_tasks table), NOT from JSON
    expect(result!.subItems).toHaveLength(0)
  })

  it('sub_tasks 按 order 排序', async () => {
    const task = await prisma.task.create({
      data: {
        user_id: TEST_USER_ID,
        product_id: testProductId,
        content: 'Task with ordered sub-tasks',
        status: 'ACTIVE',
        sub_items: [],
      },
    })

    await prisma.subTask.createMany({
      data: [
        { task_id: task.id, user_id: TEST_USER_ID, content: 'Third', order: 2 },
        { task_id: task.id, user_id: TEST_USER_ID, content: 'First', order: 0 },
        { task_id: task.id, user_id: TEST_USER_ID, content: 'Second', order: 1 },
      ],
    })

    const result = await repository.findById(task.id, TEST_USER_ID)

    expect(result!.subItems[0].content).toBe('First')
    expect(result!.subItems[1].content).toBe('Second')
    expect(result!.subItems[2].content).toBe('Third')
  })
})
