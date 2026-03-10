import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { prisma } from "@/lib/db"
import { createZentropyAgent } from "@/application/use-cases/agent/zentropy-agent"

async function waitForMemoryRows(userId: string, timeoutMs = 10_000): Promise<number> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const rows = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count
      FROM naru_memories
      WHERE user_id = ${userId}
    `
    const count = Number(rows[0]?.count ?? 0)
    if (count > 0) return count
    await new Promise((resolve) => setTimeout(resolve, 300))
  }
  return 0
}

const describeIfEnabled = process.env.RUN_AGENT_MEMORY_E2E === "1" ? describe : describe.skip

describeIfEnabled("Agent memory cross-session persistence (real LLM)", () => {
  let userId: string
  const code = `MEM-${Date.now().toString().slice(-6)}`

  beforeAll(async () => {
    const ts = Date.now()
    const user = await prisma.user.create({
      data: {
        email: `agent-memory-${ts}@test.example.com`,
        auth_provider_id: `agent-memory-${ts}`,
        auth_provider: "EMAIL",
        name: "Agent Memory Test User",
      },
    })
    userId = user.id
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

  it("stores fact and recalls it in a different session", async () => {
    const agent = createZentropyAgent(userId, `line-memory-${Date.now()}`)
    const sessionA = `memory-a-${Date.now()}`
    const sessionB = `memory-b-${Date.now()}`

    const storeResult = await agent.chat(
      `請記住我的驗證代號是 ${code}。只回覆「收到」。`,
      { userId, sessionId: sessionA },
    )
    expect(storeResult.content).not.toBe("抱歉，我剛剛出了一點狀況，可以再說一次嗎？")

    const memoryCount = await waitForMemoryRows(userId)
    expect(memoryCount).toBeGreaterThan(0)

    const recallResult = await agent.chat("我剛剛告訴你的驗證代號是什麼？只回答代號。", {
      userId,
      sessionId: sessionB,
    })
    expect(recallResult.content).not.toBe("抱歉，我剛剛出了一點狀況，可以再說一次嗎？")
    expect(recallResult.content).toContain(code)
  }, 120_000)

  it("still recalls after simulated restart (module reload)", async () => {
    vi.resetModules()
    const mod = await import("@/application/use-cases/agent/zentropy-agent")
    const restartedAgent = mod.createZentropyAgent(userId, `line-memory-restart-${Date.now()}`)

    const recallAfterRestart = await restartedAgent.chat(
      "重新啟動後，我之前給的驗證代號是什麼？只回答代號。",
      { userId, sessionId: `memory-restart-${Date.now()}` },
    )

    expect(recallAfterRestart.content).not.toBe("抱歉，我剛剛出了一點狀況，可以再說一次嗎？")
    expect(recallAfterRestart.content).toContain(code)
  }, 120_000)
})
