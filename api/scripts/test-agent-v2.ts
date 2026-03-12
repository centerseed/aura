import dotenv from "dotenv"
dotenv.config()

import { createZentropyAgent } from "@/application/use-cases/agent/zentropy-agent"
import { prisma } from "@/lib/db"
import { buildLineInteractiveReply } from "@/lib/line-interactive-reply"

const userId = "d8493e56-db97-4cfa-b18d-8c843b8574f3"
const sessionAgents = new Map<string, ReturnType<typeof createZentropyAgent>>()
const failures: string[] = []
const defaultSeedTasks = ["買牛奶", "寄信給客戶", "整理書桌"] as const

interface LineUiExpectation {
  mode: "text-only" | "quickReply"
  sessionType?: string
  buttonLabels?: string[]
}

interface ChatSnapshot {
  content: string
  toolCalls: string[]
  sessionType: string
  lineUiMode: "text-only" | "quickReply"
  buttonLabels: string[]
}

function requiresConfirmation(snapshot: ChatSnapshot): boolean {
  return snapshot.lineUiMode === "quickReply"
    && snapshot.buttonLabels.includes("確認")
    && snapshot.buttonLabels.includes("取消")
}

// ════════════════════════════════════════════════
// DB 工具
// ════════════════════════════════════════════════

async function cleanTestUser() {
  const r2 = await prisma.$executeRawUnsafe(`DELETE FROM daily_plan_items WHERE task_id IN (SELECT id FROM tasks WHERE user_id = '${userId}')`)
  const r1 = await prisma.$executeRawUnsafe(`DELETE FROM sub_tasks WHERE task_id IN (SELECT id FROM tasks WHERE user_id = '${userId}')`)
  const r3 = await prisma.$executeRawUnsafe(`DELETE FROM tasks WHERE user_id = '${userId}'`)
  const r4 = await prisma.$executeRawUnsafe(`DELETE FROM topics WHERE product_id IN (SELECT id FROM products WHERE user_id = '${userId}')`)
  const r5 = await prisma.$executeRawUnsafe(`DELETE FROM products WHERE user_id = '${userId}'`)
  const r6 = await prisma.$executeRawUnsafe(`DELETE FROM areas WHERE user_id = '${userId}'`)
  console.log(`🧹 [CLEANUP] daily_plan_items=${r2} sub_tasks=${r1} tasks=${r3} topics=${r4} products=${r5} areas=${r6}`)
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
    if (!match) {
      failures.push(`[${label}] DB 中找不到預期任務: ${title}`)
    }
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
    failures.push(`[${label}] 找不到任務: ${expectedTitle}`)
    return
  }
  const isArchived = match.status === "ARCHIVE"
  console.log(`  🔍 [完成驗證 ${label}] ${isArchived ? "✅" : "❌"} 「${match.content}」status=${match.status} ${isArchived ? "→ 已封存（完成）" : "→ 未變更為完成！"}`)
  if (!isArchived) {
    failures.push(`[${label}] 任務未完成封存: ${match.content} status=${match.status}`)
  }
}

async function seedBaseTasks(extraTasks: string[] = []) {
  const seedArea = await prisma.area.create({
    data: { user_id: userId, name: "一般", scope: "測試", is_custom: false },
  })
  const seedProduct = await prisma.product.create({
    data: { user_id: userId, area_id: seedArea.id, name: "日常事務", status: "ACTIVE", lifecycle: "FINITE" },
  })

  const tasks = [...defaultSeedTasks, ...extraTasks]
  await prisma.task.createMany({
    data: tasks.map((content) => ({ user_id: userId, product_id: seedProduct.id, content, status: "ACTIVE" })),
  })

  console.log(`🌱 種子任務完成（${tasks.join("、")}）`)
}

async function resetScenario(label: string, extraTasks: string[] = []) {
  console.log(`\n🔄 ${label} 前重置資料...`)
  sessionAgents.clear()
  await cleanTestUser()
  await seedBaseTasks(extraTasks)
}

