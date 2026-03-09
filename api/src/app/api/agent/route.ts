/**
 * POST /api/agent — Zentropy Intent Agent
 *
 * Interface Layer: 認證 → 建立 Agent → 對話 → 回應
 */

import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest } from "@/lib/auth-middleware"
import { prisma } from "@/lib/db"
import { createZentropyAgent } from "@/application/use-cases/agent/zentropy-agent"

export async function POST(request: NextRequest) {
  try {
    // 1. 認證
    const userId = await authenticateRequest(request, prisma)

    // 2. 解析輸入
    const body = await request.json() as Record<string, unknown>
    const message = body.message as string | undefined
    const sessionId = (body.session_id as string | undefined) ?? "default"

    if (!message || typeof message !== "string" || message.trim() === "") {
      return NextResponse.json({ error: "message is required" }, { status: 400 })
    }

    // 3. 建立 Agent 並執行對話
    const agent = createZentropyAgent(userId)
    const result = await agent.chat(message.trim(), {
      userId,
      sessionId,
    })

    return NextResponse.json({
      reply: result.content,
      tool_calls: result.toolCalls,
      usage: result.usage,
    })
  } catch (error: any) {
    if (error?.name === "UnauthorizedException" || error?.statusCode === 401) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    console.error("[agent] Unexpected error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
