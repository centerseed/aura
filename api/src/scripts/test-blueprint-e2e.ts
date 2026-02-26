/**
 * End-to-end test for blueprint + two-stage retrieval
 *
 * 驗證：
 * 1. Blueprint 生成 (text + embedding)
 * 2. Task embedding 計算
 * 3. Two-stage retrieval (product selection + task fetch)
 * 4. Similarity signal for append vs new
 *
 * 使用方式：npx tsx src/scripts/test-blueprint-e2e.ts
 */

import { prisma } from '@/lib/db'
import { getEmbedding } from '@/lib/embedding'
import { generateBlueprintText, updateProductBlueprint, maybeRefreshBlueprint } from '@/lib/product-blueprint'
import { ensureTaskEmbedding } from '@/lib/embedding'

const TEST_USER_ID = crypto.randomUUID()

async function setup() {
  console.log('🔧 Setting up test data...\n')

  // Create user
  await prisma.user.create({
    data: {
      id: TEST_USER_ID,
      email: `test-${Date.now()}@example.com`,
      name: 'Blueprint Test User',
      auth_provider: 'EMAIL',
      auth_provider_id: `test-${Date.now()}`,
    },
  })

  // Create areas
  const workArea = await prisma.area.create({
    data: { user_id: TEST_USER_ID, name: '工作', description: '工作相關', scope: '職場事務', is_custom: true },
  })
  const personalArea = await prisma.area.create({
    data: { user_id: TEST_USER_ID, name: '個人', description: '個人事務', scope: '個人生活', is_custom: true },
  })
  const learningArea = await prisma.area.create({
    data: { user_id: TEST_USER_ID, name: '學習', description: '學習成長', scope: '技能提升', is_custom: true },
  })

  // Create products
  const appProduct = await prisma.product.create({
    data: { user_id: TEST_USER_ID, area_id: workArea.id, name: 'Zentropy App 開發', description: 'Flutter App 開發與維護', status: 'ACTIVE', lifecycle: 'PERPETUAL' },
  })
  const mcpProduct = await prisma.product.create({
    data: { user_id: TEST_USER_ID, area_id: workArea.id, name: 'MCP Server 開發', description: 'MCP protocol server 開發', status: 'ACTIVE', lifecycle: 'FINITE' },
  })
  const apiProduct = await prisma.product.create({
    data: { user_id: TEST_USER_ID, area_id: workArea.id, name: 'API 後端', description: 'Next.js API 後端服務', status: 'ACTIVE', lifecycle: 'PERPETUAL' },
  })
  const fitnessProduct = await prisma.product.create({
    data: { user_id: TEST_USER_ID, area_id: personalArea.id, name: '健身計畫', description: '每日運動和飲食控制', status: 'ACTIVE', lifecycle: 'PERPETUAL' },
  })
  const travelProduct = await prisma.product.create({
    data: { user_id: TEST_USER_ID, area_id: personalArea.id, name: '旅遊規劃', description: '日本旅遊計畫', status: 'ACTIVE', lifecycle: 'FINITE' },
  })
  const rustProduct = await prisma.product.create({
    data: { user_id: TEST_USER_ID, area_id: learningArea.id, name: 'Rust 學習', description: '學習 Rust 語言', status: 'ACTIVE', lifecycle: 'FINITE' },
  })
  const devopsProduct = await prisma.product.create({
    data: { user_id: TEST_USER_ID, area_id: workArea.id, name: 'DevOps 自動化', description: 'CI/CD 和部署流程', status: 'ACTIVE', lifecycle: 'PERPETUAL' },
  })
  const renovationProduct = await prisma.product.create({
    data: { user_id: TEST_USER_ID, area_id: personalArea.id, name: '家裡裝潢', description: '新家裝潢進度', status: 'ACTIVE', lifecycle: 'FINITE' },
  })

  // Create topics
  await prisma.topic.create({ data: { user_id: TEST_USER_ID, product_id: appProduct.id, name: 'UI 設計' } })
  await prisma.topic.create({ data: { user_id: TEST_USER_ID, product_id: appProduct.id, name: '效能優化' } })
  await prisma.topic.create({ data: { user_id: TEST_USER_ID, product_id: apiProduct.id, name: 'Brain Dump' } })
  await prisma.topic.create({ data: { user_id: TEST_USER_ID, product_id: fitnessProduct.id, name: '重訓' } })

  // Create tasks
  const tasks = [
    { product_id: appProduct.id, content: '重新設計首頁 UI', status: 'ACTIVE' as const },
    { product_id: appProduct.id, content: '修復列表滾動卡頓', status: 'ACTIVE' as const },
    { product_id: appProduct.id, content: '實作 dark mode 切換', status: 'ACTIVE' as const },
    { product_id: apiProduct.id, content: '改善 Brain Dump 分類準確度', status: 'ACTIVE' as const },
    { product_id: apiProduct.id, content: '加入 two-stage retrieval', status: 'ACTIVE' as const },
    { product_id: apiProduct.id, content: '修復 API rate limiting', status: 'ACTIVE' as const },
    { product_id: fitnessProduct.id, content: '每週重訓三次', status: 'MAINTAIN' as const },
    { product_id: fitnessProduct.id, content: '控制每日蛋白質攝取', status: 'ACTIVE' as const },
    { product_id: travelProduct.id, content: '訂東京機票', status: 'ACTIVE' as const },
    { product_id: travelProduct.id, content: '預約淺草民宿', status: 'ACTIVE' as const },
    { product_id: mcpProduct.id, content: '實作 MCP tool 列表功能', status: 'ACTIVE' as const },
    { product_id: rustProduct.id, content: '完成 Rust Book 第五章', status: 'ACTIVE' as const },
    { product_id: devopsProduct.id, content: '設定 Cloud Build 自動部署', status: 'ACTIVE' as const },
    { product_id: renovationProduct.id, content: '選定廚房磁磚', status: 'ACTIVE' as const },
  ]

  const createdTasks = []
  for (const t of tasks) {
    const task = await prisma.task.create({
      data: { user_id: TEST_USER_ID, product_id: t.product_id, content: t.content, status: t.status, sub_items: [] },
    })
    createdTasks.push(task)
  }

  return {
    products: { appProduct, mcpProduct, apiProduct, fitnessProduct, travelProduct, rustProduct, devopsProduct, renovationProduct },
    tasks: createdTasks,
  }
}

