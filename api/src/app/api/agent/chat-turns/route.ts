import { NextRequest } from "next/server"
import { authenticateRequest } from "@/lib/auth-middleware"
import { prisma } from "@/lib/db"
import { ApiResponseBuilder, catchDomainException } from "@/lib/api-response"
import { GetAgentChatTurnsUseCase } from "@/application/use-cases/agent/get-chat-turns"

export async function GET(request: NextRequest) {
  return catchDomainException(async () => {
    const userId = await authenticateRequest(request, prisma)
    const { searchParams } = new URL(request.url)

    const useCase = new GetAgentChatTurnsUseCase()
    const result = await useCase.execute({
      userId,
      channel: (searchParams.get("channel") as "API" | "LINE" | null) ?? undefined,
      status: (searchParams.get("status") as "SUCCESS" | "ERROR" | null) ?? undefined,
      sessionId: searchParams.get("session_id") ?? undefined,
      from: searchParams.get("from") ?? undefined,
      to: searchParams.get("to") ?? undefined,
      limit: searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : undefined,
      offset: searchParams.get("offset") ? parseInt(searchParams.get("offset")!, 10) : undefined,
    })

    return ApiResponseBuilder.success(result, {})
  })
}
