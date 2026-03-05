/**
 * Reorganize API Route
 *
 * Interface Layer: 認證 → 分析結構 → 執行重組 → 回應
 */

import { NextRequest } from "next/server"
import { prisma } from "@/lib/db"
import { authenticateRequest } from "@/lib/auth-middleware"
import { ApiResponseBuilder, catchDomainException } from "@/lib/api-response"
import { checkAiRateLimit, incrementAiUsage, DEFAULT_AI_MODEL } from "@/lib/ai-rate-limit"
import { AnalyzeStructureUseCase } from "@/application/use-cases/reorganize/analyze-structure"
import { ExecuteReorganizationUseCase, type ExecuteReorganizationRequest } from "@/application/use-cases/reorganize/execute-reorganization"

// POST /api/reorganize
export async function POST(request: NextRequest) {
  return catchDomainException<any>(async () => {
    const userId = await authenticateRequest(request, prisma)
    await checkAiRateLimit(userId)
    const body = await request.json() as any
    const { preview = false, confirmed = false, selected_operation_ids = null } = body

    // 1. 分析結構
    const analyzeUseCase = new AnalyzeStructureUseCase()
    const analysis = await analyzeUseCase.execute({ userId })

    // LLM 已被呼叫，無論結果為何都計數
    await incrementAiUsage(userId, { usage: analysis.usage, feature: 'reorganize', model: DEFAULT_AI_MODEL })

    if (analysis.isEmpty) {
      return ApiResponseBuilder.success({
        message: "No data to reorganize",
        changes: { merges: 0, reclassifications: 0 },
      }, {})
    }
    const { result, structuredOperations } = analysis

    // 2. 預覽模式
    if (preview || !confirmed) {
      return ApiResponseBuilder.success({
        preview: true,
        analysis: result.analysis,
        structured_operations: structuredOperations,
        preview_operations: structuredOperations.map((op) => {
          if (op.type === "merge") {
            return `合併「${op.from.product}」→「${op.to.product}」（${op.taskCount} 個任務）`
          } else {
            return `移動「${op.from.taskTitle}」從「${op.from.product}」到「${op.to.product}」`
          }
        }),
        estimated_changes: {
          merges: result.merges.length,
          reclassifications: result.reclassifications.length,
        },
      }, {})
    }

    // 3. 執行重組
    const executeUseCase = new ExecuteReorganizationUseCase()
    const execResult = await executeUseCase.execute({
      userId,
      merges: result.merges as ExecuteReorganizationRequest["merges"],
      reclassifications: result.reclassifications as ExecuteReorganizationRequest["reclassifications"],
      taskMap: analysis.taskMap,
      areaCache: analysis.areaCache,
      productCache: analysis.productCache,
      productByNameCache: analysis.productByNameCache,
      selectedOperationIds: selected_operation_ids,
    })

    return ApiResponseBuilder.success({
      analysis: result.analysis,
      operations: execResult.operationLog,
      changes: execResult.changes,
    }, {})
  })
}
