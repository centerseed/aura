/**
 * LINE Webhook — 接收 LINE 平台事件
 *
 * 處理：
 * 1. 未綁定用戶 → 生成 magic link → push URL
 * 2. 一般文字訊息 → NaruAgent
 */

import { NextRequest, NextResponse } from "next/server"
import { verifyLineSignature, getLineClient } from "@/lib/line-client"
import { createZentropyAgent } from "@/application/use-cases/agent/zentropy-agent"
import { prisma } from "@/lib/db"
import { getLineSession, clearLineSession, saveLineSession } from "@/lib/line-session"
import { ExecuteAdjustmentUseCase } from "@/application/use-cases/adjust-tags/execute-adjustment"
import type { AdjustTagsPayload, BrainDumpPendingPayload, CompleteTaskPayload } from "@/lib/line-session"
import { generateLineMagicLink } from "@/lib/line-magic-link"
import { CompleteTaskUseCase } from "@/application/use-cases/tasks/complete-task"
import { classifyConfirmationDisposition, extractBrainDumpConfirmationTarget } from "@/lib/line-confirmation"
import { UpdateSubItemUseCase } from "@/application/use-cases/tasks/update-sub-item"
import { UpdatePlanItemUseCase } from "@/application/use-cases/coach/update-plan-item"
import { createBrainDumpTool } from "@/application/use-cases/agent/brain-dump-skill"
import { parseToolResult } from "@/application/use-cases/agent/tool-result-protocol"
import { normalizeAgentUsage } from "@/application/use-cases/agent/llm-logging"

interface LineMessagePhaseTimings {
  user_lookup_ms?: number
  session_lookup_ms?: number
  pending_execute_ms?: number
  agent_chat_ms?: number
  push_ms?: number
  total_ms?: number
}

interface LineMessageUsage {
  inputTokens: number
  outputTokens: number
  totalTokens: number
  classifierInputTokens?: number
  classifierOutputTokens?: number
  classifierTotalTokens?: number
}

