/**
 * 整合測試設置
 *
 * 這個檔案設置整合測試環境，包括：
 * - 測試資料庫連線
 * - 測試用戶建立
 * - 測試資料清理
 *
 * 🚨 重要安全警告：
 * 1. cleanupIntegrationTests() 使用 deleteMany 僅適用於測試環境的 beforeAll/afterAll
 * 2. **強烈推薦**使用 withTestTransaction() 進行測試隔離（自動 rollback，更安全）
 * 3. **絕對禁止**在生產環境或任何非測試代碼中使用 deleteMany
 * 4. 整合測試必須使用 DATABASE_URL_TEST 環境變數（本地 PostgreSQL）
 * 5. vitest.config.ts 已內建 Supabase 阻斷機制，確保不會連接生產資料庫
 *
 * 推薦用法：
 * ```typescript
 * it('測試案例', async () => {
 *   await withTestTransaction(async (tx) => {
 *     // 所有資料庫操作使用 tx，測試結束後自動 rollback
 *   })
 * })
 * ```
 */

import { prisma } from '@/lib/db'
import { beforeAll, afterAll, beforeEach } from 'vitest'

// 測試用戶 ID（固定，用於所有測試）
// 使用有效的 UUID 格式
export const TEST_USER_ID = '00000000-0000-0000-0000-000000000001'
export const TEST_FIREBASE_UID = 'test-firebase-uid-12345'

/**
 * 整合測試前置作業
 */
export async function setupIntegrationTests() {
  // 先清理所有測試資料（包括其他可能使用相同 email 的用戶）
  await cleanupIntegrationTests()

  // 建立測試用戶（直接 create，因為已經清理乾淨）
  await prisma.user.create({
    data: {
      id: TEST_USER_ID,
      email: 'test@example.com',
      name: 'Test User',
      auth_provider: 'GOOGLE',
      auth_provider_id: TEST_FIREBASE_UID,
    },
  }).catch((error) => {
    console.error('Failed to create test user:', error)
    throw error
  })
}

/**
 * 整合測試後置清理
 */
export async function cleanupIntegrationTests() {
  try {
    // 清理測試資料（按照依賴順序）
    // 找出所有測試相關用戶（包括可能使用相同 email 的用戶）
    const testUsers = await prisma.user.findMany({
      where: {
        OR: [
          { id: TEST_USER_ID },
          { email: 'test@example.com' },
          { auth_provider_id: TEST_FIREBASE_UID },
        ],
      },
      select: { id: true },
    })

    const testUserIds = testUsers.map(u => u.id)

    if (testUserIds.length === 0) {
      return // 沒有需要清理的資料
    }

    // 0. 刪除所有測試用戶的 sub_tasks
    await prisma.subTask.deleteMany({
      where: { user_id: { in: testUserIds } },
    })

    // 1. 刪除所有測試用戶的任務（包含關聯的 sub-items 和 references）
    await prisma.task.deleteMany({
      where: { user_id: { in: testUserIds } },
    })

    // 1b. 刪除所有測試用戶的週期任務模板（task 先刪，因為 task 有 FK 指向 recurringTask）
    await prisma.recurringTask.deleteMany({
      where: { user_id: { in: testUserIds } },
    })

    // 2. 刪除所有測試用戶的 topics
    await prisma.topic.deleteMany({
      where: { user_id: { in: testUserIds } },
    })

    // 3. 刪除所有測試用戶的產品
    await prisma.product.deleteMany({
      where: { user_id: { in: testUserIds } },
    })

    // 4. 刪除所有測試用戶的 milestones
    await prisma.milestone.deleteMany({
      where: { user_id: { in: testUserIds } },
    })

    // 5. 刪除所有測試用戶的領域
    await prisma.area.deleteMany({
      where: { user_id: { in: testUserIds } },
    })

    // 6. 刪除所有測試用戶的 system_evaluation_logs
    await prisma.systemEvaluationLog.deleteMany({
      where: { user_id: { in: testUserIds } },
    })

    // 7. 最後刪除所有測試用戶
    await prisma.user.deleteMany({
      where: { id: { in: testUserIds } },
    })
  } catch (error) {
    // Ignore cleanup errors (資料可能不存在)
    console.log('Cleanup error (可忽略):', error)
  }
}

/**
 * Mock Firebase ID Token 驗證
 *
 * 整合測試中，我們需要 mock Firebase 認證
 */
export function mockFirebaseAuth() {
  // 這裡可以設置 Firebase Admin SDK 的 mock
  // 在實際整合測試中，您可能需要使用真實的 Firebase 測試環境
}

/**
 * 建立測試 Authorization header
 */
