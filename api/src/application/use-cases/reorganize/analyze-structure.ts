/**
 * AnalyzeStructureUseCase - 分析結構並提出重組建議
 *
 * Application Layer Use Case
 * SQL 查詢取得完整結構 → 構建快取 → AI 分析 + 建議
 */

import { google } from "@ai-sdk/google"
import { generateObject } from "ai"
import { z } from "zod"
import { prisma } from "@/lib/db"
import type { AiTokenUsage } from "@/lib/ai-rate-limit"

// ============================================================================
// Types
// ============================================================================

interface RawStructureRow {
  area_id: string
  area_name: string
  area_scope: string | null
  product_id: string | null
  product_name: string | null
  topic_id: string | null
  topic_name: string | null
  task_id: string | null
  task_content: string | null
  task_ai_analysis: unknown
}

export interface TaskInfo {
  areaName: string
  productName: string
  content: string
  aiAnalysis: object | null
}

export interface ProductInfo {
  id: string
  name: string
  areaId: string
  areaName: string
  taskCount: number
}

export interface StructuredOperation {
  id: string
  type: "merge" | "reclassify"
  reason: string
  from: { area?: string; product: string; taskTitle?: string }
  to: { area?: string; product: string }
  taskCount?: number
}

// ============================================================================
// Zod Schema
// ============================================================================

const ReorganizeResultSchema = z.object({
  analysis: z.string().describe("以繁體中文描述目前結構的問題分析（1-2 句話）"),
  merges: z.array(
    z.object({
      reason: z.string().describe("以繁體中文說明為什麼要合併"),
      target_area: z.string().describe("保留的目標 Area 名稱"),
      source_areas: z.array(z.string()).describe("要合併到目標的來源 Area 名稱"),
      target_product: z.string().describe("保留的目標 Product 名稱"),
      source_products: z.array(z.string()).describe("要合併到目標的來源 Product 名稱"),
    })
  ).describe("建議合併的重複/相似結構"),
  reclassifications: z.array(
    z.object({
      task_id: z.string().describe("要重新分類的任務 ID"),
      task_title: z.string().describe("任務標題（用於顯示）"),
      current_area: z.string(),
      current_product: z.string(),
      new_area: z.string().describe("正確的 Area"),
      new_product: z.string().describe("正確的 Product"),
      reason: z.string().describe("以繁體中文說明重新分類的原因"),
    })
  ).describe("需要移動到不同 Area/Product 的任務"),
})

type ReorganizeResult = z.infer<typeof ReorganizeResultSchema>

// ============================================================================
// DTOs
// ============================================================================

export interface AnalyzeStructureRequest {
  userId: string
}

export interface AnalyzeStructureResponse {
  result: ReorganizeResult
  taskMap: Record<string, TaskInfo>
  areaCache: Map<string, { id: string; name: string }>
  productCache: Map<string, ProductInfo>
  productByNameCache: Map<string, Array<{ id: string; areaName: string; taskCount: number }>>
  structuredOperations: StructuredOperation[]
  isEmpty: boolean
  usage?: AiTokenUsage
}

// ============================================================================
// Use Case
// ============================================================================

