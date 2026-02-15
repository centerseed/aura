/**
 * 測試 Brain Dump prompt 多種場景
 * 用法: npx tsx scripts/test-brain-dump-prompt.ts
 */

import { google } from "@ai-sdk/google"
import { generateObject } from "ai"
import { z } from "zod"

const SubItemSchema = z.object({
  content: z.string().max(100),
})

const SourceAttributionSchema = z.object({
  source_type: z.enum(["explicit", "inferred_from_context", "inferred_from_system"]),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().max(80),
})

const TaskTypeSchema = z.enum(["waiting", "booking", "preparation", "execution"])

const StructuredItemSchema = z.object({
  title: z.string().max(50),
  narrative: z.string().max(100),
  drawer: z.enum(["INBOX", "ACTIVE", "MAINTAIN", "REFERENCE", "ARCHIVE"]),
  lifecycle: z.enum(["FINITE", "PERPETUAL"]),
  tag: z.object({
    area: z.string().max(30),
    product: z.string().max(50),
    topic: z.string().max(50),
  }),
  strategy_used: z.string().max(50),
  reasoning: z.string().max(100),
  due_date: z.string().datetime({ offset: true }).optional(),
  due_date_source: SourceAttributionSchema.optional(),
  inferred_from_milestone: z.string().optional(),
  task_type: TaskTypeSchema.optional(),
  estimated_days_needed: z.number().min(1).max(30).optional(),
  depends_on_task: z.string().max(50).optional(),
  time_confidence: z.number().min(0).max(1).optional(),
  sub_items: z.array(SubItemSchema).optional(),
})

const AppendSubItemActionSchema = z.object({
  action: z.literal("append_sub_item"),
  target_task_id: z.string(),
  sub_items: z.array(SubItemSchema),
  reasoning: z.string().max(100),
})

const CreateNewTasksActionSchema = z.object({
  action: z.literal("create_new_tasks"),
  items: z.array(StructuredItemSchema),
})

const StructureResultSchema = z.discriminatedUnion("action", [
  AppendSubItemActionSchema,
  CreateNewTasksActionSchema,
])

// 模擬用戶真實的 context
const contextSummary = `
### 用戶的任務上下文

**可用的 Areas**: 事業, 生活

**Area: 事業** (範圍: 事業相關)
  📦 Product: Zentropy
     Topics: Zentropy 功能開發, Zentropy 專案管理
     未完成任務 (可追加 sub-item 的候選):
       - [task-001] 開發 Zentropy MCP 與 Coach 功能
         ⏰ 1 天前更新 | 狀態: active | 截止: 2026/2/15
         已有的待辦項目:
           ✅ [M1] 開發 Zentropy Coach
           ☐ [M2] Zentropy 無摩擦模式
           ✅ MCP 規格確認
           ☐ MCP實作
       - [task-002] 規劃 Zentropy Google Calendar 整合策略
         ⏰ 3 天前更新 | 狀態: active | 截止: 2026/2/20
         已有的待辦項目:
           ✅ 研究 Google Calendar API 功能與限制
           ☐ 評估遷移所需資源與時間
           ☐ 與相關團隊討論部署方式的決定
  📦 Product: Paceriz
     Topics: Paceriz v2 課表開發與問題修復
     未完成任務 (可追加 sub-item 的候選):
       - [task-003] 確認 Paceriz 部署方式遷移
         ⏰ 2 天前更新 | 狀態: active | 截止: 2026/2/17
         已有的待辦項目:
           ☐ 研究 GCR 遷移到 AR 的可行性與影響
           ☐ 評估遷移所需資源與時間
           ☐ 與相關團隊討論部署方式的決定

**Area: 生活** (範圍: 個人生活)
  📦 Product: 健康管理
     Topics: 運動, 飲食
     未完成任務 (可追加 sub-item 的候選): (無)
`

const now = new Date()

