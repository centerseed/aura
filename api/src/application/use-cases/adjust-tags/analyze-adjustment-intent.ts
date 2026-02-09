/**
 * AnalyzeAdjustmentIntentUseCase - 分析標籤調整意圖
 *
 * Application Layer Use Case
 * SQL 查詢取得結構 + taskMap → AI 解析用戶意圖 → 回傳 intent + 結構化操作
 */

import { google } from "@ai-sdk/google"
import { generateObject } from "ai"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { ValidationException } from "@/lib/api-response"

// ============================================================================
// Types
// ============================================================================

interface RawStructureRow {
  area_id: string
  area_name: string
  product_id: string | null
  product_name: string | null
  topic_id: string | null
  topic_name: string | null
  task_id: string | null
  task_content: string | null
  task_topic_id: string | null
  task_ai_analysis: unknown
}

export interface TaskInfo {
  areaName: string
  productName: string
  content: string
  topicName: string | null
  productId: string
  aiAnalysis: object | null
}

export interface StructuredOperation {
  type: "move" | "change_topic"
  reason: string
  from: { area?: string; product: string; topic?: string; taskTitle: string }
  to: { area?: string; product?: string; topic?: string }
}

// ============================================================================
// Zod Schema
// ============================================================================

const AdjustmentIntentSchema = z.object({
  intent_type: z.enum(["move_tasks", "change_topic", "no_action"]).describe(
    "move_tasks: 移動任務到不同專案, change_topic: 改變任務的主題標籤, no_action: 不是調整指令"
  ),
  task_matches: z.array(
    z.object({
      task_id: z.string().describe("要修改的任務 ID"),
      task_title: z.string().describe("任務標題（用於顯示）"),
      current_location: z.string().describe("目前所在 Area/Product 位置"),
      match_reason: z.string().describe("為什麼此任務符合用戶的描述（繁體中文）"),
    })
  ).describe("符合用戶描述的任務"),
  target_area: z.string().optional().describe("目標 Area 名稱（移動操作用）"),
  target_product: z.string().optional().describe("目標 Product 名稱（移動操作用）"),
  target_topic: z.string().optional().describe("目標 Topic 名稱（變更主題用）"),
  reasoning: z.string().describe("用繁體中文說明解析結果的理由"),
})

type AdjustmentIntent = z.infer<typeof AdjustmentIntentSchema>

// ============================================================================
// DTOs
// ============================================================================

export interface AnalyzeAdjustmentIntentRequest {
  userId: string
  text: string
  preview: boolean
}

export interface AnalyzeAdjustmentIntentResponse {
  intent: AdjustmentIntent
  taskMap: Record<string, TaskInfo>
  structuredOperations: StructuredOperation[]
  previewLog: string[]
  logId?: string
  timings: Record<string, number>
}

// ============================================================================
// Use Case
// ============================================================================

