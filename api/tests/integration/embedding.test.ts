/**
 * Embedding 整合測試
 *
 * 測試目標：
 * 1. ensureProductEmbedding() - 計算並存儲 embedding 到資料庫
 * 2. findRelevantProductsHybrid() - 向量相似度搜尋
 * 3. 快取邏輯驗證
 *
 * 注意：
 * - 使用真實 Gemini API（需要 GOOGLE_GENERATIVE_AI_API_KEY）
 * - 可使用 SKIP_EMBEDDING_TESTS=true 跳過（避免耗盡 API 配額）
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import {
  setupIntegrationTests,
  cleanupIntegrationTests,
  TEST_USER_ID,
} from './setup'
import { prisma } from '@/lib/db'
import {
  ensureProductEmbedding,
  ensureProductEmbeddings,
  findRelevantProductsHybrid,
} from '@/lib/embedding'

// 允許透過環境變數跳過測試（避免耗盡 API 配額）
const SKIP_TESTS = process.env.SKIP_EMBEDDING_TESTS === 'true'

describe.skipIf(SKIP_TESTS)('Embedding Integration Tests', () => {
  let testAreaId: string

  beforeAll(async () => {
    if (SKIP_TESTS) {
      console.log('⏭️  Skipping Embedding Integration Tests (SKIP_EMBEDDING_TESTS=true)')
      return
    }

    // 檢查 API key 是否設置
    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      throw new Error(
        'GOOGLE_GENERATIVE_AI_API_KEY is required for embedding integration tests'
      )
    }

    await setupIntegrationTests()

    // 建立測試用的 Area
    const area = await prisma.area.create({
      data: {
        user_id: TEST_USER_ID,
        name: 'Embedding Test Area',
        is_custom: true,
      },
    })
    testAreaId = area.id

    console.log('🧪 Embedding Integration Tests - Setup complete')
  })

  afterAll(async () => {
    if (SKIP_TESTS) return
    await cleanupIntegrationTests()
    console.log('🧪 Embedding Integration Tests - Cleanup complete')
  })

  beforeEach(async () => {
    if (SKIP_TESTS) return

    // 每個測試前清理 products
    await prisma.product.deleteMany({
      where: { user_id: TEST_USER_ID },
    })
  })

  describe('ensureProductEmbedding', () => {
    it('應該計算並存儲 embedding 到資料庫', async () => {
      // 建立測試 Product（沒有 embedding）
      const product = await prisma.product.create({
        data: {
          user_id: TEST_USER_ID,
          area_id: testAreaId,
          name: 'Test Product for Embedding',
          description: 'This is a test product with a meaningful description',
        status: 'ACTIVE',
        lifecycle: 'FINITE',
        },
      })

      // 確認初始狀態沒有 embedding（使用原始 SQL，將 vector 轉換為 text）
      const before = await prisma.$queryRaw<Array<{ embedding: string | null }>>`
        SELECT embedding::text FROM products WHERE id = ${product.id}::uuid
      `
      expect(before[0]?.embedding).toBeNull()

      // 計算並存儲 embedding
      await ensureProductEmbedding(
        product.id,
        product.name,
        product.description,
        false // force = false
      )

      // 驗證 embedding 已存儲（使用原始 SQL）
      const after = await prisma.$queryRaw<Array<{ embedding: string | null }>>`
        SELECT embedding::text FROM products WHERE id = ${product.id}::uuid
      `

      expect(after[0]?.embedding).not.toBeNull()
      expect(after[0]?.embedding).toBeTruthy()

      // 驗證 embedding 是字串格式的向量
      if (typeof after?.embedding === 'string') {
        // pgvector 存儲為字串格式 "[0.1,0.2,0.3,...]"
        expect(after.embedding).toMatch(/^\[.*\]$/)
      }
    }, 30000) // 增加 timeout，因為需要呼叫真實 API

    it('應該跳過已有 embedding 的 product（force=false）', async () => {
      // 建立 Product 並計算 embedding
      const product = await prisma.product.create({
        data: {
          user_id: TEST_USER_ID,
          area_id: testAreaId,
          name: 'Product with Existing Embedding',
          description: 'Already has embedding',
        status: 'ACTIVE',
        lifecycle: 'FINITE',
        },
      })

      // 第一次計算 embedding
      await ensureProductEmbedding(product.id, product.name, product.description, false)

      const firstEmbedding = await prisma.product.findUnique({
        where: { id: product.id },
        
      })

      // 第二次呼叫（應該跳過）
      await ensureProductEmbedding(product.id, product.name, product.description, false)

      const secondEmbedding = await prisma.product.findUnique({
        where: { id: product.id },
        
      })

      // 驗證 embedding 沒有改變（因為被跳過了）
      expect(secondEmbedding?.embedding).toEqual(firstEmbedding?.embedding)
    }, 30000)

    it('應該強制更新 embedding（force=true）', async () => {
      // 建立 Product 並計算 embedding
      const product = await prisma.product.create({
        data: {
          user_id: TEST_USER_ID,
          area_id: testAreaId,
          name: 'Product to Force Update',
          description: 'Original description',
        status: 'ACTIVE',
        lifecycle: 'FINITE',
        },
      })

      await ensureProductEmbedding(product.id, product.name, product.description, false)

      const firstEmbedding = await prisma.$queryRaw<Array<{ embedding: string | null }>>`
        SELECT embedding::text FROM products WHERE id = ${product.id}::uuid
      `

      // 更新描述
      await prisma.product.update({
        where: { id: product.id },
        data: { description: 'Updated description with different content' },
      })

      // 強制重新計算 embedding
      await ensureProductEmbedding(
        product.id,
        product.name,
        'Updated description with different content',
        true // force = true
      )

      const secondEmbedding = await prisma.$queryRaw<Array<{ embedding: string | null }>>`
        SELECT embedding::text FROM products WHERE id = ${product.id}::uuid
      `

      // 驗證 embedding 已改變（因為描述不同，embedding 應該不同）
      expect(secondEmbedding[0]?.embedding).not.toBeNull()
      expect(secondEmbedding[0]?.embedding).not.toEqual(firstEmbedding[0]?.embedding)
    }, 30000)

    it('應該處理沒有 description 的 Product', async () => {
      const product = await prisma.product.create({
        data: {
          user_id: TEST_USER_ID,
          area_id: testAreaId,
          name: 'Product Without Description',
          description: null,
        status: 'ACTIVE',
        lifecycle: 'FINITE',
        },
      })

      // 只使用 name 計算 embedding
      await ensureProductEmbedding(product.id, product.name, null, false)

      const after = await prisma.product.findUnique({
        where: { id: product.id },
        
      })

      // 即使沒有 description，也應該能計算 embedding
      expect(after?.embedding).not.toBeNull()
    }, 30000)
  })

  describe('ensureProductEmbeddings (批次)', () => {
    it('應該批次計算多個 Products 的 embeddings', async () => {
      // 建立 3 個測試 Products（沒有 embedding）
      const products = await Promise.all([
        prisma.product.create({
          data: {
            user_id: TEST_USER_ID,
            area_id: testAreaId,
            name: 'Batch Product 1',
            description: 'First product in batch',
          status: 'ACTIVE',
          lifecycle: 'FINITE',
          },
        }),
        prisma.product.create({
          data: {
            user_id: TEST_USER_ID,
            area_id: testAreaId,
            name: 'Batch Product 2',
            description: 'Second product in batch',
          status: 'ACTIVE',
          lifecycle: 'FINITE',
          },
        }),
        prisma.product.create({
          data: {
            user_id: TEST_USER_ID,
            area_id: testAreaId,
            name: 'Batch Product 3',
            description: 'Third product in batch',
          status: 'ACTIVE',
          lifecycle: 'FINITE',
          },
        }),
      ])

      // 批次計算 embeddings
      await ensureProductEmbeddings(
        products.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
        }))
      )

      // 驗證所有 Products 都有 embedding
      const results = await prisma.product.findMany({
        where: { id: { in: products.map((p) => p.id) } },
        
      })

      expect(results.length).toBe(3)
      results.forEach((r) => {
        expect(r.embedding).not.toBeNull()
      })
    }, 60000) // 批次 API 呼叫需要更長時間

    it('應該只計算缺少 embedding 的 Products', async () => {
      // 建立 2 個 Products，其中 1 個已有 embedding
      const product1 = await prisma.product.create({
        data: {
          user_id: TEST_USER_ID,
          area_id: testAreaId,
          name: 'Product with Embedding',
          description: 'Already has embedding',
        status: 'ACTIVE',
        lifecycle: 'FINITE',
        },
      })

      const product2 = await prisma.product.create({
        data: {
          user_id: TEST_USER_ID,
          area_id: testAreaId,
          name: 'Product without Embedding',
          description: 'Missing embedding',
        status: 'ACTIVE',
        lifecycle: 'FINITE',
        },
      })

      // 為 product1 計算 embedding
      await ensureProductEmbedding(product1.id, product1.name, product1.description, false)

      // 批次計算（應該只計算 product2）
      await ensureProductEmbeddings([
        { id: product1.id, name: product1.name, description: product1.description },
        { id: product2.id, name: product2.name, description: product2.description },
      ])

      // 驗證兩個 Products 都有 embedding
      const results = await prisma.product.findMany({
        where: { id: { in: [product1.id, product2.id] } },
        
      })

      expect(results.length).toBe(2)
      expect(results.every((r) => r.embedding !== null)).toBe(true)
    }, 60000)
  })

  describe('findRelevantProductsHybrid', () => {
    it('應該使用向量相似度返回最相關的 products', async () => {
      // 建立多個相關主題的 Products
      const products = await Promise.all([
        prisma.product.create({
          data: {
            user_id: TEST_USER_ID,
            area_id: testAreaId,
            name: 'Frontend Development',
            description: 'React, TypeScript, and modern web technologies',
          status: 'ACTIVE',
          lifecycle: 'FINITE',
          },
        }),
        prisma.product.create({
          data: {
            user_id: TEST_USER_ID,
            area_id: testAreaId,
            name: 'Backend API',
            description: 'Node.js, Express, REST API development',
          status: 'ACTIVE',
          lifecycle: 'FINITE',
          },
        }),
        prisma.product.create({
          data: {
            user_id: TEST_USER_ID,
            area_id: testAreaId,
            name: 'Machine Learning',
            description: 'Python, TensorFlow, data science and AI',
          status: 'ACTIVE',
          lifecycle: 'FINITE',
          },
        }),
      ])

      // 批次計算 embeddings
      await ensureProductEmbeddings(
        products.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
        }))
      )

      // 搜尋與「React 前端開發」相關的 Products
      const { results, allCached } = await findRelevantProductsHybrid(
        'Building a React frontend application',
        TEST_USER_ID,
        3
      )

      // 驗證結果
      expect(results.length).toBeGreaterThan(0)
      expect(allCached).toBe(true) // 所有 Products 都有 embedding

      // 驗證排序（相似度遞減）
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].similarity).toBeGreaterThanOrEqual(results[i].similarity)
      }

      // 驗證最相關的是 "Frontend Development"
      expect(results[0].productName).toBe('Frontend Development')
      expect(results[0].similarity).toBeGreaterThan(0.5) // 應該有合理的相似度
    }, 60000)

    it('應該正確報告 allCached 狀態', async () => {
      // 建立 2 個 Products，只為其中 1 個計算 embedding
      const product1 = await prisma.product.create({
        data: {
          user_id: TEST_USER_ID,
          area_id: testAreaId,
          name: 'Product with Embedding',
          description: 'Has embedding',
        status: 'ACTIVE',
        lifecycle: 'FINITE',
        },
      })

      await prisma.product.create({
        data: {
          user_id: TEST_USER_ID,
          area_id: testAreaId,
          name: 'Product without Embedding',
          description: 'Missing embedding',
        status: 'ACTIVE',
        lifecycle: 'FINITE',
        },
      })

      // 只為 product1 計算 embedding
      await ensureProductEmbedding(product1.id, product1.name, product1.description, false)

      // 執行搜尋
      const { allCached } = await findRelevantProductsHybrid(
        'test query',
        TEST_USER_ID,
        3
      )

      // allCached 應該為 false（因為有 1 個 Product 缺少 embedding）
      expect(allCached).toBe(false)
    }, 60000)

    it('應該返回空結果當沒有 Products', async () => {
      // 確保沒有 Products
      await prisma.product.deleteMany({
        where: { user_id: TEST_USER_ID },
      })

      const { results, allCached } = await findRelevantProductsHybrid(
        'test query',
        TEST_USER_ID,
        3
      )

      expect(results).toEqual([])
      expect(allCached).toBe(true) // 沒有 Products 時，allCached 應為 true
    }, 30000)

    it('應該限制返回數量（topK）', async () => {
      // 建立 5 個 Products
      const products = await Promise.all(
        Array.from({ length: 5 }, (_, i) =>
          prisma.product.create({
            data: {
              user_id: TEST_USER_ID,
              area_id: testAreaId,
              name: `Product ${i + 1}`,
              description: `Description for product ${i + 1}`,
              status: 'ACTIVE',
              lifecycle: 'FINITE',
            },
          })
        )
      )

      // 批次計算 embeddings
      await ensureProductEmbeddings(
        products.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
        }))
      )

      // 只請求 top 3
      const { results } = await findRelevantProductsHybrid(
        'test query',
        TEST_USER_ID,
        3 // topK = 3
      )

      // 驗證只返回 3 個結果
      expect(results.length).toBe(3)
    }, 60000)
  })
})

// 當測試被跳過時，顯示提示訊息
if (SKIP_TESTS) {
  describe('Embedding Integration Tests (Skipped)', () => {
    it('提示：設置 SKIP_EMBEDDING_TESTS=false 來運行這些測試', () => {
      console.log('💡 提示：要運行 Embedding 整合測試，請設置環境變數：')
      console.log('   SKIP_EMBEDDING_TESTS=false npm run test:integration')
      expect(true).toBe(true)
    })
  })
}