export function createTestAuthHeader(): HeadersInit {
  return {
    'Authorization': 'Bearer test-token',
    'Content-Type': 'application/json',
  }
}

// ============================================================================
// Transaction-based 測試隔離
// ============================================================================

/**
 * Transaction-based 測試隔離機制
 *
 * 使用 Prisma interactive transaction + 強制 rollback 確保測試隔離性
 *
 * 優點：
 * 1. 自動清理測試資料（無需手動 deleteMany）
 * 2. 更快的測試執行（rollback 比 delete 快）
 * 3. 避免資料污染（每個測試完全隔離）
 * 4. 避免遺漏清理（transaction 保證一致性）
 *
 * 限制：
 * 1. 不支援嵌套 transaction（Prisma 限制）
 * 2. 測試內的所有操作必須使用提供的 tx client
 *
 * @example
 * ```typescript
 * it('應該創建 product', async () => {
 *   await withTestTransaction(async (tx) => {
 *     const product = await tx.product.create({
 *       data: { user_id: TEST_USER_ID, name: 'Test' }
 *     })
 *     expect(product).toBeDefined()
 *     // Transaction 結束後自動 rollback，資料不會真正存入 DB
 *   })
 * })
 * ```
 */
export async function withTestTransaction<T = void>(
  testFn: (tx: typeof prisma) => Promise<T>
): Promise<T> {
  let result: T | undefined

  try {
    await prisma.$transaction(
      async (tx) => {
        // 執行測試函數
        result = await testFn(tx as typeof prisma)

        // 強制 rollback（即使測試成功）
        // 拋出特殊錯誤來觸發 rollback
        throw new Error('FORCE_ROLLBACK_TEST_TRANSACTION')
      },
      {
        // 設置較長的 timeout（某些測試可能需要呼叫外部 API）
        timeout: 60000, // 60 秒
        // 隔離級別：Read Committed（避免幻讀）
        isolationLevel: 'ReadCommitted',
      }
    )
  } catch (error: any) {
    // 忽略強制 rollback 的錯誤（這是預期的）
    if (error.message === 'FORCE_ROLLBACK_TEST_TRANSACTION') {
      // Rollback 成功，返回測試結果
      return result as T
    }

    // 其他錯誤正常拋出（測試失敗）
    throw error
  }

  // 理論上不會到這裡，但 TypeScript 需要返回值
  return result as T
}

/**
 * 批次 Transaction 隔離（用於多個獨立測試）
 *
 * 當需要在單個測試檔案中運行多個獨立的 transaction 測試時使用
 *
 * @example
 * ```typescript
 * describe('Product Tests', () => {
 *   const tests = [
 *     { name: '測試 1', fn: async (tx) => { ... } },
 *     { name: '測試 2', fn: async (tx) => { ... } },
 *   ]
 *
 *   tests.forEach(({ name, fn }) => {
 *     it(name, async () => {
 *       await withTestTransaction(fn)
 *     })
 *   })
 * })
 * ```
 */
export async function withTestTransactions<T = void>(
  tests: Array<{
    name: string
    fn: (tx: typeof prisma) => Promise<T>
  }>
): Promise<void> {
  for (const test of tests) {
    try {
      await withTestTransaction(test.fn)
    } catch (error) {
      console.error(`❌ Test failed: ${test.name}`, error)
      throw error
    }
  }
}

/**
 * 使用 Transaction 的整合測試輔助函數
 *
 * 結合 setupIntegrationTests 和 withTestTransaction
 * 適用於需要基礎設置但希望每個測試自動 rollback 的場景
 *
 * @example
 * ```typescript
 * describe('API Tests', () => {
 *   beforeAll(async () => {
 *     await setupIntegrationTests() // 建立測試用戶
 *   })
 *
 *   it('應該創建 area', async () => {
 *     await withIsolatedTest(async (tx) => {
 *       const area = await tx.area.create({
 *         data: { user_id: TEST_USER_ID, name: 'Test Area' }
 *       })
 *       expect(area).toBeDefined()
 *     })
 *   })
 * })
 * ```
 */
export async function withIsolatedTest<T = void>(
  testFn: (tx: typeof prisma) => Promise<T>
): Promise<T> {
  // 確保測試用戶存在（如果不存在則創建）
  const existingUser = await prisma.user.findUnique({
    where: { id: TEST_USER_ID },
  })

  if (!existingUser) {
    await prisma.user.create({
      data: {
        id: TEST_USER_ID,
        email: 'test@example.com',
        name: 'Test User',
        auth_provider: 'GOOGLE',
        auth_provider_id: TEST_FIREBASE_UID,
      },
    })
  }

  // 執行測試（使用 transaction rollback）
  return withTestTransaction(testFn)
}
