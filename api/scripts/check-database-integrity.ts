/**
 * 資料庫完整性檢查腳本
 *
 * 檢查並報告：
 * 1. Tasks 的 sub_items 和 references JSON 欄位是否包含 null
 * 2. JSON 欄位格式是否正確
 * 3. 必要欄位是否存在
 *
 * 用法：
 *   npx tsx scripts/check-database-integrity.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface IntegrityIssue {
  taskId: string
  taskContent: string
  issueType: 'sub_items_null' | 'references_null' | 'sub_items_invalid' | 'references_invalid'
  details: string
}

async function checkDatabaseIntegrity() {
  console.log('🔍 開始檢查資料庫完整性...\n')

  const issues: IntegrityIssue[] = []

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
    // 檢查 sub_items
    if (task.sub_items) {
      const subItems = task.sub_items as Array<any>

      if (!Array.isArray(subItems)) {
        issues.push({
          taskId: task.id,
          taskContent: task.content,
          issueType: 'sub_items_invalid',
          details: 'sub_items 不是陣列',
        })
      } else {
        // 檢查是否有 null 項目
        const hasNull = subItems.some((item) => item == null)
        if (hasNull) {
          issues.push({
            taskId: task.id,
            taskContent: task.content,
            issueType: 'sub_items_null',
            details: `sub_items 包含 ${subItems.filter((i) => i == null).length} 個 null 項目`,
          })
        }

        // 檢查必要欄位
        const invalidItems = subItems.filter((item) => item != null && (!item.id || !item.content))
        if (invalidItems.length > 0) {
          issues.push({
            taskId: task.id,
            taskContent: task.content,
            issueType: 'sub_items_invalid',
            details: `${invalidItems.length} 個 sub_items 缺少必要欄位 (id 或 content)`,
          })
        }
      }
    }

    // 檢查 references
    if (task.references) {
      const references = task.references as Array<any>

      if (!Array.isArray(references)) {
        issues.push({
          taskId: task.id,
          taskContent: task.content,
          issueType: 'references_invalid',
          details: 'references 不是陣列',
        })
      } else {
        // 檢查是否有 null 項目
        const hasNull = references.some((ref) => ref == null)
        if (hasNull) {
          issues.push({
            taskId: task.id,
            taskContent: task.content,
            issueType: 'references_null',
            details: `references 包含 ${references.filter((r) => r == null).length} 個 null 項目`,
          })
        }

        // 檢查必要欄位
        const invalidRefs = references.filter((ref) => ref != null && (!ref.id || !ref.type || !ref.content))
        if (invalidRefs.length > 0) {
          issues.push({
            taskId: task.id,
            taskContent: task.content,
            issueType: 'references_invalid',
            details: `${invalidRefs.length} 個 references 缺少必要欄位 (id、type 或 content)`,
          })
        }
      }
    }
  }

  // 報告結果
  console.log('\n' + '='.repeat(80))
  if (issues.length === 0) {
    console.log('✅ 資料庫完整性檢查通過！沒有發現問題。')
  } else {
    console.log(`❌ 發現 ${issues.length} 個問題：\n`)

    // 按類型分類
    const byType: Record<string, IntegrityIssue[]> = {}
    for (const issue of issues) {
      if (!byType[issue.issueType]) {
        byType[issue.issueType] = []
      }
      byType[issue.issueType].push(issue)
    }

    for (const [type, typeIssues] of Object.entries(byType)) {
      console.log(`\n📌 ${type} (${typeIssues.length} 個問題):`)
      for (const issue of typeIssues) {
        console.log(`   - Task ID: ${issue.taskId}`)
        console.log(`     內容: ${issue.taskContent.slice(0, 50)}${issue.taskContent.length > 50 ? '...' : ''}`)
        console.log(`     問題: ${issue.details}`)
        console.log()
      }
    }

    console.log('\n💡 建議：')
    console.log('   1. 執行 scripts/fix-database-integrity.ts 自動修復這些問題')
    console.log('   2. 或手動檢查並修復這些 tasks')
  }
  console.log('='.repeat(80) + '\n')

  await prisma.$disconnect()
}

// 執行檢查
checkDatabaseIntegrity()
  .catch((error) => {
    console.error('❌ 檢查失敗:', error)
    process.exit(1)
  })