export async function POST(req: NextRequest) {
  const body = await req.text()
  const signature = req.headers.get("x-line-signature") ?? ""

  if (!verifyLineSignature(body, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
  }

  const payload = JSON.parse(body || "{}")
  const client = getLineClient()

  for (const event of payload.events ?? []) {
    const lineUserId: string = event.source?.userId
    if (!lineUserId) continue

    // ── 加好友事件 ────────────────────────────────────────────────────────
    if (event.type === "follow") {
      Promise.resolve().then(async () => {
        const user = await prisma.user.findFirst({
          where: { line_user_id: lineUserId, deleted_at: null },
          select: { id: true },
        })
        if (!user) {
          const { url, isReused } = await generateLineMagicLink(lineUserId)
          const msg = isReused
            ? "歡迎回來！你之前已收過綁定連結，請使用該連結登入完成綁定，或稍後再試。"
            : `👋 你好！我是 Zentropy 任務助理。\n\n請先到官網登入，完成 LINE 帳號綁定：\n\n${url}\n\n連結 15 分鐘內有效 🔐\n\n綁定完成後即可透過 LINE 管理你的任務！`
          await client.pushMessage({
            to: lineUserId,
            messages: [{ type: "text", text: msg }],
          })
        }
        // 已綁定：不推送，避免打擾
      }).catch((err) => {
        console.error("[LINE Webhook] Follow event error:", err)
      })
      continue
    }

    if (event.type !== "message" || event.message?.type !== "text") continue

    const text: string = event.message.text

    // ── 一般對話 → NaruAgent ────────────────────────────────────────────
    // 直接 await：Cloud Run 回應後會節流 CPU，fire-and-forget 會導致 30 秒延遲。
    // 使用 pushMessage（非 replyMessage），無 5 秒 reply token 限制。
    // 正常處理 5-10 秒，在 LINE webhook 30 秒 timeout 之內。
    await (async () => {
      const startedAt = Date.now()
      const timings: LineMessagePhaseTimings = {}
      let usage: LineMessageUsage = {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
      }
      let userId: string | null = null
      let outcome = "unknown"
      let sessionType: string | null = null
      let toolCalls: string[] = []
      try {
        const userLookupStartedAt = Date.now()
        const user = await prisma.user.findFirst({
          where: { line_user_id: lineUserId, deleted_at: null },
          select: { id: true },
        })
        timings.user_lookup_ms = Date.now() - userLookupStartedAt
        userId = user?.id ?? null

        if (!user) {
          // 未綁定：生成 magic link 並 push
          const { url, isReused } = await generateLineMagicLink(lineUserId)
          const msg = isReused
            ? "你已收過綁定連結，請使用之前的連結完成綁定，或稍後再試。"
            : `請先到官網完成 LINE 帳號綁定：\n\n${url}\n\n連結 15 分鐘內有效 🔐`
          const pushStartedAt = Date.now()
          await client.pushMessage({
            to: lineUserId,
            messages: [{ type: "text", text: msg }],
          })
          timings.push_ms = Date.now() - pushStartedAt
          outcome = "unbound_magic_link"
          return
        }

        // ── Session 攔截：先查 session，再判斷 disposition ───────────────
        const sessionLookupStartedAt = Date.now()
        const session = await getLineSession(lineUserId)
        timings.session_lookup_ms = Date.now() - sessionLookupStartedAt
        sessionType = session?.type ?? null
        if (session) {
          const disposition = classifyConfirmationDisposition(text)

          if (disposition === "reject") {
            await clearLineSession(lineUserId)
            const pushStartedAt = Date.now()
            await client.pushMessage({
              to: lineUserId,
              messages: [{ type: "text", text: "好的，已取消。" }],
            })
            timings.push_ms = Date.now() - pushStartedAt
            outcome = "pending_reject"
            return
          }

          if (disposition === "override") {
            // 用戶有新意圖，清除 pending session，進入正常 agent 流程
            await clearLineSession(lineUserId)
            // fall through to agent
          } else {
            // disposition === "confirm" → 執行 pending operation
            const pendingExecuteStartedAt = Date.now()
            if (session.type === "adjust_tags_preview") {
              const p = session.payload as AdjustTagsPayload
              const executeUC = new ExecuteAdjustmentUseCase()
              const result = await executeUC.execute({
                userId: user.id,
                intentType: p.intentType,
                taskMatches: p.taskMatches,
                targetArea: p.targetArea,
                targetProduct: p.targetProduct,
                targetTopic: p.targetTopic,
                taskMap: p.taskMap as Parameters<typeof executeUC.execute>[0]["taskMap"],
                logId: p.logId,
              })
              timings.pending_execute_ms = Date.now() - pendingExecuteStartedAt
              await clearLineSession(lineUserId)
              const summary = result.operationLog.join("\n")
              const pushStartedAt = Date.now()
              await client.pushMessage({
                to: lineUserId,
                messages: [{ type: "text", text: `✅ 已完成分類調整：\n\n${summary}` }],
              })
              timings.push_ms = Date.now() - pushStartedAt
              outcome = "adjust_tags_confirmed"
              return
            }

            if (session.type === "complete_task_confirm") {
              const p = session.payload as CompleteTaskPayload
              if (p.sourceType === "sub_task" && p.taskId && p.subTaskId) {
                const updateSubItemUseCase = new UpdateSubItemUseCase()
                await updateSubItemUseCase.execute({
                  taskId: p.taskId,
                  subItemId: p.subTaskId,
                  userId: user.id,
                  completed: true,
                })
              } else if (p.sourceType === "daily_plan_item" && p.planItemId) {
                const updatePlanItemUseCase = new UpdatePlanItemUseCase()
                await updatePlanItemUseCase.execute({
                  itemId: p.planItemId,
                  userId: user.id,
                  completed: true,
                })
              } else if (p.taskId) {
                const completeTaskUseCase = new CompleteTaskUseCase()
                await completeTaskUseCase.execute({
                  taskId: p.taskId,
                  userId: user.id,
                })
              } else {
                throw new Error("Invalid complete_task_confirm payload")
              }
              timings.pending_execute_ms = Date.now() - pendingExecuteStartedAt
              await clearLineSession(lineUserId)
              const pushStartedAt = Date.now()
              await client.pushMessage({
                to: lineUserId,
                messages: [{ type: "text", text: `✅ 已完成「${p.taskTitle}」` }],
              })
              timings.push_ms = Date.now() - pushStartedAt
              outcome = "complete_task_confirmed"
              return
            }

            if (session.type === "brain_dump_pending") {
              const p = session.payload as BrainDumpPendingPayload
              const toolOutput = await createBrainDumpTool(user.id, p.originalText).execute({})
              timings.pending_execute_ms = Date.now() - pendingExecuteStartedAt
              await clearLineSession(lineUserId)
              const pushStartedAt = Date.now()
              await client.pushMessage({
                to: lineUserId,
                messages: [{ type: "text", text: parseToolResult(toolOutput).summary }],
              })
              timings.push_ms = Date.now() - pushStartedAt
              outcome = "brain_dump_confirmed"
              return
            }
          }
        }

        // ── 一般 Agent 對話 ──────────────────────────────────────────────
        const agent = createZentropyAgent(user.id, lineUserId)
        const tAgentStart = Date.now()
        console.log(JSON.stringify({ event: "line_agent_start", userId: user.id, lineUserId, textLen: text.length }))
        const result = await agent.chat(text, {
          userId: user.id,
          sessionId: lineUserId,
        })
        timings.agent_chat_ms = Date.now() - tAgentStart
        toolCalls = result.toolCalls
        usage = {
          ...normalizeAgentUsage(result.usage),
          ...extractClassifierUsageForLine(result.trace),
        }
        console.log(JSON.stringify({ event: "line_agent_end", userId: user.id, lineUserId, total_ms: timings.agent_chat_ms, toolsUsed: result.toolCalls, timings: result.timings, usage }))

        const pendingBrainDumpTarget = extractBrainDumpConfirmationTarget(result.content)
        if (pendingBrainDumpTarget) {
          await saveLineSession(lineUserId, "brain_dump_pending", {
            originalText: pendingBrainDumpTarget,
            taskTitle: pendingBrainDumpTarget,
          })
        }

        const pushStartedAt = Date.now()
        await client.pushMessage({
          to: lineUserId,
          messages: [{ type: "text", text: result.content }],
        })
        timings.push_ms = Date.now() - pushStartedAt
        outcome = "agent_reply"
      } catch (err) {
        console.error("[LINE Webhook] Agent error:", err)
        const pushStartedAt = Date.now()
        await client.pushMessage({
          to: lineUserId,
          messages: [{ type: "text", text: "抱歉，處理過程中發生錯誤，請稍後再試。" }],
        })
        timings.push_ms = Date.now() - pushStartedAt
        outcome = "error"
      } finally {
        timings.total_ms = Date.now() - startedAt
        console.log(JSON.stringify({
          event: "line_message_complete",
          userId,
          lineUserId,
          textLen: text.length,
          outcome,
          sessionType,
          toolCalls,
          timings,
          usage,
        }))
      }
    })().catch((err) => {
      console.error("[LINE Webhook] Processing error:", err)
    })
  }

  return NextResponse.json({ ok: true })
}

function extractClassifierUsageForLine(trace: unknown): Partial<LineMessageUsage> {
  if (!trace || typeof trace !== "object") return {}

  const classifierUsage = (trace as {
    metadata?: {
      classifierUsage?: {
        inputTokens?: unknown
        outputTokens?: unknown
        totalTokens?: unknown
      }
    }
  }).metadata?.classifierUsage

  if (!classifierUsage) return {}

  return {
    classifierInputTokens: typeof classifierUsage.inputTokens === "number" ? classifierUsage.inputTokens : 0,
    classifierOutputTokens: typeof classifierUsage.outputTokens === "number" ? classifierUsage.outputTokens : 0,
    classifierTotalTokens: typeof classifierUsage.totalTokens === "number" ? classifierUsage.totalTokens : 0,
  }
}
