import { beforeEach, describe, expect, it, vi } from "vitest"
import { buildCompleteTaskSuccessMessage, executeCompleteTaskPayload } from "@/application/use-cases/agent/complete-task-executor"

const {
  mockCompleteTaskUseCaseExecute,
  mockUpdateSubItemExecute,
  mockUpdatePlanItemExecute,
} = vi.hoisted(() => ({
  mockCompleteTaskUseCaseExecute: vi.fn(),
  mockUpdateSubItemExecute: vi.fn(),
  mockUpdatePlanItemExecute: vi.fn(),
}))

vi.mock("@/application/use-cases/tasks/complete-task", () => ({
  CompleteTaskUseCase: vi.fn(() => ({
    execute: mockCompleteTaskUseCaseExecute,
  })),
}))

vi.mock("@/application/use-cases/tasks/update-sub-item", () => ({
  UpdateSubItemUseCase: vi.fn(() => ({
    execute: mockUpdateSubItemExecute,
  })),
}))

vi.mock("@/application/use-cases/coach/update-plan-item", () => ({
  UpdatePlanItemUseCase: vi.fn(() => ({
    execute: mockUpdatePlanItemExecute,
  })),
}))

describe("complete-task-executor", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCompleteTaskUseCaseExecute.mockResolvedValue(undefined)
    mockUpdateSubItemExecute.mockResolvedValue(undefined)
    mockUpdatePlanItemExecute.mockResolvedValue(undefined)
  })

  it("routes task payloads through CompleteTaskUseCase", async () => {
    await executeCompleteTaskPayload("user-1", {
      sourceType: "task",
      taskTitle: "整理書桌",
      taskId: "task-1",
    })

    expect(mockCompleteTaskUseCaseExecute).toHaveBeenCalledWith({
      taskId: "task-1",
      userId: "user-1",
    })
    expect(mockUpdateSubItemExecute).not.toHaveBeenCalled()
    expect(mockUpdatePlanItemExecute).not.toHaveBeenCalled()
  })

  it("routes sub-task payloads through UpdateSubItemUseCase", async () => {
    await executeCompleteTaskPayload("user-1", {
      sourceType: "sub_task",
      taskTitle: "寄信給客戶",
      taskId: "task-1",
      subTaskId: "sub-1",
    })

    expect(mockUpdateSubItemExecute).toHaveBeenCalledWith({
      taskId: "task-1",
      subItemId: "sub-1",
      userId: "user-1",
      completed: true,
    })
    expect(mockCompleteTaskUseCaseExecute).not.toHaveBeenCalled()
    expect(mockUpdatePlanItemExecute).not.toHaveBeenCalled()
  })

  it("routes daily plan item payloads through UpdatePlanItemUseCase", async () => {
    await executeCompleteTaskPayload("user-1", {
      sourceType: "daily_plan_item",
      taskTitle: "買牛奶",
      planItemId: "plan-1",
    })

    expect(mockUpdatePlanItemExecute).toHaveBeenCalledWith({
      itemId: "plan-1",
      userId: "user-1",
      completed: true,
    })
    expect(mockCompleteTaskUseCaseExecute).not.toHaveBeenCalled()
    expect(mockUpdateSubItemExecute).not.toHaveBeenCalled()
  })

  it("throws on invalid payloads", async () => {
    await expect(executeCompleteTaskPayload("user-1", {
      sourceType: "task",
      taskTitle: "不完整 payload",
    })).rejects.toThrow("Invalid complete task payload")
  })

  it("builds the success message centrally", () => {
    expect(buildCompleteTaskSuccessMessage("整理書桌")).toBe("✅ 已完成「整理書桌」")
  })
})
