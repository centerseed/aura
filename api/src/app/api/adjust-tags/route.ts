/**
 * Adjust Tags API Route
 *
 * Interface Layer: 認證 → 分析意圖 → 執行調整 → 回應
 */

import { NextRequest } from "next/server"
import { prisma } from "@/lib/db"
import { authenticateRequest } from "@/lib/auth-middleware"
import { ApiResponseBuilder, ValidationException, catchDomainException } from "@/lib/api-response"
import { checkAiRateLimit, incrementAiUsage, DEFAULT_AI_MODEL } from "@/lib/ai-rate-limit"
import { sanitizeText } from "@/domain/constants/validation"
import { AnalyzeAdjustmentIntentUseCase } from "@/application/use-cases/adjust-tags/analyze-adjustment-intent"
import { ExecuteAdjustmentUseCase, type ExecuteAdjustmentRequest } from "@/application/use-cases/adjust-tags/execute-adjustment"

// POST /api/adjust-tags
export async function POST(request: NextRequest) {
  return catchDomainException<any>(async () => {
    const startTotal = Date.now()
    const userId = await authenticateRequest(request, prisma)
    await checkAiRateLimit(userId)
    const body = await request.json() as any
    const { preview = false, confirmed = false, logId = null } = body

    // 輸入清理與驗證
    let text: string
    try {
      text = sanitizeText(body.text, { fieldName: "text" })
    } catch (e) {
      throw new ValidationException(
        e instanceof Error ? e.message : "text is required",
        "text"
      )
    }

    // 1. 分析意圖
    const analyzeUseCase = new AnalyzeAdjustmentIntentUseCase()
    const analysis = await analyzeUseCase.execute({
      userId,
      text,
      preview: preview || !confirmed,
    })

    // Note: preview 模式也消耗 AI quota，因為 AnalyzeAdjustmentIntent 每次都呼叫 LLM
    await incrementAiUsage(userId, { usage: analysis.usage, feature: 'adjust_tags', model: DEFAULT_AI_MODEL })
    const { intent, taskMap, structuredOperations, previewLog, timings } = analysis

    // 如果不是調整指令
    if (intent.intent_type === "no_action") {
      return ApiResponseBuilder.success({
        success: false,
        message: "這似乎不是一個調整標籤的指令。如果您想新增任務,請直接送出。如果想調整現有任務,請明確說明要「移到」或「改成」哪裡。",
        intent_type: "no_action",
        reasoning: intent.reasoning,
      }, {})
    }

    // 如果沒有找到匹配的任務
    if (intent.task_matches.length === 0) {
      return ApiResponseBuilder.success({
        success: false,
        message: "找不到符合描述的任務。請檢查任務內容是否正確。",
        intent_type: intent.intent_type,
        reasoning: intent.reasoning,
      }, {})
    }

    // 2. 預覽模式
    if (preview || !confirmed) {
      timings["total"] = Date.now() - startTotal
      console.log("⏱️ [adjust-tags] Timings (preview):", JSON.stringify(timings, null, 2))

      return ApiResponseBuilder.success({
        preview: true,
        logId: analysis.logId,
        intent_type: intent.intent_type,
        reasoning: intent.reasoning,
        structured_operations: structuredOperations,
        preview_operations: previewLog,
        task_matches: intent.task_matches,
        changes: { moved: intent.task_matches.length },
      }, {})
    }

    // 3. 執行調整
    const executeUseCase = new ExecuteAdjustmentUseCase()
    const result = await executeUseCase.execute({
      userId,
      intentType: intent.intent_type as "move_tasks" | "change_topic",
      taskMatches: intent.task_matches as ExecuteAdjustmentRequest["taskMatches"],
      targetArea: intent.target_area,
      targetProduct: intent.target_product,
      targetTopic: intent.target_topic,
      taskMap,
      logId,
    })

    timings["db_execution"] = result.timings["db_execution"] || 0
    timings["total"] = Date.now() - startTotal
    console.log("⏱️ [adjust-tags] Timings (execute):", JSON.stringify(timings, null, 2))

    return ApiResponseBuilder.success({
      intent_type: intent.intent_type,
      reasoning: intent.reasoning,
      operations: result.operationLog,
      task_matches: intent.task_matches,
      changes: { moved: result.movedCount },
    }, {})
  })
}
