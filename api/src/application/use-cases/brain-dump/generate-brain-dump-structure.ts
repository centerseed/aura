/**
 * GenerateBrainDumpStructureUseCase - 生成 Brain Dump 結構化結果
 *
 * Application Layer Use Case
 * 並行執行 embedding + librarian recall → SQL 查詢取得上下文 →
 * 構建 context summary → 呼叫 AI generateObject
 */

import { google } from "@ai-sdk/google"
import { generateObject } from "ai"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { Prisma } from "@prisma/client"
import { isValidUUID } from "@/domain/constants/validation"
import { getEmbedding } from "@/lib/embedding"
import { librarianRecall, LibrarianRule } from "@/lib/librarian-client"

// ============================================================================
// Zod Schemas (moved from route)
// ============================================================================

const SubItemSchema = z.object({
  content: z.string().max(100).describe("Sub-item 內容（最多 100 字元）"),
})

const SourceAttributionSchema = z.object({
  source_type: z.enum(["explicit", "inferred_from_context", "inferred_from_system"])
    .describe("explicit=用戶明說, inferred_from_context=從輸入推斷, inferred_from_system=從系統資料推斷"),
  confidence: z.number().min(0).max(1).describe("信心度 0-1"),
  reasoning: z.string().max(80).describe("簡要說明推斷理由（最多 80 字元）"),
})

const TaskTypeSchema = z.enum(["waiting", "booking", "preparation", "execution"])
  .describe("waiting=需等待處理(7-14天), booking=需預約(5-7天), preparation=資料準備(3-5天), execution=簡單執行(1-2天)")

const StructuredItemSchema = z.object({
  title: z.string().max(50).describe("簡潔的任務標題（最多 50 字元）"),
  narrative: z.string().max(100).describe("任務的簡要背景描述（最多 100 字元）"),
  drawer: z.enum(["INBOX", "ACTIVE", "MAINTAIN", "REFERENCE", "ARCHIVE"])
    .describe("Status drawer based on urgency"),
  lifecycle: z.enum(["FINITE", "PERPETUAL"])
    .describe("finite = project with deadline, perpetual = ongoing maintenance"),
  tag: z.object({
    area: z.string().max(30).describe("領域名稱（最多 30 字元）- 必須從既有 Areas 選擇"),
    product: z.string().max(50).describe("專案名稱（最多 50 字元）- 優先使用既有 Product"),
    topic: z.string().max(50).describe("主題名稱（最多 50 字元）- 必須盡量填寫，優先使用既有 Topic 或創建合適的新名稱，只有真正無法歸類時才填空字串"),
  }),
  strategy_used: z.string().max(50).describe("Classification strategy: boundary_match, semantic_anchor, new_structure"),
  reasoning: z.string().max(100).describe("簡短說明分類理由（1 句話，最多 100 字元）"),
  due_date: z.string().datetime({ offset: true }).optional().describe("推斷的截止日期（ISO 8601 格式）- 只要能推斷出時間就必須填寫"),
  due_date_source: SourceAttributionSchema.optional().describe("時間來源歸因 - 區分 explicit/inferred"),
  inferred_from_milestone: z.string().optional().describe("關聯的 Milestone ID（僅當任務與某里程碑相關時填寫）"),
  task_type: TaskTypeSchema.optional().describe("任務類型 - 用於計算需要提前多少天完成"),
  estimated_days_needed: z.number().min(1).max(30).optional().describe("AI 估算完成此任務需要的天數（包含等待時間）"),
  depends_on_task: z.string().max(50).optional().describe("如果此任務依賴同批次的其他任務，填入該任務的 title"),
  time_confidence: z.number().min(0).max(1).optional().describe("Confidence score for time inference (0-1)"),
  sub_items: z.array(SubItemSchema).optional().describe("如果任務包含多個可獨立勾選的步驟/項目，拆成 sub-items - 不可遺漏用戶提到的任何事項"),
})

const AppendSubItemActionSchema = z.object({
  action: z.literal("append_sub_item"),
  target_task_id: z.string().describe("要追加到的任務 ID"),
  sub_items: z.array(SubItemSchema).describe("要追加的待辦事項清單"),
  reasoning: z.string().max(100).describe("簡要說明為什麼判斷這是追加而非新任務（1 句話，最多 100 字元）"),
})

