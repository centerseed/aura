import { prisma } from '@/lib/db'
import { randomUUID } from 'crypto'

/**
 * 測試資料庫工具
 * 用於整合測試的資料庫設置與清理
 */

/**
 * 清理測試資料
 * 按照外鍵依賴順序刪除（由子表到父表）
 */
export async function cleanupTestData(userId?: string) {
  try {
    // 🚨 絕對安全檢查 1: 必須使用測試資料庫
    const dbUrl = process.env.DATABASE_URL || ''
    const isTestDatabase = (
      dbUrl.includes('_test') ||
      dbUrl.includes('localhost:5432') ||
      dbUrl.includes('127.0.0.1:5432') ||
      dbUrl.includes('localhost:54322') || // Supabase local
      dbUrl.includes('test.supabase')
    )

    if (!isTestDatabase) {
      throw new Error(
        `🚨 FATAL: Tests MUST use test database!\n` +
        `Current DATABASE_URL: ${dbUrl.substring(0, 30)}...\n` +
        `Expected: URL must contain "_test", "localhost", or "test.supabase"`
      )
    }

    // 🚨 絕對安全檢查 2: 禁止在生產環境執行清理
    if (process.env.NODE_ENV === 'production') {
      throw new Error('🚨 FATAL: Cannot cleanup data in production environment!')
    }

    // 🚨 絕對安全檢查 3: 必須指定 userId，禁止清理所有資料
    if (!userId) {
      throw new Error('🚨 FATAL: userId is required! Cannot cleanup all data without explicit user ID.')
    }

    // 🚨 絕對安全檢查 4: 只允許清理明確標記的測試用戶
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        auth_provider_id: true
      }
    })
    if (!user) {
      throw new Error(`User ${userId} not found`)
    }

    // ⚠️ 只允許清理明確的測試用戶：
    // - email 必須以 "test-" 開頭
    // - 或 email 必須包含 @example.com 或 @test.com
    // - 或 auth_provider_id 必須以 "firebase-test-uid-" 或 "anon-" 或 "google-" 或 "email-" 開頭
    //
    // ❌ 絕對不允許：
    // - 任何真實的 domain（@naruvia.local, @zentropy.local 等）
    // - 任何沒有明確標記為測試的用戶
    const isTestUser = (
      user.email?.startsWith('test-') ||
      user.email?.includes('@example.com') ||
      user.email?.includes('@test.com') ||
      user.auth_provider_id?.startsWith('firebase-test-uid-') ||
      user.auth_provider_id?.startsWith('anon-') ||
      user.auth_provider_id?.startsWith('google-') ||
      user.auth_provider_id?.startsWith('email-')
    )

    if (!isTestUser) {
      throw new Error(
        `🚨 FATAL: Cannot cleanup real user data!\n` +
        `User email: ${user.email}\n` +
        `User auth_provider_id: ${user.auth_provider_id}\n` +
        `Only users with email starting with "test-" or containing "@example.com/@test.com" are allowed.`
      )
    }

    // 清理特定測試用戶的資料（按外鍵依賴順序）
    // 先刪除 SystemEvaluationLog (依賴 user_id)
    await prisma.systemEvaluationLog.deleteMany({ where: { user_id: userId } })

    // 然後刪除其他資料
    await prisma.task.deleteMany({ where: { user_id: userId } })
    await prisma.milestone.deleteMany({ where: { user_id: userId } })
    await prisma.topic.deleteMany({ where: { product: { user_id: userId } } })
    await prisma.product.deleteMany({ where: { user_id: userId } })
    await prisma.area.deleteMany({ where: { user_id: userId } })

    // 最後刪除用戶
    await prisma.user.deleteMany({ where: { id: userId } })

    console.log(`✅ Cleaned up test user: ${user.email}`)
  } catch (error) {
    console.error('清理測試資料失敗:', error)
    throw error
  }
}

/**
 * 創建測試用戶
 */
export async function createTestUser(overrides: {
  id?: string
  email?: string
  auth_provider_id?: string
} = {}) {
  const testUser = await prisma.user.create({
    data: {
      id: overrides.id || randomUUID(),
      email: overrides.email || `test-${randomUUID()}@example.com`,
      name: 'Test User',
      auth_provider_id: overrides.auth_provider_id || `firebase-test-uid-${randomUUID()}`,
      created_at: new Date(),
      updated_at: new Date(),
    },
  })
  return testUser
}

/**
 * 創建測試 Area
 */
export async function createTestArea(userId: string, overrides: {
  id?: string
  name?: string
  is_custom?: boolean
} = {}) {
  const area = await prisma.area.create({
    data: {
      id: overrides.id || randomUUID(),
      user_id: userId,
      name: overrides.name || 'Test Area',
      is_custom: overrides.is_custom ?? true,
      created_at: new Date(),
      updated_at: new Date(),
    },
  })
  return area
}

/**
 * 創建測試 Product
 */
export async function createTestProduct(userId: string, areaId: string, overrides: {
  id?: string
  name?: string
  status?: 'INBOX' | 'ACTIVE' | 'MAINTAIN' | 'REFERENCE' | 'ARCHIVE'
  lifecycle?: 'FINITE' | 'PERPETUAL'
} = {}) {
  const product = await prisma.product.create({
    data: {
      id: overrides.id || randomUUID(),
      user_id: userId,
      area_id: areaId,
      name: overrides.name || 'Test Product',
      status: overrides.status || 'ACTIVE',
      lifecycle: overrides.lifecycle || 'FINITE',
      created_at: new Date(),
      updated_at: new Date(),
    },
  })
  return product
}

/**
 * 創建測試 Topic
 */
export async function createTestTopic(productId: string, userId: string, overrides: {
  id?: string
  name?: string
} = {}) {
  const topic = await prisma.topic.create({
    data: {
      id: overrides.id || randomUUID(),
      product_id: productId,
      user_id: userId,
      name: overrides.name || 'Test Topic',
      created_at: new Date(),
      updated_at: new Date(),
    },
  })
  return topic
}

/**
 * 創建測試 Task
 */
export async function createTestTask(userId: string, productId: string, overrides: {
  id?: string
  content?: string
  status?: 'INBOX' | 'ACTIVE' | 'MAINTAIN' | 'REFERENCE' | 'ARCHIVE'
  topic_id?: string | null
  ai_analysis?: any
  start_date?: Date | null
  due_date?: Date | null
  time_confidence?: number | null
  inferred_from_milestone?: string | null
  sub_items?: any[]
  references?: any[]
} = {}) {
  const task = await prisma.task.create({
    data: {
      id: overrides.id || randomUUID(),
      user_id: userId,
      product_id: productId,
      topic_id: overrides.topic_id ?? null,
      content: overrides.content || 'Test Task',
      status: overrides.status || 'INBOX',
      ai_analysis: overrides.ai_analysis || null,
      start_date: overrides.start_date ?? null,
      due_date: overrides.due_date ?? null,
      time_confidence: overrides.time_confidence ?? null,
      inferred_from_milestone: overrides.inferred_from_milestone ?? null,
      references: overrides.references || [],
      sub_items: overrides.sub_items || [],
      deleted_at: null,
      created_at: new Date(),
      updated_at: new Date(),
    },
  })
  return task
}

/**
 * 斷開資料庫連線
 */
export async function disconnectDb() {
  await prisma.$disconnect()
}
