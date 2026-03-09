import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { prisma } from "@/lib/db"
import { createZentropyAgent } from "@/application/use-cases/agent/zentropy-agent"

describe("Agent latency sample (real LLM)", () => {
  let userId: string

  beforeAll(async () => {
    const ts = Date.now()
    const user = await prisma.user.create({
      data: {
        email: `agent-latency-${ts}@test.example.com`,
        auth_provider_id: `agent-latency-${ts}`,
        auth_provider: "EMAIL",
        name: "Agent Latency Sample User",
      },
    })
    userId = user.id

    const area = await prisma.area.create({
      data: { user_id: userId, name: "工作", scope: "工作", is_custom: true },
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
        { user_id: userId, product_id: product.id, content: "今天要完成部署", status: "ACTIVE" },
        { user_id: userId, product_id: product.id, content: "補測試案例", status: "ACTIVE" },
        { user_id: userId, product_id: product.id, content: "昨天已完成回歸測試", status: "ARCHIVE" },
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

  it("samples 6 rounds and prints timings", async () => {
    const prompts = [
      "我今天要做什麼？",
      "我今天完成了什麼？",
      "我今天要做什麼？",
      "我今天完成了什麼？",
      "我今天要做什麼？",
      "我今天完成了什麼？",
    ]

    const agent = createZentropyAgent(userId, `line-lat-${Date.now()}`)
    const rows: Array<{ i: number; prompt: string; prefetch: number; llm: number; total: number; toolCalls: string[] }> = []

    for (let i = 0; i < prompts.length; i++) {
      const res = await agent.chat(prompts[i], {
        userId,
        sessionId: `line-lat-${Date.now()}-${i}`,
      })
      rows.push({
        i: i + 1,
        prompt: prompts[i],
        prefetch: res.timings.prefetch ?? -1,
        llm: res.timings.llm ?? -1,
        total: res.timings.total ?? -1,
        toolCalls: res.toolCalls,
      })
    }

    console.log("LATENCY_SAMPLES_BEGIN")
    for (const r of rows) {
      console.log(
        `${r.i}. prefetch=${r.prefetch} llm=${r.llm} total=${r.total} tools=[${r.toolCalls.join(",")}] prompt=${r.prompt}`
      )
    }
    console.log("LATENCY_SAMPLES_END")

    expect(rows.length).toBe(6)
  }, 180_000)
})
