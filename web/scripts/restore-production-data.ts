import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const USER_ID = '467c7125-d890-429f-b46f-168429b1907e'

async function main() {
  console.log('開始重建生產資料...')

  try {
    // 查詢現有的 Areas
    const areas = await prisma.area.findMany({
      where: { user_id: USER_ID },
      select: { id: true, name: true }
    })

    const areaMap: Record<string, string> = {}
    areas.forEach(area => {
      areaMap[area.name] = area.id
    })

    console.log('找到的 Areas:', areaMap)

    // ==================== Milestones ====================
    console.log('\n創建 Milestones...')

    const milestones = [
      {
        name: '[Paceriz] v11.6',
        target_date: new Date('2026-01-26T00:00:00Z'),
        status: 'planned',
        entity_type: 'PRODUCT',
        entity_id: '', // 需要找到對應的 product_id
        priority: 5,
      },
      {
        name: '[Zentropy] POC上線',
        target_date: new Date('2026-01-28T00:00:00Z'),
        status: 'planned',
        entity_type: 'PRODUCT',
        entity_id: '',
        priority: 5,
      },
      {
        name: '[日本代購] 提案代購',
        target_date: new Date('2026-01-29T00:00:00Z'),
        status: 'planned',
        entity_type: 'PRODUCT',
        entity_id: '',
        priority: 5,
      },
      {
        name: '[搬家去日本] 搬去日本',
        target_date: new Date('2026-01-30T00:00:00Z'),
        status: 'planned',
        entity_type: 'PRODUCT',
        entity_id: '',
        priority: 5,
      },
      {
        name: '[Miyume] 實作付費',
        target_date: new Date('2026-01-31T00:00:00Z'),
        status: 'planned',
        entity_type: 'PRODUCT',
        entity_id: '',
        priority: 5,
      },
    ]

    // 首先創建或查找所有需要的 Products
    console.log('\n創建/查找 Products...')

    const products = [
      { name: 'Zentropy', area: '事業', status: 'ACTIVE' as const, lifecycle: 'FINITE' as const },
      { name: 'Paceriz', area: '事業', status: 'ACTIVE' as const, lifecycle: 'FINITE' as const },
      { name: 'Fintasy', area: '事業', status: 'ACTIVE' as const, lifecycle: 'FINITE' as const },
      { name: '個人事務', area: '個人', status: 'ACTIVE' as const, lifecycle: 'PERPETUAL' as const },
      { name: '搬家去日本', area: '個人', status: 'ACTIVE' as const, lifecycle: 'FINITE' as const },
      { name: '日本代購', area: '事業', status: 'ACTIVE' as const, lifecycle: 'FINITE' as const },
      { name: 'Miyume', area: '事業', status: 'ACTIVE' as const, lifecycle: 'FINITE' as const },
    ]

    const productMap: Record<string, string> = {}

    for (const prod of products) {
      const areaId = areaMap[prod.area]
      if (!areaId) {
        console.log(`❌ 找不到 Area: ${prod.area}`)
        continue
      }

      // 查找是否已存在
      let product = await prisma.product.findFirst({
        where: {
          user_id: USER_ID,
          name: prod.name,
          deleted_at: null,
        }
      })

      if (!product) {
        product = await prisma.product.create({
          data: {
            user_id: USER_ID,
            area_id: areaId,
            name: prod.name,
            status: prod.status,
            lifecycle: prod.lifecycle,
          }
        })
        console.log(`✅ 創建 Product: ${prod.name}`)
      } else {
        console.log(`✓ Product 已存在: ${prod.name}`)
      }

      productMap[prod.name] = product.id
    }

    // 創建 Topics
    console.log('\n創建 Topics...')

    const topics = [
      { name: 'Aura 功能開發', product: 'Zentropy' },
      { name: 'Paceriz v11.7 問題修復', product: 'Paceriz' },
      { name: 'Paceriz v11.7 功能需求規劃', product: 'Paceriz' },
      { name: 'Paceriz 主畫面載入問題修復', product: 'Paceriz' },
      { name: 'Paceriz 方法論測試', product: 'Paceriz' },
      { name: 'Paceriz 課表 V2 開發與問題修復', product: 'Paceriz' },
      { name: '未分類', product: 'Fintasy' },
      { name: '個人服務預約', product: '個人事務' },
      { name: '個人行政事務', product: '個人事務' },
      { name: '日本生活行政準備', product: '搬家去日本' },
      { name: '日本現金與物品準備', product: '搬家去日本' },
    ]

    const topicMap: Record<string, string> = {}

    for (const top of topics) {
      const productId = productMap[top.product]
      if (!productId) {
        console.log(`❌ 找不到 Product: ${top.product}`)
        continue
      }

      let topic = await prisma.topic.findFirst({
        where: {
          user_id: USER_ID,
          product_id: productId,
          name: top.name,
          deleted_at: null,
        }
      })

      if (!topic) {
        topic = await prisma.topic.create({
          data: {
            user_id: USER_ID,
            product_id: productId,
            name: top.name,
          }
        })
        console.log(`✅ 創建 Topic: ${top.name} (${top.product})`)
      } else {
        console.log(`✓ Topic 已存在: ${top.name}`)
      }

      topicMap[`${top.product}::${top.name}`] = topic.id
    }

    // 創建 Milestones (現在我們有了 product IDs)
    const milestoneData = [
      { name: '[Paceriz] v11.6', product: 'Paceriz', target_date: new Date('2026-01-26T00:00:00Z') },
      { name: '[Zentropy] POC上線', product: 'Zentropy', target_date: new Date('2026-01-28T00:00:00Z') },
      { name: '[日本代購] 提案代購', product: '日本代購', target_date: new Date('2026-01-29T00:00:00Z') },
      { name: '[搬家去日本] 搬去日本', product: '搬家去日本', target_date: new Date('2026-01-30T00:00:00Z') },
      { name: '[Miyume] 實作付費', product: 'Miyume', target_date: new Date('2026-01-31T00:00:00Z') },
    ]

    for (const ms of milestoneData) {
      const productId = productMap[ms.product]
      if (!productId) {
        console.log(`❌ 找不到 Product: ${ms.product}`)
        continue
      }

      const existing = await prisma.milestone.findFirst({
        where: {
          user_id: USER_ID,
          name: ms.name,
          deleted_at: null,
        }
      })

      if (!existing) {
        await prisma.milestone.create({
          data: {
            user_id: USER_ID,
            name: ms.name,
            target_date: ms.target_date,
            status: 'planned',
            entity_type: 'PRODUCT',
            entity_id: productId,
            priority: 5,
          }
        })
        console.log(`✅ 創建 Milestone: ${ms.name}`)
      } else {
        console.log(`✓ Milestone 已存在: ${ms.name}`)
      }
    }

    // ==================== Tasks ====================
    console.log('\n創建 Tasks...')

    const tasks = [
      // Zentropy
      {
        content: '規劃後端單元測試',
        product: 'Zentropy',
        topic: 'Aura 功能開發',
        status: 'ACTIVE' as const,
        due_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3天後
        sub_items: [],
        references: [],
      },
      {
        content: 'Zentropy App 開發',
        product: 'Zentropy',
        topic: 'Aura 功能開發',
        status: 'ACTIVE' as const,
        due_date: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000), // 4天後
        sub_items: [
          { id: crypto.randomUUID(), content: '文字輸入功能', completed: false, created_at: new Date().toISOString(), completed_at: null, order: 0 },
          { id: crypto.randomUUID(), content: '語音輸入功能', completed: false, created_at: new Date().toISOString(), completed_at: null, order: 1 },
          { id: crypto.randomUUID(), content: '不同的 UI 呈現', completed: false, created_at: new Date().toISOString(), completed_at: null, order: 2 },
        ],
        references: [],
      },
      {
        content: 'MVP上線功能',
        product: 'Zentropy',
        topic: 'Aura 功能開發',
        status: 'ACTIVE' as const,
        due_date: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000), // 3週後
        sub_items: [
          { id: crypto.randomUUID(), content: 'Aura 核心功能開發 (Google Calendar 同步)', completed: false, created_at: new Date().toISOString(), completed_at: null, order: 0 },
          { id: crypto.randomUUID(), content: 'Aura 圖片內容辨識與建檔', completed: false, created_at: new Date().toISOString(), completed_at: null, order: 1 },
          { id: crypto.randomUUID(), content: 'Aura 為每個 project 建立參考資料', completed: false, created_at: new Date().toISOString(), completed_at: null, order: 2 },
          { id: crypto.randomUUID(), content: 'Aura 支援 mcp server', completed: false, created_at: new Date().toISOString(), completed_at: null, order: 3 },
        ],
        references: [],
      },

      // Paceriz
      {
        content: 'Paceriz v11.7',
        product: 'Paceriz',
        topic: 'Paceriz v11.7 問題修復',
        status: 'ACTIVE' as const,
        due_date: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000), // 6天後
        sub_items: [
          { id: crypto.randomUUID(), content: 'Paceriz v11.7 問題修復', completed: false, created_at: new Date().toISOString(), completed_at: null, order: 0 },
          { id: crypto.randomUUID(), content: 'Paceriz v11.7 功能需求規劃', completed: false, created_at: new Date().toISOString(), completed_at: null, order: 1 },
          { id: crypto.randomUUID(), content: 'Paceriz 主畫面載入問題修復', completed: true, created_at: new Date().toISOString(), completed_at: new Date().toISOString(), order: 2 },
        ],
        references: [],
      },
      {
        content: 'Paceriz 方法論測試',
        product: 'Paceriz',
        topic: 'Paceriz 方法論測試',
        status: 'ACTIVE' as const,
        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 1個月後
        sub_items: [
          { id: crypto.randomUUID(), content: 'Paceriz 方法論測試', completed: false, created_at: new Date().toISOString(), completed_at: null, order: 0 },
        ],
        references: [],
      },
      {
        content: 'Paceriz 非跑步訓練UI顯示',
        product: 'Paceriz',
        topic: 'Paceriz 課表 V2 開發與問題修復',
        status: 'ACTIVE' as const,
        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 1個月後
        sub_items: [
          { id: crypto.randomUUID(), content: 'Paceriz 課表 V2 開發與問題修復', completed: false, created_at: new Date().toISOString(), completed_at: null, order: 0 },
        ],
        references: [],
      },
      {
        content: 'Paceriz v2 課表 UI 修正',
        product: 'Paceriz',
        topic: 'Paceriz 課表 V2 開發與問題修復',
        status: 'ACTIVE' as const,
        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 1個月後
        sub_items: [
          { id: crypto.randomUUID(), content: 'Paceriz 課表 V2 開發與問題修復', completed: false, created_at: new Date().toISOString(), completed_at: null, order: 0 },
        ],
        references: [],
      },
      {
        content: 'Paceriz v2週課表還轉測試',
        product: 'Paceriz',
        topic: 'Paceriz 課表 V2 開發與問題修復',
        status: 'ACTIVE' as const,
        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        sub_items: [
          { id: crypto.randomUUID(), content: 'Paceriz 課表 V2 開發與問題修復', completed: false, created_at: new Date().toISOString(), completed_at: null, order: 0 },
        ],
        references: [],
      },

      // Fintasy
      {
        content: 'Fintasy MVP事項',
        product: 'Fintasy',
        topic: '未分類',
        status: 'ACTIVE' as const,
        due_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2天後
        sub_items: [
          { id: crypto.randomUUID(), content: 'App測試', completed: false, created_at: new Date().toISOString(), completed_at: null, order: 0 },
          { id: crypto.randomUUID(), content: '金流串接', completed: false, created_at: new Date().toISOString(), completed_at: null, order: 1 },
          { id: crypto.randomUUID(), content: '重新啟用帳戶介紹', completed: false, created_at: new Date().toISOString(), completed_at: null, order: 2 },
        ],
        references: [],
      },
      {
        content: 'Fintasy確認preview API上線',
        product: 'Fintasy',
        topic: '未分類',
        status: 'ACTIVE' as const,
        due_date: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000), // 4天後
        sub_items: [],
        references: [],
      },

      // 個人事務
      {
        content: '剪頭髮',
        product: '個人事務',
        topic: '個人服務預約',
        status: 'ACTIVE' as const,
        due_date: new Date(), // 今天
        sub_items: [],
        references: [],
      },
      {
        content: '處理個人行政與帳務事宜',
        product: '個人事務',
        topic: '個人行政事務',
        status: 'ACTIVE' as const,
        due_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2天後
        sub_items: [
          { id: crypto.randomUUID(), content: '退 Mod', completed: false, created_at: new Date().toISOString(), completed_at: null, order: 0 },
          { id: crypto.randomUUID(), content: '對發票', completed: false, created_at: new Date().toISOString(), completed_at: null, order: 1 },
        ],
        references: [],
      },

      // 搬家去日本
      {
        content: '填寫 Visit Japan Web',
        product: '搬家去日本',
        topic: '日本生活行政準備',
        status: 'ACTIVE' as const,
        due_date: new Date(), // 今天
        sub_items: [],
        references: [],
      },
      {
        content: '確認樂天上網方案',
        product: '搬家去日本',
        topic: '日本生活行政準備',
        status: 'REFERENCE' as const,
        due_date: new Date(), // 今天
        sub_items: [],
        references: [
          { id: crypto.randomUUID(), type: 'url', content: '網址', title: '樂天上網', created_at: new Date().toISOString() }
        ],
      },
      {
        content: '購買日本 eSIM',
        product: '搬家去日本',
        topic: '日本生活行政準備',
        status: 'ACTIVE' as const,
        due_date: new Date(), // 今天
        sub_items: [],
        references: [],
      },
      {
        content: '訂購日本Amazon家電傢俱',
        product: '搬家去日本',
        topic: '日本現金與物品準備',
        status: 'ACTIVE' as const,
        due_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2天後
        sub_items: [],
        references: [
          { id: crypto.randomUUID(), type: 'url', content: 'https://www.amazon.co.jp/-/zh/gp/cart/view.html?ref_=nav_cart', title: 'Amazon 購物車', created_at: new Date().toISOString() }
        ],
      },
    ]

    for (const task of tasks) {
      const productId = productMap[task.product]
      if (!productId) {
        console.log(`❌ 找不到 Product: ${task.product}`)
        continue
      }

      const topicKey = `${task.product}::${task.topic}`
      const topicId = topicMap[topicKey]
      if (!topicId) {
        console.log(`❌ 找不到 Topic: ${topicKey}`)
        continue
      }

      const existing = await prisma.task.findFirst({
        where: {
          user_id: USER_ID,
          content: task.content,
          product_id: productId,
          deleted_at: null,
        }
      })

      if (!existing) {
        await prisma.task.create({
          data: {
            user_id: USER_ID,
            product_id: productId,
            topic_id: topicId,
            content: task.content,
            status: task.status,
            due_date: task.due_date,
            sub_items: task.sub_items,
            references: task.references,
          }
        })
        console.log(`✅ 創建 Task: ${task.content}`)
      } else {
        console.log(`✓ Task 已存在: ${task.content}`)
      }
    }

    console.log('\n✅ 資料重建完成！')

    // 統計
    const taskCount = await prisma.task.count({
      where: { user_id: USER_ID, deleted_at: null }
    })
    const milestoneCount = await prisma.milestone.count({
      where: { user_id: USER_ID, deleted_at: null }
    })

    console.log(`\n📊 統計：`)
    console.log(`- Tasks: ${taskCount}`)
    console.log(`- Milestones: ${milestoneCount}`)

  } catch (error) {
    console.error('❌ 重建失敗:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

main()
