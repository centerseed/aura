/**
 * plan-sync 真實函式整合測試
 * 用本地 DB 跑完整的 syncPlanOnTaskChange 流程
 */
import { PrismaClient } from '@prisma/client'
import { toDateOnly } from '../src/lib/timezone-utils'

const localUrl = 'postgresql://naruvia:naruvia_password@localhost:5432/naruvia_db'
process.env.DATABASE_URL = localUrl

async function main() {
  const { syncPlanOnTaskChange } = await import('../src/application/services/plan-sync')
  const prisma = new PrismaClient({ datasources: { db: { url: localUrl } } })

  const userId = '00000000-0000-0000-0000-000000000001'
  const areaId = '00000000-0000-0000-0000-000000000002'
  const productId = '00000000-0000-0000-0000-000000000003'
  const taskId = '00000000-0000-0000-0000-000000000004'
  const planId = '00000000-0000-0000-0000-000000000005'

  // 清理
  const ids = [planId, taskId, productId, areaId, userId]
  await prisma.$executeRawUnsafe(`DELETE FROM daily_plan_items WHERE plan_id='${planId}'`).catch(() => {})
  await prisma.$executeRawUnsafe(`DELETE FROM daily_plans WHERE id='${planId}'`).catch(() => {})
  await prisma.$executeRawUnsafe(`DELETE FROM tasks WHERE id='${taskId}'`).catch(() => {})
  await prisma.$executeRawUnsafe(`DELETE FROM products WHERE id='${productId}'`).catch(() => {})
  await prisma.$executeRawUnsafe(`DELETE FROM areas WHERE id='${areaId}'`).catch(() => {})
  await prisma.$executeRawUnsafe(`DELETE FROM users WHERE id='${userId}'`).catch(() => {})

  // 建立測試資料
  await prisma.$executeRawUnsafe(`INSERT INTO users (id,email,name,auth_provider,updated_at) VALUES ('${userId}','t@t.com','T','EMAIL',NOW())`)
  await prisma.$executeRawUnsafe(`INSERT INTO areas (id,user_id,name,is_custom,updated_at) VALUES ('${areaId}','${userId}','TestArea',true,NOW())`)
  await prisma.$executeRawUnsafe(`INSERT INTO products (id,user_id,area_id,name,status,lifecycle,display_order,updated_at) VALUES ('${productId}','${userId}','${areaId}','TestProd','ACTIVE','FINITE',0,NOW())`)
  await prisma.$executeRawUnsafe(`INSERT INTO tasks (id,user_id,product_id,content,status,due_date,updated_at) VALUES ('${taskId}','${userId}','${productId}','真實函式測試','ACTIVE','2026-02-16',NOW())`)

  const planDate = toDateOnly(new Date(), 'Asia/Taipei')
  await prisma.$executeRawUnsafe(`INSERT INTO daily_plans (id,user_id,plan_date,coach_message,available_minutes,meeting_minutes,planned_minutes,updated_at) VALUES ('${planId}','${userId}','${planDate.toISOString()}','ok',480,60,300,NOW())`)

  console.log('Setup OK. planDate:', planDate.toISOString())

  // === 呼叫真實函式 ===
  console.log('\n=== syncPlanOnTaskChange ===')
  try {
    await syncPlanOnTaskChange({
      userId,
      taskId,
      dueDate: '2026-02-16T08:00:00.000Z',
      timezone: 'Asia/Taipei',
    })
    console.log('函式執行完成（無拋錯）')
  } catch (e: any) {
    console.error('❌ 拋錯:', e.message)
    process.exit(1)
  }

  // 驗證
  const plan = await prisma.dailyPlan.findUnique({ where: { id: planId }, include: { items: true } })
  if (!plan) { console.error('❌ plan not found'); process.exit(1) }

  const overflow = plan.items.filter(i => i.status === 'overflow')
  console.log('Plan items:', plan.items.length, '| overflow:', overflow.length)

  if (overflow.length === 1 && overflow[0].content === '真實函式測試') {
    console.log('\n✅✅✅ syncPlanOnTaskChange 整合測試通過 ✅✅✅')
  } else {
    console.error('❌ 驗證失敗！items:', plan.items)
    process.exit(1)
  }

  // 清理
  await prisma.$executeRawUnsafe(`DELETE FROM daily_plan_items WHERE plan_id='${planId}'`)
  await prisma.$executeRawUnsafe(`DELETE FROM daily_plans WHERE id='${planId}'`)
  await prisma.$executeRawUnsafe(`DELETE FROM tasks WHERE id='${taskId}'`)
  await prisma.$executeRawUnsafe(`DELETE FROM products WHERE id='${productId}'`)
  await prisma.$executeRawUnsafe(`DELETE FROM areas WHERE id='${areaId}'`)
  await prisma.$executeRawUnsafe(`DELETE FROM users WHERE id='${userId}'`)
  await prisma.$disconnect()
}

main().catch(e => { console.error('❌:', e); process.exit(1) })
