/**
 * Brain Dump 追加 vs 新建 判斷測試
 *
 * 測試目標：驗證 AI 在「追加 sub-item」與「創建新任務」之間的判斷是否正確
 * 重點：時間衝突時必須創建新任務，不得追加到時間不一致的既有任務
 *
 * 注意：此測試會調用真實的 Gemini API
 */

import { describe, it, expect } from 'vitest'
import { google } from '@ai-sdk/google'
import { generateObject } from 'ai'
import { z } from 'zod'

// 與 route.ts 一致的 schema（簡化版）
const SubItemSchema = z.object({
  content: z.string(),
})

const SourceAttributionSchema = z.object({
  source_type: z.enum(['explicit', 'inferred_from_context', 'inferred_from_system']),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
})

const StructuredItemSchema = z.object({
  title: z.string(),
  narrative: z.string(),
  drawer: z.enum(['INBOX', 'ACTIVE', 'MAINTAIN', 'REFERENCE', 'ARCHIVE']),
  lifecycle: z.enum(['FINITE', 'PERPETUAL']),
  tag: z.object({
    area: z.string(),
    product: z.string(),
    topic: z.string(),
  }),
  strategy_used: z.string(),
  reasoning: z.string(),
  due_date: z.string().optional(),
  due_date_source: SourceAttributionSchema.optional(),
  inferred_from_milestone: z.string().optional(),
  task_type: z.enum(['waiting', 'booking', 'preparation', 'execution']).optional(),
  estimated_days_needed: z.number().max(30).optional(),
  depends_on_task: z.string().optional(),
  time_confidence: z.number().min(0).max(1).optional(),
  sub_items: z.array(SubItemSchema).optional(),
})

const AppendSubItemActionSchema = z.object({
  action: z.literal('append_sub_item'),
  target_task_id: z.string(),
  sub_items: z.array(SubItemSchema),
  reasoning: z.string(),
})

const CreateNewTasksActionSchema = z.object({
  action: z.literal('create_new_tasks'),
  items: z.array(StructuredItemSchema),
})

const StructureResultSchema = z.discriminatedUnion('action', [
  AppendSubItemActionSchema,
  CreateNewTasksActionSchema,
])

// 從 route.ts 擷取的核心 prompt（追加判斷 + 分類規則）
function buildPrompt(contextSummary: string, userInput: string): string {
  const now = new Date()
  const todayStr = now.toLocaleDateString('zh-TW')
  const dayOfWeek = ['日', '一', '二', '三', '四', '五', '六'][now.getDay()]

  return `你是任務記錄專家。將用戶輸入轉成結構化的 Task。

# 🔥 最優先判斷：是追加還是新任務？

## 核心判斷原則：因果關係測試

**唯一判斷標準**：問自己這個問題——

> 「完成【用戶輸入】是否是達成【既有任務】的必要手段？」

- 如果答案是「是」→ 追加
- 如果答案是「否」或「不確定」→ 新任務

### 追加的必要條件（全部滿足才追加）

1. **因果關係成立**：輸入是既有任務的「達成手段」
2. **粒度更細**：輸入的範圍比既有任務更小、更具體
3. **同一目標**：輸入和既有任務服務於同一個最終目標
4. **時間一致**：如果用戶輸入帶有明確時間意圖，目標任務的截止日期必須落在相同時間範圍內。時間不一致則不得追加，必須創建新任務

### 常見誤判情況（這些都是新任務）

- 「語意相關」≠「是子步驟」（封存 vs 封版，都有「封」字但無因果關係）
- 「同一專案」≠「是子步驟」（同一個 Product 下的兩件不同的事）
- 「時間相近」≠「是子步驟」（今天要做的兩件獨立的事）
- 用戶輸入帶有明確時間且與目標任務截止日不同天 → 絕對是新任務

### 判斷流程

\`\`\`
1. 找出最相關的既有任務
2. 🚨 時間衝突檢查：用戶輸入有明確時間 且 目標任務截止日不同天？→ 直接創建新任務
3. 執行因果關係測試：「完成 X 是達成 Y 的手段嗎？」
4. 如果測試失敗 → 創建新任務
5. 如果測試通過 → 再確認粒度是否更細
6. 全部通過 → 追加
\`\`\`

**預設行為**：有任何疑慮，創建新任務。追加是例外，不是常態。

**如果符合追加條件**：
→ 回傳 \`action: "append_sub_item"\`，指定 \`target_task_id\` 和新的 \`sub_items\`

**如果是新任務**：
→ 繼續往下，按照原有規則創建新任務

---

# 核心原則（創建新任務時使用）

## 1. Area 選擇（🚨 絕對禁止創建新 Area）
**規則：只能從既有 Areas 中選擇，絕對不能創建新的 Area**

## 2. Drawer 狀態（與 due_date 連動）
- **有填 due_date → 必須是 ACTIVE**
- **沒有 due_date → 必須是 INBOX**

---

# 背景資訊

今天：${todayStr} (星期${dayOfWeek})

${contextSummary}

---

# 用戶輸入

${userInput}

---

# 輸出格式

- 使用繁體中文
- due_date：ISO 8601 格式`
}

