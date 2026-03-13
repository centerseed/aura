/**
 * ReorganizeSkill — 重整任務結構
 *
 * 觸發詞匹配 → 注入 prompt + ReorganizeTool
 * Tool 直接呼叫 AnalyzeStructureUseCase（預覽模式）
 */

import { tool, skill, makeSkillResult } from "naru-agent-js"
import { z } from "zod"
import { AnalyzeStructureUseCase } from "@/application/use-cases/reorganize/analyze-structure"

export const createReorganizeTool = (userId: string) =>
  tool({
    name: "reorganize_preview",
    description: "分析用戶的任務結構並提出重組建議（預覽模式，不實際執行）",
    // 預覽工具不需要模型提供額外參數，避免 Groq function calling 誤生成 schema 片段。
    parameters: z.object({}),
    execute: async (_params) => {
      const analyzeUC = new AnalyzeStructureUseCase()
      const result = await analyzeUC.execute({ userId })

      if (result.isEmpty) return "目前沒有足夠的任務結構需要重組。"

      const ops = result.structuredOperations
      if (ops.length === 0) return `結構分析完成：${result.result.analysis}\n\n目前沒有需要調整的地方。`

      const opLines = ops
        .map((op) => {
          if (op.type === "merge") {
            return `- 合併：將「${op.from.product}」合併到「${op.to.product}」（${op.taskCount ?? 0} 個任務）`
          } else {
            return `- 移動：將「${op.from.taskTitle ?? op.from.product}」的任務移到「${op.to.product}」`
          }
        })
        .join("\n")

      return `分析：${result.result.analysis}\n\n找到 ${ops.length} 個重組建議：\n${opLines}`
    },
  })

export const createReorganizeSkill = (userId: string) =>
  skill({
    name: "reorganize",
    description: "重整任務結構",
    triggers: ["幫我整理", "整理任務", "整理待辦", "重組任務", "重整結構"],
    priority: 8,
    run: async (_message, _context) =>
      makeSkillResult({
        promptInjection:
          "用戶想要整理任務結構。先用 reorganize_preview 工具取得分析結果，" +
          "再用繁體中文呈現建議內容，詢問用戶是否需要進一步說明或確認執行。",
        extraTools: [createReorganizeTool(userId)],
        skillName: "reorganize",
      }),
  })