async function testBlueprintGeneration(productId: string, productName: string) {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`📋 Test 1: Blueprint 生成 — ${productName}`)
  console.log('='.repeat(60))

  const text = await generateBlueprintText(productId)
  console.log(`Blueprint text: "${text}"`)
  console.log(`Length: ${text.length} chars`)

  // Verify it contains expected parts
  const hasTopics = text.includes('Topics:')
  const hasTasks = text.includes('Tasks:')
  console.log(`Contains Topics: ${hasTopics ? '✅' : '❌'}`)
  console.log(`Contains Tasks: ${hasTasks ? '✅' : '❌'}`)

  return text
}

async function testBlueprintEmbedding(productId: string, productName: string) {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`🧮 Test 2: Blueprint Embedding 寫入 — ${productName}`)
  console.log('='.repeat(60))

  await updateProductBlueprint(productId)

  // Verify it was written
  const result = await prisma.$queryRaw<Array<{ has_blueprint: boolean; text_len: number; task_count: number }>>`
    SELECT
      blueprint_embedding IS NOT NULL as has_blueprint,
      LENGTH(blueprint_text) as text_len,
      task_count_at_blueprint as task_count
    FROM products WHERE id = ${productId}::uuid
  `

  console.log(`Has blueprint_embedding: ${result[0].has_blueprint ? '✅' : '❌'}`)
  console.log(`Blueprint text length: ${result[0].text_len}`)
  console.log(`Task count at blueprint: ${result[0].task_count}`)

  return result[0].has_blueprint
}