function buildPrompt(userInput: string): string {
  return `你是任務記錄專家。將用戶輸入轉成結構化的 Task。

# 🔥🔥🔥 最最優先：清單模式偵測

**在做任何其他判斷之前**，先檢查用戶輸入的結構：

用戶輸入是否有「主題 + 列表」的結構？（例：「XX更新：1. A 2. B」「XX事項：- C - D」）

- **是** → 創建 **1 個新任務**，主題當 title，列表項目當 sub-items
  - sub-item 的 content 必須**直接使用用戶的原話**，禁止改寫
  - 不需要做追加判斷，直接 create_new_tasks
  - 範例：「App更新：1. 刪除project 2. 加今日計劃」→ title=「App更新」, sub_items=[「要可以刪除project」,「加入今日計劃頁面」]
- **否** → 繼續往下做追加判斷

---

# 🔥 是追加還是新任務？（僅當上面不是清單模式時）

## 核心判斷原則：因果關係測試

**唯一判斷標準**：執行「完成度測試」——

> 假設我把【用戶輸入】勾掉了，【既有任務】的完成進度是否從 X% 變成了 (X+N)%？

- 如果進度會推進 → 追加
- 如果進度不變（只是「相關」但不推進完成度）→ 新任務

### 因果關係測試範例

| 用戶輸入 | 既有任務 | 測試問題 | 答案 | 結果 |
|---------|---------|---------|------|------|
| 買菜 | 準備晚餐 | 「買菜」勾掉後，「準備晚餐」進度推進了嗎？ | ✅ 是 | 追加 |
| 發郵件 | 週報：整理資料、發郵件 | 「發郵件」勾掉後，「週報」進度推進了嗎？ | ✅ 是 | 追加 |
| 封存專案 | 封版與測試 | 「封存專案」勾掉後，「封版與測試」進度推進了嗎？ | ❌ 否 | 新任務 |
| 修 bug | 開發新功能 | 「修 bug」勾掉後，「開發新功能」進度推進了嗎？ | ❌ 否 | 新任務 |
| App要加每日清單 | 開發MCP與Coach | 「加每日清單」勾掉後，「MCP與Coach」進度推進了嗎？ | ❌ 否，不同功能 | 新任務 |

### 追加的必要條件（全部滿足才追加）

1. **既有任務的 sub-items 或描述中，已經提到了相同或幾乎相同的事**：輸入內容必須能直接對應到既有任務已列出的具體工作項目
2. **粒度更細且推進完成度**：勾掉輸入後，既有任務的完成百分比會直接推進
3. **時間一致**：如果用戶輸入帶有明確時間意圖，目標任務的截止日期必須落在相同時間範圍內

### 追加的絕對禁止（出現任一條即為新任務）

- 既有任務是「大傘任務」（名稱寬泛如「開發 XX 功能」「推進 XX 專案」）→ 不追加。大傘任務會吸引所有相關輸入，但「相關」不等於「子步驟」

### 常見誤判情況（這些都是新任務）

- 「語意相關」≠「是子步驟」（封存 vs 封版，都有「封」字但無因果關係）
- 「同一專案」≠「是子步驟」（同一個 Product 下的兩件不同的事）
- 「時間相近」≠「是子步驟」（今天要做的兩件獨立的事）
- 「同屬一個大方向」≠「是子步驟」（「加 A 功能」和「開發 B 功能」都是 App 開發，但完成 A 不推進 B 的進度）

### 判斷流程

\`\`\`
1. 找出最相關的既有任務
2. 執行完成度測試：「勾掉 X 後，Y 的完成進度推進了嗎？」
3. 如果進度不變 → 創建新任務
4. 如果進度推進 → 再確認粒度是否更細
5. 兩個都通過 → 追加
\`\`\`

**預設行為**：有任何疑慮，創建新任務。追加是例外，不是常態。

**如果符合追加條件**：
→ 回傳 \`action: "append_sub_item"\`，指定 \`target_task_id\` 和新的 \`sub_items\`

**如果是新任務**：
→ 繼續往下，按照原有規則創建新任務

---

# 核心原則（創建新任務時使用）

## 1. 完整記錄
問自己：**「把輸出念給用戶聽，用戶會說『你漏了 X』嗎？」**
- 會 → 你漏了東西，補上
- 不會 → OK

所有細節都要保留：
- 用戶提到的每個事項 → 放入 sub_items 或 narrative
- 用戶提到的條件/前提 → 放入 narrative
- 用戶提到的人名/專案名 → 保留原文

## 2. Sub-items 拆分

**第一原則：你是記錄員，不是 PM。忠實記錄用戶說的，不要自作主張拆解。**

### 什麼時候拆 sub-items？

**情況 A：用戶自己列了清單**
用戶輸入帶有主題 + 列表（如「XX更新：1. A 2. B」、「要做 A、B、C」）→ 主題當 title，列表項目照用戶原話當 sub-items
🚨 sub-item 的 content 必須直接使用用戶的原話，禁止改寫、禁止展開、禁止加工

**情況 B：任務規模明顯很大（預估 > 3 天）且用戶沒列清單**
例如「重構整個認證系統」→ 可以拆出合理的里程碑級子項

### 什麼時候不拆？

- 用戶只說了一件事（不管多複雜）→ 不拆，放 narrative
- 你想拆「設計→實作→測試」→ 🚫 這是你在當 PM，禁止
- 你想把用戶的一句話展開成多個步驟 → 🚫 禁止

### 拆分的黃金測試

> 「這些 sub-items 是用戶說的，還是我發明的？」
> - 用戶說的 → 拆
> - 我發明的 → 不拆

**🚨 禁止只有 1 個 sub-item**
- 如果只有一件事，那就是任務本身，不需要 sub-item
- sub_items 至少要有 2 個，否則留空不要拆

## 3. Area 選擇（🚨 絕對禁止創建新 Area）
**規則：只能從既有 Areas 中選擇，絕對不能創建新的 Area**

## 4. Product 選擇
問自己：**「這個新任務和哪個 Product 的現有任務最像？」**

---

# 背景資訊

今天：${now.toLocaleDateString("zh-TW")} (星期${['日', '一', '二', '三', '四', '五', '六'][now.getDay()]})

${contextSummary}
---

# 用戶輸入

${userInput}

---

# 輸出格式與長度限制（嚴格遵守）

**字元數限制：**
- title：≤ 50 字元
- narrative：≤ 100 字元
- reasoning：≤ 100 字元
- sub_item.content：≤ 100 字元

**格式要求：**
- 使用繁體中文
- 精簡優先：每個字都要有意義`
}

