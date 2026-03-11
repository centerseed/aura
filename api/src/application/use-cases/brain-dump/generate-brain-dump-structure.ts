/**
 * GenerateBrainDumpStructureUseCase - 生成 Brain Dump 結構化結果
 *
 * Application Layer Use Case
 * 並行執行 embedding + librarian recall → SQL 查詢取得上下文 →
 * 構建 context summary → 呼叫 AI generateObject
 */

import { google } from "@ai-sdk/google"
import { createOpenAI } from "@ai-sdk/openai"
import { resilientGenerateObject } from "@/lib/ai-resilient"
import { z } from "zod"
import { isSingleConnectionPool, prisma } from "@/lib/db"
import { getEmbedding } from "@/lib/embedding"
import { librarianRecall, LibrarianRule } from "@/lib/librarian-client"
import { ValidationException } from "@/lib/api-response"
import type { AiTokenUsage } from "@/lib/ai-rate-limit"

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
  narrative: z.string().max(500).describe("完整保留用戶記錄的背景脈絡與細節（最多 500 字元）"),
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
  inferred_from_milestone: z.string().optional().describe("關聯的里程碑名稱（如「成立公司」）—— 填入里程碑的名稱文字，不是 ID"),
  task_type: TaskTypeSchema.optional().describe("任務類型 - 用於計算需要提前多少天完成"),
  estimated_days_needed: z.number().min(0.25).max(365).optional().describe("AI 估算完成此任務需要的天數（包含等待時間），最小值為 0.25（即 2 小時）"),
  depends_on_task: z.string().max(50).optional().describe("如果此任務依賴同批次的其他任務，填入該任務的 title"),
  time_confidence: z.number().min(0).max(1).optional().describe("Confidence score for time inference (0-1)"),
  sub_items: z.array(SubItemSchema).max(20).optional().describe("【清單模式強制填寫】當輸入格式為「主題：A、B、C」或「主題：1. A 2. B」時，必須將列表中的每個項目填入 sub_items，禁止將它們合併到 narrative。每個 sub-item 使用用戶的原話。最多 20 個，超過時只取前 20 個最重要的。"),
})

const StructureResultSchema = z.object({
  action: z.enum(["create_new_tasks", "append_sub_item"])
    .describe("create_new_tasks = 建立新任務；append_sub_item = 追加到現有任務"),
  // create_new_tasks 時填寫
  items: z.array(StructuredItemSchema).optional()
    .describe("action=create_new_tasks 時必填：要建立的任務清單"),
  // append_sub_item 時填寫
  target_task_ids: z.array(z.string().uuid()).min(1).optional()
    .describe("action=append_sub_item 時必填：要追加到的任務 UUID 陣列（一或多個），只能使用背景資訊中格式為 '- [uuid]' 的 UUID。若用戶要追加到多個任務，填入所有目標的 UUID 陣列，例如 [\"uuid1\", \"uuid2\"]。"),
  sub_items: z.array(SubItemSchema).optional()
    .describe("action=append_sub_item 時必填：要追加的待辦事項清單"),
  reasoning: z.string().max(100).optional()
    .describe("action=append_sub_item 時必填：簡要說明為什麼判斷這是追加而非新任務"),
})

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

export interface ExistingArea {
  id: string
  name: string
  scope: string | null
  products: Array<{
    id: string
    name: string
    topics: Array<{ id: string; name: string }>
    tasks: Array<{ id: string; content: string; status: string; sub_items: any; updated_at: Date; due_date: Date | null; task_similarity?: number | null }>
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
  sessionContext?: string[]
}

export interface GenerateBrainDumpStructureResponse {
  result: StructureResult
  milestones: Milestone[]
  existingAreas: ExistingArea[]
  timings: Record<string, number>
  usage?: AiTokenUsage
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

    // ========================================================================
    // Two-Stage Retrieval
    // ========================================================================

    // Stage 1: Product Selection (uses blueprint_embedding with fallback to embedding)
    type ProductCandidate = { id: string; name: string; area_id: string; similarity: number }

