/**
 * LINE Webhook — 接收 LINE 平台事件
 *
 * 處理：
 * 1. 綁定流程（bind:<token>）
 * 2. 一般文字訊息 → NaruAgent
 */

import { NextRequest, NextResponse } from "next/server"
import { verifyLineSignature, getLineClient } from "@/lib/line-client"
import { createZentropyAgent } from "@/application/use-cases/agent/zentropy-agent"
import { prisma } from "@/lib/db"
import { getLineSession, clearLineSession } from "@/lib/line-session"
import { ExecuteAdjustmentUseCase } from "@/application/use-cases/adjust-tags/execute-adjustment"
import { Status } from "@prisma/client"
import type { AdjustTagsPayload, CompleteTaskPayload } from "@/lib/line-session"

export async function POST(req: NextRequest) {
  const body = await req.text()
  const signature = req.headers.get("x-line-signature") ?? ""

  if (!verifyLineSignature(body, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
  }

  const payload = JSON.parse(body)
  const client = getLineClient()

  for (const event of payload.events ?? []) {
    if (event.type !== "message" || event.message?.type !== "text") continue

    const lineUserId: string = event.source.userId
    const text: string = event.message.text
    const replyToken: string = event.replyToken

    // ── 綁定流程 ──────────────────────────────────────────────────────
    if (text.startsWith("bind:")) {
      const token = text.replace("bind:", "").trim()
      const user = await prisma.user.findFirst({
        where: { line_binding_token: token },
        select: { id: true },
      })

      if (!user) {
        await client.replyMessage({
          replyToken,
          messages: [
            {
              type: "text",
              text: "綁定碼無效或已過期，請重新在 Zentropy 產生。",
            },
          ],
        })
        continue
      }

      await prisma.user.update({
        where: { id: user.id },
        data: {
          line_user_id: lineUserId,
          line_bound_at: new Date(),
          line_binding_token: null,
        },
      })

      await client.replyMessage({
        replyToken,
        messages: [
          {
            type: "text",
            text: "✅ 綁定成功！明天早上 7:30 會收到晨報。\n\n隨時傳訊息記錄任務，我都會幫你整理好。",
          },
        ],
      })
      continue
    }

    // ── 一般對話 → NaruAgent（背景處理，避免 reply token 5 秒過期）──────
    // 不 await — 立刻進入下一個 event，最後 return 200
    Promise.resolve().then(async () => {
      const user = await prisma.user.findFirst({
        where: { line_user_id: lineUserId, deleted_at: null },
        select: { id: true },
      })

      if (!user) {
        await client.pushMessage({
          to: lineUserId,
          messages: [{ type: "text", text: "請先在 Zentropy App 完成 LINE 帳號綁定。" }],
        })
        return
      }

      try {
        // ── Session 攔截：多步驟確認對話 ────────────────────────────────
        const isConfirm = /^確認$|^confirm$/i.test(text.trim())
        if (isConfirm) {
          const session = await getLineSession(lineUserId)
          if (session) {
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
              await prisma.task.update({
                where: { id: p.taskId },
                data: { status: Status.ARCHIVE },
              })
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
        const result = await agent.chat(text, {
          userId: user.id,
          sessionId: lineUserId,
        })

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