async function testTaskEmbedding(taskId: string, content: string) {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`🧮 Test 3: Task Embedding — "${content}"`)
  console.log('='.repeat(60))

  await ensureTaskEmbedding(taskId, content)

  const result = await prisma.$queryRaw<Array<{ has_embedding: boolean }>>`
    SELECT embedding IS NOT NULL as has_embedding FROM tasks WHERE id = ${taskId}::uuid
  `

  console.log(`Has task embedding: ${result[0].has_embedding ? '✅' : '❌'}`)
  return result[0].has_embedding
}

async function testTwoStageRetrieval(userId: string, inputText: string, expectedProductName: string) {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`🔍 Test 4: Two-Stage Retrieval`)
  console.log(`Input: "${inputText}"`)
  console.log(`Expected top product: "${expectedProductName}"`)
  console.log('='.repeat(60))

  // Stage 1: Product selection with blueprint_embedding
  const userEmbedding = await getEmbedding(inputText)
  const vectorStr = `[${userEmbedding.join(",")}]`

  const products = await prisma.$queryRaw<Array<{ id: string; name: string; similarity: number; used_blueprint: boolean }>>`
    SELECT
      p.id::text, p.name,
      1 - (COALESCE(p.blueprint_embedding, p.embedding) <=> ${vectorStr}::vector) as similarity,
      p.blueprint_embedding IS NOT NULL as used_blueprint
    FROM products p
    WHERE p.user_id = ${userId}::uuid
      AND p.deleted_at IS NULL
      AND COALESCE(p.blueprint_embedding, p.embedding) IS NOT NULL
    ORDER BY COALESCE(p.blueprint_embedding, p.embedding) <=> ${vectorStr}::vector
    LIMIT 3
  `

  console.log('\nStage 1 — Product Selection:')
  for (const p of products) {
    const marker = p.name === expectedProductName ? ' ← expected' : ''
    console.log(`  ${p.name}: ${(Number(p.similarity) * 100).toFixed(1)}% (blueprint: ${p.used_blueprint ? 'yes' : 'no'})${marker}`)
  }

  const topProduct = products[0]
  const isCorrect = topProduct?.name === expectedProductName
  console.log(`\nTop product correct: ${isCorrect ? '✅' : '❌'} (got "${topProduct?.name}")`)

  // Stage 2: Task fetch with similarity
  if (products.length > 0) {
    const productIds = products.map(p => p.id)
    const tasks = await prisma.$queryRaw<Array<{ content: string; product_name: string; task_similarity: number | null }>>`
      SELECT t.content, p.name as product_name,
             CASE WHEN t.embedding IS NOT NULL
               THEN 1 - (t.embedding <=> ${vectorStr}::vector)
               ELSE NULL
             END as task_similarity
      FROM tasks t
      JOIN products p ON p.id = t.product_id
      WHERE t.product_id = ANY(${productIds}::uuid[])
        AND t.deleted_at IS NULL AND t.status != 'ARCHIVE'
      ORDER BY CASE WHEN t.embedding IS NOT NULL THEN t.embedding <=> ${vectorStr}::vector ELSE 999 END
      LIMIT 5
    `

    console.log('\nStage 2 — Top Tasks:')
    for (const t of tasks) {
      const sim = t.task_similarity != null ? `${(Number(t.task_similarity) * 100).toFixed(1)}%` : 'no embedding'
      console.log(`  [${t.product_name}] ${t.content}: ${sim}`)
    }
  }

  return isCorrect
}