    const stage1Promise = request.explicitProductId
      ? prisma.$queryRaw<ProductCandidate[]>`
          SELECT p.id::text, p.name, p.area_id::text, 1.0::float8 as similarity
          FROM products p
          WHERE p.id = ${request.explicitProductId}::uuid AND p.deleted_at IS NULL
        `
      : vectorStr
        ? prisma.$queryRawUnsafe<ProductCandidate[]>(
            `SELECT p.id::text, p.name, p.area_id::text,
                    1 - (COALESCE(p.blueprint_embedding, p.embedding) <=> $1::vector) as similarity
             FROM products p
             WHERE p.user_id = $2::uuid
               AND p.deleted_at IS NULL
               AND COALESCE(p.blueprint_embedding, p.embedding) IS NOT NULL
             ORDER BY COALESCE(p.blueprint_embedding, p.embedding) <=> $1::vector
             LIMIT 3`,
            vectorStr, request.userId
          )
        : prisma.$queryRaw<ProductCandidate[]>`
            SELECT p.id::text, p.name, p.area_id::text, 1.0::float8 as similarity
            FROM products p
            WHERE p.user_id = ${request.userId}::uuid AND p.deleted_at IS NULL
            LIMIT 10
          `

    // Milestone query (parallel)
    const milestonePromise = prisma.$queryRaw<Milestone[]>`
      SELECT id::text, name, description, target_date, status::text
      FROM milestones
      WHERE user_id = ${request.userId}::uuid
        AND deleted_at IS NULL
        AND target_date >= ${now}
        AND target_date <= ${futureDate}
        AND status IN ('planned', 'in_progress')
    `

    // 單連線測試/Cloud Run 模式下不能把多個 Prisma 查詢丟進 Promise.all，
    // 否則很容易因 connection_limit=1 直接把自己塞爆。
    const [productCandidates, milestones, librarianRules] = isSingleConnectionPool()
      ? [
          await stage1Promise,
          await milestonePromise,
          await recallPromise,
        ]
      : await Promise.all([
          stage1Promise, milestonePromise, recallPromise,
        ])
    timings["stage1_and_recall"] = Date.now() - startParallel

    if (librarianRules.length > 0) {
      console.log(`📚 [brain-dump] Librarian recalled ${librarianRules.length} rules`)
    }

    const relevantProducts = productCandidates.map(r => ({
      id: r.id, name: r.name, area_id: r.area_id, similarity: Number(r.similarity),
    }))

    if (relevantProducts.length > 0 && !request.explicitProductId) {
      console.log(
        `🔍 [brain-dump] Stage 1: ${relevantProducts.length} Products (${timings["embedding"]}ms embedding):`,
        relevantProducts.map(r => `${r.name} (${(r.similarity * 100).toFixed(0)}%)`).join(", ")
      )
    }

    // Stage 2: Focused task fetch for selected products + task similarity
    const selectedProductIds = productCandidates.map(p => p.id)

    type TaskRow = {
      id: string; content: string; status: string; updated_at: Date; due_date: Date | null
      product_id: string; task_similarity: number | null
    }

    let stage2Tasks: TaskRow[] = []
    let topTaskSimilarity = 0
    let topSimilarTask: { id: string; content: string; productName: string; similarity: number } | null = null

    if (selectedProductIds.length > 0) {
      const startStage2 = Date.now()
      stage2Tasks = vectorStr
        ? await prisma.$queryRaw<TaskRow[]>`
            SELECT t.id::text, t.content, t.status::text, t.updated_at, t.due_date,
                   t.product_id::text,
                   CASE WHEN t.embedding IS NOT NULL
                     THEN 1 - (t.embedding <=> ${vectorStr}::vector)
                     ELSE NULL
                   END as task_similarity
            FROM tasks t
            WHERE t.product_id = ANY(${selectedProductIds}::uuid[])
              AND t.deleted_at IS NULL AND t.status != 'ARCHIVE'
            ORDER BY t.updated_at DESC
            LIMIT 30
          `
        : await prisma.$queryRaw<TaskRow[]>`
            SELECT t.id::text, t.content, t.status::text, t.updated_at, t.due_date,
                   t.product_id::text, NULL::float8 as task_similarity
            FROM tasks t
            WHERE t.product_id = ANY(${selectedProductIds}::uuid[])
              AND t.deleted_at IS NULL AND t.status != 'ARCHIVE'
            ORDER BY t.updated_at DESC
            LIMIT 30
          `
      timings["stage2_tasks"] = Date.now() - startStage2

      // Find most similar task for append signal
      const productNameMap = new Map(productCandidates.map(p => [p.id, p.name]))
      for (const t of stage2Tasks) {
        const sim = Number(t.task_similarity ?? 0)
        if (sim > topTaskSimilarity) {
          topTaskSimilarity = sim
          topSimilarTask = {
            id: t.id,
            content: t.content,
            productName: productNameMap.get(t.product_id) || "",
            similarity: sim,
          }
        }
      }

      if (topSimilarTask) {
        console.log(
          `🔍 [brain-dump] Stage 2: Top similar task "${topSimilarTask.content}" (${(topSimilarTask.similarity * 100).toFixed(0)}%)`
        )
      }
    }