/**
 * 產生一個未來 N 天的日期字串（zh-TW locale）
 */
function futureDateStr(daysFromNow: number): string {
  const d = new Date()
  d.setDate(d.getDate() + daysFromNow)
  return d.toLocaleDateString('zh-TW')
}

function todayDateStr(): string {
  return new Date().toLocaleDateString('zh-TW')
}

describe('Brain Dump 追加 vs 新建判斷', () => {

  describe('時間衝突：用戶說「今天」但候選任務截止日不同天', () => {
    it('應該創建新任務，不追加到截止日為數天後的任務', async () => {
      const taskId = 'task-uuid-001'
      const futureDate = futureDateStr(4)

      const context = `
### 用戶的 Products 與任務:

**Area: 公司營運** (範圍: 公司設立與日常營運)
  📦 Product: 公司設立
     Topics: 行政流程
     未完成任務 (可追加 sub-item 的候選):
       - [${taskId}] 準備公司設立文件
         ⏰ 2 天前更新 | 狀態: ACTIVE | 截止: ${futureDate}
         已有的待辦項目:
           ☐ 準備章程草案
           ☐ 確認股東名冊
`

      const { object: result } = await generateObject({
        model: google('gemini-3.1-flash-lite-preview'),
        schema: StructureResultSchema,
        prompt: buildPrompt(context, '今天要去刻印章'),
      })

      console.log(`\n📝 輸入: "今天要去刻印章"`)
      console.log(`📋 AI 判斷: action=${result.action}`)
      if (result.action === 'create_new_tasks') {
        for (const item of result.items) {
          console.log(`   新任務: ${item.title} | drawer: ${item.drawer} | due_date: ${item.due_date || '無'}`)
        }
      } else {
        console.log(`   ❌ 追加到: ${result.target_task_id}`)
        console.log(`   reasoning: ${result.reasoning}`)
      }

      // 核心斷言：必須是創建新任務（不追加到截止日不同天的任務）
      expect(result.action).toBe('create_new_tasks')

      if (result.action === 'create_new_tasks') {
        expect(result.items.length).toBeGreaterThanOrEqual(1)
      }
    }, 30000)
  })

  describe('時間衝突：用戶說「明天」但候選任務截止日不同天', () => {
    it('應該創建新任務，不追加到截止日為一週後的任務', async () => {
      const taskId = 'task-uuid-002'
      const futureDate = futureDateStr(7)

      const context = `
### 用戶的 Products 與任務:

**Area: 工作** (範圍: 日常工作事務)
  📦 Product: 專案 Alpha
     Topics: 會議準備
     未完成任務 (可追加 sub-item 的候選):
       - [${taskId}] 準備下週客戶簡報
         ⏰ 1 天前更新 | 狀態: ACTIVE | 截止: ${futureDate}
         已有的待辦項目:
           ☐ 整理數據圖表
           ☐ 寫結案摘要
`

      const { object: result } = await generateObject({
        model: google('gemini-3.1-flash-lite-preview'),
        schema: StructureResultSchema,
        prompt: buildPrompt(context, '明天要交週報'),
      })

      console.log(`\n📝 輸入: "明天要交週報"`)
      console.log(`📋 AI 判斷: action=${result.action}`)
      if (result.action === 'create_new_tasks') {
        for (const item of result.items) {
          console.log(`   新任務: ${item.title} | drawer: ${item.drawer} | due_date: ${item.due_date || '無'}`)
        }
      } else {
        console.log(`   ❌ 追加到: ${result.target_task_id}`)
      }

      expect(result.action).toBe('create_new_tasks')
    }, 30000)
  })

  describe('合法追加：無時間衝突且有因果關係', () => {
    it('應該追加到既有任務（用戶輸入無時間詞，且是既有任務的子步驟）', async () => {
      const taskId = 'task-uuid-003'
      const futureDate = futureDateStr(3)

      const context = `
### 用戶的 Products 與任務:

**Area: 工作** (範圍: 日常工作事務)
  📦 Product: 專案 Alpha
     Topics: 技術開發
     未完成任務 (可追加 sub-item 的候選):
       - [${taskId}] 整理週報
         ⏰ 30 分鐘前更新 | 狀態: ACTIVE | 截止: ${futureDate}
         已有的待辦項目:
           ☐ 整理本週進度
           ☐ 統計 Bug 修復數
`

      const { object: result } = await generateObject({
        model: google('gemini-3.1-flash-lite-preview'),
        schema: StructureResultSchema,
        prompt: buildPrompt(context, '週報還要加上客戶回饋摘要'),
      })

      console.log(`\n📝 輸入: "週報還要加上客戶回饋摘要"`)
      console.log(`📋 AI 判斷: action=${result.action}`)
      if (result.action === 'append_sub_item') {
        console.log(`   ✅ 追加到: ${result.target_task_id}`)
        console.log(`   sub_items: ${result.sub_items.map(s => s.content).join(', ')}`)
      } else {
        console.log(`   新任務: ${result.items.map(i => i.title).join(', ')}`)
      }

      // 這個場景應該追加（無時間衝突 + 有因果關係）
      expect(result.action).toBe('append_sub_item')
      if (result.action === 'append_sub_item') {
        expect(result.target_task_id).toBe(taskId)
        expect(result.sub_items.length).toBeGreaterThanOrEqual(1)
      }
    }, 30000)
  })

  describe('語意相關但無因果關係：應創建新任務', () => {
    it('語意相近但獨立的事項不應追加', async () => {
      const taskId = 'task-uuid-004'

      const context = `
### 用戶的 Products 與任務:

**Area: 公司營運** (範圍: 公司設立與日常營運)
  📦 Product: 公司設立
     Topics: 行政流程
     未完成任務 (可追加 sub-item 的候選):
       - [${taskId}] 準備公司設立文件
         ⏰ 1 天前更新 | 狀態: ACTIVE | 截止: ${futureDateStr(5)}
         已有的待辦項目:
           ☐ 準備章程草案
           ☐ 確認股東名冊
`

      const { object: result } = await generateObject({
        model: google('gemini-3.1-flash-lite-preview'),
        schema: StructureResultSchema,
        prompt: buildPrompt(context, '封存舊版公司網站'),
      })

      console.log(`\n📝 輸入: "封存舊版公司網站"`)
      console.log(`📋 AI 判斷: action=${result.action}`)

      // 「封存舊版網站」和「公司設立文件」語意相關但無因果關係
      expect(result.action).toBe('create_new_tasks')
    }, 30000)
  })
})
