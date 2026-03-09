/**
 * Live LLM integration test for LINE query intent routing.
 *
 * This test uses real LLM calls (no mock) to verify:
 * - "我今天完成了什麼？" routes to completed-today query
 * - "我今天要做什麼？" routes to today-active query
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { prisma } from "@/lib/db"
import { createZentropyAgent } from "@/application/use-cases/agent/zentropy-agent"

describe("Agent live query routing (real LLM)", () => {
  let userId: string

  beforeAll(async () => {
    const ts = Date.now()
    const user = await prisma.user.create({
      data: {
        email: `agent-live-query-${ts}@test.example.com`,
        auth_provider_id: `agent-live-query-${ts}`,
        auth_provider: "EMAIL",
        name: "Agent Live Query Test",
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

    const product = await prisma.product.create({
      data: {
        user_id: userId,
        area_id: area.id,
        name: "Naruvia",
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
          content: "完成 API 部署",
          status: "ARCHIVE",
          completed_at: new Date(),
        },
        {
          user_id: userId,
          product_id: product.id,
          content: "修正 LINE 查詢邏輯",
          status: "ARCHIVE",
          completed_at: new Date(),
        },
        {
          user_id: userId,
          product_id: product.id,
          content: "整理明日待辦",
          status: "ACTIVE",
          updated_at: new Date(),
        },
      ],
    })
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

  it("asks completed-today and should call completed query tool", async () => {
    const agent = createZentropyAgent(userId, `line-live-${Date.now()}-done`)
    const result = await agent.chat("我今天完成了什麼？", {
      userId,
      sessionId: `line-live-${Date.now()}-done`,
    })

    expect(result.toolCalls).toContain("query_completed_today_tasks")
    expect(result.content).toMatch(/完成|已完成/)
    expect(result.content).toContain("完成 API 部署")
  }, 90_000)

  it("asks today-todo and should call today active query tool", async () => {
    const agent = createZentropyAgent(userId, `line-live-${Date.now()}-todo`)
    const result = await agent.chat("我今天要做什麼？", {
      userId,
      sessionId: `line-live-${Date.now()}-todo`,
    })

    expect(result.toolCalls).toContain("query_today_tasks")
    expect(result.content).toMatch(/今日任務|待辦|要做/)
  }, 30_000)
})