    // Build area/product/task structure from Stage 1 + Stage 2
    // First, fetch all areas for the user (we need them for the context)
    const allAreas = await prisma.area.findMany({
      where: { user_id: request.userId, deleted_at: null },
      select: { id: true, name: true, scope: true },
    })

    // Fetch topics for selected products
    const topicRows = selectedProductIds.length > 0
      ? await prisma.topic.findMany({
          where: { product_id: { in: selectedProductIds }, deleted_at: null },
          select: { id: true, name: true, product_id: true },
        })
      : []

    // Build areaMap
    const areaMap = new Map<string, {
      id: string
      name: string
      scope: string | null
      products: Map<string, {
        id: string
        name: string
        topics: Array<{ id: string; name: string }>
        tasks: Array<{ id: string; content: string; status: string; sub_items: any; updated_at: Date; due_date: Date | null; task_similarity: number | null }>
      }>
    }>()

    // Seed all areas
    for (const area of allAreas) {
      areaMap.set(area.id, { id: area.id, name: area.name, scope: area.scope, products: new Map() })
    }

    // Add selected products to their areas
    for (const pc of productCandidates) {
      const area = areaMap.get(pc.area_id)
      if (!area) continue
      area.products.set(pc.id, { id: pc.id, name: pc.name, topics: [], tasks: [] })
    }

    // Add topics
    for (const t of topicRows) {
      for (const area of areaMap.values()) {
        const product = area.products.get(t.product_id)
        if (product && !product.topics.some(tp => tp.id === t.id)) {
          product.topics.push({ id: t.id, name: t.name })
        }
      }
    }

    // Add tasks (distribute by product, limit per product)
    const tasksByProduct = new Map<string, TaskRow[]>()
    for (const t of stage2Tasks) {
      const list = tasksByProduct.get(t.product_id) || []
      list.push(t)
      tasksByProduct.set(t.product_id, list)
    }

