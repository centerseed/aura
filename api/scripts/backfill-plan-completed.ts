/**
 * 一次性修補腳本：將「今日已完成但不在 plan 裡」的任務補入 daily_plan_items
 *
 * 背景：統一完成度計算後，所有完成數字以 daily_plan 為唯一來源。
 * 但歷史上在 plan 外完成的任務沒有對應的 plan item，需要補建。
 *
 * 執行方式：cd api && npx tsx scripts/backfill-plan-completed.ts
 *
 * 安全性：只做 INSERT，不做 UPDATE/DELETE，冪等（重複執行不會重複插入）
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function backfillPlanCompleted() {
  const today = new Date()
  const todayStr = today.toISOString().slice(0, 10)

  // 1. 找到所有今日的 daily_plan
  const todayPlans = await prisma.dailyPlan.findMany({
    where: { plan_date: new Date(todayStr + 'T00:00:00.000Z') },
    include: {
      items: {
        select: { task_id: true, sub_task_id: true },
      },
    },
  })

  if (todayPlans.length === 0) {
    console.log('❌ 今日沒有任何 daily_plan，無需修補')
    return
  }

  console.log(`📋 找到 ${todayPlans.length} 個今日 plan`)

  let totalCreated = 0

  for (const plan of todayPlans) {
    // 已在 plan 裡的 task_id set（用於快速查找）
    const existingTaskIds = new Set(
      plan.items
        .filter((i) => i.sub_task_id === null)
        .map((i) => i.task_id)
    )
    const existingSubTaskIds = new Set(
      plan.items
        .filter((i) => i.sub_task_id !== null)
        .map((i) => i.sub_task_id)
    )

    // 2. 找到此用戶今日完成的所有 tasks（status=ARCHIVE 且 completed_at 或 updated_at 在今天）
    const todayStart = new Date(todayStr + 'T00:00:00.000Z')
    const todayEnd = new Date(todayStr + 'T23:59:59.999Z')

    // 從 plan 找 user_id
    const planRecord = await prisma.dailyPlan.findUnique({
      where: { id: plan.id },
      select: { user_id: true },
    })
    if (!planRecord) continue

    const completedTasks = await prisma.task.findMany({
      where: {
        user_id: planRecord.user_id,
        status: 'ARCHIVE',
        deleted_at: null,
        OR: [
          { completed_at: { gte: todayStart, lte: todayEnd } },
          {
            completed_at: null,
            updated_at: { gte: todayStart, lte: todayEnd },
          },
        ],
      },
      include: {
        product: {
          select: { name: true, area: { select: { name: true } } },
        },
        sub_tasks: {
          where: {
            deleted_at: null,
            completed: true,
            completed_at: { gte: todayStart, lte: todayEnd },
          },
          select: { id: true, content: true, completed_at: true },
        },
      },
    })

    console.log(`\n👤 User ${planRecord.user_id} — Plan ${plan.id}`)
    console.log(`   今日完成任務數: ${completedTasks.length}`)

    let planCreated = 0

    for (const task of completedTasks) {
      // 補建 task 層級的 plan item
      if (!existingTaskIds.has(task.id)) {
        await prisma.dailyPlanItem.create({
          data: {
            plan_id: plan.id,
            task_id: task.id,
            sub_task_id: null,
            item_type: 'task',
            content: task.content,
            area_name: task.product?.area?.name ?? '',
            product_name: task.product?.name ?? '',
            estimated_minutes: 30,
            status: 'today',
            completed: true,
            completed_at: task.completed_at ?? task.updated_at,
            order: 9999 + planCreated,
          },
        })
        planCreated++
        console.log(`   ✅ 補建 task: "${task.content.slice(0, 40)}..."`)
      }

      // 補建 sub_task 層級的 plan item
      for (const sub of task.sub_tasks) {
        if (!existingSubTaskIds.has(sub.id)) {
          await prisma.dailyPlanItem.create({
            data: {
              plan_id: plan.id,
              task_id: task.id,
              sub_task_id: sub.id,
              item_type: 'task',
              content: sub.content,
              area_name: task.product?.area?.name ?? '',
              product_name: task.product?.name ?? '',
              estimated_minutes: 30,
              status: 'today',
              completed: true,
              completed_at: sub.completed_at ?? task.updated_at,
              order: 9999 + planCreated,
            },
          })
          planCreated++
          console.log(`   ✅ 補建 sub-task: "${sub.content.slice(0, 40)}..."`)
        }
      }
    }

    console.log(`   📊 此 plan 補建 ${planCreated} 筆`)
    totalCreated += planCreated
  }

  console.log(`\n🎉 修補完成！共補建 ${totalCreated} 筆 daily_plan_items`)
}

backfillPlanCompleted()
  .catch((e) => {
    console.error('❌ 修補失敗:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
