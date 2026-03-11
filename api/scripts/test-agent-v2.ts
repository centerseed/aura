import dotenv from "dotenv"
dotenv.config()

import { createZentropyAgent } from "@/application/use-cases/agent/zentropy-agent"
import { prisma } from "@/lib/db"

const userId = "d8493e56-db97-4cfa-b18d-8c843b8574f3"
const sessionAgents = new Map<string, ReturnType<typeof createZentropyAgent>>()
const failures: string[] = []

// ════════════════════════════════════════════════
// DB 工具
// ════════════════════════════════════════════════

async function cleanTestUser() {
  const r2 = await prisma.$executeRawUnsafe(`DELETE FROM daily_plan_items WHERE task_id IN (SELECT id FROM tasks WHERE user_id = '${userId}')`)
  const r1 = await prisma.$executeRawUnsafe(`DELETE FROM sub_tasks WHERE task_id IN (SELECT id FROM tasks WHERE user_id = '${userId}')`)
  const r3 = await prisma.$executeRawUnsafe(`DELETE FROM tasks WHERE user_id = '${userId}'`)
  const r4 = await prisma.$executeRawUnsafe(`DELETE FROM topics WHERE product_id IN (SELECT id FROM products WHERE user_id = '${userId}')`)
  const r5 = await prisma.$executeRawUnsafe(`DELETE FROM products WHERE user_id = '${userId}'`)
  console.log(`🧹 [CLEANUP] daily_plan_items=${r2} sub_tasks=${r1} tasks=${r3} products=${r5}`)
}

async function verifyTasksInDB(label: string, expectedTitles: string[]) {
  const tasks = await prisma.task.findMany({
    where: { user_id: userId, deleted_at: null },
    select: { content: true, status: true },
    orderBy: { created_at: "desc" },
    take: 30,
  })
  const found = tasks.map(t => t.content)
  console.log(`  🔍 [DB驗證 ${label}]`)
  for (const title of expectedTitles) {
    const match = found.find(f => f.includes(title) || title.includes(f))
    console.log(`    ${match ? "✅" : "❌"} "${title}" → ${match ? `找到「${match}」` : "DB 中找不到"}`)
  }
}

async function verifyTaskCompleted(label: string, expectedTitle: string) {
  const tasks = await prisma.task.findMany({
    where: { user_id: userId, deleted_at: null },
    select: { content: true, status: true },
    orderBy: { created_at: "desc" },
    take: 30,
  })
  const match = tasks.find(t => t.content.includes(expectedTitle) || expectedTitle.includes(t.content))
  if (!match) {
    console.log(`  🔍 [完成驗證 ${label}] ❌ 找不到任務「${expectedTitle}」`)
    return
  }
  const isArchived = match.status === "ARCHIVE"
  console.log(`  🔍 [完成驗證 ${label}] ${isArchived ? "✅" : "❌"} 「${match.content}」status=${match.status} ${isArchived ? "→ 已封存（完成）" : "→ 未變更為完成！"}`)
}

// ════════════════════════════════════════════════
// Agent 測試工具
// ════════════════════════════════════════════════

async function singleTurn(label: string, text: string, verifyTasks?: string[]) {
  const sessionId = "single-v3-" + Date.now()
  console.log(`\n[單輪] ${label}`)
  console.log(`  Input   : ${text}`)
  const agent = createZentropyAgent(userId)
  const result = await agent.chat(text, { userId, sessionId })
  const intent = result.intent as { object?: string; speechAct?: string; confidence?: number } | null
  console.log(`  Intent  : ${intent?.object ?? "null"} (${intent?.speechAct ?? "-"}) conf=${intent?.confidence?.toFixed(2) ?? "-"}`)
  console.log(`  Tools   : ${result.toolCalls.length ? result.toolCalls.join(", ") : "—"}`)
  console.log(`  Reply   : ${result.content?.slice(0, 250)}`)
  if (verifyTasks) await verifyTasksInDB(label, verifyTasks)
}

