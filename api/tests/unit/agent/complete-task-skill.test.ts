import { describe, expect, it } from "vitest"
import {
  buildDisambiguationMessage,
  decideTaskMatch,
  lexicalMatchScore,
  pickSearchCandidates,
} from "@/application/use-cases/agent/complete-task-skill"
import { normalizeCompletionQuery } from "@/application/use-cases/agent/completion-query-normalizer"

describe("CompleteTaskSkill lexical candidate search", () => {
  it("prefers lexical matches over unrelated tasks", () => {
    const tasks = [
      { id: "task-1", content: "整理會議記錄" },
      { id: "task-2", content: "修正 LINE 查詢邏輯" },
      { id: "task-3", content: "提交版本更新" },
    ]

    const candidates = pickSearchCandidates("查詢邏輯", tasks)

    expect(candidates[0].id).toBe("task-2")
  })

  it("returns no candidates when there is no lexical match", () => {
    const tasks = Array.from({ length: 50 }, (_, index) => ({
      id: `task-${index + 1}`,
      content: `任務 ${index + 1}`,
    }))

    const candidates = pickSearchCandidates("完全無關的描述", tasks)

    expect(candidates).toHaveLength(0)
  })

  it("gives higher lexical score to direct substring matches", () => {
    const direct = lexicalMatchScore("完成 API 部署", "今天完成 API 部署")
    const weak = lexicalMatchScore("完成 API 部署", "整理部署文件")

    expect(direct).toBeGreaterThan(weak)
  })

  it("prefers Chinese bigram overlap for short task titles", () => {
    const closer = lexicalMatchScore("週一跑步", "週一跑步")
    const near = lexicalMatchScore("週一跑步", "週二跑步")
    const far = lexicalMatchScore("週一跑步", "晨跑")

    expect(closer).toBeGreaterThan(near)
    expect(near).toBeGreaterThan(far)
  })

  it("normalizes compact variants like 1on1 for lexical matching", () => {
    const direct = lexicalMatchScore("吳柏宗 1on1會議", "與吳柏宗安排 1 on 1 會議")
    const weak = lexicalMatchScore("吳柏宗 1on1會議", "與 Rebecca 安排 1 on 1 會議")

    expect(direct).toBeGreaterThan(weak)
  })

  it("normalizeCompletionQuery is pure text cleanup (no NLU stripping)", () => {
    // normalizeCompletionQuery is now pure text cleanup (lowercase + whitespace collapse)
    // Task name extraction from completion phrasing is done by resolveCompletionQuery (LLM-primary)
    expect(normalizeCompletionQuery("跑步跑完了")).toBe("跑步跑完了")
    expect(normalizeCompletionQuery("週一跑步我做完了")).toBe("週一跑步我做完了")
    expect(normalizeCompletionQuery("DONE")).toBe("done")
  })

  it("uses normalized query for candidate selection", () => {
    const tasks = [
      { id: "task-1", content: "晨跑" },
      { id: "task-2", content: "跑步" },
      { id: "task-3", content: "週一跑步" },
    ]

    const candidates = pickSearchCandidates("跑步跑完了", tasks)

    expect(candidates[0].id).toBe("task-2")
  })

  it("keeps verb-object variants aligned through shared lexical matching", () => {
    const tasks = [
      { id: "task-1", content: "繳交電費" },
      { id: "task-2", content: "繳房租" },
      { id: "task-3", content: "整理報稅資料" },
    ]

    const candidates = pickSearchCandidates("繳電費繳掉了", tasks)

    expect(candidates[0]?.id).toBe("task-1")
    expect(lexicalMatchScore("繳電費", "繳交電費")).toBeGreaterThan(lexicalMatchScore("繳電費", "繳房租"))
  })

  it("keeps reversed word-order variants above the lexical cutoff", () => {
    const reversed = lexicalMatchScore("書桌整理", "整理書桌")

    expect(reversed).toBeGreaterThanOrEqual(45)
  })

  it("keeps reversed word-order variants in the candidate set", () => {
    const tasks = [
      { id: "task-1", content: "整理書桌" },
      { id: "task-2", content: "整理報銷資料" },
      { id: "task-3", content: "買牛奶" },
    ]

    const candidates = pickSearchCandidates("書桌整理好了", tasks)

    expect(candidates.map((item) => item.id)).toContain("task-1")
  })

  it("keeps code-switching completion variants aligned with the task title", () => {
    const tasks = [
      { id: "task-1", content: "寄 email 給客戶" },
      { id: "task-2", content: "整理客戶名單" },
      { id: "task-3", content: "安排客戶會議" },
    ]

    const candidates = pickSearchCandidates("剛剛把 email 寄給客戶了", tasks)

    expect(candidates[0]?.id).toBe("task-1")
  })

  it("keeps multi-clause completion variants aligned after normalization", () => {
    const tasks = [
      { id: "task-1", content: "更新客戶名單" },
      { id: "task-2", content: "整理 API 文件" },
      { id: "task-3", content: "買牛奶" },
    ]

    const candidates = pickSearchCandidates("我今天已經把客戶名單更新完了，幫我標記完成", tasks)

    expect(candidates[0]?.id).toBe("task-1")
  })

  it("keeps typo-tolerant candidates via Levenshtein similarity", () => {
    const tasks = [
      { id: "task-1", content: "整理會議記錄" },
      { id: "task-2", content: "整裡會議紀錄" },
      { id: "task-3", content: "提交版本更新" },
    ]

    const candidates = pickSearchCandidates("整理會議記錄", tasks)

    expect(candidates.map((item) => item.id)).toContain("task-2")
  })

  it("dedupes repeated candidates before lexical ranking", () => {
    const tasks = [
      { id: "task-1", taskId: "task-1", sourceType: "task" as const, content: "與 Rebecca 安排 1 on 1 會議" },
      { id: "task-1-dup", taskId: "task-1", sourceType: "task" as const, content: "與 Rebecca 安排 1 on 1 會議" },
      { id: "task-2", taskId: "task-2", sourceType: "task" as const, content: "與吳柏宗安排 1 on 1 會議" },
    ]

    const candidates = pickSearchCandidates("吳柏宗 1on1會議", tasks)

    expect(candidates).toHaveLength(2)
    expect(candidates.some((item) => item.taskId === "task-2")).toBe(true)
  })

  it("dedupes the same underlying task across task and daily plan sources", () => {
    const tasks = [
      { id: "plan-1", planItemId: "plan-1", taskId: "task-1", sourceType: "daily_plan_item" as const, content: "與 Rebecca 安排 1 on 1 會議" },
      { id: "task-1", taskId: "task-1", sourceType: "task" as const, content: "與 Rebecca 安排 1 on 1 會議" },
      { id: "plan-2", planItemId: "plan-2", taskId: "task-1", sourceType: "daily_plan_item" as const, content: "與 Rebecca 安排 1 on 1 會議" },
    ]

    const candidates = pickSearchCandidates("Rebecca 1on1會議", tasks)

    expect(candidates).toHaveLength(1)
    expect(candidates[0]).toMatchObject({
      id: "task-1",
      sourceType: "task",
      taskId: "task-1",
    })
  })

  it("requires disambiguation when top candidates are too close", () => {
    const decision = decideTaskMatch([
      {
        id: "task-1",
        content: "修正 LINE 查詢邏輯",
        productName: "Naruvia",
        lexicalScore: 68,
        combinedScore: 0.67,
      },
      {
        id: "task-2",
        content: "修正 LINE 任務查詢",
        productName: "Naruvia",
        lexicalScore: 64,
        combinedScore: 0.61,
      },
    ])

    expect(decision.type).toBe("disambiguation")
  })

  it("uses singular clarification copy when only one candidate remains", () => {
    const message = buildDisambiguationMessage("Rebecca會議", [
      {
        id: "task-1",
        taskId: "task-1",
        content: "與 Rebecca 安排 1 on 1 會議",
        productName: "BNI",
        sourceType: "task",
        lexicalScore: 52,
        combinedScore: 0.52,
      },
    ])

    expect(message).toContain("我只找到一個可能的任務")
    expect(message).not.toContain("我找到多個可能的任務")
  })

  it("selects a task only when confidence is clearly separated", () => {
    const decision = decideTaskMatch([
      {
        id: "task-1",
        content: "完成 API 部署",
        productName: "Naruvia",
        lexicalScore: 86,
        combinedScore: 0.9,
      },
      {
        id: "task-2",
        content: "整理部署文件",
        productName: "Naruvia",
        lexicalScore: 31,
        combinedScore: 0.48,
      },
    ])

    expect(decision).toMatchObject({
      type: "selected",
      task: { id: "task-1" },
    })
  })
})