// ============================================================================
// Test scenarios
// ============================================================================

interface TestCase {
  name: string
  input: string
  expect: {
    action: "create_new_tasks" | "append_sub_item"
    taskCount?: number       // for create_new_tasks
    subItemCount?: number    // expected sub-items on the (first) task
    noSubItems?: boolean     // should have 0 sub-items
    targetTaskId?: string    // for append
  }
}

const testCases: TestCase[] = [
  // ── 清單模式：主題 + 列表 → 1 任務 + sub-items ──
  {
    name: "清單模式：App更新 + 編號列表",
    input: "Zentropy App更新：1. 要可以刪除project 2. 加入今日計劃頁面",
    expect: { action: "create_new_tasks", taskCount: 1, subItemCount: 2 },
  },
  {
    name: "清單模式：三項列表",
    input: "Paceriz 修復項目：1. 課表顯示錯誤 2. 推播沒有聲音 3. 登入偶爾閃退",
    expect: { action: "create_new_tasks", taskCount: 1, subItemCount: 3 },
  },
  {
    name: "清單模式：頓號列表",
    input: "週末要買的東西：牛奶、雞蛋、麵包",
    expect: { action: "create_new_tasks", taskCount: 1, subItemCount: 3 },
  },

  // ── 單一任務：不該拆 sub-items ──
  {
    name: "單一任務：不該有 sub-items",
    input: "研究 Flutter 的狀態管理方案",
    expect: { action: "create_new_tasks", taskCount: 1, noSubItems: true },
  },
  {
    name: "單一任務：複雜但只有一件事",
    input: "把 Zentropy 的登入流程改成用 Google OAuth",
    expect: { action: "create_new_tasks", taskCount: 1, noSubItems: true },
  },

  // ── 不該追加到大傘任務 ──
  {
    name: "不追加：獨立功能 vs 大傘任務",
    input: "Zentropy 要加入深色模式",
    expect: { action: "create_new_tasks", taskCount: 1 },
  },
  {
    name: "不追加：不同功能 vs MCP",
    input: "加入今日計劃頁面",
    expect: { action: "create_new_tasks", taskCount: 1 },
  },

  // ── 應該追加的情況 ──
  {
    name: "應追加：MCP實作的具體細節",
    input: "MCP 要支援 get-context-now 這個 tool",
    expect: { action: "append_sub_item", targetTaskId: "task-001" },
  },
  {
    name: "應追加：Calendar 整合的子步驟",
    input: "確認 Google Calendar API 的 quota 限制",
    expect: { action: "append_sub_item", targetTaskId: "task-002" },
  },

  // ── 完全無關的新任務 ──
  {
    name: "無關：生活類任務",
    input: "明天下午三點看牙醫",
    expect: { action: "create_new_tasks", taskCount: 1, noSubItems: true },
  },
  {
    name: "無關：不同 Product",
    input: "Fintasy 要做 MVP demo 影片",
    expect: { action: "create_new_tasks", taskCount: 1 },
  },
]

