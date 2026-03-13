/**
 * AC5: ContextResolver 單元測試
 */

import { describe, expect, it } from "vitest"
import { ContextResolver, extractTaskMentions, extractLatestTaskCode } from "@/application/use-cases/agent/context-resolver"
import type { AgentSessionState } from "@/application/use-cases/agent/agent-session-state"

function emptyState(): AgentSessionState {
  return { lastPresentedEntities: [], lastRecordedEntities: [] }
}

describe("ContextResolver", () => {
  const resolver = new ContextResolver()

  describe("resolveContextualEntity — ordinal references", () => {
    it("should resolve '第一個' to first presented entity", () => {
      const state: AgentSessionState = {
        lastPresentedEntities: [
          { position: 1, title: "買牛奶", entityType: "task", taskId: "t1" },
          { position: 2, title: "整理文件", entityType: "task", taskId: "t2" },
        ],
        lastRecordedEntities: [],
      }

      const result = resolver.resolveContextualEntity("第一個完成了", state, [])
      expect(result?.title).toBe("買牛奶")
    })

    it("should resolve '第二個' to second presented entity", () => {
      const state: AgentSessionState = {
        lastPresentedEntities: [
          { position: 1, title: "買牛奶", entityType: "task", taskId: "t1" },
          { position: 2, title: "整理文件", entityType: "task", taskId: "t2" },
        ],
        lastRecordedEntities: [],
      }

      const result = resolver.resolveContextualEntity("第二個做完了", state, [])
      expect(result?.title).toBe("整理文件")
    })

    it("should resolve '最後一個' to last presented entity", () => {
      const state: AgentSessionState = {
        lastPresentedEntities: [
          { position: 1, title: "任務A", entityType: "task", taskId: "t1" },
          { position: 2, title: "任務B", entityType: "task", taskId: "t2" },
          { position: 3, title: "任務C", entityType: "task", taskId: "t3" },
        ],
        lastRecordedEntities: [],
      }

      const result = resolver.resolveContextualEntity("最後那個完成了", state, [])
      expect(result?.title).toBe("任務C")
    })

    it("should return null when ordinal index is out of bounds", () => {
      const state: AgentSessionState = {
        lastPresentedEntities: [
          { position: 1, title: "任務A", entityType: "task", taskId: "t1" },
        ],
        lastRecordedEntities: [],
      }

      const result = resolver.resolveContextualEntity("第五個完成了", state, [])
      expect(result).toBeNull()
    })
  })

  describe("resolveContextualEntity — contextual references", () => {
    it("should resolve '剛才記的那個' to last recorded entity", () => {
      const state: AgentSessionState = {
        lastPresentedEntities: [],
        lastRecordedEntities: [
          { position: 1, title: "整理履歷", entityType: "task", taskId: "task-1" },
        ],
      }

      const result = resolver.resolveContextualEntity("剛才記的那個完成了嗎", state, [])
      expect(result?.title).toBe("整理履歷")
    })

    it("should resolve bare completion phrase to single recorded entity", () => {
      const state: AgentSessionState = {
        lastPresentedEntities: [],
        lastRecordedEntities: [
          { position: 1, title: "跑步", entityType: "task", taskId: "task-2" },
        ],
      }

      const result = resolver.resolveContextualEntity("完成了", state, [])
      expect(result?.title).toBe("跑步")
    })

    it("should return null when no context and no pronoun match", () => {
      const result = resolver.resolveContextualEntity("幫我查任務", emptyState(), [])
      expect(result).toBeNull()
    })
  })

  describe("resolveContextualQuery", () => {
    it("should resolve ordinal from session state mentions", () => {
      const state: AgentSessionState = {
        lastPresentedEntities: [
          { position: 1, title: "買牛奶", entityType: "task", taskId: "t1" },
          { position: 2, title: "健身", entityType: "task", taskId: "t2" },
        ],
        lastRecordedEntities: [],
      }

      const result = resolver.resolveContextualQuery("第二個完成了", state, [])
      expect(result).toBe("健身")
    })

    it("should return null for non-referential message", () => {
      const result = resolver.resolveContextualQuery("今天的任務", emptyState(), [])
      expect(result).toBeNull()
    })
  })
})

describe("extractTaskMentions", () => {
  it("should extract numbered list items from assistant message", () => {
    const history = [
      {
        role: "assistant" as const,
        content: "今天有以下任務：\n1. 買牛奶\n2. 整理文件\n3. 開會",
      },
    ]

    const result = extractTaskMentions(history)
    expect(result).toHaveLength(3)
    expect(result[0]).toBe("買牛奶")
    expect(result[1]).toBe("整理文件")
  })

  it("should return empty array when no assistant messages", () => {
    const result = extractTaskMentions([])
    expect(result).toHaveLength(0)
  })
})

describe("extractLatestTaskCode", () => {
  it("should extract task code from history", () => {
    const history = [
      { role: "assistant" as const, content: "已建立任務 ZNT-001234，你可以在代碼 ZNT-001234 查詢" },
    ]

    const result = extractLatestTaskCode(history)
    expect(result).toBe("ZNT-001234")
  })

  it("should return null when no task code found", () => {
    const result = extractLatestTaskCode([
      { role: "assistant" as const, content: "今天有 3 個任務" },
    ])
    expect(result).toBeNull()
  })

  it("should return the last task code when multiple exist", () => {
    const history = [
      { role: "assistant" as const, content: "舊代號 ABC-000001" },
      { role: "assistant" as const, content: "新代號 XYZ-999999" },
    ]

    const result = extractLatestTaskCode(history)
    expect(result).toBe("XYZ-999999")
  })
})