// ════════════════════════════════════════════════
// Agent 測試工具
// ════════════════════════════════════════════════

async function singleTurn(
  label: string,
  text: string,
  verifyTasks?: string[],
  lineUiExpectation?: LineUiExpectation,
): Promise<ChatSnapshot> {
  const sessionId = "single-v3-" + Date.now()
  console.log(`\n[單輪] ${label}`)
  console.log(`  Input   : ${text}`)
  const agent = createZentropyAgent(userId)
  const result = await agent.chat(text, { userId, sessionId })
  const intent = result.intent as { object?: string; speechAct?: string; confidence?: number } | null
  console.log(`  Intent  : ${intent?.object ?? "null"} (${intent?.speechAct ?? "-"}) conf=${intent?.confidence?.toFixed(2) ?? "-"}`)
  console.log(`  Tools   : ${result.toolCalls.length ? result.toolCalls.join(", ") : "—"}`)
  console.log(`  Reply   : ${result.content?.slice(0, 250)}`)
  const snapshot = printLineUiPreview(label, result.content, result.toolOutputs, lineUiExpectation)
  if (verifyTasks) await verifyTasksInDB(label, verifyTasks)
  return { content: result.content, toolCalls: result.toolCalls, ...snapshot }
}

async function multiTurn(
  sessionId: string,
  label: string,
  text: string,
  verifyTasks?: string[],
  lineUiExpectation?: LineUiExpectation,
): Promise<ChatSnapshot> {
  console.log(`\n  [輪] ${label}`)
  console.log(`    Input  : ${text}`)
  const agent = sessionAgents.get(sessionId) ?? createZentropyAgent(userId)
  sessionAgents.set(sessionId, agent)
  const result = await agent.chat(text, { userId, sessionId })
  const intent = result.intent as { object?: string; confidence?: number } | null
  console.log(`    Intent : ${intent?.object ?? "null"} conf=${intent?.confidence?.toFixed(2) ?? "-"}`)
  console.log(`    Tools  : ${result.toolCalls.length ? result.toolCalls.join(", ") : "—"}`)
  console.log(`    Reply  : ${result.content?.slice(0, 250)}`)
  const snapshot = printLineUiPreview(label, result.content, result.toolOutputs, lineUiExpectation, "    ")
  if (verifyTasks) await verifyTasksInDB(label, verifyTasks)
  return { content: result.content, toolCalls: result.toolCalls, ...snapshot }
}