export class AnalyzeStructureUseCase {
  async execute(
    request: AnalyzeStructureRequest
  ): Promise<AnalyzeStructureResponse> {
    // 1. 獲取用戶所有現有結構（單一 SQL 查詢）
    const rawRows = await prisma.$queryRaw<RawStructureRow[]>`
      SELECT
        a.id::text as area_id,
        a.name as area_name,
        a.scope as area_scope,
        p.id::text as product_id,
        p.name as product_name,
        top.id::text as topic_id,
        top.name as topic_name,
        t.id::text as task_id,
        t.content as task_content,
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

    if (rawRows.length === 0) {
      return {
        result: { analysis: "", merges: [], reclassifications: [] },
        taskMap: {},
        areaCache: new Map(),
        productCache: new Map(),
        productByNameCache: new Map(),
        structuredOperations: [],
        isEmpty: true,
      }
    }

    // 2. 構建快取
    const areaCache = new Map<string, { id: string; name: string }>()
    const productCache = new Map<string, ProductInfo>()
    const productByNameCache = new Map<string, Array<{ id: string; areaName: string; taskCount: number }>>()
    const taskMap: Record<string, TaskInfo> = {}

    const productTaskCounts = new Map<string, number>()
    const tasksProcessed = new Set<string>()

    // 第一遍：計算每個 product 的 task 數量
    for (const row of rawRows) {
      if (row.product_id && row.task_id && !tasksProcessed.has(row.task_id)) {
        tasksProcessed.add(row.task_id)
        productTaskCounts.set(row.product_id, (productTaskCounts.get(row.product_id) || 0) + 1)
      }
    }
    tasksProcessed.clear()

    // 構建結構摘要
    let structureSummary = "### Current Structure:\n\n"
    const areasProcessed = new Set<string>()
    const productsProcessed = new Set<string>()

    for (const row of rawRows) {
      if (!areasProcessed.has(row.area_id)) {
        areasProcessed.add(row.area_id)
        areaCache.set(row.area_name, { id: row.area_id, name: row.area_name })
        structureSummary += `**Area: ${row.area_name}** (scope: ${row.area_scope || "undefined"})\n`
      }

      if (row.product_id && !productsProcessed.has(row.product_id)) {
        productsProcessed.add(row.product_id)
        const taskCount = productTaskCounts.get(row.product_id) || 0

        productCache.set(row.product_id, {
          id: row.product_id,
          name: row.product_name!,
          areaId: row.area_id,
          areaName: row.area_name,
          taskCount,
        })

        const existingByName = productByNameCache.get(row.product_name!) || []
        existingByName.push({ id: row.product_id, areaName: row.area_name, taskCount })
        productByNameCache.set(row.product_name!, existingByName)

        structureSummary += `  - Product: ${row.product_name}\n`
      }

      if (row.task_id && row.product_id && !tasksProcessed.has(row.task_id)) {
        tasksProcessed.add(row.task_id)
        const aiAnalysis = row.task_ai_analysis as { narrative?: string } || {}
        structureSummary += `    - Task [${row.task_id}]: ${row.task_content} (${aiAnalysis.narrative || "no context"})\n`
        taskMap[row.task_id] = {
          areaName: row.area_name,
          productName: row.product_name!,
          content: row.task_content!,
          aiAnalysis: row.task_ai_analysis as object | null,
        }
      }
    }
    structureSummary += "\n"

    // 3. AI 分析
    const { object: result, usage: aiUsage } = await generateObject({
      model: google("gemini-3.1-flash-lite-preview"),
      schema: ReorganizeResultSchema,
      prompt: `你是 Zentropy 的圖書管理員 AI，一個資訊熵減系統。

你的任務是重新整理和合併用戶現有的資料結構。

## 核心聚合規則（必須遵守）：
1. **絕不聚合 Area (L1)**：Area 代表身分/角色，應保持穩定，即使名稱相似也不合併
2. **L2 (Product) 完全沒資料才聚合**：只清理完全沒有任務的空 Product
3. **L2 相似專案才考慮聚合**：只合併語義上明顯重複的 Product（如「專案管理」vs「項目管理」）

## 治理原則：
- **語義引力**：關於同一現實概念的項目應該聚集在一起
- **清晰層級**：Area = 身分角色、Product = 長期資產、Topic = 主題模組
- **保守優先**：寧可保留分散的結構，也不要過度聚合造成混亂

${structureSummary}

## 指示：
1. 分析目前結構的問題（但要保守判斷）
2. **只建議合併明顯重複的 Product**（例如名稱幾乎相同、語義完全一致）
3. 識別需要重新分類的任務（但要有充分理由）
4. 盡可能使用現有的 Area/Product 名稱作為目標
5. **絕對不要合併 Area**

重要：
- 所有分析和理由必須使用繁體中文回覆
- 只建議有語義意義的變更，不要為了整理而整理
- 在 reclassifications 中，請填入 task_title 欄位（從 Task 內容中提取）
- **保守原則**：如果不確定是否該合併，就不要合併`,
    })

    console.log("AI Reorganize Analysis:", result.analysis)
    console.log("Suggested Merges:", result.merges)
    console.log("Reclassifications:", result.reclassifications)

    // 4. 構建結構化操作預覽
    const structuredOperations: StructuredOperation[] = []
    let operationIdCounter = 0

    for (const merge of result.merges) {
      for (const sourceProductName of merge.source_products) {
        const sourceProducts = productByNameCache.get(sourceProductName) || []
        for (const sourceProduct of sourceProducts) {
          structuredOperations.push({
            id: `merge-${operationIdCounter++}`,
            type: "merge",
            reason: merge.reason,
            from: {
              area: sourceProduct.areaName,
              product: sourceProductName,
            },
            to: {
              area: merge.target_area,
              product: merge.target_product,
            },
            taskCount: sourceProduct.taskCount,
          })
        }
      }
    }

    for (const reclass of result.reclassifications) {
      const taskInfo = taskMap[reclass.task_id]
      if (taskInfo) {
        structuredOperations.push({
          id: `reclass-${operationIdCounter++}`,
          type: "reclassify",
          reason: reclass.reason,
          from: {
            area: reclass.current_area,
            product: reclass.current_product,
            taskTitle: reclass.task_title || taskInfo.content,
          },
          to: {
            area: reclass.new_area,
            product: reclass.new_product,
          },
        })
      }
    }

    return {
      result,
      taskMap,
      areaCache,
      productCache,
      productByNameCache,
      structuredOperations,
      isEmpty: false,
      usage: aiUsage,
    }
  }
}
