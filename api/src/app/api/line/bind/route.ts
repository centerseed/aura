/**
 * POST /api/line/bind — Magic Link 綁定
 *
 * 安全檢查順序（不可調換）：
 * 1. Firebase Auth → 未登入 401
 * 2. Token 格式 regex
 * 3. DB 查詢 → 不存在 404
 * 4. 過期 → 410
 * 5. 已使用 → 409
 * 6. line_user_id 已綁其他帳號 → 409
 * 7. Transaction：更新 User + 標記 magic link used
 * 8. LINE push 通知
 */

import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest } from "@/lib/auth-middleware"
import { prisma } from "@/lib/db"
import { getLineClient } from "@/lib/line-client"

const TOKEN_REGEX = /^[0-9a-f]{64}$/

export async function POST(req: NextRequest) {
  // 1. Firebase Auth
  let userId: string
  try {
    userId = await authenticateRequest(req, prisma)
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const token = typeof body.token === "string" ? body.token : ""

  // 2. Token 格式
  if (!token || !TOKEN_REGEX.test(token)) {
    return NextResponse.json({ error: "Invalid token format" }, { status: 400 })
  }

  // 3. DB 查詢
  const link = await prisma.lineMagicLink.findUnique({ where: { token } })
  if (!link) {
    return NextResponse.json({ error: "Token not found" }, { status: 404 })
  }

  const now = new Date()

  // 4. 過期
  if (link.expires_at < now) {
    return NextResponse.json({ error: "Token expired" }, { status: 410 })
  }

  // 5. 已使用
  if (link.used_at !== null) {
    return NextResponse.json({ error: "Token already used" }, { status: 409 })
  }

  // 6. line_user_id 已綁其他帳號
  const existingBound = await prisma.user.findFirst({
    where: { line_user_id: link.line_user_id, deleted_at: null },
    select: { id: true },
  })
  if (existingBound && existingBound.id !== userId) {
    return NextResponse.json(
      { error: "LINE account already bound to another user" },
      { status: 409 }
    )
  }

  // 7. Transaction：更新 User + 標記 magic link used
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        line_user_id: link.line_user_id,
        line_bound_at: now,
        line_binding_token: null,
      },
    }),
    prisma.lineMagicLink.update({
      where: { token },
      data: { used_at: now },
    }),
  ])

  // 8. Fire-and-forget：LINE push 通知
  Promise.resolve().then(async () => {
    try {
      const client = getLineClient()
      await client.pushMessage({
        to: link.line_user_id,
        messages: [
          {
            type: "text",
            text: "✅ 綁定成功！Zentropy 助理已就位 🎉\n\n你可以直接傳訊息給我：\n\n📝 記錄任務\n「幫我記下 XXX」、「待辦：XXX」\n\n📋 查看今日任務\n「今天有哪些待辦」、「任務清單」\n\n✅ 完成任務\n「XXX 完成了」、「XXX 搞定」\n\n🗂️ 拆解目標\n「幫我規劃 XXX」\n\n📁 調整分類\n「把 XXX 移到 YYY」\n\n就這樣，直接說話就行了！",
          },
        ],
      })
    } catch (err) {
      console.error("[line/bind] Failed to push success message:", err)
    }
  }).catch(() => {})

  return NextResponse.json({ ok: true })
}