    for (const area of areaMap.values()) {
      for (const [productId, product] of area.products) {
        const tasks = (tasksByProduct.get(productId) || []).slice(0, 10)
        for (const t of tasks) {
          product.tasks.push({
            id: t.id,
            content: t.content,
            status: t.status || "INBOX",
            sub_items: [],
            updated_at: t.updated_at || new Date(),
            due_date: t.due_date,
            task_similarity: t.task_similarity != null ? Number(t.task_similarity) : null,
          })
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

    timings["db_and_recall_parallel"] = Date.now() - startParallel

    // Build product similarity signal from Stage 1 results (using areaMap for area names)
    let productSimilaritySignal = ""
    if (relevantProducts.length > 0 && !request.explicitProductId) {
      const productSignalLines = relevantProducts.map(p => {
        const area = areaMap.get(p.area_id)
        const areaName = area ? area.name : "未知"
        return `  - ${p.name}（在「${areaName}」下，相似度 ${(p.similarity * 100).toFixed(0)}%）`
      })
      productSimilaritySignal = `\n### ⚠️ 語意相似度系統提示（優先級高於一般規則）\n` +
        `以下 Products 與本次輸入最相關，**強烈優先使用這些 Products 及其所在 Area**：\n` +
        productSignalLines.join('\n') +
        `\n如確實無法歸類才考慮其他 Product 或新建 Product。\n` +
        `**如果以上任何 Product 名稱與你想新建的 Product 相同或相似，必須使用已存在的 Product，不可重複建立。**\n`
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

    // 收集 context 中所有合法的 task IDs，用於 AI 回應驗證
    const validTaskIds = new Set<string>()
    for (const area of existingAreas) {
      for (const product of area.products) {
        for (const task of product.tasks) {
          validTaskIds.add(task.id)
        }
      }
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

        contextSummary += `🎯 **${milestone.name}**\n`
        contextSummary += `   - 目標日期：${targetDate.toLocaleDateString("zh-TW")} (${daysUntil} 天後)\n`
        if (milestone.description) {
          contextSummary += `   - 描述：${milestone.description}\n`
        }
        contextSummary += "\n"
      }
    }

    // 偵測時間指示詞 / 緊急程度詞（在 similarity signal 之前，出現則強制 create）
    const urgencyTimeKeywords = [
      '今天', '明天', '後天', '大後天',
      '週一', '週二', '週三', '週四', '週五', '週六', '週日',
      '下週', '本週', '這週', '上週',
      '月底', '月初', '本月底', '年底', '年初',
      '馬上', '立刻', '現在', '趕快', '盡快', '緊急', '趕緊',
    ]
    const inputText = request.text || request.cleanedText || ''
    const hasUrgencyOrTime = urgencyTimeKeywords.some(kw => inputText.includes(kw))

    // Similarity signal for append vs new task
    let similaritySignal = ""
    if (hasUrgencyOrTime) {
      // 有時間/緊急詞：直接壓制 similarity signal，強制指向 create
      similaritySignal = `\n### 🔍 語意分析信號\n⚠️ 偵測到時間指示詞或緊急程度詞（「馬上」「月底」「今天」等）→ **必須 create_new_tasks，禁止 append_sub_item**（即使語意高度相似）\n`
    } else if (topSimilarTask && topTaskSimilarity > 0.85) {
      similaritySignal = `\n### 🔍 語意分析信號\n語意分析發現高度相似的既有任務：\n  任務: "${topSimilarTask.content}" (相似度: ${(topSimilarTask.similarity * 100).toFixed(0)}%)\n  Product: ${topSimilarTask.productName}\n  → 請優先考慮是否追加為此任務的 sub-item\n`
    } else if (topTaskSimilarity < 0.6) {
      similaritySignal = `\n### 🔍 語意分析信號\n語意分析未發現高度相似的既有任務（最高相似度: ${(topTaskSimilarity * 100).toFixed(0)}%）→ 建議創建新任務\n`
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

    // Step 4: 呼叫 AI（最多 3 次重試）
    const startAI = Date.now()
    let result: z.infer<typeof StructureResultSchema> | undefined
    let aiUsage: AiTokenUsage | undefined
    let lastError: unknown
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        console.log(`🔄 [brain-dump] AI generateObject attempt ${attempt + 1}/3...`)
        const { object, usage } = await resilientGenerateObject({
          model: process.env.OPENROUTER_MODEL
            ? createOpenAI({ baseURL: "https://openrouter.ai/api/v1", apiKey: process.env.OPENROUTER_API_KEY! })(process.env.OPENROUTER_MODEL)
            : google("gemini-2.5-flash-lite"),
          schema: StructureResultSchema,
          prompt: `你是任務記錄專家。將用戶輸入轉成結構化的 Task。

# 🔥🔥🔥 最最優先：清單模式偵測

**在做任何其他判斷之前**，先檢查用戶輸入的結構：

用戶輸入是否有「主題 + 列表」的結構？（例：「XX更新：1. A 2. B」「XX事項：- C - D」「XX計畫：A、B、C」）

- **是** → 清單模式強制觸發，規則如下：
  1. 創建 **1 個新任務**，主題當 title
  2. **sub_items 必須填入列表中的每個項目（這是清單模式的核心，絕對不可省略）**
  3. sub-item 的 content 必須**直接使用用戶的原話**，禁止改寫、合併、省略任何項目
  4. 不需要做追加判斷，直接 create_new_tasks
  5. 如果輸入同時含有時間指示詞（如「明天」「下週」）→ 時間指示詞用來設定父任務的 due_date，**不影響清單模式結構，仍然是 1 個任務 + sub_items**
  - 範例1：「App更新：1. 刪除project 2. 加今日計劃」→ title=「App更新」, sub_items=[{content:「刪除project」},{content:「加今日計劃」}]
  - 範例2：「明天要做的事：發email、更新README、部署」→ title=「明天要做的事」, due_date=明天, sub_items=[{content:「發email」},{content:「更新README」},{content:「部署」}]
  - 範例3：「健身計畫：週一跑步、週三游泳、週五瑜伽」→ title=「健身計畫」, sub_items=[{content:「週一跑步」},{content:「週三游泳」},{content:「週五瑜伽」}]
- **否** → 繼續往下做追加判斷

---

# 🔥🔥 第二優先：時間指示詞 / 緊急程度強制規則

**在做追加判斷之前**，先掃描輸入是否含有以下詞語：

- **時間指示詞**：今天、明天、後天、大後天、週一、週二、週三、週四、週五、週六、週日、下週、本週、這週、上週、月底、月初、本月底、年底、年初、X日前、X號前、X月前、幾天內、幾週內
- **緊急程度詞**：馬上、立刻、現在、ASAP、趕快、盡快、緊急、急、趕緊

**只要出現以上任一詞** → **必須 create_new_tasks，禁止 append_sub_item**
- 理由：時間指示詞代表用戶在為**這件事**設定截止日期；sub-item 無法攜帶截止日期
- 緊急程度詞代表用戶要**立刻執行這件新事**，不是補充現有任務的細節
- **此規則優先級高於語意相似度**，無論現有任務多相似，只要有時間/緊急詞就創建新任務

---

# 🔥 是追加還是新任務？（僅當上面兩項都不適用時）

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
| 優化效能 | 修復登入問題 | 「優化效能」勾掉後，「修復登入問題」進度推進了嗎？ | ❌ 否 | 新任務 |
| App要加每日清單 | 開發MCP與Coach | 「加每日清單」勾掉後，「MCP與Coach」進度推進了嗎？ | ❌ 否，不同功能 | 新任務 |
| 要能編輯task | 開發MCP與Coach | 「能編輯task」勾掉後，「MCP與Coach」進度推進了嗎？ | ❌ 否，不同功能 | 新任務 |

### 追加的必要條件（全部滿足才追加）

1. **既有任務的 sub-items 或描述中，已經提到了相同或幾乎相同的事**：輸入內容必須能直接對應到既有任務已列出的具體工作項目
2. **粒度更細且推進完成度**：勾掉輸入後，既有任務的完成百分比會直接推進
3. **時間一致**：如果用戶輸入帶有明確時間意圖，目標任務的截止日期必須落在相同時間範圍內

### 追加的絕對禁止（出現任一條即為新任務）

- 輸入含有「動詞 + 獨立目標」結構（如「修復X」「處理Y」「完成Z」「開發A」「設計B」）→ 這是獨立任務，不追加
- 輸入含有時間指示詞或緊急程度詞（已在上方「第二優先」規則中定義）→ 必須創建新任務，此處再次確認
- 既有任務是「大傘任務」（名稱寬泛如「開發 XX 功能」「推進 XX 專案」）→ 不追加。大傘任務會吸引所有相關輸入，但「相關」不等於「子步驟」

**預設行為**：有任何疑慮，創建新任務。追加是例外，不是常態。

**如果符合追加條件**：
→ 回傳 \`action: "append_sub_item"\`，指定 \`target_task_ids\` 和新的 \`sub_items\`
⚠️ \`target_task_ids\` 必須填入「用戶的 Products 與任務」清單中格式為 \`- [uuid]\` 的 UUID 陣列（一或多個）
✅ 若用戶要追加到多個任務（如「國語和數學」），\`target_task_ids\` 填入多個 UUID，\`sub_items\` 將同樣追加到每個目標任務
🚫 **嚴禁使用里程碑區塊的 \`milestone_id\`**（兩者外觀相似，但來源不同，任何 milestone_id 都不是有效的 target_task_ids 元素）
🚫 **嚴禁使用逗號分隔字串**，必須使用陣列格式

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

**特別注意**：@Product 鎖定只影響歸屬哪個 Product，不影響「追加 vs 新任務」的判斷。
用戶用 @Product 標記通常是想在該 Product 下**創建新任務**，而非追加到既有任務。
除非輸入明確是某個既有任務的子步驟，否則預設創建新任務。

系統已自動篩選，你看到的任務列表**只包含該 Product 的任務**。

---

` : ''}
# 核心原則（創建新任務時使用）

## 1. 完整記錄
**items 是任務清單，不是固定 1 個**：輸入中若有多個各自獨立、可分別完成的目標，建立對應數量的 items。獨立性測試：移除其中一個目標，另一個仍然完整成立 → 它們是獨立任務。

問自己：**「把輸出念給用戶聽，用戶會說『你漏了 X』嗎？」**
- 會 → 你漏了東西，補上
- 不會 → OK

所有細節都要保留：
- 用戶提到的每個事項 → 放入 sub_items 或 narrative
- 用戶提到的條件/前提 → 放入 narrative
- 用戶提到的人名/專案名 → 保留原文

## 2. Sub-items 拆分

**第一原則：你是記錄員，不是 PM。忠實記錄用戶說的，不要自作主張拆解。**

⚠️ **注意**：如果輸入已由「最最優先：清單模式」處理，sub_items 已強制填入，本節規則不再適用。

### 什麼時候拆 sub-items？（排除清單模式後）

**任務規模明顯很大（預估 > 3 天）且用戶沒列清單**時，可以拆出合理的里程碑級子項（如「重構整個認證系統」）。

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

問自己：**「這個任務屬於哪個既有的 Area？」**
- 查看上下文中列出的所有 Areas
- 選擇最相關的既有 Area
- 如果不確定，選擇最通用的那個 Area
- **絕對禁止**填入不存在的 Area 名稱

## 4. Product 選擇
問自己：**「這個新任務和哪個 Product 的現有任務最像？」**
- 先看「語意相似度系統提示」列出的 Products，**優先使用分數最高的 Product**
- 再看每個 Product 下的「最近任務」
- 選擇任務類型最相似的 Product
- **如果 context 中任何 Area 下已存在同名的 Product，必須使用既有的 Product 及其所在 Area，絕對不可跨 Area 重複建立**
- 可以在既有 Area 下創建新 Product（僅當確實沒有任何匹配的既有 Product 時）

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

## 4. 時間推斷

**規則：只要你能推斷出時間，就必須填 due_date**

- 用戶說「今天」「明天」「週五」「1/30」→ 填 due_date
- 從上下文推斷出時間（如「週報通常週五發」）→ 填 due_date
- 任務與里程碑相關 → 填 due_date + inferred_from_milestone（填里程碑名稱文字，如「成立公司」）+ task_type + estimated_days_needed

due_date 格式：ISO 8601，如 2026-02-07T00:00:00+08:00

**「下週X」計算規則（嚴格）：**
- 「下週」= 本週結束後的下一個完整週（從下週一算起）
- 「下週三」= 下週的星期三，不是本週後的第一個星期三
- 計算方式：若今天是星期X，「下週Y」= 今天 + (7 - X + Y) % 7 + 7 天（不足 7 天時再加 7）
- 例：今天星期三(3)，「下週三」= +7 天 = 下週三；「下週五」= +9 天 = 下週五

**task_type**（當任務與里程碑相關時填寫）：
- waiting：需等待結果
- booking：需預約
- preparation：需準備
- execution：可立即執行

## 5. Drawer 狀態

- **有填 due_date → 必須是 ACTIVE**（有明確期限，需要追蹤進度）
- **沒有 due_date → 預設 INBOX**（還沒決定什麼時候做）
- **例行性/週期性任務 → MAINTAIN**（穩定運作中，異常時才需關注）
- **研究/參考資料類任務 → REFERENCE**（不需執行，只是蒐集資訊或供決策參考）
  - 判斷關鍵詞：「研究」「調查」「評估」「分析」「整理成文件」「供決策參考」「參考資料」
  - 例：「研究 Redis 快取方案，供決策參考」→ REFERENCE（無需執行，只是探索選項）

---

# 背景資訊

今天：${now.toLocaleDateString("zh-TW")} (星期${['日', '一', '二', '三', '四', '五', '六'][now.getDay()]})
${productSimilaritySignal}
${contextSummary}
${similaritySignal}
${librarianHints}
---

${request.sessionContext && request.sessionContext.length > 0
  ? `### 本次會話脈絡（同一 session 中較早的輸入，僅供理解連貫性，不代表用戶要追加到這些內容）
${request.sessionContext.map((s, i) => `- [${i + 1}] 「${s}」`).join('\n')}
如果用戶的當前輸入明顯是接著脈絡繼續說，請納入理解，但仍以當前輸入決定動作。

---

`
  : ''}# 用戶輸入

${request.text}

---

# 輸出格式與長度限制（嚴格遵守）

**字元數限制：**
- title：≤ 50 字元（動詞 + 目標，去掉冗詞）
- narrative：≤ 500 字元（完整保留用戶的原始描述、背景脈絡、結論與細節；禁止壓縮或省略）
- reasoning：≤ 100 字元（1 句話說明分類依據）
- due_date_source.reasoning：≤ 80 字元（1 句話說明時間推斷，使用 due_date_source 結構）
- sub_item.content：≤ 100 字元（簡短的待辦事項）
- tag.area/product/topic：≤ 30/50/50 字元

**格式要求：**
- 使用繁體中文
- due_date：ISO 8601 格式（例：2026-01-30T00:00:00+08:00）
- tag.topic：字串，**必須盡量填寫**（優先使用既有 Topic，或創建合適的新名稱）

**寫作原則：**
- title 精簡優先：每個字都要有意義，動詞開頭，≤ 50 字元
- narrative **保留完整**：將用戶提供的描述、結論、細節、背景完整複製到 narrative，不得省略或壓縮；如果用戶提供大量細節，全部放入 narrative（≤ 500 字元）
- reasoning 範例：「提到專案名稱，判斷為工作相關」`,
        })
        result = object
        aiUsage = usage
        break
      } catch (err) {
        lastError = err
        const isTransient = err instanceof Error && (
          err.message.includes('fetch failed') ||
          err.message.includes('network') ||
          err.message.includes('ECONNRESET') ||
          err.message.includes('timeout')
        )
        console.error(`❌ [brain-dump] AI call attempt ${attempt + 1} failed:`, err instanceof Error ? err.message : String(err))
        if (!isTransient || attempt === 2) {
          console.error(`❌ [brain-dump] All 3 AI attempts failed. Final error:`, lastError instanceof Error ? lastError.message : String(lastError))
          throw err
        }
        console.warn(`⚠️ [brain-dump] AI call attempt ${attempt + 1} failed (transient), retrying...`, err)
        await new Promise(r => setTimeout(r, 2000 * (attempt + 1)))
      }
    }
    if (!result) throw lastError
    timings["ai_generateObject"] = Date.now() - startAI
    console.log("🤖 [brain-dump] AI raw result:", JSON.stringify(result, null, 2).slice(0, 1000))

    // 驗證 append_sub_item 的 target_task_ids 必須全部來自 context 中的真實 task
    if (result.action === 'append_sub_item') {
      const taskIds = result.target_task_ids ?? []
      const invalidIds = taskIds.filter(id => !validTaskIds.has(id))
      if (invalidIds.length > 0) {
        console.warn(
          `⚠️ [brain-dump] AI returned invalid target_task_ids: ${invalidIds.join(', ')}. ` +
          `Valid task IDs in context: [${Array.from(validTaskIds).join(', ')}]`
        )
        throw new ValidationException(
          `AI 選擇的追加目標（${invalidIds.join(', ')}）不在當前任務清單中，請重新送出輸入`,
          'target_task_ids'
        )
      }
    }

    return {
      result,
      milestones,
      existingAreas,
      timings,
      usage: aiUsage,
    }
  }
}
