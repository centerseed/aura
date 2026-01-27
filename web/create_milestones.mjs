import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function createMilestones() {
  const userId = '467c7125-d890-429f-b46f-168429b1907e'

  // 1. 先查詢所有 Product
  const products = await prisma.product.findMany({
    where: { user_id: userId, deleted_at: null },
    select: { id: true, name: true }
  })

  console.log('📦 找到的 Products:')
  products.forEach(p => console.log(`  - ${p.name} (${p.id})`))

  // 2. 找到對應的 Product ID
  const zentropy = products.find(p => p.name === 'Zentropy')
  const paceriz = products.find(p => p.name === 'Paceriz')
  const fintasy = products.find(p => p.name === 'Fintasy')

  if (!zentropy || !paceriz || !fintasy) {
    console.error('❌ 找不到必要的 Product')
    console.log('Zentropy:', zentropy)
    console.log('Paceriz:', paceriz)
    console.log('Fintasy:', fintasy)
    process.exit(1)
  }

  // 3. 計算日期（從今天 2026-01-27 開始）
  const today = new Date('2026-01-27T00:00:00.000Z')
  const milestones = [
    // Zentropy
    {
      user_id: userId,
      name: 'POC上線',
      target_date: new Date(today.getTime() + 1 * 24 * 60 * 60 * 1000), // 1天後 = 2026-01-28
      entity_type: 'PRODUCT',
      entity_id: zentropy.id,
      priority: 8,
      status: 'in_progress',
    },
    {
      user_id: userId,
      name: 'MVP版本',
      target_date: new Date(today.getTime() + 27 * 24 * 60 * 60 * 1000), // 27天後 = 2026-02-23
      entity_type: 'PRODUCT',
      entity_id: zentropy.id,
      priority: 7,
      status: 'planned',
    },
    // Paceriz
    {
      user_id: userId,
      name: 'v1.1.6',
      target_date: new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000), // 逾期1天 = 2026-01-26
      entity_type: 'PRODUCT',
      entity_id: paceriz.id,
      priority: 9,
      status: 'delayed',
    },
    {
      user_id: userId,
      name: 'v1.1.7',
      target_date: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000), // 7天後 = 2026-02-03
      entity_type: 'PRODUCT',
      entity_id: paceriz.id,
      priority: 8,
      status: 'in_progress',
    },
    {
      user_id: userId,
      name: '完成v2訓練流程',
      target_date: new Date(today.getTime() + 32 * 24 * 60 * 60 * 1000), // 32天後 = 2026-02-28
      entity_type: 'PRODUCT',
      entity_id: paceriz.id,
      priority: 6,
      status: 'planned',
    },
    // Fintasy
    {
      user_id: userId,
      name: 'MVP上線',
      target_date: new Date(today.getTime() + 32 * 24 * 60 * 60 * 1000), // 32天後 = 2026-02-28
      entity_type: 'PRODUCT',
      entity_id: fintasy.id,
      priority: 7,
      status: 'planned',
    },
  ]

  console.log('\n🎯 準備創建的 Milestones:')
  milestones.forEach(m => {
    const dateStr = m.target_date.toISOString().split('T')[0]
    console.log(`  - ${m.name.padEnd(20)} ${dateStr} [${m.status}]`)
  })

  // 4. 檢查現有的 milestones
  const existing = await prisma.milestone.findMany({
    where: { user_id: userId },
    select: { name: true, target_date: true }
  })
  console.log(`\n📊 現有 ${existing.count} 筆 milestones`)

  // 5. 批次創建新的 milestones（不刪除現有資料）
  console.log('\n✨ 創建新的 milestones...')
  const created = await prisma.milestone.createMany({
    data: milestones
  })
  console.log(`   已新增 ${created.count} 筆`)

  // 6. 驗證結果 - 顯示所有 milestones
  console.log('\n✅ 最終結果（包含新舊資料）:')
  const result = await prisma.milestone.findMany({
    where: { user_id: userId },
    orderBy: { target_date: 'asc' }
  })

  console.log(`   總共 ${result.length} 筆 milestones`)
  result.forEach(m => {
    const daysFromNow = Math.round((m.target_date.getTime() - today.getTime()) / (24 * 60 * 60 * 1000))
    const status = daysFromNow < 0 ? `逾期${Math.abs(daysFromNow)}天` : `${daysFromNow}天後`
    console.log(`  ✓ ${m.name.padEnd(20)} ${status.padEnd(10)} [${m.status}]`)
  })
}

createMilestones()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
