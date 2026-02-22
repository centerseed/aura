/**
 * Demo account seed script for App Store screenshots
 * Firebase UID: jbgvbrYXb3aoo09xV0leteiCkow2
 *
 * Run: npx ts-node --project tsconfig.json scripts/seed-demo-account.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const DEMO_FIREBASE_UID = 'jbgvbrYXb3aoo09xV0leteiCkow2'

async function main() {
  // 1. 找到示範帳戶
  const user = await prisma.user.findFirst({
    where: { auth_provider_id: DEMO_FIREBASE_UID },
  })

  if (!user) {
    console.error(`❌ 找不到 Firebase UID: ${DEMO_FIREBASE_UID}`)
    process.exit(1)
  }

  const userId = user.id
  console.log(`✅ 找到示範帳戶：${user.name} (${userId})`)

  // 2. 清除現有示範資料（避免重複）
  await prisma.subTask.deleteMany({ where: { user_id: userId } })
  await prisma.task.deleteMany({ where: { user_id: userId } })
  await prisma.topic.deleteMany({ where: { user_id: userId } })
  await prisma.product.deleteMany({ where: { user_id: userId } })
  await prisma.area.deleteMany({ where: { user_id: userId } })
  console.log('🧹 清除現有資料完成')

  // 3. 建立 Areas
  const areaPersonal = await prisma.area.create({
    data: {
      user_id: userId,
      name: '個人成長',
      description: '學習、閱讀、技能提升',
      is_custom: false,
    },
  })

  const areaHealth = await prisma.area.create({
    data: {
      user_id: userId,
      name: '健康生活',
      description: '運動、飲食、睡眠管理',
      is_custom: false,
    },
  })

  const areaCareer = await prisma.area.create({
    data: {
      user_id: userId,
      name: '職涯發展',
      description: '工作技能、人脈、副業',
      is_custom: false,
    },
  })

  console.log('✅ Areas 建立完成')

  // 4. 建立 Products
  const prodEnglish = await prisma.product.create({
    data: {
      user_id: userId,
      area_id: areaPersonal.id,
      name: '英語學習計畫',
      description: '目標 IELTS 7.0，每日練習 30 分鐘',
      status: 'ACTIVE',
      lifecycle: 'FINITE',
      display_order: 0,
    },
  })

  const prodReading = await prisma.product.create({
    data: {
      user_id: userId,
      area_id: areaPersonal.id,
      name: '年度閱讀清單',
      description: '2024 年閱讀 24 本書',
      status: 'ACTIVE',
      lifecycle: 'PERPETUAL',
      display_order: 1,
    },
  })

  const prodFitness = await prisma.product.create({
    data: {
      user_id: userId,
      area_id: areaHealth.id,
      name: '健身習慣養成',
      description: '每週運動 4 次，目標完成半馬',
      status: 'ACTIVE',
      lifecycle: 'PERPETUAL',
      display_order: 0,
    },
  })

  const prodDiet = await prisma.product.create({
    data: {
      user_id: userId,
      area_id: areaHealth.id,
      name: '飲食管理',
      description: '減少精緻糖、增加蔬菜攝取',
      status: 'MAINTAIN',
      lifecycle: 'PERPETUAL',
      display_order: 1,
    },
  })

  const prodCareer = await prisma.product.create({
    data: {
      user_id: userId,
      area_id: areaCareer.id,
      name: '職涯規劃 2024',
      description: '轉職產品經理或創業準備',
      status: 'ACTIVE',
      lifecycle: 'FINITE',
      display_order: 0,
    },
  })

  const prodSideProject = await prisma.product.create({
    data: {
      user_id: userId,
      area_id: areaCareer.id,
      name: 'Side Project：健身 App',
      description: '打造個人運動追蹤應用',
      status: 'ACTIVE',
      lifecycle: 'FINITE',
      display_order: 1,
    },
  })

  console.log('✅ Products 建立完成')

  // 5. 建立 Tasks + SubItems（個人成長）
  const now = new Date()
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
  const nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

  // 英語學習任務
  const taskEnglish1 = await prisma.task.create({
    data: {
      user_id: userId,
      product_id: prodEnglish.id,
      content: '完成 IELTS 模擬考試並分析錯題',
      status: 'ACTIVE',
      due_date: nextWeek,
      sub_items: [
        { id: '1', content: '下載 Cambridge IELTS 15 練習題', completed: true },
        { id: '2', content: '完成 Listening + Reading 模擬', completed: false },
        { id: '3', content: '整理錯題筆記並找規律', completed: false },
        { id: '4', content: '針對弱項安排加強練習', completed: false },
      ],
    },
  })

  await prisma.subTask.createMany({
    data: [
      { task_id: taskEnglish1.id, user_id: userId, content: '下載 Cambridge IELTS 15 練習題', completed: true, completed_at: new Date(), order: 0 },
      { task_id: taskEnglish1.id, user_id: userId, content: '完成 Listening + Reading 模擬', completed: false, order: 1 },
      { task_id: taskEnglish1.id, user_id: userId, content: '整理錯題筆記並找規律', completed: false, order: 2 },
      { task_id: taskEnglish1.id, user_id: userId, content: '針對弱項安排加強練習', completed: false, order: 3 },
    ],
  })

  const taskEnglish2 = await prisma.task.create({
    data: {
      user_id: userId,
      product_id: prodEnglish.id,
      content: '每日英文口說練習 15 分鐘（連續 30 天）',
      status: 'MAINTAIN',
      sub_items: [
        { id: '1', content: '報名 iTalki 外師課程（每週 2 堂）', completed: true },
        { id: '2', content: '使用 Anki 複習每日單字', completed: false },
        { id: '3', content: '錄音回聽改善發音', completed: false },
      ],
    },
  })

  await prisma.subTask.createMany({
    data: [
      { task_id: taskEnglish2.id, user_id: userId, content: '報名 iTalki 外師課程（每週 2 堂）', completed: true, completed_at: new Date(), order: 0 },
      { task_id: taskEnglish2.id, user_id: userId, content: '使用 Anki 複習每日單字', completed: false, order: 1 },
      { task_id: taskEnglish2.id, user_id: userId, content: '錄音回聽改善發音', completed: false, order: 2 },
    ],
  })

  // 閱讀任務
  const taskReading1 = await prisma.task.create({
    data: {
      user_id: userId,
      product_id: prodReading.id,
      content: '閱讀《原子習慣》並寫讀後感',
      status: 'ACTIVE',
      due_date: nextWeek,
      sub_items: [
        { id: '1', content: '閱讀第 1-5 章：習慣的基礎', completed: true },
        { id: '2', content: '閱讀第 6-10 章：四個定律', completed: true },
        { id: '3', content: '閱讀第 11-15 章：進階技巧', completed: false },
        { id: '4', content: '整理 3 個可立即實踐的重點', completed: false },
        { id: '5', content: '在 Notion 撰寫讀後感', completed: false },
      ],
    },
  })

  await prisma.subTask.createMany({
    data: [
      { task_id: taskReading1.id, user_id: userId, content: '閱讀第 1-5 章：習慣的基礎', completed: true, completed_at: new Date(), order: 0 },
      { task_id: taskReading1.id, user_id: userId, content: '閱讀第 6-10 章：四個定律', completed: true, completed_at: new Date(), order: 1 },
      { task_id: taskReading1.id, user_id: userId, content: '閱讀第 11-15 章：進階技巧', completed: false, order: 2 },
      { task_id: taskReading1.id, user_id: userId, content: '整理 3 個可立即實踐的重點', completed: false, order: 3 },
      { task_id: taskReading1.id, user_id: userId, content: '在 Notion 撰寫讀後感', completed: false, order: 4 },
    ],
  })

  const taskReading2 = await prisma.task.create({
    data: {
      user_id: userId,
      product_id: prodReading.id,
      content: '建立每月選書清單（下半年）',
      status: 'INBOX',
      sub_items: [
        { id: '1', content: '整理 Goodreads 待讀書單', completed: false },
        { id: '2', content: '依主題分類：商業、心理、技術', completed: false },
        { id: '3', content: '每月第一週決定當月主書', completed: false },
      ],
    },
  })

  await prisma.subTask.createMany({
    data: [
      { task_id: taskReading2.id, user_id: userId, content: '整理 Goodreads 待讀書單', completed: false, order: 0 },
      { task_id: taskReading2.id, user_id: userId, content: '依主題分類：商業、心理、技術', completed: false, order: 1 },
      { task_id: taskReading2.id, user_id: userId, content: '每月第一週決定當月主書', completed: false, order: 2 },
    ],
  })

  // 健身任務
  const taskFitness1 = await prisma.task.create({
    data: {
      user_id: userId,
      product_id: prodFitness.id,
      content: '報名 2024 台北半程馬拉松',
      status: 'ACTIVE',
      due_date: nextMonth,
      sub_items: [
        { id: '1', content: '確認比賽日期（11 月場次）', completed: true },
        { id: '2', content: '完成線上報名並繳費', completed: false },
        { id: '3', content: '制定 12 週訓練計畫', completed: false },
        { id: '4', content: '購買跑步裝備（鞋子、手錶）', completed: false },
      ],
    },
  })

  await prisma.subTask.createMany({
    data: [
      { task_id: taskFitness1.id, user_id: userId, content: '確認比賽日期（11 月場次）', completed: true, completed_at: new Date(), order: 0 },
      { task_id: taskFitness1.id, user_id: userId, content: '完成線上報名並繳費', completed: false, order: 1 },
      { task_id: taskFitness1.id, user_id: userId, content: '制定 12 週訓練計畫', completed: false, order: 2 },
      { task_id: taskFitness1.id, user_id: userId, content: '購買跑步裝備（鞋子、手錶）', completed: false, order: 3 },
    ],
  })

  const taskFitness2 = await prisma.task.create({
    data: {
      user_id: userId,
      product_id: prodFitness.id,
      content: '本週重訓課表執行（胸 + 背 + 腿）',
      status: 'ACTIVE',
      due_date: nextWeek,
      sub_items: [
        { id: '1', content: '週一：胸部訓練（臥推 4x8）', completed: true },
        { id: '2', content: '週三：背部訓練（引體向上 4x6）', completed: false },
        { id: '3', content: '週五：腿部訓練（深蹲 4x10）', completed: false },
        { id: '4', content: '週日：恢復跑步 5km', completed: false },
      ],
    },
  })

  await prisma.subTask.createMany({
    data: [
      { task_id: taskFitness2.id, user_id: userId, content: '週一：胸部訓練（臥推 4x8）', completed: true, completed_at: new Date(), order: 0 },
      { task_id: taskFitness2.id, user_id: userId, content: '週三：背部訓練（引體向上 4x6）', completed: false, order: 1 },
      { task_id: taskFitness2.id, user_id: userId, content: '週五：腿部訓練（深蹲 4x10）', completed: false, order: 2 },
      { task_id: taskFitness2.id, user_id: userId, content: '週日：恢復跑步 5km', completed: false, order: 3 },
    ],
  })

  // 飲食任務
  const taskDiet1 = await prisma.task.create({
    data: {
      user_id: userId,
      product_id: prodDiet.id,
      content: '計算每日蛋白質攝取量並調整飲食',
      status: 'MAINTAIN',
      sub_items: [
        { id: '1', content: '安裝 MyFitnessPal 記錄飲食', completed: true },
        { id: '2', content: '計算體重 × 1.6g 的蛋白質目標', completed: true },
        { id: '3', content: '每餐加入高蛋白食材（蛋、雞胸、豆腐）', completed: false },
        { id: '4', content: '每週回顧達標天數', completed: false },
      ],
    },
  })

  await prisma.subTask.createMany({
    data: [
      { task_id: taskDiet1.id, user_id: userId, content: '安裝 MyFitnessPal 記錄飲食', completed: true, completed_at: new Date(), order: 0 },
      { task_id: taskDiet1.id, user_id: userId, content: '計算體重 × 1.6g 的蛋白質目標', completed: true, completed_at: new Date(), order: 1 },
      { task_id: taskDiet1.id, user_id: userId, content: '每餐加入高蛋白食材（蛋、雞胸、豆腐）', completed: false, order: 2 },
      { task_id: taskDiet1.id, user_id: userId, content: '每週回顧達標天數', completed: false, order: 3 },
    ],
  })

  // 職涯任務
  const taskCareer1 = await prisma.task.create({
    data: {
      user_id: userId,
      product_id: prodCareer.id,
      content: '完成 PM 職位申請（3 家目標公司）',
      status: 'ACTIVE',
      due_date: nextMonth,
      sub_items: [
        { id: '1', content: '更新履歷加入量化成果', completed: true },
        { id: '2', content: '準備 Product Case Study 作品集', completed: false },
        { id: '3', content: '投遞 Appier、91APP、Gogoro', completed: false },
        { id: '4', content: '模擬行為面試（STAR 方法）', completed: false },
        { id: '5', content: '研究各公司產品策略差異', completed: false },
      ],
    },
  })

  await prisma.subTask.createMany({
    data: [
      { task_id: taskCareer1.id, user_id: userId, content: '更新履歷加入量化成果', completed: true, completed_at: new Date(), order: 0 },
      { task_id: taskCareer1.id, user_id: userId, content: '準備 Product Case Study 作品集', completed: false, order: 1 },
      { task_id: taskCareer1.id, user_id: userId, content: '投遞 Appier、91APP、Gogoro', completed: false, order: 2 },
      { task_id: taskCareer1.id, user_id: userId, content: '模擬行為面試（STAR 方法）', completed: false, order: 3 },
      { task_id: taskCareer1.id, user_id: userId, content: '研究各公司產品策略差異', completed: false, order: 4 },
    ],
  })

  const taskCareer2 = await prisma.task.create({
    data: {
      user_id: userId,
      product_id: prodCareer.id,
      content: '參加 ProductTank Taipei 活動並拓展人脈',
      status: 'INBOX',
      sub_items: [
        { id: '1', content: '報名下次月會', completed: false },
        { id: '2', content: '準備 30 秒個人介紹', completed: false },
        { id: '3', content: '活動後 48 小時內 LinkedIn 連結', completed: false },
      ],
    },
  })

  await prisma.subTask.createMany({
    data: [
      { task_id: taskCareer2.id, user_id: userId, content: '報名下次月會', completed: false, order: 0 },
      { task_id: taskCareer2.id, user_id: userId, content: '準備 30 秒個人介紹', completed: false, order: 1 },
      { task_id: taskCareer2.id, user_id: userId, content: '活動後 48 小時內 LinkedIn 連結', completed: false, order: 2 },
    ],
  })

  // Side Project 任務
  const taskSide1 = await prisma.task.create({
    data: {
      user_id: userId,
      product_id: prodSideProject.id,
      content: '完成健身 App MVP 設計稿',
      status: 'ACTIVE',
      due_date: nextMonth,
      sub_items: [
        { id: '1', content: '定義核心功能：訓練記錄、進度追蹤', completed: true },
        { id: '2', content: '繪製 User Flow 流程圖', completed: true },
        { id: '3', content: '在 Figma 完成 Wireframe', completed: false },
        { id: '4', content: '設計視覺風格指南（色系、字體）', completed: false },
        { id: '5', content: '製作可點擊 Prototype 給朋友測試', completed: false },
      ],
    },
  })

  await prisma.subTask.createMany({
    data: [
      { task_id: taskSide1.id, user_id: userId, content: '定義核心功能：訓練記錄、進度追蹤', completed: true, completed_at: new Date(), order: 0 },
      { task_id: taskSide1.id, user_id: userId, content: '繪製 User Flow 流程圖', completed: true, completed_at: new Date(), order: 1 },
      { task_id: taskSide1.id, user_id: userId, content: '在 Figma 完成 Wireframe', completed: false, order: 2 },
      { task_id: taskSide1.id, user_id: userId, content: '設計視覺風格指南（色系、字體）', completed: false, order: 3 },
      { task_id: taskSide1.id, user_id: userId, content: '製作可點擊 Prototype 給朋友測試', completed: false, order: 4 },
    ],
  })

  const taskSide2 = await prisma.task.create({
    data: {
      user_id: userId,
      product_id: prodSideProject.id,
      content: '訪談 5 位潛在用戶了解健身痛點',
      status: 'INBOX',
      sub_items: [
        { id: '1', content: '撰寫用戶訪談問題清單', completed: false },
        { id: '2', content: '找到 5 位不同健身習慣的受訪者', completed: false },
        { id: '3', content: '完成訪談並整理洞察報告', completed: false },
      ],
    },
  })

  await prisma.subTask.createMany({
    data: [
      { task_id: taskSide2.id, user_id: userId, content: '撰寫用戶訪談問題清單', completed: false, order: 0 },
      { task_id: taskSide2.id, user_id: userId, content: '找到 5 位不同健身習慣的受訪者', completed: false, order: 1 },
      { task_id: taskSide2.id, user_id: userId, content: '完成訪談並整理洞察報告', completed: false, order: 2 },
    ],
  })

  console.log('✅ Tasks + SubTasks 建立完成')
  console.log('\n📊 建立摘要:')
  console.log('  Areas: 3（個人成長、健康生活、職涯發展）')
  console.log('  Products: 6')
  console.log('  Tasks: 10')
  console.log('  SubTasks: 38')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
