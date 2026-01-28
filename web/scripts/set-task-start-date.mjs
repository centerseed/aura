import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function setTaskStartDate() {
  const userId = '467c7125-d890-429f-b46f-168429b1907e'
  const startDate = new Date('2026-01-26T00:00:00.000Z')

  console.log('🚀 開始設定 Task 開始時間...')
  console.log(`   User ID: ${userId}`)
  console.log(`   Start Date: ${startDate.toISOString().split('T')[0]}`)

  // 1. 查詢所有該用戶未刪除的 tasks
  const tasksBeforeUpdate = await prisma.task.findMany({
    where: {
      user_id: userId,
      deleted_at: null
    },
    select: {
      id: true,
      content: true,
      start_date: true,
      due_date: true,
      status: true,
      created_at: true
    }
  })

  console.log(`\n📊 找到 ${tasksBeforeUpdate.length} 筆 tasks (未刪除)`)

  if (tasksBeforeUpdate.length === 0) {
    console.log('   ❌ 沒有找到任何 tasks')
    process.exit(1)
  }

  // 2. 顯示更新前的狀態
  console.log('\n📋 更新前的 start_date 分佈:')
  const beforeStats = {
    withStartDate: tasksBeforeUpdate.filter(t => t.start_date).length,
    withoutStartDate: tasksBeforeUpdate.filter(t => !t.start_date).length
  }
  console.log(`   ✓ 已有 start_date: ${beforeStats.withStartDate}`)
  console.log(`   ✗ 沒有 start_date: ${beforeStats.withoutStartDate}`)

  // 3. 批次更新 tasks 的 start_date
  console.log('\n⏳ 更新中...')
  const result = await prisma.task.updateMany({
    where: {
      user_id: userId,
      deleted_at: null
    },
    data: {
      start_date: startDate
    }
  })

  console.log(`   ✅ 已更新 ${result.count} 筆 tasks`)

  // 4. 驗證更新結果
  console.log('\n✨ 驗證結果...')
  const tasksAfterUpdate = await prisma.task.findMany({
    where: {
      user_id: userId,
      deleted_at: null
    },
    select: {
      id: true,
      content: true,
      start_date: true,
      due_date: true,
      status: true,
      created_at: true
    },
    orderBy: { created_at: 'desc' },
    take: 10 // 顯示最後建立的 10 筆
  })

  console.log(`\n📝 最後建立的 10 筆 tasks (已驗證):`)
  tasksAfterUpdate.forEach((task, index) => {
    const startDateStr = task.start_date ? task.start_date.toISOString().split('T')[0] : 'NULL'
    const dueDateStr = task.due_date ? task.due_date.toISOString().split('T')[0] : 'NULL'
    const createdAtStr = task.created_at.toISOString().split('T')[0]
    console.log(`   ${(index + 1).toString().padStart(2)} | ${task.content.substring(0, 30).padEnd(30)} | start: ${startDateStr} | due: ${dueDateStr} | created: ${createdAtStr}`)
  })

  // 5. 最終統計
  const afterStats = {
    allWithStartDate: tasksAfterUpdate.filter(t => t.start_date).length,
    matchingTargetDate: tasksAfterUpdate.filter(t =>
      t.start_date &&
      t.start_date.getFullYear() === 2026 &&
      t.start_date.getMonth() === 0 && // January = 0
      t.start_date.getDate() === 26
    ).length
  }

  console.log(`\n🎉 完成！`)
  console.log(`   ✓ 設定為 2026-01-26 的 tasks: ${afterStats.matchingTargetDate}/${tasksAfterUpdate.length}`)
  console.log(`   ✓ 所有 tasks 都已成功設定 created_at (自動時間戳)`)
}

setTaskStartDate()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
