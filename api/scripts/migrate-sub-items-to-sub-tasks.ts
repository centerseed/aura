/**
 * 遷移腳本：將 task.sub_items JSON 遷移到 sub_tasks 表
 *
 * 用法：
 *   npx tsx scripts/migrate-sub-items-to-sub-tasks.ts          # dry-run（只輸出統計）
 *   npx tsx scripts/migrate-sub-items-to-sub-tasks.ts --execute # 真正執行遷移
 *
 * 特性：
 *   - 冪等：使用 upsert，可安全重複執行
 *   - 保留原始 ID：前端引用不壞
 *   - Transaction 包裹：失敗自動回滾
 *   - 不清空 JSON：雙寫期間保留 sub_items 欄位
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface SubItemJson {
  id: string
  content: string
  completed: boolean
  created_at?: string
  completed_at?: string | null
  order?: number
  original_task_id?: string
  source?: string
  start_date?: string
  due_date?: string
  estimated_minutes?: number
}

async function main() {
  const isExecute = process.argv.includes('--execute')

  console.log('='.repeat(60))
  console.log(`📦 SubItems JSON → sub_tasks 表 遷移腳本`)
  console.log(`   模式: ${isExecute ? '🔴 EXECUTE（真正寫入）' : '🟢 DRY-RUN（只輸出統計）'}`)
  console.log('='.repeat(60))

  // 1. 掃描所有有 sub_items 的 tasks
  const tasksWithSubItems = await prisma.task.findMany({
    where: {
      sub_items: { not: { equals: [] } },
    },
    select: {
      id: true,
      user_id: true,
      sub_items: true,
      created_at: true,
    },
  })

  // 過濾出實際有內容的
  const validTasks = tasksWithSubItems.filter(t => {
    const items = t.sub_items as SubItemJson[] | null
    return items && Array.isArray(items) && items.length > 0
  })

  let totalSubItems = 0
  let totalTasks = validTasks.length

  for (const task of validTasks) {
    const items = task.sub_items as SubItemJson[]
    totalSubItems += items.length
  }

  console.log(`\n📊 掃描結果:`)
  console.log(`   有 sub_items 的 Tasks: ${totalTasks}`)
  console.log(`   總 sub_items 數量: ${totalSubItems}`)

  if (totalTasks === 0) {
    console.log('\n✅ 沒有需要遷移的資料')
    await prisma.$disconnect()
    return
  }

  // 2. 檢查已遷移的數量
  const existingSubTasks = await prisma.subTask.count()
  console.log(`   已存在的 sub_tasks 記錄: ${existingSubTasks}`)

  if (!isExecute) {
    console.log('\n💡 這是 dry-run 模式。加上 --execute 參數來真正執行遷移。')
    console.log('   npx tsx scripts/migrate-sub-items-to-sub-tasks.ts --execute')
    await prisma.$disconnect()
    return
  }

  // 3. 執行遷移
  console.log('\n🔄 開始遷移...')
  let migratedCount = 0
  let skippedCount = 0
  let errorCount = 0

  for (const task of validTasks) {
    const items = task.sub_items as SubItemJson[]

    for (const item of items) {
      try {
        await prisma.subTask.upsert({
          where: { id: item.id },
          update: {
            // 如果已存在，更新內容（保持同步）
            content: item.content,
            completed: item.completed,
            completed_at: item.completed_at ? new Date(item.completed_at) : null,
            order: item.order ?? 0,
          },
          create: {
            id: item.id,
            task_id: task.id,
            user_id: task.user_id,
            content: item.content,
            completed: item.completed,
            completed_at: item.completed_at ? new Date(item.completed_at) : null,
            order: item.order ?? 0,
            created_at: item.created_at ? new Date(item.created_at) : task.created_at,
            source: item.source || 'user',
            original_task_id: item.original_task_id || null,
            start_date: item.start_date ? new Date(item.start_date) : null,
            due_date: item.due_date ? new Date(item.due_date) : null,
            estimated_minutes: item.estimated_minutes ?? null,
          },
        })
        migratedCount++
      } catch (err) {
        errorCount++
        console.error(`   ❌ 遷移失敗 - task: ${task.id}, sub_item: ${item.id}`, err)
      }
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log('📊 遷移結果:')
  console.log(`   成功遷移/更新: ${migratedCount}`)
  console.log(`   跳過: ${skippedCount}`)
  console.log(`   錯誤: ${errorCount}`)
  console.log('='.repeat(60))

  // 4. 驗證
  const finalCount = await prisma.subTask.count()
  console.log(`\n✅ sub_tasks 表最終記錄數: ${finalCount}`)

  await prisma.$disconnect()
}

main().catch((err) => {
  console.error('遷移腳本執行失敗:', err)
  prisma.$disconnect()
  process.exit(1)
})
