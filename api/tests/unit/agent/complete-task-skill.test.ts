import { describe, expect, it } from "vitest"
import { lexicalMatchScore, pickSearchCandidates } from "@/application/use-cases/agent/complete-task-skill"

describe("CompleteTaskSkill lexical candidate search", () => {
  it("prefers lexical matches over recency fallback", () => {
    const tasks = [
      { id: "task-1", content: "整理會議記錄" },
      { id: "task-2", content: "修正 LINE 查詢邏輯" },
      { id: "task-3", content: "提交版本更新" },
    ]

    const candidates = pickSearchCandidates("查詢邏輯", tasks)

    expect(candidates[0].id).toBe("task-2")
  })

  it("falls back to leading tasks when there is no lexical match", () => {
    const tasks = Array.from({ length: 50 }, (_, index) => ({
      id: `task-${index + 1}`,
      content: `任務 ${index + 1}`,
    }))

    const candidates = pickSearchCandidates("完全無關的描述", tasks)

    expect(candidates).toHaveLength(40)
    expect(candidates[0].id).toBe("task-1")
    expect(candidates[39].id).toBe("task-40")
  })

  it("gives higher lexical score to direct substring matches", () => {
    const direct = lexicalMatchScore("完成 API 部署", "今天完成 API 部署")
    const weak = lexicalMatchScore("完成 API 部署", "整理部署文件")

    expect(direct).toBeGreaterThan(weak)
  })
})