const CreateNewTasksActionSchema = z.object({
  action: z.literal("create_new_tasks"),
  items: z.array(StructuredItemSchema),
})

const StructureResultSchema = z.discriminatedUnion("action", [
  AppendSubItemActionSchema,
  CreateNewTasksActionSchema,
])

export type StructuredItem = z.infer<typeof StructuredItemSchema>
export type StructureResult = z.infer<typeof StructureResultSchema>

// ============================================================================
// Types
// ============================================================================

export type Milestone = {
  id: string
  name: string
  target_date: Date
  description?: string | null
  [key: string]: any
}

type CombinedResult = {
  data_type: string
  area_id: string | null
  area_name: string | null
  area_scope: string | null
  product_id: string | null
  product_name: string | null
  product_similarity: number | null
  topic_id: string | null
  topic_name: string | null
  task_id: string | null
  task_content: string | null
  task_status: string | null
  task_sub_items: any
  task_updated_at: Date | null
  task_due_date: Date | null
  milestone_id: string | null
  milestone_name: string | null
  milestone_description: string | null
  milestone_target_date: Date | null
  milestone_status: string | null
}

export interface ExistingArea {
  id: string
  name: string
  scope: string | null
  products: Array<{
    id: string
    name: string
    topics: Array<{ id: string; name: string }>
    tasks: Array<{ id: string; content: string; status: string; sub_items: any; updated_at: Date; due_date: Date | null }>
  }>
}

// ============================================================================
// DTOs
// ============================================================================

export interface GenerateBrainDumpStructureRequest {
  userId: string
  text: string
  cleanedText: string
  explicitProductId: string | null
}

export interface GenerateBrainDumpStructureResponse {
  result: StructureResult
  milestones: Milestone[]
  existingAreas: ExistingArea[]
  timings: Record<string, number>
}

// ============================================================================
// Use Case
// ============================================================================

export class GenerateBrainDumpStructureUseCase {
  async execute(
    request: GenerateBrainDumpStructureRequest
  ): Promise<GenerateBrainDumpStructureResponse> {
    const timings: Record<string, number> = {}
    const now = new Date()
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 90)

    // Step 1: embedding + Librarian recall + 巨型 SQL（盡量並行）
    const startParallel = Date.now()

    // embedding（如果有 explicitProductId 則跳過）
    const embeddingPromise = request.explicitProductId
      ? Promise.resolve(null)
      : getEmbedding(request.cleanedText)

    // librarian rules（直接查 DB，不走 HTTP）
    const recallPromise = librarianRecall({ userId: request.userId })

    // 等 embedding 完成後才能跑 main SQL（需要 vector）
    const userEmbedding = await embeddingPromise
    timings["embedding"] = Date.now() - startParallel

    const vectorStr = userEmbedding ? `[${userEmbedding.join(",")}]` : null

