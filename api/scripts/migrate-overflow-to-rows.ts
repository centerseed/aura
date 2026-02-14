/**
 * 一次性遷移腳本：將 DailyPlan.overflow_items (JSONB) 轉為 DailyPlanItem rows
 *
 * 執行方式：cd api && npx tsx scripts/migrate-overflow-to-rows.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function migrateOverflowItems() {
  const plans = await prisma.dailyPlan.findMany({
    where: {
      overflow_items: { not: null },
    },
    include: {
      items: {
        orderBy: { order: 'desc' },
        take: 1,
        select: { order: true },
      },
    },
  })

  let totalMigrated = 0

  for (const plan of plans) {
    const overflowItems = plan.overflow_items as any[]
    if (!Array.isArray(overflowItems) || overflowItems.length === 0) continue

    const maxOrder = plan.items[0]?.order ?? -1
    const startOrder = maxOrder + 1

    // itemId 可能是 subtask_id 或 task_id，需要查找對應的 task_id
    const itemIds = overflowItems.map((oi: any) => oi.itemId).filter(Boolean)

    // 先查 subtask
    const subTasks = await prisma.subTask.findMany({
      where: { id: { in: itemIds } },
      select: { id: true, task_id: true },
    })
    const subTaskMap = new Map(subTasks.map(st => [st.id, st.task_id]))

    // 查 task（itemId 直接是 task_id 的情況）
    const tasks = await prisma.task.findMany({
      where: { id: { in: itemIds } },
      select: { id: true },
    })
    const taskSet = new Set(tasks.map(t => t.id))

    const rows: any[] = []
    for (let idx = 0; idx < overflowItems.length; idx++) {
      const oi = overflowItems[idx]
      const id = oi.itemId

      let taskId: string
      let subTaskId: string | null = null

      if (subTaskMap.has(id)) {
        // itemId 是 subtask_id
        taskId = subTaskMap.get(id)!
        subTaskId = id
      } else if (taskSet.has(id)) {
        // itemId 是 task_id
        taskId = id
      } else {
        console.warn(`  Skipping unknown itemId: ${id} (not found in tasks or sub_tasks)`)
        continue
      }

      rows.push({
        plan_id: plan.id,
        task_id: taskId,
        sub_task_id: subTaskId,
        content: oi.content || '',
        product_name: oi.productName || '',
        area_name: '',
        order: startOrder + idx,
        status: 'overflow',
        reasoning: oi.suggestion || null,
        estimated_minutes: null,
        item_type: subTaskId ? 'subtask' : 'task',
        due_date: null,
      })
    }

    if (rows.length > 0) {
      await prisma.dailyPlanItem.createMany({ data: rows })
      totalMigrated += rows.length
      console.log(`Migrated ${rows.length} overflow items for plan ${plan.id}`)
    }
  }

  console.log(`\nMigration complete! Total: ${totalMigrated} items migrated.`)
  await prisma.$disconnect()
}

migrateOverflowItems().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
