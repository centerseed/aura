/**
 * LINE 帳號綁定 Route
 *
 * POST  /api/line/connect  — 產生綁定 token
 * DELETE /api/line/connect — 解除綁定
 */

import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest } from "@/lib/auth-middleware"
import { prisma } from "@/lib/db"
import crypto from "crypto"

export async function POST(req: NextRequest) {
  let userId: string
  try {
    userId = await authenticateRequest(req, prisma)
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const token = crypto.randomBytes(16).toString("hex")

  await prisma.user.update({
    where: { id: userId },
    data: { line_binding_token: token },
  })

  return NextResponse.json({
    binding_token: token,
    line_add_friend_url: `https://line.me/R/ti/p/${process.env.LINE_BOT_BASIC_ID}`,
    instructions: `加入 LINE 官方帳號後，傳送「bind:${token}」完成綁定`,
  })
}

export async function DELETE(req: NextRequest) {
  let userId: string
  try {
    userId = await authenticateRequest(req, prisma)
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  await prisma.user.update({
    where: { id: userId },
    data: { line_user_id: null, line_bound_at: null, line_binding_token: null },
  })

  return NextResponse.json({ ok: true })
}