    // main SQL + librarian recall 並行（recall 可能已完成或仍在跑）
    const mainQueryPromise = prisma.$queryRaw<CombinedResult[]>`
      WITH
      relevant_products AS (
        SELECT
          id,
          name,
          ${vectorStr ? Prisma.sql`1 - (embedding <=> ${vectorStr}::vector)` : Prisma.sql`1.0`} as similarity
        FROM products
        WHERE user_id = ${request.userId}::uuid
          AND deleted_at IS NULL
          ${request.explicitProductId
            ? Prisma.sql`AND id = ${request.explicitProductId}::uuid`
            : vectorStr
              ? Prisma.sql`AND embedding IS NOT NULL ORDER BY embedding <=> ${vectorStr}::vector LIMIT 4`
              : Prisma.sql`LIMIT 10`
          }
      ),
      ranked_tasks AS (
        SELECT
          t.*,
          ROW_NUMBER() OVER (PARTITION BY t.product_id ORDER BY t.updated_at DESC) as row_num
        FROM tasks t
        WHERE t.deleted_at IS NULL
          AND t.status != 'ARCHIVE'
          AND t.user_id = ${request.userId}::uuid
      ),
      main_data AS (
        SELECT
          'main'::text as data_type,
          a.id::text as area_id,
          a.name as area_name,
          a.scope as area_scope,
          p.id::text as product_id,
          p.name as product_name,
          rp.similarity as product_similarity,
          top.id::text as topic_id,
          top.name as topic_name,
          rt.id::text as task_id,
          rt.content as task_content,
          rt.status::text as task_status,
          NULL::json as task_sub_items,
          rt.updated_at as task_updated_at,
          rt.due_date as task_due_date,
          NULL::text as milestone_id,
          NULL::text as milestone_name,
          NULL::text as milestone_description,
          NULL::timestamp as milestone_target_date,
          NULL::text as milestone_status
        FROM areas a
        LEFT JOIN products p ON p.area_id = a.id AND p.deleted_at IS NULL
        LEFT JOIN relevant_products rp ON rp.id = p.id
        LEFT JOIN topics top ON top.product_id = p.id AND top.deleted_at IS NULL
        LEFT JOIN ranked_tasks rt ON rt.product_id = p.id AND rt.row_num <= 5
        WHERE a.user_id = ${request.userId}::uuid
          AND a.deleted_at IS NULL
          AND (rp.id IS NOT NULL OR p.id IS NULL)
      ),
      milestone_data AS (
        SELECT
          'milestone'::text as data_type,
          NULL::text as area_id,
          NULL::text as area_name,
          NULL::text as area_scope,
          NULL::text as product_id,
          NULL::text as product_name,
          NULL::float8 as product_similarity,
          NULL::text as topic_id,
          NULL::text as topic_name,
          NULL::text as task_id,
          NULL::text as task_content,
          NULL::text as task_status,
          NULL::json as task_sub_items,
          NULL::timestamp as task_updated_at,
          NULL::timestamp as task_due_date,
          id::text as milestone_id,
          name as milestone_name,
          description as milestone_description,
          target_date as milestone_target_date,
          status::text as milestone_status
        FROM milestones
        WHERE user_id = ${request.userId}::uuid
          AND deleted_at IS NULL
          AND target_date >= ${now}
          AND target_date <= ${futureDate}
          AND status IN ('planned', 'in_progress')
      )
      SELECT * FROM main_data
      UNION ALL
      SELECT * FROM milestone_data
      ORDER BY data_type DESC, product_similarity DESC NULLS LAST, area_name, product_name
    `

    // 等待 main SQL + librarian recall 並行完成
    const [combinedResults, librarianRules] = await Promise.all([mainQueryPromise, recallPromise])
    timings["db_and_recall_parallel"] = Date.now() - startParallel

    if (librarianRules.length > 0) {
      console.log(`📚 [brain-dump] Librarian recalled ${librarianRules.length} rules`)
    }

    // 解析合併結果
    const rawStructure: Array<{
      area_id: string
      area_name: string
      area_scope: string | null
      product_id: string | null
      product_name: string | null
      topic_id: string | null
      topic_name: string | null
      task_id: string | null
      task_content: string | null
      task_status: string | null
      task_sub_items: any
      task_updated_at: Date | null
      task_due_date: Date | null
    }> = []

    const milestones: Milestone[] = []
    const relevantProducts: Array<{ id: string; name: string; similarity: number }> = []
    const seenProducts = new Set<string>()

    for (const row of combinedResults) {
      if (row.data_type === 'main' && row.area_id) {
        rawStructure.push({
          area_id: row.area_id,
          area_name: row.area_name!,
          area_scope: row.area_scope,
          product_id: row.product_id,
          product_name: row.product_name,
          topic_id: row.topic_id,
          topic_name: row.topic_name,
          task_id: row.task_id,
          task_content: row.task_content,
          task_status: row.task_status,
          task_sub_items: row.task_sub_items,
          task_updated_at: row.task_updated_at,
          task_due_date: row.task_due_date,
        })
        if (row.product_id && row.product_similarity && !seenProducts.has(row.product_id)) {
          seenProducts.add(row.product_id)
          relevantProducts.push({
            id: row.product_id,
            name: row.product_name!,
            similarity: row.product_similarity,
          })
        }
      } else if (row.data_type === 'milestone' && row.milestone_id) {
        milestones.push({
          id: row.milestone_id,
          name: row.milestone_name!,
          description: row.milestone_description,
          target_date: row.milestone_target_date!,
        } as Milestone)
      }
    }

