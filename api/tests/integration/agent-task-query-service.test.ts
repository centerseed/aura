import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { prisma } from "@/lib/db"
import { AgentTaskQueryService } from "@/application/use-cases/agent/agent-task-query-service"

describe("AgentTaskQueryService integration", () => {
  let userId: string
  let productId: string
  let areaId: string

  beforeAll(async () => {
    const ts = Date.now()
    const user = await prisma.user.create({
      data: {
        email: `agent-task-query-${ts}@test.example.com`,
        auth_provider_id: `agent-task-query-${ts}`,
        auth_provider: "EMAIL",
        name: "Agent Task Query Test User",
        timezone: "Asia/Taipei",
      },
    })
    userId = user.id

    const area = await prisma.area.create({
      data: {
        user_id: userId,
        name: "工作",
        scope: "工作相關",
        is_custom: true,
      },
    })
    areaId = area.id

    const product = await prisma.product.create({
      data: {
        user_id: userId,
        area_id: areaId,
        name: "Naruvia",
        status: "ACTIVE",
        display_order: 0,
        lifecycle: "FINITE",
      },
    })
    productId = product.id
  }, 30_000)

  afterAll(async () => {
    await prisma.subTask.deleteMany({ where: { task: { user_id: userId } } })
    await prisma.task.deleteMany({ where: { user_id: userId } })
    await prisma.topic.deleteMany({ where: { product: { user_id: userId } } })
    await prisma.product.deleteMany({ where: { user_id: userId } })
    await prisma.area.deleteMany({ where: { user_id: userId } })
    await prisma.systemEvaluationLog.deleteMany({ where: { user_id: userId } })
    await prisma.$executeRaw`DELETE FROM naru_memories WHERE user_id = ${userId}`
    await prisma.user.delete({ where: { id: userId } })
  }, 30_000)

  it("uses completed_at instead of updated_at for completed-today", async () => {
    const now = new Date()
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)

    await prisma.task.createMany({
      data: [
        {
          user_id: userId,
          product_id: productId,
          content: "今天完成但昨天更新",
          status: "ARCHIVE",
          completed_at: now,
          updated_at: yesterday,
        },
        {
          user_id: userId,
          product_id: productId,
          content: "昨天完成但今天更新",
          status: "ARCHIVE",
          completed_at: yesterday,
          updated_at: now,
        },
      ],
    })

    const service = new AgentTaskQueryService()
    const result = await service.queryCompletedToday(userId, "Asia/Taipei")

    expect(result.totalCount).toBe(1)
    expect(result.summary).toContain("今天完成但昨天更新")
    expect(result.summary).not.toContain("昨天完成但今天更新")
  })

  it("preserves total count when results are truncated", async () => {
    await prisma.task.deleteMany({ where: { user_id: userId } })

    const completedAt = new Date()
    await prisma.task.createMany({
      data: Array.from({ length: 12 }, (_, index) => ({
        user_id: userId,
        product_id: productId,
        content: `批次完成任務 ${index + 1}`,
        status: "ARCHIVE",
        completed_at: completedAt,
      })),
    })

    const service = new AgentTaskQueryService()
    const result = await service.queryCompletedToday(userId, "Asia/Taipei")

    expect(result.totalCount).toBe(12)
    expect(result.displayCount).toBe(10)
    expect(result.truncated).toBe(true)
    expect(result.summary).toContain("你今天已完成 12 項 Task")
    expect(result.summary).toContain("以下列出其中 10 項")
  })
})

