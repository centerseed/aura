/**
 * 整合測試設置
 *
 * 這個檔案設置整合測試環境，包括：
 * - 測試資料庫連線
 * - 測試用戶建立
 * - 測試資料清理
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
  // 先清理所有測試資料
  await cleanupIntegrationTests()

  // 建立測試用戶（使用 upsert 避免重複建立）
  await prisma.user.upsert({
    where: { id: TEST_USER_ID },
    update: {
      email: 'test@example.com',
      name: 'Test User',
    },
    create: {
      id: TEST_USER_ID,
      email: 'test@example.com',
      name: 'Test User',
      auth_provider: 'GOOGLE', // Must match AuthProvider enum
      auth_provider_id: TEST_FIREBASE_UID,
    },
  }).catch((error) => {
    console.error('Failed to upsert test user:', error)
    throw error
  })
}

/**
 * 整合測試後置清理
 */
export async function cleanupIntegrationTests() {
  try {
    // 清理測試資料（按照依賴順序）
    // 注意：這會刪除所有測試用戶的資料

    // 1. 刪除測試用戶的所有任務（包含關聯的 sub-items 和 references）
    await prisma.task.deleteMany({
      where: { user_id: TEST_USER_ID },
    })

    // 2. 刪除測試用戶的所有 topics
    await prisma.topic.deleteMany({
      where: { user_id: TEST_USER_ID },
    })

    // 3. 刪除測試用戶的所有產品
    await prisma.product.deleteMany({
      where: { user_id: TEST_USER_ID },
    })

    // 4. 刪除測試用戶的所有 milestones
    await prisma.milestone.deleteMany({
      where: { user_id: TEST_USER_ID },
    })

    // 5. 刪除測試用戶的所有領域
    await prisma.area.deleteMany({
      where: { user_id: TEST_USER_ID },
    })

    // 6. 最後刪除測試用戶
    await prisma.user.deleteMany({
      where: { id: TEST_USER_ID },
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