    if (relevantProducts.length > 0 && !request.explicitProductId) {
      console.log(
        `🔍 [brain-dump] Found ${relevantProducts.length} relevant Products (${timings["embedding"]}ms embedding):`,
        relevantProducts.map(r => `${r.name} (${(r.similarity * 100).toFixed(0)}%)`).join(", ")
      )
    }

    // 重建嵌套結構
    const areaMap = new Map<string, {
      id: string
      name: string
      scope: string | null
      products: Map<string, {
        id: string
        name: string
        topics: Array<{ id: string; name: string }>
        tasks: Array<{ id: string; content: string; status: string; sub_items: any; updated_at: Date; due_date: Date | null }>
      }>
    }>()

    for (const row of rawStructure) {
      if (!areaMap.has(row.area_id)) {
        areaMap.set(row.area_id, {
          id: row.area_id,
          name: row.area_name,
          scope: row.area_scope,
          products: new Map(),
        })
      }
      const area = areaMap.get(row.area_id)!

      if (row.product_id && row.product_name) {
        if (!area.products.has(row.product_id)) {
          area.products.set(row.product_id, {
            id: row.product_id,
            name: row.product_name,
            topics: [],
            tasks: [],
          })
        }
        const product = area.products.get(row.product_id)!

        if (row.topic_id && row.topic_name) {
          if (!product.topics.some(t => t.id === row.topic_id)) {
            product.topics.push({ id: row.topic_id, name: row.topic_name })
          }
        }

        if (row.task_id && row.task_content) {
          if (!product.tasks.some(t => t.id === row.task_id)) {
            product.tasks.push({
              id: row.task_id,
              content: row.task_content,
              status: row.task_status || 'INBOX',
              sub_items: [], // populated below from sub_tasks table
              updated_at: row.task_updated_at || new Date(),
              due_date: row.task_due_date,
            })
          }
        }
      }
    }

    // Batch query sub_tasks for all collected task IDs
    const allTaskIds: string[] = []
    for (const area of areaMap.values()) {
      for (const product of area.products.values()) {
        for (const task of product.tasks) {
          allTaskIds.push(task.id)
        }
      }
    }

    if (allTaskIds.length > 0) {
      const subTasks = await prisma.subTask.findMany({
        where: { task_id: { in: allTaskIds }, deleted_at: null },
        orderBy: { order: 'asc' },
        select: { task_id: true, id: true, content: true, completed: true },
      })

      const subTasksByTaskId = new Map<string, typeof subTasks>()
      for (const st of subTasks) {
        const list = subTasksByTaskId.get(st.task_id) || []
        list.push(st)
        subTasksByTaskId.set(st.task_id, list)
      }

      for (const area of areaMap.values()) {
        for (const product of area.products.values()) {
          for (const task of product.tasks) {
            task.sub_items = (subTasksByTaskId.get(task.id) || []).slice(0, 2)
          }
        }
      }
    }

    let existingAreas: ExistingArea[] = Array.from(areaMap.values()).map(area => ({
      ...area,
      products: Array.from(area.products.values()),
    }))

    // 如果沒有 Area，自動創建預設
    if (existingAreas.length === 0) {
      console.log(`📦 [brain-dump] No Areas found, auto-creating default Area "一般"`)
      const defaultArea = await prisma.area.create({
        data: {
          user_id: request.userId,
          name: "一般",
          description: "系統自動建立的預設領域",
          is_custom: false,
          scope: "個人事務與日常任務",
        },
      })
      existingAreas = [{
        id: defaultArea.id,
        name: defaultArea.name,
        scope: defaultArea.scope,
        products: [],
      }]
    }

    // timings already recorded above in db_and_recall_parallel

    // Step 3: 動態預算分配
    const MAX_CONTEXT_ITEMS = 100
    const totalProducts = existingAreas.reduce((sum, area) => sum + area.products.length, 0)

    let tasksPerProduct = 1
    let subItemsPerTask = 1