async function multiTurn(sessionId: string, label: string, text: string, verifyTasks?: string[]) {
  console.log(`\n  [輪] ${label}`)
  console.log(`    Input  : ${text}`)
  const agent = sessionAgents.get(sessionId) ?? createZentropyAgent(userId)
  sessionAgents.set(sessionId, agent)
  const result = await agent.chat(text, { userId, sessionId })
  const intent = result.intent as { object?: string; confidence?: number } | null
  console.log(`    Intent : ${intent?.object ?? "null"} conf=${intent?.confidence?.toFixed(2) ?? "-"}`)
  console.log(`    Tools  : ${result.toolCalls.length ? result.toolCalls.join(", ") : "—"}`)
  console.log(`    Reply  : ${result.content?.slice(0, 250)}`)
  if (verifyTasks) await verifyTasksInDB(label, verifyTasks)
}

async function runSection(label: string, fn: () => Promise<void>) {
  try {
    await fn()
  } catch (error) {
    const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
    failures.push(`${label}: ${message}`)
    console.error(`\n❌ [${label}] ${message}`)
  }
}

// ════════════════════════════════════════════════
// Main
// ════════════════════════════════════════════════

async function main() {

  console.log("\n🧹 測試開始前清理測試用戶資料...")
  await cleanTestUser()

  // 種入種子任務（名稱設計讓語意搜尋容易命中）
  console.log("🌱 種入種子任務...")
  const seedArea = await prisma.area.create({
    data: { user_id: userId, name: "一般", scope: "測試", is_custom: false },
  })
  const seedProduct = await prisma.product.create({
    data: { user_id: userId, area_id: seedArea.id, name: "日常事務", status: "ACTIVE", lifecycle: "FINITE" },
  })
  await prisma.task.createMany({
    data: [
      { user_id: userId, product_id: seedProduct.id, content: "買牛奶", status: "ACTIVE" },
      { user_id: userId, product_id: seedProduct.id, content: "寄信給客戶", status: "ACTIVE" },
      { user_id: userId, product_id: seedProduct.id, content: "整理書桌", status: "ACTIVE" },
    ],
  })
  console.log("🌱 種子任務完成（買牛奶、寄信給客戶、整理書桌）")

  // ════════════════════════════════════════════════
  // Section A：單輪路由驗證（第四套措辭）
  // ════════════════════════════════════════════════
  console.log("\n════════════ A. 單輪路由（第四套） ════════════")

  await singleTurn("A1: 問候",                       "嗨！你能做什麼事幫到我？")
  await singleTurn("A2: 陳述（計畫性）",             "明天想去看個展覽")
  await singleTurn("A3: 陳述（提醒語氣）",           "下週要把報告繳出去")
  await singleTurn("A4: 查詢今日待辦",               "現在有什麼事還沒處理？")
  await singleTurn("A5: 查詢今日完成",               "我今天做了哪些事？")
  await singleTurn("A6: 記錄（加入格式）",           "加入：約牙醫回診",          ["牙醫"])
  await singleTurn("A7: 記錄（記一下格式）",         "記一下：更新個人網站",      ["個人網站"])
  await singleTurn("A8: 完成（口語倒裝）",           "牛奶我去買了")
  await singleTurn("A9: 完成（已經句式）",           "已經把信寄給客戶了")
  await singleTurn("A10: 完成（模糊指代）",          "那件事剛剛處理完了")
  await singleTurn("A11: 規劃",                      "幫我擬一個準備馬拉松的訓練計畫", ["訓練", "課表"])
  await singleTurn("A12: 調整（無上下文）",          "把它歸到工作那邊")

  // B 段前重新清理 + 重種種子，確保 DB 只有 3 筆種子任務
  console.log("\n🔄 B 段前重置：清理 + 重種種子...")
  sessionAgents.clear()
  await cleanTestUser()
  const seedArea2 = await prisma.area.create({
    data: { user_id: userId, name: "一般", scope: "測試", is_custom: false },
  })
  const seedProduct2 = await prisma.product.create({
    data: { user_id: userId, area_id: seedArea2.id, name: "日常事務", status: "ACTIVE", lifecycle: "FINITE" },
  })
  await prisma.task.createMany({
    data: [
      { user_id: userId, product_id: seedProduct2.id, content: "買牛奶", status: "ACTIVE" },
      { user_id: userId, product_id: seedProduct2.id, content: "寄信給客戶", status: "ACTIVE" },
      { user_id: userId, product_id: seedProduct2.id, content: "整理書桌", status: "ACTIVE" },
    ],
  })
  console.log("🌱 B 段種子重種完成")

  // ════════════════════════════════════════════════
  // Section B：多輪 — 查詢 → 序號完成 → 確認 → DB驗證
  // ════════════════════════════════════════════════
  console.log("\n════════════ B. 多輪：查詢 → 序號完成 ════════════")
  await runSection("Section B", async () => {
    const sid = "multi-b3-" + Date.now()
    await multiTurn(sid, "B1: 查詢今日",             "今天有什麼代辦？")
    await multiTurn(sid, "B2: 第三個完成",           "第三個搞定了")
    await multiTurn(sid, "B3: 確認",                 "對，確認")
    await verifyTaskCompleted("B3: 整理書桌", "整理書桌")
    await multiTurn(sid, "B4: 第一個完成",           "第一個也弄完了")
    await multiTurn(sid, "B5: 確認",                 "確認")
    await verifyTaskCompleted("B5: 買牛奶", "買牛奶")
  })

  // ════════════════════════════════════════════════
  // Section C：多輪 — 陳述 → 問確認 → 否定 → 切換記錄
  // ════════════════════════════════════════════════
  console.log("\n════════════ C. 多輪：陳述 → 否定 → 記錄 ════════════")
  await runSection("Section C", async () => {
    const sid = "multi-c3-" + Date.now()
    await multiTurn(sid, "C1: 陳述（這週要…）",      "這週五要陪老婆看電影")
    await multiTurn(sid, "C2: 否定",                 "不用記啦，就隨口說說")
    await multiTurn(sid, "C3: 新記錄",               "待辦：繳網路費",            ["網路費"])
    await multiTurn(sid, "C4: 追加記錄",             "再加一個：買貓糧",          ["買貓糧"])
  })

  // ════════════════════════════════════════════════
  // Section D：多輪 — 記錄 → recall → 指代完成 → 確認 → DB驗證
  // ════════════════════════════════════════════════
  console.log("\n════════════ D. 多輪：記錄 → 指代完成 ════════════")
  await runSection("Section D", async () => {
    const sid = "multi-d3-" + Date.now()
    await multiTurn(sid, "D1: 記錄",                 "記一下：清理電腦桌面",      ["清理電腦桌面"])
    await multiTurn(sid, "D2: 問剛記的",             "我剛才說要記什麼？")
    await multiTurn(sid, "D3: 指代完成",             "搞定了")
    await multiTurn(sid, "D4: 確認",                 "確認")
    await verifyTaskCompleted("D4: 清理電腦桌面", "清理電腦桌面")
  })

  // ════════════════════════════════════════════════
  // Section E：多輪 — 規劃 → 查詢新任務
  // ════════════════════════════════════════════════
  console.log("\n════════════ E. 多輪：規劃 → 查詢 ════════════")
  await runSection("Section E", async () => {
    const sid = "multi-e3-" + Date.now()
    await multiTurn(sid, "E1: 規劃目標",             "幫我規劃考 PMP 證照的準備步驟", ["學習", "考試"])
    await multiTurn(sid, "E2: 查詢",                 "現在有什麼要做的")
  })

  // ════════════════════════════════════════════════
  // Section F：直接完成種子任務（語意搜尋）→ 確認 → DB驗證
  // ════════════════════════════════════════════════
  console.log("\n════════════ F. 完成種子任務 → DB驗證 ════════════")
  await runSection("Section F", async () => {
    const sid = "multi-f3-" + Date.now()
    await multiTurn(sid, "F1: 完成整理書桌",         "剛把書桌整理完了")
    await multiTurn(sid, "F2: 確認",                 "對")
    await verifyTaskCompleted("F2: 整理書桌", "整理書桌")
  })

  if (failures.length > 0) {
    console.log("\n⚠️ 本次執行有失敗，但後續 section 已繼續執行：")
    for (const failure of failures) {
      console.log(`  - ${failure}`)
    }
  }

  console.log("\n🧹 測試結束後清理測試用戶資料...")
  sessionAgents.clear()
  await cleanTestUser()

  await prisma.$disconnect()
  process.exit(0)
}

main().catch(e => { console.error(e); process.exit(1) })