async function runTest(tc: TestCase): Promise<{ pass: boolean; detail: string }> {
  const prompt = buildPrompt(tc.input)

  try {
    const { object: result } = await generateObject({
      model: google("gemini-2.5-flash-lite"),
      schema: StructureResultSchema,
      prompt,
    })

    const lines: string[] = []
    let pass = true

    // Check action
    if (result.action !== tc.expect.action) {
      pass = false
      lines.push(`action: 期望 ${tc.expect.action}, 實際 ${result.action}`)
    }

    if (result.action === "create_new_tasks") {
      const items = result.items
      lines.push(`→ ${items.length} 任務`)

      // Check task count
      if (tc.expect.taskCount && items.length !== tc.expect.taskCount) {
        pass = false
        lines.push(`  taskCount: 期望 ${tc.expect.taskCount}, 實際 ${items.length}`)
      }

      for (const item of items) {
        const subs = item.sub_items || []
        lines.push(`  「${item.title}」 (${subs.length} sub-items)`)
        for (const s of subs) {
          lines.push(`    ☐ ${s.content}`)
        }
      }

      // Check sub-item count
      if (tc.expect.subItemCount && items.length === 1) {
        const actual = items[0].sub_items?.length || 0
        if (actual !== tc.expect.subItemCount) {
          pass = false
          lines.push(`  subItemCount: 期望 ${tc.expect.subItemCount}, 實際 ${actual}`)
        }
      }

      // Check no sub-items
      if (tc.expect.noSubItems) {
        const actual = items[0]?.sub_items?.length || 0
        if (actual > 0) {
          pass = false
          lines.push(`  應該沒有 sub-items，但有 ${actual} 個`)
        }
      }
    } else {
      lines.push(`→ append to ${result.target_task_id}`)
      lines.push(`  reasoning: ${result.reasoning}`)
      lines.push(`  sub_items: ${result.sub_items.map(s => s.content).join(", ")}`)

      if (tc.expect.targetTaskId && result.target_task_id !== tc.expect.targetTaskId) {
        // Soft warning, not fail
        lines.push(`  ⚠️ target: 期望 ${tc.expect.targetTaskId}, 實際 ${result.target_task_id}`)
      }
    }

    return { pass, detail: lines.join("\n") }
  } catch (err: any) {
    return { pass: false, detail: `Error: ${err.message}` }
  }
}

async function main() {
  console.log("🧪 Brain Dump Prompt 多場景測試\n")
  console.log(`共 ${testCases.length} 個測試案例\n`)
  console.log("=".repeat(70))

  let passCount = 0
  let failCount = 0

  for (const tc of testCases) {
    const { pass, detail } = await runTest(tc)

    const icon = pass ? "✅" : "❌"
    console.log(`\n${icon} ${tc.name}`)
    console.log(`  輸入: "${tc.input}"`)
    console.log(`  ${detail}`)

    if (pass) passCount++
    else failCount++
  }

  console.log("\n" + "=".repeat(70))
  console.log(`\n📊 結果: ${passCount}/${testCases.length} 通過, ${failCount}/${testCases.length} 失敗`)

  if (failCount === 0) {
    console.log("🎉 全部通過！")
  } else {
    console.log("⚠️ 有失敗案例需要處理")
  }
}

main().catch(console.error)