    if (totalProducts > 0) {
      tasksPerProduct = Math.max(1, Math.min(5, Math.floor(MAX_CONTEXT_ITEMS / totalProducts)))
      const totalTaskBudget = totalProducts * tasksPerProduct
      const remainingBudget = MAX_CONTEXT_ITEMS - totalTaskBudget
      subItemsPerTask = Math.max(1, Math.min(2, Math.floor(remainingBudget / totalTaskBudget)))
    }

    console.log(`📊 [brain-dump] Dynamic budget: ${totalProducts} Products × ${tasksPerProduct} tasks × ${subItemsPerTask} sub_items = ~${totalProducts * tasksPerProduct * (1 + subItemsPerTask)} items`)

    // 構建上下文摘要
    let contextSummary = ""
    if (existingAreas.length > 0) {
      const hasProducts = existingAreas.some(a => a.products.length > 0)

      if (hasProducts) {
        contextSummary = "\n### 用戶的 Products 與任務:\n\n"
      } else {
        contextSummary = "\n### 用戶尚無任何專案\n"
      }

      contextSummary += `\n**可用的 Areas**: ${existingAreas.map(a => a.name).join(", ")}\n`

      for (const area of existingAreas) {
        if (area.products.length === 0) continue

        contextSummary += `\n**Area: ${area.name}** (範圍: ${area.scope || "未定義"})\n`

        for (const product of area.products) {
          contextSummary += `  📦 Product: ${product.name}\n`

          if (product.topics.length > 0) {
            contextSummary += `     Topics: ${product.topics.map(t => t.name).join(", ")}\n`
          }

          const limitedTasks = (product.tasks || []).slice(0, tasksPerProduct)
          if (limitedTasks.length > 0) {
            contextSummary += `     未完成任務 (可追加 sub-item 的候選):\n`
            for (const task of limitedTasks) {
              const updatedAgo = Math.floor((Date.now() - new Date(task.updated_at).getTime()) / 60000)
              const timeDisplay = updatedAgo < 60
                ? `${updatedAgo} 分鐘前更新`
                : updatedAgo < 1440
                  ? `${Math.floor(updatedAgo / 60)} 小時前更新`
                  : `${Math.floor(updatedAgo / 1440)} 天前更新`

              const dueDateDisplay = task.due_date
                ? new Date(task.due_date).toLocaleDateString("zh-TW")
                : "無期限"

              contextSummary += `       - [${task.id}] ${task.content}\n`
              contextSummary += `         ⏰ ${timeDisplay} | 狀態: ${task.status} | 截止: ${dueDateDisplay}\n`

              if (task.sub_items && subItemsPerTask > 0) {
                const subItems = task.sub_items as Array<{
                  id: string
                  content: string
                  completed: boolean
                }>
                const limitedSubItems = subItems.slice(0, subItemsPerTask)
                if (limitedSubItems.length > 0) {
                  contextSummary += `         已有的待辦項目:\n`
                  for (const subItem of limitedSubItems) {
                    const checkbox = subItem.completed ? '✅' : '☐'
                    contextSummary += `           ${checkbox} ${subItem.content}\n`
                  }
                }
              }
            }
          } else {
            contextSummary += `     未完成任務: (無，這是新專案)\n`
          }
        }
      }
      contextSummary += "\n"
    }

