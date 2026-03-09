/**
 * BrainDumpSkill — 記錄任務與想法
 *
 * 觸發詞匹配 → 注入 prompt + BrainDumpTool
 * Tool 直接呼叫現有 Use Cases（同一 process，不走 HTTP）
 */

import { tool, skill, makeSkillResult } from "naru-agent-js"
import { z } from "zod"
import { ParseBrainDumpInputUseCase } from "@/application/use-cases/brain-dump/parse-brain-dump-input"
import { GenerateBrainDumpStructureUseCase } from "@/application/use-cases/brain-dump/generate-brain-dump-structure"
import { ExecuteBrainDumpUseCase } from "@/application/use-cases/brain-dump/execute-brain-dump"

const createBrainDumpTool = (userId: string) =>
  tool({
    name: "brain_dump",
    description: "將用戶的文字輸入分類並寫入 Zentropy 任務系統",
    parameters: z.object({ text: z.string().describe("用戶想記錄的內容") }),
    execute: async ({ text }) => {
      const parseUC = new ParseBrainDumpInputUseCase()
      const generateUC = new GenerateBrainDumpStructureUseCase()
      const executeUC = new ExecuteBrainDumpUseCase()

      const parsed = await parseUC.execute({
        userId,
        contentType: "application/json",
        jsonBody: { text },
      })

      const generated = await generateUC.execute({
        userId,
        text,
        cleanedText: parsed.cleanedText,
        explicitProductId: parsed.explicitProductId,
      })

      const result = await executeUC.execute({
        userId,
        text,
        inputType: "text",
        result: generated.result,
        milestones: generated.milestones,
        existingAreas: generated.existingAreas,
        imageUnderstandingResult: null,
      })

      const items: any[] = result.data?.items ?? []
      if (items.length === 0) return "已記錄，但沒有新增任何項目。"
      const titles = items.map((i: any) => i.title ?? i.content ?? "（無標題）").join("、")
      return `✅ 已記錄 ${items.length} 個項目：${titles}`
    },
  })

export const createBrainDumpSkill = (userId: string) =>
  skill({
    name: "brain_dump",
    description: "記錄任務與想法",
    triggers: ["記下", "記一下", "待辦", "todo", "任務", "想法", "記得", "幫我記", "幫我加", "新增任務"],
    priority: 10,
    run: async (_message, _context) =>
      makeSkillResult({
        promptInjection:
          "用戶想要記錄一件事或任務。請用 brain_dump 工具將用戶的輸入原文傳入，" +
          "工具執行後用繁體中文告知用戶已記錄哪些項目。不要修改用戶的原始文字。",
        extraTools: [createBrainDumpTool(userId)],
        skillName: "brain_dump",
      }),
  })
