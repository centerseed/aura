/**
 * Transaction Rollback 測試範例
 *
 * 這個檔案展示如何使用 withTestTransaction() 來實現自動 rollback 的測試隔離
 *
 * 優點：
 * 1. 無需手動清理測試資料（自動 rollback）
 * 2. 測試執行更快（rollback 比 deleteMany 快）
 * 3. 完全隔離（測試之間不會互相影響）
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import {
  setupIntegrationTests,
  cleanupIntegrationTests,
  withTestTransaction,
  withIsolatedTest,
  TEST_USER_ID,
} from '../setup'
import { prisma } from '@/lib/db'

describe('Transaction Rollback 範例', () => {
  beforeAll(async () => {
    await setupIntegrationTests()
  })

  afterAll(async () => {
    await cleanupIntegrationTests()
  })

  describe('基本用法：withTestTransaction', () => {
    it('應該創建 area 並自動 rollback', async () => {
      await withTestTransaction(async (tx) => {
        // 在 transaction 中創建 area
        const area = await tx.area.create({
          data: {
            user_id: TEST_USER_ID,
            name: 'Test Area - Will be Rolled Back',
            is_custom: true,
          },
        })

        // 驗證創建成功
        expect(area).toBeDefined()
        expect(area.name).toBe('Test Area - Will be Rolled Back')

        // 在 transaction 內查詢可以找到
        const found = await tx.area.findUnique({
          where: { id: area.id },
        })
        expect(found).not.toBeNull()
      })

      // Transaction 結束後，資料已被 rollback
      // 無法在資料庫中找到剛才創建的 area
      const allAreas = await prisma.area.findMany({
        where: { user_id: TEST_USER_ID },
      })

      // 應該沒有任何 area（因為被 rollback 了）
      const hasTestArea = allAreas.some((a) =>
        a.name.includes('Will be Rolled Back')
      )
      expect(hasTestArea).toBe(false)
    })

    it('應該創建 product 並自動 rollback', async () => {
      let createdProductId: string = ''

      await withTestTransaction(async (tx) => {
        // 先創建 area
        const area = await tx.area.create({
          data: {
            user_id: TEST_USER_ID,
            name: 'Product Test Area',
            is_custom: true,
          },
        })

        // 創建 product
        const product = await tx.product.create({
          data: {
            user_id: TEST_USER_ID,
            area_id: area.id,
            name: 'Test Product - Auto Rollback',
            description: 'This product will be rolled back',
            status: 'ACTIVE',
            lifecycle: 'FINITE',
          },
        })

        createdProductId = product.id

        // 驗證創建成功
        expect(product).toBeDefined()
        expect(product.name).toBe('Test Product - Auto Rollback')

        // 在 transaction 內可以查詢到
        const foundProduct = await tx.product.findUnique({
          where: { id: product.id },
        })
        expect(foundProduct).not.toBeNull()
      })

      // Transaction 結束後，product 已被 rollback
      const product = await prisma.product.findUnique({
        where: { id: createdProductId },
      })
      expect(product).toBeNull()
    })
  })

  describe('進階用法：withIsolatedTest', () => {
    it('應該自動確保測試用戶存在', async () => {
      await withIsolatedTest(async (tx) => {
        // withIsolatedTest 會自動確保 TEST_USER_ID 存在
        const user = await tx.user.findUnique({
          where: { id: TEST_USER_ID },
        })

        expect(user).not.toBeNull()
        expect(user?.email).toBe('test@example.com')
      })
    })

    it('應該創建複雜的關聯資料並 rollback', async () => {
      await withIsolatedTest(async (tx) => {
        // 創建 area
        const area = await tx.area.create({
          data: {
            user_id: TEST_USER_ID,
            name: 'Complex Test Area',
            is_custom: true,
          },
        })

        // 創建 product
        const product = await tx.product.create({
          data: {
            user_id: TEST_USER_ID,
            area_id: area.id,
            name: 'Complex Product',
            status: 'ACTIVE',
            lifecycle: 'FINITE',
          },
        })

        // 創建 milestone
        const milestone = await tx.milestone.create({
          data: {
            user_id: TEST_USER_ID,
            name: 'Test Milestone',
            target_date: new Date('2025-12-31'),
            priority: 1,
            entity_type: 'product',
            entity_id: product.id,
          },
        })

        // 創建 task
        const task = await tx.task.create({
          data: {
            user_id: TEST_USER_ID,
            product_id: product.id,
            content: 'Complex Task',
            status: 'INBOX',
          },
        })

        // 驗證所有資料都創建成功
        expect(area).toBeDefined()
        expect(product).toBeDefined()
        expect(milestone).toBeDefined()
        expect(task).toBeDefined()

        // 驗證關聯正確
        const taskWithRelations = await tx.task.findUnique({
          where: { id: task.id },
          include: {
            product: true,
          },
        })

        expect(taskWithRelations?.product?.name).toBe('Complex Product')
      })

      // Transaction 結束後，所有關聯資料都被 rollback
      // 無需手動清理！
    })
  })

  describe('錯誤處理', () => {
    it('應該正確處理測試內的錯誤', async () => {
      await expect(
        withTestTransaction(async (tx) => {
          // 創建 area
          await tx.area.create({
            data: {
              user_id: TEST_USER_ID,
              name: 'Error Test Area',
              is_custom: true,
            },
          })

          // 拋出錯誤（模擬測試失敗）
          throw new Error('Test intentionally failed')
        })
      ).rejects.toThrow('Test intentionally failed')

      // 即使測試失敗，資料也應該被 rollback
      const areas = await prisma.area.findMany({
        where: { user_id: TEST_USER_ID, name: 'Error Test Area' },
      })
      expect(areas.length).toBe(0)
    })

    it('應該處理資料庫約束錯誤', async () => {
      await expect(
        withTestTransaction(async (tx) => {
          // 嘗試創建重複的 user（違反 unique 約束）
          await tx.user.create({
            data: {
              id: TEST_USER_ID, // 已存在的 ID
              email: 'duplicate@example.com',
              name: 'Duplicate User',
              auth_provider: 'GOOGLE',
              auth_provider_id: 'duplicate-uid',
            },
          })
        })
      ).rejects.toThrow()

      // 資料庫應該保持原狀
      const user = await prisma.user.findUnique({
        where: { id: TEST_USER_ID },
      })
      expect(user?.email).toBe('test@example.com') // 原始資料未變
    })
  })

  describe('性能比較', () => {
    it('展示 rollback 的速度優勢', async () => {
      const iterations = 10

      // 方法 1: 使用 transaction rollback（快）
      const rollbackStart = Date.now()
      for (let i = 0; i < iterations; i++) {
        await withTestTransaction(async (tx) => {
          await tx.area.create({
            data: {
              user_id: TEST_USER_ID,
              name: `Rollback Test ${i}`,
              is_custom: true,
            },
          })
        })
      }
      const rollbackTime = Date.now() - rollbackStart

      // 方法 2: 使用 create + deleteMany（慢）
      const deleteStart = Date.now()
      for (let i = 0; i < iterations; i++) {
        const area = await prisma.area.create({
          data: {
            user_id: TEST_USER_ID,
            name: `Delete Test ${i}`,
            is_custom: true,
          },
        })
        await prisma.area.delete({ where: { id: area.id } })
      }
      const deleteTime = Date.now() - deleteStart

      console.log(`📊 性能比較 (${iterations} 次迭代):`)
      console.log(`   Rollback: ${rollbackTime}ms`)
      console.log(`   Delete:   ${deleteTime}ms`)
      console.log(
        `   速度提升: ${((deleteTime / rollbackTime - 1) * 100).toFixed(1)}%`
      )

      // Rollback 通常比 delete 快（允許最多 2x 的差距，避免 flaky test）
      expect(rollbackTime).toBeLessThanOrEqual(deleteTime * 2.0)
    })
  })
})
