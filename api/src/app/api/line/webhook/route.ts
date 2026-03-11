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
import { getLineSession, clearLineSession } from "@/lib/line-session"
import { ExecuteAdjustmentUseCase } from "@/application/use-cases/adjust-tags/execute-adjustment"
import type { AdjustTagsPayload, CompleteTaskPayload } from "@/lib/line-session"
import { generateLineMagicLink } from "@/lib/line-magic-link"
import { CompleteTaskUseCase } from "@/application/use-cases/tasks/complete-task"
import { classifyConfirmationDisposition } from "@/lib/line-confirmation"
import { UpdateSubItemUseCase } from "@/application/use-cases/tasks/update-sub-item"
import { UpdatePlanItemUseCase } from "@/application/use-cases/coach/update-plan-item"

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

    // ── 一般對話 → NaruAgent（背景處理，避免 reply token 5 秒過期）──────
    // 不 await — 立刻進入下一個 event，最後 return 200
    Promise.resolve().then(async () => {
      const user = await prisma.user.findFirst({
        where: { line_user_id: lineUserId, deleted_at: null },
        select: { id: true },
      })

      if (!user) {
        // 未綁定：生成 magic link 並 push
        const { url, isReused } = await generateLineMagicLink(lineUserId)
        const msg = isReused
          ? "你已收過綁定連結，請使用之前的連結完成綁定，或稍後再試。"
          : `請先到官網完成 LINE 帳號綁定：\n\n${url}\n\n連結 15 分鐘內有效 🔐`
        await client.pushMessage({
          to: lineUserId,
          messages: [{ type: "text", text: msg }],
        })
        return
      }

      try {
        // ── Session 攔截：先查 session，再判斷 disposition ───────────────
        const session = await getLineSession(lineUserId)
        if (session) {
          const disposition = classifyConfirmationDisposition(text)

          if (disposition === "reject") {
            await clearLineSession(lineUserId)
            await client.pushMessage({
              to: lineUserId,
              messages: [{ type: "text", text: "好的，已取消。" }],
            })
            return
          }

          if (disposition === "override") {
            // 用戶有新意圖，清除 pending session，進入正常 agent 流程
            await clearLineSession(lineUserId)
            // fall through to agent
          } else {
            // disposition === "confirm" → 執行 pending operation
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
              await clearLineSession(lineUserId)
              const summary = result.operationLog.join("\n")
              await client.pushMessage({
                to: lineUserId,
                messages: [{ type: "text", text: `✅ 已完成分類調整：\n\n${summary}` }],
              })
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
              await clearLineSession(lineUserId)
              await client.pushMessage({
                to: lineUserId,
                messages: [{ type: "text", text: `✅ 已完成「${p.taskTitle}」` }],
              })
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
        const tAgentEnd = Date.now()
        console.log(JSON.stringify({ event: "line_agent_end", userId: user.id, lineUserId, total_ms: tAgentEnd - tAgentStart, toolsUsed: result.toolCalls, timings: result.timings }))

        await client.pushMessage({
          to: lineUserId,
          messages: [{ type: "text", text: result.content }],
        })
      } catch (err) {
        console.error("[LINE Webhook] Agent error:", err)
        await client.pushMessage({
          to: lineUserId,
          messages: [{ type: "text", text: "抱歉，處理過程中發生錯誤，請稍後再試。" }],
        })
      }
    }).catch((err) => {
      console.error("[LINE Webhook] Background task error:", err)
    })
  }

  return NextResponse.json({ ok: true })
}
