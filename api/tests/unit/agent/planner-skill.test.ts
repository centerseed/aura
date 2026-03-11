import { describe, expect, it } from "vitest"
import { normalizePlanningGoalFromMessage } from "@/application/use-cases/agent/planner-skill"

describe("normalizePlanningGoalFromMessage", () => {
  it("strips planning command prefixes while preserving the actual goal", () => {
    expect(normalizePlanningGoalFromMessage("幫我規劃學英文的計畫")).toBe("學英文的計畫")
    expect(normalizePlanningGoalFromMessage("請幫我拆解準備轉職的步驟")).toBe("準備轉職的步驟")
  })

  it("falls back to the original message when no command frame is present", () => {
    expect(normalizePlanningGoalFromMessage("建立個人作品集網站")).toBe("建立個人作品集網站")
  })

  it("rejects empty or undefined-like inputs", () => {
    expect(normalizePlanningGoalFromMessage("")).toBe("")
    expect(normalizePlanningGoalFromMessage("undefined")).toBe("")
  })
})
