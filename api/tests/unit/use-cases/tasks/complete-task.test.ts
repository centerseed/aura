import { beforeEach, describe, expect, it, vi } from "vitest"
import { CompleteTaskUseCase } from "@/application/use-cases/tasks/complete-task"

const mockExecute = vi.fn()

vi.mock("@/application/use-cases/tasks/update-task", () => ({
  UpdateTaskUseCase: vi.fn().mockImplementation(() => ({
    execute: mockExecute,
  })),
}))

describe("CompleteTaskUseCase", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("delegates to UpdateTaskUseCase with ARCHIVE status", async () => {
    mockExecute.mockResolvedValue({
      task: { id: "task-1", status: "ARCHIVE" },
      message: "Completing task. Great job!",
    })

    const useCase = new CompleteTaskUseCase()
    const result = await useCase.execute({
      taskId: "task-1",
      userId: "user-1",
    })

    expect(mockExecute).toHaveBeenCalledWith({
      taskId: "task-1",
      userId: "user-1",
      status: "ARCHIVE",
    })
    expect(result.message).toBe("Completing task. Great job!")
  })
})
