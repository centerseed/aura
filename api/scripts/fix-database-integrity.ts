/**
 * 資料庫完整性自動修復腳本
 *
 * 自動修復：
 * 1. 過濾掉 sub_items 和 references 中的 null 項目
 * 2. 移除缺少必要欄位的項目
 * 3. 備份原始資料到日誌
 *
 * 用法：
 *   npx tsx scripts/fix-database-integrity.ts
 */

import { PrismaClient } from '@prisma/client'
import { writeFileSync } from 'fs'
import { join } from 'path'

const prisma = new PrismaClient()

interface FixLog {
  taskId: string
  taskContent: string
  fixType: string
  before: any
  after: any
}

async function fixDatabaseIntegrity() {
  console.log('🔧 開始修復資料庫完整性...\n')

  const fixLogs: FixLog[] = []
  let fixedCount = 0

  // 獲取所有 tasks
  const tasks = await prisma.task.findMany({
    where: { deleted_at: null },
    select: {
      id: true,
      content: true,
      sub_items: true,
      references: true,
    },
  })

  console.log(`📊 總共 ${tasks.length} 個 tasks 需要檢查\n`)

  for (const task of tasks) {
    let needsUpdate = false
    const updates: any = {}

    // 修復 sub_items
    if (task.sub_items) {
      const subItems = task.sub_items as Array<any>

      if (Array.isArray(subItems)) {
        const cleanedSubItems = subItems
          .filter((item) => item != null && item.id && item.content)
          .map((item) => ({
            id: item.id,
            content: item.content,
            completed: Boolean(item.completed),
            created_at: item.created_at || new Date().toISOString(),
            completed_at: item.completed_at || null,
            order: Number(item.order) || 0,
          }))

        if (cleanedSubItems.length !== subItems.length || JSON.stringify(cleanedSubItems) !== JSON.stringify(subItems)) {
          fixLogs.push({
            taskId: task.id,
            taskContent: task.content,
            fixType: 'sub_items_cleaned',
            before: subItems,
            after: cleanedSubItems,
          })
          updates.sub_items = cleanedSubItems
          needsUpdate = true
          console.log(`✓ 清理 Task ${task.id} 的 sub_items (${subItems.length} → ${cleanedSubItems.length})`)
        }
      }
    }

    // 修復 references
    if (task.references) {
      const references = task.references as Array<any>

      if (Array.isArray(references)) {
        const cleanedReferences = references
          .filter((ref) => ref != null && ref.id && ref.type && ref.content)
          .map((ref) => ({
            id: ref.id,
            type: ref.type,
            content: ref.content,
            title: ref.title || null,
            created_at: ref.created_at || new Date().toISOString(),
          }))

        if (cleanedReferences.length !== references.length || JSON.stringify(cleanedReferences) !== JSON.stringify(references)) {
          fixLogs.push({
            taskId: task.id,
            taskContent: task.content,
            fixType: 'references_cleaned',
            before: references,
            after: cleanedReferences,
          })
          updates.references = cleanedReferences
          needsUpdate = true
          console.log(`✓ 清理 Task ${task.id} 的 references (${references.length} → ${cleanedReferences.length})`)
        }
      }
    }

    // 執行更新
    if (needsUpdate) {
      await prisma.task.update({
        where: { id: task.id },
        data: updates,
      })
      fixedCount++
    }
  }

  // 儲存修復日誌
  if (fixLogs.length > 0) {
    const logPath = join(__dirname, '..', 'logs', `fix-integrity-${Date.now()}.json`)
    writeFileSync(logPath, JSON.stringify(fixLogs, null, 2))
    console.log(`\n📝 修復日誌已儲存到: ${logPath}`)
  }

  // 報告結果
  console.log('\n' + '='.repeat(80))
  if (fixedCount === 0) {
    console.log('✅ 沒有需要修復的資料。')
  } else {
    console.log(`✅ 成功修復 ${fixedCount} 個 tasks！`)
    console.log(`   總共處理 ${fixLogs.length} 個問題`)
    console.log('\n💡 建議：')
    console.log('   1. 重新執行 scripts/check-database-integrity.ts 確認修復成功')
    console.log('   2. 檢查修復日誌確認沒有遺失重要資料')
  }
  console.log('='.repeat(80) + '\n')

  await prisma.$disconnect()
}

// 執行修復
fixDatabaseIntegrity()
  .catch((error) => {
    console.error('❌ 修復失敗:', error)
    process.exit(1)
  })
