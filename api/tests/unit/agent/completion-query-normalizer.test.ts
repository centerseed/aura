import { describe, expect, it, vi } from "vitest"
import {
  normalizeCompletionQueryText,
  resolveCompletionQuery,
} from "@/application/use-cases/agent/completion-query-normalizer"

// @ac1, @ac2, @ac3: LLM-first completion query resolution
describe("resolveCompletionQuery — LLM-first", () => {
  it("@ac1 resolves arrow-separator completion statement via LLM", async () => {
    const fallbackAgent = {
      normalize: vi.fn().mockResolvedValue({
        query: "實作 Planner Phase 1",
        confidence: 0.95,
      }),
    }

    const resolved = await resolveCompletionQuery(
      "實作 Planner Phase 1 第一優先 -> 已經完成",
      { fallbackAgent },
    )

    expect(fallbackAgent.normalize).toHaveBeenCalledWith("實作 Planner Phase 1 第一優先 -> 已經完成")
    expect(resolved).toBe("實作 planner phase 1")
  })

  it("@ac2 resolves trailing completion marker via LLM", async () => {
    const fallbackAgent = {
      normalize: vi.fn().mockResolvedValue({
        query: "寫週報",
        confidence: 0.92,
      }),
    }

    const resolved = await resolveCompletionQuery("寫週報已完成", { fallbackAgent })

    expect(fallbackAgent.normalize).toHaveBeenCalledWith("寫週報已完成")
    expect(resolved).toBe("寫週報")
  })

  it("@ac3 resolves resultative completion construction via LLM", async () => {
    const fallbackAgent = {
      normalize: vi.fn().mockResolvedValue({
        query: "寄信給客戶",
        confidence: 0.90,
      }),
    }

    const resolved = await resolveCompletionQuery("信已經發出去給客戶了", { fallbackAgent })

    expect(fallbackAgent.normalize).toHaveBeenCalledWith("信已經發出去給客戶了")
    expect(resolved).toBe("寄信給客戶")
  })

  it("uses LLM agent when available and confidence >= 0.7", async () => {
    const fallbackAgent = {
      normalize: vi.fn().mockResolvedValue({
        query: "跑步",
        confidence: 0.91,
      }),
    }

    const resolved = await resolveCompletionQuery("我今天已經跑完步了，幫我標記完成", {
      fallbackAgent,
    })

    expect(fallbackAgent.normalize).toHaveBeenCalledWith("我今天已經跑完步了，幫我標記完成")
    expect(resolved).toBe("跑步")
  })

  it("falls back to basic text cleanup when agent confidence is below threshold", async () => {
    const fallbackAgent = {
      normalize: vi.fn().mockResolvedValue({
        query: "晨跑",
        confidence: 0.4,
      }),
    }

    const resolved = await resolveCompletionQuery("我今天已經跑完步了，幫我標記完成", {
      fallbackAgent,
    })

    // confidence < 0.7 → fallback to normalizeCompletionQueryText
    expect(resolved).toBe("我今天已經跑完步了，幫我標記完成")
  })

  it("falls back to basic text cleanup when agent returns empty query for deictic input", async () => {
    const fallbackAgent = {
      normalize: vi.fn().mockResolvedValue({
        query: "",
        confidence: 0.95,
      }),
    }

    const resolved = await resolveCompletionQuery("這個 done 了", { fallbackAgent })

    // empty query → fallback to normalizeCompletionQueryText
    expect(resolved).toBe("這個 done 了")
  })

  it("@ac9 graceful degradation: returns basic text cleanup when agent unavailable", async () => {
    const resolved = await resolveCompletionQuery("寫週報已完成", { fallbackAgent: null })

    // No LLM available → basic text cleanup only
    expect(resolved).toBe("寫週報已完成")
  })

  it("@ac9 graceful degradation: returns text if agent throws", async () => {
    const fallbackAgent = {
      normalize: vi.fn().mockRejectedValue(new Error("LLM unavailable")),
    }

    const resolved = await resolveCompletionQuery("跑步完成了", { fallbackAgent })

    expect(resolved).toBe("跑步完成了")
  })
})

// normalizeCompletionQueryText: pure text cleanup (no NLU)
describe("normalizeCompletionQueryText — pure text cleanup", () => {
  it("lowercases and collapses whitespace", () => {
    expect(normalizeCompletionQueryText("  買  牛奶  ")).toBe("買 牛奶")
    expect(normalizeCompletionQueryText("買牛奶完成了")).toBe("買牛奶完成了")
    expect(normalizeCompletionQueryText("API  文件整理")).toBe("api 文件整理")
  })

  it("returns empty string for empty input", () => {
    expect(normalizeCompletionQueryText("")).toBe("")
    expect(normalizeCompletionQueryText("   ")).toBe("")
  })
})
