import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { prisma } from "@/lib/db"

const describeIfEnabled = process.env.RUN_LINE_WEBHOOK_E2E === "1" ? describe : describe.skip

const mockPushMessage = vi.fn()

vi.mock("@/lib/line-client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/line-client")>("@/lib/line-client")
  return {
    ...actual,
    verifyLineSignature: vi.fn(() => true),
    getLineClient: vi.fn(() => ({
      pushMessage: mockPushMessage,
    })),
  }
})

const { POST } = await import("@/app/api/line/webhook/route")

function buildMessageRequest(text: string, lineUserId: string): NextRequest {
  return new NextRequest("http://localhost/api/line/webhook", {
    method: "POST",
    headers: {
      "x-line-signature": "valid-signature",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      events: [
        {
          type: "message",
          source: { userId: lineUserId },
          message: {
            type: "text",
            text,
          },
        },
      ],
    }),
  })
}

describeIfEnabled("LINE webhook live UI (real dialogue)", () => {
  let userId: string
  let lineUserId: string

  beforeAll(async () => {
    const ts = Date.now()
    lineUserId = `line-live-ui-${ts}`

    const user = await prisma.user.create({
      data: {
        email: `line-webhook-live-${ts}@test.example.com`,
        auth_provider_id: `line-webhook-live-${ts}`,
        auth_provider: "EMAIL",
        name: "LINE Webhook Live UI Test",
        line_user_id: lineUserId,
      },
    })
    userId = user.id

    const area = await prisma.area.create({
      data: {
        user_id: userId,
        name: "健康",
        scope: "健康相關",
        is_custom: true,
      },
    })

    const product = await prisma.product.create({
      data: {
        user_id: userId,
        area_id: area.id,
        name: "個人",
        status: "ACTIVE",
        display_order: 0,
        lifecycle: "FINITE",
      },
    })

    await prisma.task.createMany({
      data: [
        {
          user_id: userId,
          product_id: product.id,
          content: "晨間跑步",
          status: "ACTIVE",
        },
        {
          user_id: userId,
          product_id: product.id,
          content: "晚間跑步",
          status: "ACTIVE",
        },
      ],
    })
  }, 30_000)

  afterAll(async () => {
    await prisma.linePendingState.deleteMany({ where: { line_user_id: lineUserId } }).catch(() => {})
    await prisma.subTask.deleteMany({ where: { task: { user_id: userId } } })
    await prisma.task.deleteMany({ where: { user_id: userId } })
    await prisma.topic.deleteMany({ where: { product: { user_id: userId } } })
    await prisma.product.deleteMany({ where: { user_id: userId } })
    await prisma.area.deleteMany({ where: { user_id: userId } })
    await prisma.systemEvaluationLog.deleteMany({ where: { user_id: userId } })
    await prisma.$executeRaw`DELETE FROM naru_memories WHERE user_id = ${userId}`
    await prisma.user.delete({ where: { id: userId } })
  }, 30_000)

  it("renders quick reply buttons when completion has multiple candidates", async () => {
    mockPushMessage.mockClear()

    const response = await POST(buildMessageRequest("跑步完成了", lineUserId))

    expect(response.status).toBe(200)
    expect(mockPushMessage).toHaveBeenCalledTimes(1)

    const pushed = mockPushMessage.mock.calls[0]?.[0]
    expect(pushed?.to).toBe(lineUserId)
    expect(pushed?.messages?.[0]?.type).toBe("text")
    expect(pushed?.messages?.[0]?.text).toContain("我找到多個可能的任務")

    const quickReplyItems = pushed?.messages?.[0]?.quickReply?.items ?? []
    expect(quickReplyItems.length).toBeGreaterThanOrEqual(3)
    expect(quickReplyItems.some((item: any) => item.action?.data === "a=select_completion_candidate&p=1")).toBe(true)
    expect(quickReplyItems.some((item: any) => item.action?.data === "a=select_completion_candidate&p=2")).toBe(true)
    expect(quickReplyItems.some((item: any) => item.action?.data === "a=reject_pending")).toBe(true)
  }, 90_000)
})
