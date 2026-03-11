import dotenv from "dotenv"
dotenv.config()

import { createZentropyAgent } from "@/application/use-cases/agent/zentropy-agent"

const userId = "d8493e56-db97-4cfa-b18d-8c843b8574f3"

async function singleTurn(label: string, text: string) {
  const sessionId = "single-" + Date.now()
  console.log(`\n[單輪] ${label}`)
  console.log(`  Input   : ${text}`)
  const agent = createZentropyAgent(userId)
  const result = await agent.chat(text, { userId, sessionId })
  const intent = result.intent as { object?: string; speechAct?: string; confidence?: number; reasonCodes?: string[] } | null
  console.log(`  Intent  : ${intent?.object ?? "null"} (${intent?.speechAct ?? "-"}) conf=${intent?.confidence?.toFixed(2) ?? "-"}`)
  console.log(`  Tools   : ${result.toolCalls.length ? result.toolCalls.join(", ") : "—"}`)
  console.log(`  Reply   : ${result.content?.slice(0, 200)}`)
}

async function multiTurn(sessionId: string, label: string, text: string) {
  console.log(`\n  [輪] ${label}`)
  console.log(`    Input  : ${text}`)
  const agent = createZentropyAgent(userId)
  const result = await agent.chat(text, { userId, sessionId })
  const intent = result.intent as { object?: string; confidence?: number } | null
  console.log(`    Intent : ${intent?.object ?? "null"} conf=${intent?.confidence?.toFixed(2) ?? "-"}`)
  console.log(`    Tools  : ${result.toolCalls.length ? result.toolCalls.join(", ") : "—"}`)
  console.log(`    Reply  : ${result.content?.slice(0, 250)}`)
}

async function main() {

  // ════════════════════════════════════════════════════════════════
  // Section A：單輪基本路由驗證
  // ════════════════════════════════════════════════════════════════
  console.log("\n════════════ A. 單輪路由驗證 ════════════")

  await singleTurn("A1: 打招呼",            "你好，我可以用你做什麼？")
  await singleTurn("A2: 純陳述句（無意圖）", "下午要去接小孩")
  await singleTurn("A3: 純陳述句（未來）",   "這週五要跟設計師開會")
  await singleTurn("A4: 查詢今日待辦",       "今天有哪些事情要做")
  await singleTurn("A5: 查詢今日完成",       "今天做了哪些事")
  await singleTurn("A6: 明確記錄",           "記錄：準備設計師評審簡報")
  await singleTurn("A7: 明確記錄（幫我記）", "幫我記一下要寄履歷給三家公司")
  await singleTurn("A8: 標記完成（直述）",   "健身房做完了")
  await singleTurn("A9: 標記完成（請求）",   "幫我把買牛奶標記完成")
  await singleTurn("A10: 調整分類",          "把這個任務移到個人")
  // await singleTurn("A11: 整理任務",          "幫我整理一下任務") // SKIP: Gemini payload too large
  await singleTurn("A12: 規劃目標",          "幫我規劃準備轉職的步驟")

  // ════════════════════════════════════════════════════════════════
  // Section B：多輪 — 查詢後用上下文完成
  // ════════════════════════════════════════════════════════════════
  console.log("\n════════════ B. 多輪：查詢 → 上下文完成 ════════════")
  {
    const sid = "multi-b-" + Date.now()
    await multiTurn(sid, "B1: 查詢今日待辦",          "今天要做什麼")
    await multiTurn(sid, "B2: 用序號指代完成",         "第一個做完了")
    await multiTurn(sid, "B3: 用「這件事」指代完成",   "剛剛第二個也搞定了")
  }

  // ════════════════════════════════════════════════════════════════
  // Section C：多輪 — 陳述句確認流程
  // ════════════════════════════════════════════════════════════════
  console.log("\n════════════ C. 多輪：陳述句 → 確認 → 記錄 ════════════")
  {
    const sid = "multi-c-" + Date.now()
    await multiTurn(sid, "C1: 陳述句（無意圖）",      "晚上要去看牙醫")
    await multiTurn(sid, "C2: 否定（只是說說）",       "不是，只是跟你說一下")
    await multiTurn(sid, "C3: 新陳述句",               "對了，還要記得繳電費")
    await multiTurn(sid, "C4: 明確確認記錄",           "記錄：繳電費")
  }

  // ════════════════════════════════════════════════════════════════
  // Section D：多輪 — 記錄後追蹤完成
  // ════════════════════════════════════════════════════════════════
  console.log("\n════════════ D. 多輪：記錄 → 查詢 → 完成 ════════════")
  {
    const sid = "multi-d-" + Date.now()
    await multiTurn(sid, "D1: 記錄任務",               "記錄：整理履歷並更新 LinkedIn")
    await multiTurn(sid, "D2: 查詢確認",               "剛剛記了什麼")
    await multiTurn(sid, "D3: 完成剛記的任務",          "幫我把剛才記的那個標記完成")
  }

  // ════════════════════════════════════════════════════════════════
  // Section E：多輪 — 規劃後繼續操作
  // ════════════════════════════════════════════════════════════════
  console.log("\n════════════ E. 多輪：規劃 → 查詢 ════════════")
  {
    const sid = "multi-e-" + Date.now()
    await multiTurn(sid, "E1: 規劃目標",               "幫我規劃學英文的計畫")
    await multiTurn(sid, "E2: 查詢剛才建立的任務",     "今天要做什麼")
  }

  process.exit(0)
}

main().catch(e => { console.error(e); process.exit(1) })