async function testMaybeRefresh(productId: string) {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`🔄 Test 5: maybeRefreshBlueprint (staleness check)`)
  console.log('='.repeat(60))

  // Set task_count_at_blueprint to 0 to trigger refresh
  await prisma.$executeRaw`UPDATE products SET task_count_at_blueprint = 0 WHERE id = ${productId}::uuid`

  const before = await prisma.$queryRaw<Array<{ blueprint_updated_at: Date | null }>>`
    SELECT blueprint_updated_at FROM products WHERE id = ${productId}::uuid
  `
  const beforeTime = before[0].blueprint_updated_at

  await maybeRefreshBlueprint(productId)

  const after = await prisma.$queryRaw<Array<{ blueprint_updated_at: Date | null }>>`
    SELECT blueprint_updated_at FROM products WHERE id = ${productId}::uuid
  `
  const afterTime = after[0].blueprint_updated_at

  const refreshed = afterTime && (!beforeTime || afterTime > beforeTime)
  console.log(`Blueprint refreshed: ${refreshed ? '✅' : '❌'}`)
  console.log(`Before: ${beforeTime}, After: ${afterTime}`)

  return !!refreshed
}

async function cleanup() {
  console.log('\n🧹 Cleaning up test data...')
  // Delete in order due to FK constraints
  await prisma.subTask.deleteMany({ where: { user_id: TEST_USER_ID } })
  await prisma.task.deleteMany({ where: { user_id: TEST_USER_ID } })
  await prisma.topic.deleteMany({ where: { user_id: TEST_USER_ID } })
  await prisma.product.deleteMany({ where: { user_id: TEST_USER_ID } })
  await prisma.area.deleteMany({ where: { user_id: TEST_USER_ID } })
  await prisma.user.delete({ where: { id: TEST_USER_ID } })
  console.log('✅ Cleanup done')
}

async function main() {
  console.log('🚀 Blueprint E2E Test\n')

  const { products, tasks } = await setup()
  const results: boolean[] = []

  try {
    // Test 1: Blueprint text generation
    await testBlueprintGeneration(products.appProduct.id, 'Zentropy App 開發')
    await testBlueprintGeneration(products.apiProduct.id, 'API 後端')
    await testBlueprintGeneration(products.fitnessProduct.id, '健身計畫')

    // Test 2: Blueprint embedding for ALL products
    console.log('\n📦 Generating blueprints for all products...')
    for (const [key, product] of Object.entries(products)) {
      const ok = await testBlueprintEmbedding(product.id, product.name)
      results.push(ok)
    }

    // Test 3: Task embeddings
    for (const task of tasks) {
      const ok = await testTaskEmbedding(task.id, task.content)
      results.push(ok)
    }

    // Test 4: Two-stage retrieval accuracy
    const retrievalTests = [
      { input: 'App 的 dark mode 按鈕位置要調整', expected: 'Zentropy App 開發' },
      { input: '東京旅遊要訂住宿', expected: '旅遊規劃' },
      { input: 'Brain Dump 的 embedding 向量搜尋有 bug', expected: 'API 後端' },
      { input: '今天要做深蹲和臥推', expected: '健身計畫' },
      { input: 'MCP protocol 要新增一個 tool', expected: 'MCP Server 開發' },
      { input: '學 Rust 的 ownership 概念', expected: 'Rust 學習' },
      { input: 'CI/CD pipeline 要加自動測試', expected: 'DevOps 自動化' },
      { input: '浴室的磁磚顏色要改', expected: '家裡裝潢' },
    ]

    for (const test of retrievalTests) {
      const ok = await testTwoStageRetrieval(TEST_USER_ID, test.input, test.expected)
      results.push(ok)
    }

    // Test 5: maybeRefreshBlueprint
    const refreshOk = await testMaybeRefresh(products.appProduct.id)
    results.push(refreshOk)

  } finally {
    await cleanup()
  }

  // Summary
  const passed = results.filter(r => r).length
  const total = results.length
  console.log(`\n${'='.repeat(60)}`)
  console.log(`📊 Results: ${passed}/${total} passed`)
  console.log('='.repeat(60))

  if (passed < total) {
    console.log('❌ Some tests failed!')
    process.exit(1)
  } else {
    console.log('✅ All tests passed!')
  }
}

main()
  .catch(error => {
    console.error('❌ Test failed:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