export class AnalyzeAdjustmentIntentUseCase {
  async execute(
    request: AnalyzeAdjustmentIntentRequest
  ): Promise<AnalyzeAdjustmentIntentResponse> {
    const timings: Record<string, number> = {}

    if (!request.text) {
      throw new ValidationException("text is required", "text")
    }

    // 1. 獲取用戶現有結構（單一 SQL 查詢）
    const startDbStructure = Date.now()
    const rawRows = await prisma.$queryRaw<RawStructureRow[]>`
      SELECT
        a.id::text as area_id,
        a.name as area_name,
        p.id::text as product_id,
        p.name as product_name,
        top.id::text as topic_id,
        top.name as topic_name,
        t.id::text as task_id,
        t.content as task_content,
        t.topic_id::text as task_topic_id,
        t.ai_analysis as task_ai_analysis
      FROM areas a
      LEFT JOIN products p ON p.area_id = a.id AND p.deleted_at IS NULL
      LEFT JOIN topics top ON top.product_id = p.id AND top.deleted_at IS NULL
      LEFT JOIN tasks t ON t.product_id = p.id
        AND t.deleted_at IS NULL
        AND t.status != 'ARCHIVE'::"statusenum"
      WHERE a.user_id = ${request.userId}::uuid AND a.deleted_at IS NULL
      ORDER BY a.name, p.name, t.created_at DESC
    `

    // 構建結構摘要和 taskMap
    let contextSummary = "### 用戶現有結構:\n\n"
    const taskMap: Record<string, TaskInfo> = {}

    const areasProcessed = new Set<string>()
    const productsProcessed = new Set<string>()
    const topicsByProduct = new Map<string, Set<string>>()
    const tasksProcessed = new Set<string>()

    // 第一遍：收集所有 topics
    for (const row of rawRows) {
      if (row.product_id && row.topic_name) {
        if (!topicsByProduct.has(row.product_id)) {
          topicsByProduct.set(row.product_id, new Set())
        }
        topicsByProduct.get(row.product_id)!.add(row.topic_name)
      }
    }

    // 第二遍：構建 contextSummary 和 taskMap
    let currentAreaId: string | null = null

    for (const row of rawRows) {
      if (!areasProcessed.has(row.area_id)) {
        areasProcessed.add(row.area_id)
        currentAreaId = row.area_id
        contextSummary += `**Area: ${row.area_name}**\n`
      }

      if (row.product_id && !productsProcessed.has(row.product_id)) {
        productsProcessed.add(row.product_id)
        contextSummary += `  📦 Product: ${row.product_name}\n`

        const topics = topicsByProduct.get(row.product_id)
        if (topics && topics.size > 0) {
          contextSummary += `     可用 Topics: ${Array.from(topics).join(", ")}\n`
        }
      }

      if (row.task_id && !tasksProcessed.has(row.task_id)) {
        tasksProcessed.add(row.task_id)
        const aiAnalysis = row.task_ai_analysis as { narrative?: string } || {}

        let taskTopicName: string | null = null
        if (row.task_topic_id) {
          for (const r of rawRows) {
            if (r.product_id === row.product_id && r.topic_id === row.task_topic_id) {
              taskTopicName = r.topic_name
              break
            }
          }
        }

        contextSummary += `     - [${row.task_id}] ${row.task_content}${taskTopicName ? ` (Topic: ${taskTopicName})` : ""}${aiAnalysis.narrative ? ` | ${aiAnalysis.narrative}` : ""}\n`

        taskMap[row.task_id] = {
          areaName: row.area_name,
          productName: row.product_name!,
          content: row.task_content!,
          topicName: taskTopicName,
          productId: row.product_id!,
          aiAnalysis: row.task_ai_analysis as object | null,
        }
      }

      if (currentAreaId !== row.area_id) {
        contextSummary += "\n"
        currentAreaId = row.area_id
      }
    }
    contextSummary += "\n"
    timings["db_structure"] = Date.now() - startDbStructure

    // 2. 調用 AI 解析用戶意圖
    const startAI = Date.now()
    const { object: intent } = await generateObject({
      model: google("gemini-2.5-flash-lite"),
      schema: AdjustmentIntentSchema,
      prompt: `你是 Zentropy 的標籤調整助手。用戶想要調整現有任務的分類。

## 你的任務:
1. 判斷用戶的意圖類型（移動任務 or 改變主題標籤 or 不是調整指令）
2. 找出用戶描述的任務（可能是任務內容的關鍵字、模糊描述等）
3. 確定目標位置（Area/Product 或 Topic）

## 用戶指令範例:
- "把『向學校主任通報出入境』移到『搬家去日本』專案" → intent_type: move_tasks
- "把所有關於手機的任務歸到『行政事務』專案" → intent_type: move_tasks
- "把『送竹節餅』的 Topic 改成『其他』" → intent_type: change_topic
- "明天要去買菜" → intent_type: no_action (這是新任務，不是調整指令)

## 重要規則:
- 只有明確提到「移到」、「改成」、「歸到」等調整動作的才是調整指令
- 用戶可能用任務內容的部分關鍵字來指稱任務，你需要模糊匹配
- 如果找到多個匹配的任務，全部列出（用戶可能想批量移動）
- 目標 Area/Product/Topic 必須使用**現有結構中完全相同**的名稱

${contextSummary}

## 用戶輸入:
${request.text}

請分析用戶意圖並找出需要調整的任務。reasoning 請用繁體中文說明。`,
    })
    timings["ai_generateObject"] = Date.now() - startAI

    console.log("Adjustment Intent:", intent)

    // 3. 構建結構化操作預覽
    const structuredOperations: StructuredOperation[] = []
    const previewLog: string[] = []

    if (intent.intent_type === "move_tasks" && intent.target_product) {
      for (const match of intent.task_matches) {
        const taskInfo = taskMap[match.task_id]
        if (taskInfo) {
          previewLog.push(
            `將「${taskInfo.content}」\n從 ${taskInfo.areaName} / ${taskInfo.productName}\n移到 ${intent.target_area || taskInfo.areaName} / ${intent.target_product}`
          )
          structuredOperations.push({
            type: "move",
            reason: match.match_reason,
            from: {
              area: taskInfo.areaName,
              product: taskInfo.productName,
              taskTitle: match.task_title || taskInfo.content,
            },
            to: {
              area: intent.target_area || taskInfo.areaName,
              product: intent.target_product,
            },
          })
        }
      }
    }

    if (intent.intent_type === "change_topic" && intent.target_topic) {
      for (const match of intent.task_matches) {
        const taskInfo = taskMap[match.task_id]
        if (taskInfo) {
          previewLog.push(
            `將「${taskInfo.content}」的 Topic\n從 ${taskInfo.topicName || "(無)"}\n改為 ${intent.target_topic}`
          )
          structuredOperations.push({
            type: "change_topic",
            reason: match.match_reason,
            from: {
              area: taskInfo.areaName,
              product: taskInfo.productName,
              topic: taskInfo.topicName || undefined,
              taskTitle: match.task_title || taskInfo.content,
            },
            to: {
              topic: intent.target_topic,
            },
          })
        }
      }
    }

    // 4. 如果是預覽模式，建立 PENDING evaluation log
    let logId: string | undefined
    if (request.preview) {
      const startDbLog = Date.now()
      const evaluationLog = await prisma.systemEvaluationLog.create({
        data: {
          user_id: request.userId,
          type: "ADJUST_TAGS",
          input_content: { text: request.text },
          output_content: {
            intent,
            structured_operations: structuredOperations,
          } as any,
          user_action: "PENDING",
        },
      })
      logId = evaluationLog.id
      timings["db_createLog"] = Date.now() - startDbLog
    }

    return {
      intent,
      taskMap,
      structuredOperations,
      previewLog,
      logId,
      timings,
    }
  }
}
