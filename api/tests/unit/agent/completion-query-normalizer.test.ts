import { describe, expect, it } from "vitest"
import {
  normalizeCompletionQueryText,
} from "@/application/use-cases/agent/completion-query-normalizer"

// @ac3, @ac4: resolveCompletionQuery, isCompletionStatusStatement, isStableCompletionQuery,
// normalizeCompletionQuery (deprecated alias) are all deleted — only normalizeCompletionQueryText remains.

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

  it("does not strip completion markers (no NLU)", () => {
    // Raw message passed directly — no extraction layer
    expect(normalizeCompletionQueryText("作 Planner Phase 1 已完成")).toBe("作 planner phase 1 已完成")
    expect(normalizeCompletionQueryText("跑步跑完了")).toBe("跑步跑完了")
    expect(normalizeCompletionQueryText("寫週報已完成")).toBe("寫週報已完成")
  })
})
