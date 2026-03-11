import { describe, expect, it } from "vitest"
import { DeterministicAgentContextAssembler } from "@/application/use-cases/agent/agent-context-assembler"
import { EMPTY_DECISION_CONTEXT } from "@/application/use-cases/agent/agent-context"
import type { ModelMessage } from "ai"

describe("DeterministicAgentContextAssembler", () => {
  const assembler = new DeterministicAgentContextAssembler()

  it("empty history → returns EMPTY_DECISION_CONTEXT equivalent", async () => {
    const result = await assembler.assemble({
      sessionId: "session-1",
      history: [],
      pendingConfirmation: null,
    })

    expect(result.sessionId).toBe("session-1")
    expect(result.lastListedItems).toEqual([])
    expect(result.pendingConfirmation).toBeNull()
    expect(result.lastIntent).toBeNull()
    expect(result.lastQueryFactIds).toEqual([])
    expect(result.clarificationContext).toBeNull()
  })

  it("returns EMPTY_DECISION_CONTEXT structure with correct sessionId", async () => {
    const result = await assembler.assemble({
      sessionId: "test-session",
      history: [],
      pendingConfirmation: null,
    })

    const expected = {
      ...EMPTY_DECISION_CONTEXT,
      sessionId: "test-session",
    }
    expect(result).toEqual(expected)
  })

  it("history with numbered list → lastListedItems correctly parsed", async () => {
    const history: ModelMessage[] = [
      { role: "user", content: "今天要做什麼？" },
      {
        role: "assistant",
        content: "[FACTS]\n{}\n[/FACTS]\n\n📋 目前查到 2 項待處理項目：\n\n1. 晨跑 [健康]\n2. 晚間回顧 [工作]",
      },
    ]

    const result = await assembler.assemble({
      sessionId: "session-1",
      history,
      pendingConfirmation: null,
    })

    expect(result.lastListedItems).toHaveLength(2)
    expect(result.lastListedItems[0]).toMatchObject({ title: "晨跑", position: 1 })
    expect(result.lastListedItems[1]).toMatchObject({ title: "晚間回顧", position: 2 })
  })

  it("history with FACTS items block → lastListedItems correctly parsed", async () => {
    const facts = JSON.stringify({
      items: [
        { title: "整理報告", id: "task-1", type: "task" },
        { title: "寫程式", id: "task-2", type: "task" },
      ],
    })
    const history: ModelMessage[] = [
      { role: "user", content: "查詢任務" },
      {
        role: "assistant",
        content: `[FACTS]\n${facts}\n[/FACTS]\n\n今天有 2 件事`,
      },
    ]

    const result = await assembler.assemble({
      sessionId: "session-1",
      history,
      pendingConfirmation: null,
    })

    expect(result.lastListedItems).toHaveLength(2)
    expect(result.lastListedItems[0]).toMatchObject({ title: "整理報告", entityId: "task-1" })
    expect(result.lastListedItems[1]).toMatchObject({ title: "寫程式", entityId: "task-2" })
  })

  it("pendingConfirmation is passed through directly", async () => {
    const pending = {
      type: "complete_task_confirm",
      taskId: "task-1",
      taskTitle: "晨跑",
    }

    const result = await assembler.assemble({
      sessionId: "session-1",
      history: [],
      pendingConfirmation: pending,
    })

    expect(result.pendingConfirmation).toEqual(pending)
  })

  it("lastIntent and lastQueryFactIds are stub values (v1)", async () => {
    const history: ModelMessage[] = [
      { role: "user", content: "查詢任務" },
      { role: "assistant", content: "今天有 1 件事" },
    ]

    const result = await assembler.assemble({
      sessionId: "session-1",
      history,
      pendingConfirmation: null,
    })

    expect(result.lastIntent).toBeNull()
    expect(result.lastQueryFactIds).toEqual([])
  })
})
