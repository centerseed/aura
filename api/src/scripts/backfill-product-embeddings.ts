/**
 * Backfill Product Embeddings Script
 *
 * 一次性回填所有現有 Products 的 embedding 向量
 *
 * 使用方式：
 *   npx ts-node -r tsconfig-paths/register src/scripts/backfill-product-embeddings.ts
 *
 * 或在 package.json 中添加：
 *   "backfill:embeddings": "ts-node -r tsconfig-paths/register src/scripts/backfill-product-embeddings.ts"
 */

import { prisma } from '@/lib/db'
import { ensureProductEmbedding } from '@/lib/embedding'

const BATCH_SIZE = 10  // 每批處理的數量（避免 API rate limit）
const DELAY_MS = 1000  // 批次之間的延遲（毫秒）

async function main() {
  console.log('🚀 Starting Product embedding backfill...\n')

  // 1. 查詢所有沒有 embedding 的 Products
  const productsWithoutEmbedding = await prisma.$queryRaw<
    Array<{ id: string; name: string; description: string | null }>
  >`
    SELECT id::text, name, description
    FROM products
    WHERE deleted_at IS NULL
      AND embedding IS NULL
    ORDER BY created_at DESC
  `

  const total = productsWithoutEmbedding.length
  console.log(`📊 Found ${total} Products without embedding\n`)

  if (total === 0) {
    console.log('✅ All Products already have embeddings!')
    return
  }

  // 2. 分批處理
  let processed = 0
  let failed = 0

  for (let i = 0; i < total; i += BATCH_SIZE) {
    const batch = productsWithoutEmbedding.slice(i, i + BATCH_SIZE)

    console.log(`\n📦 Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(total / BATCH_SIZE)}`)

    for (const product of batch) {
      try {
        await ensureProductEmbedding(
          product.id,
          product.name,
          product.description,
          true  // force=true
        )
        processed++
        console.log(`  ✅ [${processed}/${total}] ${product.name}`)
      } catch (error) {
        failed++
        console.error(`  ❌ [${processed + failed}/${total}] ${product.name}:`, error)
      }
    }

    // 批次之間的延遲（避免 rate limit）
    if (i + BATCH_SIZE < total) {
      console.log(`  ⏳ Waiting ${DELAY_MS}ms before next batch...`)
      await new Promise(resolve => setTimeout(resolve, DELAY_MS))
    }
  }

  // 3. 輸出結果
  console.log('\n' + '='.repeat(50))
  console.log('📊 Backfill Summary:')
  console.log(`   Total:     ${total}`)
  console.log(`   Processed: ${processed}`)
  console.log(`   Failed:    ${failed}`)
  console.log('='.repeat(50))

  if (failed > 0) {
    process.exit(1)
  }
}

main()
  .catch(error => {
    console.error('❌ Backfill failed:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