    // Milestone 資訊
    if (milestones.length > 0) {
      contextSummary += "\n### 用戶設定的里程碑（未來 90 天）:\n"
      contextSummary += `今天日期：${now.toLocaleDateString("zh-TW")} (星期${['日', '一', '二', '三', '四', '五', '六'][now.getDay()]})\n\n`

      for (const milestone of milestones) {
        const targetDate = new Date(milestone.target_date)
        const daysUntil = Math.ceil((targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

        contextSummary += `🎯 **${milestone.name}** [ID: ${milestone.id}]\n`
        contextSummary += `   - 目標日期：${targetDate.toLocaleDateString("zh-TW")} (${daysUntil} 天後)\n`
        if (milestone.description) {
          contextSummary += `   - 描述：${milestone.description}\n`
        }
        contextSummary += "\n"
      }
    }

    // Librarian 規則提示
    let librarianHints = ""
    if (librarianRules.length > 0) {
      librarianHints = "\n### 📚 Librarian 學習規則（用戶過去的分類修正，優先級高於語意推斷）\n\n"
      for (const rule of librarianRules) {
        librarianHints += `- 當輸入類似「${rule.pattern}」→ 應分類為「${rule.correction}」(信心度: ${(rule.confidence * 100).toFixed(0)}%)\n`
      }
      librarianHints += "\n**重要**：這些規則來自用戶的實際修正，代表用戶的真實意圖。當規則與語意推斷衝突時，優先使用規則。\n"
    }

    // Step 4: 呼叫 AI
    const startAI = Date.now()
    const { object: result } = await generateObject({
      model: google("gemini-2.5-flash-lite"),
      schema: StructureResultSchema,
      prompt: `你是任務記錄專家。將用戶輸入轉成結構化的 Task。

# 🔥 最優先判斷：是追加還是新任務？

## 核心判斷原則：因果關係測試

**唯一判斷標準**：問自己這個問題——

> 「完成【用戶輸入】是否是達成【既有任務】的必要手段？」

- 如果答案是「是」→ 追加
- 如果答案是「否」或「不確定」→ 新任務

### 因果關係測試範例

| 用戶輸入 | 既有任務 | 測試問題 | 答案 | 結果 |
|---------|---------|---------|------|------|
| 買菜 | 準備晚餐 | 「買菜」是達成「準備晚餐」的手段嗎？ | ✅ 是 | 追加 |
| 發郵件 | 週報：整理資料、發郵件 | 「發郵件」是達成「週報」的手段嗎？ | ✅ 是 | 追加 |
| 封存專案 | 封版與測試 | 「封存專案」是達成「封版與測試」的手段嗎？ | ❌ 否 | 新任務 |
| 修 bug | 開發新功能 | 「修 bug」是達成「開發新功能」的手段嗎？ | ❌ 否 | 新任務 |
| 優化效能 | 修復登入問題 | 「優化效能」是達成「修復登入問題」的手段嗎？ | ❌ 否 | 新任務 |

### 追加的必要條件（全部滿足才追加）

1. **因果關係成立**：輸入是既有任務的「達成手段」
2. **粒度更細**：輸入的範圍比既有任務更小、更具體
3. **同一目標**：輸入和既有任務服務於同一個最終目標
4. **時間一致**：如果用戶輸入帶有明確時間意圖，目標任務的截止日期必須落在相同時間範圍內。時間不一致則不得追加，必須創建新任務

### 常見誤判情況（這些都是新任務）

- 「語意相關」≠「是子步驟」（封存 vs 封版，都有「封」字但無因果關係）
- 「同一專案」≠「是子步驟」（同一個 Product 下的兩件不同的事）
- 「時間相近」≠「是子步驟」（今天要做的兩件獨立的事）

### 判斷流程

\`\`\`
1. 找出最相關的既有任務
2. 執行因果關係測試：「完成 X 是達成 Y 的手段嗎？」
3. 如果測試失敗 → 創建新任務
4. 如果測試通過 → 再確認粒度是否更細
5. 兩個都通過 → 追加
\`\`\`

**預設行為**：有任何疑慮，創建新任務。追加是例外，不是常態。

**如果符合追加條件**：
→ 回傳 \`action: "append_sub_item"\`，指定 \`target_task_id\` 和新的 \`sub_items\`

**如果是新任務**：
→ 繼續往下，按照原有規則創建新任務

---

${request.explicitProductId ? `# 🚨 用戶明確指定了 Product

用戶在輸入中使用了 @Product 標記，系統已識別並**強制鎖定**到該專案。

**絕對規則**：
- 只能追加到該 Product 下的任務
- 創建新任務時，必須使用該 Product
- 不可將任務歸類到其他 Product，即使語意上更相似
- 這是用戶的明確指令，優先級最高

系統已自動篩選，你看到的任務列表**只包含該 Product 的任務**。

---

` : ''}
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
問自己：**「用戶說的這些事，可以分別勾掉嗎？」**
- 可以分別勾掉 → 拆成 sub_items
- 不能分別勾掉 → 放在 narrative

**🚨 禁止只有 1 個 sub-item**
- 如果只有一件事，那就是任務本身，不需要 sub-item
- sub_items 至少要有 2 個，否則留空不要拆

## 3. Area 選擇（🚨 絕對禁止創建新 Area）
**規則：只能從既有 Areas 中選擇，絕對不能創建新的 Area**

問自己：**「這個任務屬於哪個既有的 Area？」**
- 查看上下文中列出的所有 Areas
- 選擇最相關的既有 Area
- 如果不確定，選擇最通用的那個 Area
- **絕對禁止**填入不存在的 Area 名稱

## 4. Product 選擇
問自己：**「這個新任務和哪個 Product 的現有任務最像？」**
- 看每個 Product 下的「最近任務」
- 選擇任務類型最相似的 Product
- 可以在既有 Area 下創建新 Product（如果沒有匹配的）

## 5. Topic 選擇（🔥 必須盡量填寫）

**規則：Topic 是任務分類的重要維度，必須積極分配**

問自己三個問題：

1. **這個任務和哪個既有 Topic 最相關？**
   - 查看該 Product 下所有既有的 Topics
   - 如果任務內容與某個 Topic 語意相關 → 使用該 Topic
   - 例：任務「修復登入頁面 bug」，Product 下有 Topic「技術維護」→ 使用「技術維護」

2. **如果沒有相關的既有 Topic，應該創建什麼？**
   - 根據任務性質創建合理的 Topic 名稱
   - 好的 Topic 命名：「技術開發」「客戶溝通」「財務處理」「行銷活動」「產品規劃」
   - 避免太籠統的命名：「其他」「雜項」「一般」

3. **什麼情況可以留空？**
   - **只有當任務真的無法歸類時**才填 ""
   - 這應該是極少數情況（< 10%）

**Topic 命名原則：**
- 使用 2-4 字的中文名詞短語
- 描述任務的「類型」或「面向」，不是具體內容
- 範例：「內部協調」「外部溝通」「系統維護」「資料分析」「流程優化」

## 4. 時間推斷

**規則：只要你能推斷出時間，就必須填 due_date**

- 用戶說「今天」「明天」「週五」「1/30」→ 填 due_date
- 從上下文推斷出時間（如「週報通常週五發」）→ 填 due_date
- 任務與里程碑相關 → 填 due_date + inferred_from_milestone + task_type + estimated_days_needed

due_date 格式：ISO 8601，如 2026-02-07T00:00:00+08:00

**task_type**（當任務與里程碑相關時填寫）：
- waiting：需等待結果
- booking：需預約
- preparation：需準備
- execution：可立即執行

## 5. Drawer 狀態（與 due_date 連動）
- **有填 due_date → 必須是 ACTIVE**（有明確期限，需要追蹤進度）
- **沒有 due_date → 必須是 INBOX**（還沒決定什麼時候做）
- **例行性/週期性任務 → MAINTAIN**（穩定運作中，異常時才需關注）

---

# 背景資訊

今天：${now.toLocaleDateString("zh-TW")} (星期${['日', '一', '二', '三', '四', '五', '六'][now.getDay()]})

${contextSummary}
${librarianHints}
---

# 用戶輸入

${request.text}

---

# 輸出格式與長度限制（嚴格遵守）

**字元數限制：**
- title：≤ 50 字元（動詞 + 目標，去掉冗詞）
- narrative：≤ 100 字元（任務背景描述，精簡重點）
- reasoning：≤ 100 字元（1 句話說明分類依據）
- due_date_source.reasoning：≤ 80 字元（1 句話說明時間推斷，使用 due_date_source 結構）
- sub_item.content：≤ 100 字元（簡短的待辦事項）
- tag.area/product/topic：≤ 30/50/50 字元

**格式要求：**
- 使用繁體中文
- due_date：ISO 8601 格式（例：2026-01-30T00:00:00+08:00）
- tag.topic：字串，**必須盡量填寫**（優先使用既有 Topic，或創建合適的新名稱）

**寫作原則：**
- 精簡優先：每個字都要有意義
- reasoning 範例：「提到專案名稱，判斷為工作相關」
- narrative 範例：「整理本週功能，準備週報給主管」（≤ 100 字）
- 如果用戶提供了大量細節，提煉最重要的資訊`,
    })
    timings["ai_generateObject"] = Date.now() - startAI

    return {
      result,
      milestones,
      existingAreas,
      timings,
    }
  }
}
