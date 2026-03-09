/**
 * AdjustTagsSkill — 調整任務分類
 *
 * 觸發詞：移到、改到、分錯了、應該在、換到、分類錯了
 * 呼叫 AnalyzeAdjustmentIntentUseCase → preview → 存 session → 等用戶確認
 */

import { tool, skill, makeSkillResult } from "naru-agent-js"
import { z } from "zod"
import { AnalyzeAdjustmentIntentUseCase } from "@/application/use-cases/adjust-tags/analyze-adjustment-intent"
import { ExecuteAdjustmentUseCase } from "@/application/use-cases/adjust-tags/execute-adjustment"
import { saveLineSession } from "@/lib/line-session"
import type { AdjustTagsPayload } from "@/lib/line-session"

const createAdjustTagsTool = (userId: string, lineUserId?: string) =>
  tool({
    name: "adjust_tags_preview",
    description: "分析用戶的標籤調整意圖，回傳預覽並等待確認",
    parameters: z.object({
      text: z.string().describe("用戶的完整調整指令"),
    }),
    execute: async ({ text }) => {
      const analyzeUC = new AnalyzeAdjustmentIntentUseCase()
      const result = await analyzeUC.execute({ userId, text, preview: !!lineUserId })

      const { intent, structuredOperations, previewLog, logId, taskMap } = result

      if (intent.intent_type === "no_action" || structuredOperations.length === 0) {
        return "我沒有找到需要調整的任務，請確認指令格式（例如：「把 X 移到 Y 專案」）。"
      }

      // 驗證 intent_type，避免無效值被存入 session
      const intentType = intent.intent_type
      if (intentType !== "move_tasks" && intentType !== "change_topic") {
        return "無法識別操作類型，請重新描述。"
      }

      if (lineUserId) {
        if (!logId) {
          return "發生錯誤：無法建立預覽記錄。"
        }

        // LINE 模式：存 session，等待用戶確認
        const payload: AdjustTagsPayload = {
          logId,
          intentType,
          taskMatches: intent.task_matches,
          targetArea: intent.target_area,
          targetProduct: intent.target_product,
          targetTopic: intent.target_topic,
          taskMap: taskMap as Record<string, unknown>,
        }
        await saveLineSession(lineUserId, "adjust_tags_preview", payload)

        const preview = previewLog.join("\n\n")
        return `📋 調整預覽：\n\n${preview}\n\n回覆「確認」執行，或無視此訊息取消。`
      }

      // 非 LINE 模式：直接執行（避免無 session 時 fallback）
      const executeUC = new ExecuteAdjustmentUseCase()
      const executed = await executeUC.execute({
        userId,
        intentType,
        taskMatches: intent.task_matches,
        targetArea: intent.target_area,
        targetProduct: intent.target_product,
        targetTopic: intent.target_topic,
        taskMap: taskMap as Record<string, any>,
        logId: null,
      })

      if (executed.movedCount === 0) {
        return "沒有可執行的調整，請再具體描述要移動的任務與目標分類。"
      }
      return `✅ 已完成分類調整：\n\n${executed.operationLog.join("\n\n")}`
    },
  })

export const createAdjustTagsSkill = (userId: string, lineUserId?: string) =>
  skill({
    name: "adjust_tags",
    description: "調整任務的分類或標籤",
    triggers: ["移到", "改到", "改成", "分錯了", "應該在", "換到", "分類錯了", "移進", "歸到", "放在", "不是"],
    priority: 9,
    run: async (_message, _context) =>
      makeSkillResult({
        promptInjection:
          "用戶想調整某個任務的分類。請使用 adjust_tags_preview 工具，" +
          "將用戶的原始指令完整傳入。工具會分析並回傳預覽訊息。",
        extraTools: [createAdjustTagsTool(userId, lineUserId)],
        skillName: "adjust_tags",
      }),
  })
