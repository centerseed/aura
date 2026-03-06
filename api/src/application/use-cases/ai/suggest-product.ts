/**
 * SuggestProductUseCase - AI 推薦產品名稱
 *
 * Application Layer Use Case
 * 使用 AI 根據任務內容和身分資訊推薦合適的產品名稱
 */

import { google } from '@ai-sdk/google'
import { generateObject } from 'ai'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { ValidationException } from '@/lib/api-response'
import type { AiTokenUsage } from '@/lib/ai-rate-limit'

// ============================================================================
// DTOs (Data Transfer Objects)
// ============================================================================

export interface SuggestProductRequest {
  userId: string
  taskContent: string
  taskNarrative?: string
  areaId: string
  areaName: string
  areaScope?: string
}

export interface SuggestProductResponse {
  suggestion: {
    suggested_name: string
    reasoning: string
    alternative_names: string[]
  }
  usage?: AiTokenUsage
}

// ============================================================================
// AI Schema
// ============================================================================

const ProductSuggestionSchema = z.object({
  suggested_name: z.string().describe('建議的專案名稱,應該精簡且具體'),
  reasoning: z.string().describe('為什麼建議這個名稱(繁體中文)'),
  alternative_names: z
    .array(z.string())
    .max(2)
    .describe('其他可能的名稱選項'),
})

// ============================================================================
// Use Case
// ============================================================================

export class SuggestProductUseCase {
  async execute(
    request: SuggestProductRequest
  ): Promise<SuggestProductResponse> {
    // 1. 驗證輸入
    this.validateRequest(request)

    // 2. 獲取該 Area 下現有的 Products(避免重複)
    const existingProducts = await prisma.product.findMany({
      where: {
        user_id: request.userId,
        area_id: request.areaId,
        deleted_at: null,
      },
      select: {
        name: true,
      },
    })

    const existingProductNames = existingProducts.map((p) => p.name)

    // 3. 調用 AI 推薦專案名稱
    const { object: suggestion, usage: aiUsage } = await generateObject({
      model: google('gemini-3.1-flash-lite-preview'),
      schema: ProductSuggestionSchema,
      prompt: `你是 Zentropy 的專案命名助手。用戶想要將一個任務移到「${request.areaName}」身分下,但該身分下還沒有合適的專案。

## 任務資訊:
- 任務內容:${request.taskContent}
${request.taskNarrative ? `- 任務背景:${request.taskNarrative}` : ''}

## 身分資訊:
- 身分名稱:${request.areaName}
${request.areaScope ? `- 身分範圍:${request.areaScope}` : ''}

## 現有專案(避免重複):
${existingProductNames.length > 0 ? existingProductNames.map((name) => `- ${name}`).join('\n') : '(無)'}

## 你的任務:
根據任務內容和身分範圍,推薦一個**精簡、具體、有意義**的專案名稱。

### 命名原則:
1. **精簡**: 2-6 個字為佳(例如:「家庭聚會」、「職涯發展」)
2. **具體**: 明確指出專案的核心主題
3. **避重複**: 不要與現有專案名稱重複或過於相似
4. **語意群組**: 能夠涵蓋類似性質的任務
5. **符合身分**: 與身分的範圍和定位一致

### 範例:
- 任務「參加朋友婚禮」→ 專案「社交活動」或「人際往來」
- 任務「學習 Python」→ 專案「技能學習」或「程式開發」
- 任務「規劃家族旅行」→ 專案「家庭活動」

請推薦一個主要名稱和兩個備選名稱。reasoning 請用繁體中文說明。`,
    })

    return {
      suggestion: suggestion as {
        suggested_name: string
        reasoning: string
        alternative_names: string[]
      },
      usage: aiUsage,
    }
  }

  /**
   * 驗證請求資料
   */
  private validateRequest(request: SuggestProductRequest): void {
    if (!request.userId) {
      throw new ValidationException('User ID is required', 'userId')
    }

    if (!request.taskContent || request.taskContent.trim().length === 0) {
      throw new ValidationException('Task content is required', 'taskContent')
    }

    if (!request.areaId) {
      throw new ValidationException('Area ID is required', 'areaId')
    }

    if (!request.areaName) {
      throw new ValidationException('Area name is required', 'areaName')
    }
  }
}
