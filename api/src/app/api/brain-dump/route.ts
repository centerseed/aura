/**
 * Brain Dump API Route
 *
 * Interface Layer: 認證 → 解析輸入 → 生成結構 → 執行寫入 → 回應
 */

import { NextRequest } from "next/server"
import { authenticateRequest } from "@/lib/auth-middleware"
import { prisma } from "@/lib/db"
import { ApiResponseBuilder, catchDomainException } from "@/lib/api-response"
import { checkAiRateLimit, incrementAiUsage } from "@/lib/ai-rate-limit"
import { ParseBrainDumpInputUseCase } from "@/application/use-cases/brain-dump/parse-brain-dump-input"
import { GenerateBrainDumpStructureUseCase } from "@/application/use-cases/brain-dump/generate-brain-dump-structure"
import { ExecuteBrainDumpUseCase } from "@/application/use-cases/brain-dump/execute-brain-dump"

// POST /api/brain-dump
export async function POST(request: NextRequest) {
  return catchDomainException<any>(async () => {
    const timings: Record<string, number> = {}
    const startTotal = Date.now()

    // 1. 認證
    const userId = await authenticateRequest(request, prisma)
    await checkAiRateLimit(userId)

    // 2. 解析輸入
    const contentType = request.headers.get("content-type") || ""
    const parseUseCase = new ParseBrainDumpInputUseCase()
    const parsed = await parseUseCase.execute({
      userId,
      contentType,
      jsonBody: contentType.includes("multipart/form-data") ? undefined : await request.json(),
      formData: contentType.includes("multipart/form-data") ? await request.formData() : undefined,
    })
    Object.assign(timings, parsed.timings)

    // 3. 生成結構
    const generateUseCase = new GenerateBrainDumpStructureUseCase()
    const structure = await generateUseCase.execute({
      userId,
      text: parsed.text,
      cleanedText: parsed.cleanedText,
      explicitProductId: parsed.explicitProductId,
    })
    Object.assign(timings, structure.timings)

    // 4. 執行寫入
    const executeUseCase = new ExecuteBrainDumpUseCase()
    const result = await executeUseCase.execute({
      userId,
      text: parsed.text,
      inputType: parsed.inputType,
      result: structure.result,
      milestones: structure.milestones,
      existingAreas: structure.existingAreas,
      imageUnderstandingResult: parsed.imageUnderstandingResult,
    })
    Object.assign(timings, result.timings)
    await incrementAiUsage(userId)

    timings["total"] = Date.now() - startTotal
    console.log("⏱️ [brain-dump] Timings:", JSON.stringify(timings, null, 2))

    return ApiResponseBuilder.success(result.data, {})
  })
}
