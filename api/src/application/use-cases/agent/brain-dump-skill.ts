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
import { shouldActivateBrainDump } from "./brain-dump-matcher"

function summarizeOriginalText(text: string): string {
  return text.trim().replace(/\s+/g, " ").slice(0, 60)
}

function buildBrainDumpFailureMessage(text: string, error: unknown): string {
  const summary = summarizeOriginalText(text)
  const message = error instanceof Error ? error.message : String(error)
  const quotaLike = /quota|resource_exhausted|rate limit|429/i.test(message)

  if (quotaLike) {
    return `抱歉，目前系統遇到限制，暫時無法記錄「${summary}」。請稍候再試。`
  }

  return `抱歉，剛才記錄「${summary}」時發生錯誤。請稍後再試。`
}

export const createBrainDumpTool = (userId: string, originalMessage: string) =>
  tool({
    name: "brain_dump",
    description: "將用戶提供的待辦、想法或任務描述寫入 Zentropy。當用戶要求記錄、記下、加入待辦，或輸入本身就是待辦內容時必須使用。",
    // Groq + chat completions 在這個 agent 場景下容易把 JSON schema 當成工具參數輸出。
    // 這個工具改成零參數，直接消化當前使用者原句，避免 function calling 在參數生成階段失真。
    parameters: z.object({}),
    execute: async () => {
      const text = originalMessage
      if (!text || text.trim() === "") {
        return "請直接提供要記錄的內容，例如任務名稱、待辦事項或想法。"
      }
      try {
        const t0 = Date.now()
        const parseUC = new ParseBrainDumpInputUseCase()
        const generateUC = new GenerateBrainDumpStructureUseCase()
        const executeUC = new ExecuteBrainDumpUseCase()

        const t1 = Date.now()
        const parsed = await parseUC.execute({
          userId,
          contentType: "application/json",
          jsonBody: { text },
        })
        const t2 = Date.now()
        console.log(JSON.stringify({ event: "brain_dump_timing", userId, phase: "parse", ms: t2 - t1 }))

        const generated = await generateUC.execute({
          userId,
          text,
          cleanedText: parsed.cleanedText,
          explicitProductId: parsed.explicitProductId,
        })
        const t3 = Date.now()
        console.log(JSON.stringify({ event: "brain_dump_timing", userId, phase: "generate", ms: t3 - t2 }))

        const result = await executeUC.execute({
          userId,
          text,
          inputType: "text",
          result: generated.result,
          milestones: generated.milestones,
          existingAreas: generated.existingAreas,
          imageUnderstandingResult: null,
        })
        const t4 = Date.now()
        console.log(JSON.stringify({ event: "brain_dump_timing", userId, phase: "execute", ms: t4 - t3, total_tool_ms: t4 - t0 }))

        const action = result.data?.action

        if (action === "append_sub_item") {
          // 追加 sub_items 到既有任務
          const appendedTasks = result.data?.appended_tasks ?? []
          if (appendedTasks.length === 0) return "已記錄，但沒有追加任何內容。"
          const summary = appendedTasks
            .map((at: any) => `「${at.task.content}」追加 ${at.sub_items.length} 個待辦`)
            .join("; ")
          return `✅ 已記錄並追加：${summary}`
        }

        // create_new_tasks 情況
        const items: any[] = result.data?.items ?? []
        const skippedDuplicates: string[] = result.data?.skipped_as_duplicates ?? []
        if (items.length === 0 && skippedDuplicates.length > 0) {
          const titles = skippedDuplicates.join("、")
          return `⚠️ 這些任務已存在，未重複建立：${titles}`
        }
        if (items.length === 0) return "已記錄，但沒有新增任何項目。"
        const titles = items.map((i: any) => i.title ?? i.content ?? "（無標題）").join("、")
        if (skippedDuplicates.length > 0) {
          const skippedTitles = skippedDuplicates.join("、")
          return `✅ 已記錄 ${items.length} 個項目：${titles}（另有 ${skippedDuplicates.length} 個已存在的任務未重複建立：${skippedTitles}）`
        }
        return `✅ 已記錄 ${items.length} 個項目：${titles}`
      } catch (error) {
        console.error("[brain-dump] tool failed:", error)
        return buildBrainDumpFailureMessage(text, error)
      }
    },
  })

export const createBrainDumpSkill = (userId: string) =>
  skill({
    name: "brain_dump",
    description: "記錄任務與想法",
    triggers: ["記下", "記一下", "待辦", "todo", "任務", "想法", "記得", "幫我記", "幫我加", "新增任務", "再加", "再加一個", "補一個"],
    priority: 10,
    run: async (message, _context) => {
      if (!shouldActivateBrainDump(message)) {
        return makeSkillResult({ skillName: "brain_dump", skipped: true })
      }
      return makeSkillResult({
        promptInjection:
          "用戶想要記錄一件事或任務。請直接呼叫 brain_dump 工具，" +
          "工具執行後用繁體中文告知用戶已記錄哪些項目。不要修改用戶的原始文字。",
        extraTools: [createBrainDumpTool(userId, message)],
        skillName: "brain_dump",
      })
    },
  })
