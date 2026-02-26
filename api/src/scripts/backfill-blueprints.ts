/**
 * Backfill Product Blueprints + Task Embeddings
 *
 * 1. 為所有 products 生成 blueprint (text + embedding)
 * 2. 為所有沒有 embedding 的 tasks 計算 embedding
 *
 * 使用方式：
 *   npx tsx src/scripts/backfill-blueprints.ts
 */

import { prisma } from '@/lib/db'
import { updateProductBlueprint } from '@/lib/product-blueprint'
import { ensureTaskEmbedding } from '@/lib/embedding'

const BATCH_SIZE = 10
const DELAY_MS = 1000

async function backfillBlueprints() {
  console.log('🚀 Phase 1: Backfilling product blueprints...\n')

  const products = await prisma.$queryRaw<Array<{ id: string; name: string }>>`
    SELECT id::text, name
    FROM products
    WHERE deleted_at IS NULL
    ORDER BY created_at DESC
  `

  console.log(`📊 Found ${products.length} products to update\n`)

  let processed = 0
  let failed = 0

  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    const batch = products.slice(i, i + BATCH_SIZE)
    console.log(`\n📦 Blueprint batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(products.length / BATCH_SIZE)}`)

    for (const product of batch) {
      try {
        await updateProductBlueprint(product.id)
        processed++
        console.log(`  ✅ [${processed}/${products.length}] ${product.name}`)
      } catch (error) {
        failed++
        console.error(`  ❌ [${processed + failed}/${products.length}] ${product.name}:`, error)
      }
    }

    if (i + BATCH_SIZE < products.length) {
      await new Promise(resolve => setTimeout(resolve, DELAY_MS))
    }
  }

  console.log(`\n📊 Blueprints: ${processed} success, ${failed} failed`)
  return failed
}

async function backfillTaskEmbeddings() {
  console.log('\n🚀 Phase 2: Backfilling task embeddings...\n')

  const tasks = await prisma.$queryRaw<Array<{ id: string; content: string }>>`
    SELECT id::text, content
    FROM tasks
    WHERE deleted_at IS NULL
      AND embedding IS NULL
      AND status != 'ARCHIVE'
    ORDER BY updated_at DESC
  `

  console.log(`📊 Found ${tasks.length} tasks without embedding\n`)

  if (tasks.length === 0) {
    console.log('✅ All tasks already have embeddings!')
    return 0
  }

  let processed = 0
  let failed = 0

  for (let i = 0; i < tasks.length; i += BATCH_SIZE) {
    const batch = tasks.slice(i, i + BATCH_SIZE)
    console.log(`\n📦 Task batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(tasks.length / BATCH_SIZE)}`)

    for (const task of batch) {
      try {
        await ensureTaskEmbedding(task.id, task.content)
        processed++
        console.log(`  ✅ [${processed}/${tasks.length}] ${task.content.slice(0, 40)}`)
      } catch (error) {
        failed++
        console.error(`  ❌ [${processed + failed}/${tasks.length}] ${task.content.slice(0, 40)}:`, error)
      }
    }

    if (i + BATCH_SIZE < tasks.length) {
      await new Promise(resolve => setTimeout(resolve, DELAY_MS))
    }
  }

  console.log(`\n📊 Task embeddings: ${processed} success, ${failed} failed`)
  return failed
}

async function main() {
  const blueprintFailed = await backfillBlueprints()
  const taskFailed = await backfillTaskEmbeddings()

  console.log('\n' + '='.repeat(50))
  console.log('📊 Backfill Complete')
  console.log('='.repeat(50))

  if (blueprintFailed + taskFailed > 0) {
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