function printLineUiPreview(
  label: string,
  content: string,
  toolOutputs?: string[],
  expectation?: LineUiExpectation,
  indent = "  ",
): Omit<ChatSnapshot, "content" | "toolCalls"> {
  const interactive = buildLineInteractiveReply(content, toolOutputs)
  const quickReplyItems = "quickReply" in interactive.message
    ? interactive.message.quickReply?.items ?? []
    : []
  const mode = quickReplyItems.length > 0 ? "quickReply" : "text-only"
  const sessionType = interactive.sessionToSave?.type ?? "—"

  console.log(`${indent}LINE UI : ${mode} session=${sessionType}`)
  if (quickReplyItems.length > 0) {
    const labels = quickReplyItems
      .map((item) => {
        const action = item.action
        if ("label" in action && typeof action.label === "string") return action.label
        return action.type
      })
      .join(", ")
    console.log(`${indent}Buttons : ${labels}`)
  }

  if (content.includes("[FACTS]") || content.includes("[/FACTS]")) {
    const message = `[${label}] 回覆洩漏 FACTS 區塊`
    failures.push(message)
    console.log(`${indent}內容驗證 : ❌ FACTS 洩漏`)
  }

  if (!expectation) {
    return { sessionType, lineUiMode: mode, buttonLabels: quickReplyItems.map((item) => {
      const action = item.action
      return "label" in action && typeof action.label === "string" ? action.label : action.type
    }) }
  }

  const problems: string[] = []
  if (mode !== expectation.mode) {
    problems.push(`expected mode=${expectation.mode}, got ${mode}`)
  }

  if (expectation.sessionType && sessionType !== expectation.sessionType) {
    problems.push(`expected sessionType=${expectation.sessionType}, got ${sessionType}`)
  }

  if (expectation.buttonLabels?.length) {
    const actualLabels = quickReplyItems
      .map((item) => {
        const action = item.action
        return "label" in action && typeof action.label === "string" ? action.label : action.type
      })
    for (const expectedLabel of expectation.buttonLabels) {
      if (!actualLabels.includes(expectedLabel)) {
        problems.push(`missing button=${expectedLabel}`)
      }
    }
  }

  if (problems.length === 0) {
    console.log(`${indent}UI驗證 : ✅`)
    return {
      sessionType,
      lineUiMode: mode,
      buttonLabels: quickReplyItems.map((item) => {
        const action = item.action
        return "label" in action && typeof action.label === "string" ? action.label : action.type
      }),
    }
  }

  const message = `[${label}] LINE UI 驗證失敗: ${problems.join("; ")}`
  failures.push(message)
  console.log(`${indent}UI驗證 : ❌ ${problems.join("; ")}`)
  return {
    sessionType,
    lineUiMode: mode,
    buttonLabels: quickReplyItems.map((item) => {
      const action = item.action
      return "label" in action && typeof action.label === "string" ? action.label : action.type
    }),
  }
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
  await resetScenario("Section A")

  // ════════════════════════════════════════════════
  // Section A：單輪路由驗證（第五套措辭）
  // ════════════════════════════════════════════════
  console.log("\n════════════ A. 單輪路由（第五套） ════════════")

  await singleTurn("A1: 問候",                       "哈囉，你都可以幫我做什麼？")
  await singleTurn("A2: 陳述（計畫性）",             "週末打算去騎腳踏車")
  await singleTurn("A3: 陳述（提醒語氣）",           "明天記得要繳水費")
  await singleTurn("A4: 查詢今日待辦",               "我現在還有哪些事沒做？")
  await singleTurn("A5: 查詢今日完成",               "今天有完成什麼嗎？")
  await singleTurn("A6: 記錄（add格式）",            "add: 幫小孩報名才藝班",     ["才藝"])
  await singleTurn("A7: 記錄（筆記格式）",           "筆記：聯絡裝潢師傅",        ["裝潢"])
  await singleTurn("A8: 完成（時態倒裝）",           "牛奶剛買回來了")
  await singleTurn("A9: 完成（被動完成）",           "信已經發出去給客戶了")
  await singleTurn("A10: 完成（模糊）",              "那個已經 OK 了")
  await singleTurn("A11: 規劃",                      "幫我規劃學鋼琴的計畫",      ["練習", "學習"])
  await singleTurn("A12: 調整（無上下文）",          "這件事改放到個人")
  await singleTurn(
    "A13: 語意不明記錄 → 應出現記錄按鈕",
    "下週要去台北出差，記得訂機票和飯店",
    undefined,
    { mode: "quickReply", sessionType: "brain_dump_pending", buttonLabels: ["記錄", "取消"] },
  )

  await resetScenario("Section B")

  // ════════════════════════════════════════════════
  // Section B：多輪 — 查詢 → 序號完成 → 確認 → DB驗證
  // ════════════════════════════════════════════════
  console.log("\n════════════ B. 多輪：查詢 → 序號完成 ════════════")
  await runSection("Section B", async () => {
    const sid = "multi-b3-" + Date.now()
    await multiTurn(sid, "B1: 查詢今日",             "今天要做什麼事？")
    const b2 = await multiTurn(sid, "B2: 最後一個完成", "最後一個做完了")
    if (requiresConfirmation(b2)) {
      await multiTurn(sid, "B2-確認: 完成整理書桌", "確認")
    }
    await verifyTaskCompleted("B3: 整理書桌", "整理書桌")
    const b4 = await multiTurn(sid, "B4: 第一個完成", "第一個也搞定了")
    if (requiresConfirmation(b4)) {
      await multiTurn(sid, "B4-確認: 完成買牛奶", "確認")
    }
    await verifyTaskCompleted("B5: 買牛奶", "買牛奶")
  })

  await resetScenario("Section B2", ["晨間跑步", "晚間跑步"])
  console.log("\n════════════ B2. 多輪：多候選完成 → LINE buttons ════════════")
  await runSection("Section B2", async () => {
    const sid = "multi-b2-v4-" + Date.now()
    await multiTurn(
      sid,
      "B2-1: 多候選完成",
      "跑步完成了",
      undefined,
      { mode: "quickReply", sessionType: "complete_task_disambiguation" },
    )
  })

  // ════════════════════════════════════════════════
  // Section C：多輪 — 陳述 → 問確認 → 否定 → 切換記錄
  // ════════════════════════════════════════════════
  await resetScenario("Section C")
  console.log("\n════════════ C. 多輪：陳述 → 否定 → 記錄 ════════════")
  await runSection("Section C", async () => {
    const sid = "multi-c3-" + Date.now()
    await multiTurn(sid, "C1: 陳述（下週要…）",      "下週要跟朋友去爬山")
    await multiTurn(sid, "C2: 否定",                 "算了不用記，隨便說說的")
    await multiTurn(sid, "C3: 新記錄",               "記錄：準備季報資料",        ["季報"])
    await multiTurn(sid, "C4: 追加記錄",             "另外記一個：換機油",        ["換機油"])
  })

  // ════════════════════════════════════════════════
  // Section D：多輪 — 記錄 → recall → 指代完成 → 確認 → DB驗證
  // ════════════════════════════════════════════════
  await resetScenario("Section D")
  console.log("\n════════════ D. 多輪：記錄 → 指代完成 ════════════")
  await runSection("Section D", async () => {
    const sid = "multi-d3-" + Date.now()
    await multiTurn(sid, "D1: 記錄",                 "記錄：整理客廳",            ["整理客廳"])
    await multiTurn(sid, "D2: 問剛記的",             "剛才我記什麼了？")
    const d3 = await multiTurn(sid, "D3: 指代完成",  "做完了")
    if (requiresConfirmation(d3)) {
      await multiTurn(sid, "D3-確認: 完成整理客廳", "確認")
    }
    await verifyTaskCompleted("D4: 整理客廳", "整理客廳")
  })

  // ════════════════════════════════════════════════
  // Section E：多輪 — 規劃 → 查詢新任務
  // ════════════════════════════════════════════════
  await resetScenario("Section E")
  console.log("\n════════════ E. 多輪：規劃 → 查詢 ════════════")
  await runSection("Section E", async () => {
    const sid = "multi-e3-" + Date.now()
    await multiTurn(sid, "E1: 規劃目標",             "幫我規劃學日文的計畫",      ["學習", "練習"])
    await multiTurn(sid, "E2: 查詢",                 "現在要做什麼")
  })

  // ════════════════════════════════════════════════
  // Section F：直接完成種子任務（語意搜尋）→ 確認 → DB驗證
  // ════════════════════════════════════════════════
  await resetScenario("Section F")
  console.log("\n════════════ F. 完成種子任務 → DB驗證 ════════════")
  await runSection("Section F", async () => {
    const sid = "multi-f3-" + Date.now()
    const f1 = await multiTurn(sid, "F1: 完成整理書桌", "整理書桌做完了")
    if (requiresConfirmation(f1)) {
      await multiTurn(sid, "F1-確認: 完成整理書桌", "確認")
    }
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
  process.exit(failures.length > 0 ? 1 : 0)
}

main().catch(e => { console.error(e); process.exit(1) })
