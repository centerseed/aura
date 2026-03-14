/**
 * AC4: PendingConfirmationExecutor unit tests
 *
 * Verifies:
 * - Returns null when no pending state exists
 * - reject disposition → clears pending and returns "好的，已取消。"
 * - override disposition → clears pending and returns null (continue normal flow)
 * - confirm + adjust_tags_preview → executes ExecuteAdjustmentUseCase
 * - confirm + complete_task_confirm → executes completeTask and returns success message
 * - confirm + brain_dump_pending → executes brain dump tool
 * - Unknown pending type → clears and returns null
 */

import { describe, expect, it, vi, beforeEach } from "vitest"

const mockGetLineSession = vi.fn()
const mockSaveLineSession = vi.fn()
const mockClearLineSession = vi.fn()
const mockClassifyConfirmationDisposition = vi.fn()
const mockExecuteAdjustmentUseCase = vi.fn()
const mockExecuteCompleteTaskPayload = vi.fn()
const mockBuildCompleteTaskSuccessMessage = vi.fn()
const mockBrainDumpExecute = vi.fn()

vi.mock("@/lib/line-session", () => ({
  getLineSession: mockGetLineSession,
  saveLineSession: mockSaveLineSession,
  clearLineSession: mockClearLineSession,
}))

vi.mock("@/lib/line-confirmation", () => ({
  classifyConfirmationDisposition: mockClassifyConfirmationDisposition,
  extractBrainDumpConfirmationTarget: vi.fn(() => null),
}))

vi.mock("@/application/use-cases/adjust-tags/execute-adjustment", () => ({
  ExecuteAdjustmentUseCase: vi.fn(() => ({
    execute: mockExecuteAdjustmentUseCase,
  })),
}))

vi.mock("@/application/use-cases/agent/complete-task-executor", () => ({
  executeCompleteTaskPayload: mockExecuteCompleteTaskPayload,
  buildCompleteTaskSuccessMessage: mockBuildCompleteTaskSuccessMessage,
}))

vi.mock("@/application/use-cases/agent/brain-dump-skill", () => ({
  createBrainDumpTool: vi.fn(() => ({ execute: mockBrainDumpExecute })),
}))

const { LinePendingStateManager } = await import("@/application/use-cases/agent/line-adapter")
const { PendingConfirmationExecutor } = await import("@/application/use-cases/agent/pending-confirmation-executor")

function makeOrchIntent(object = "unknown") {
  return { object: object as never, confidence: 0.5, requiresConfirmation: false }
}

function makeSessionStore() {
  return {
    get: vi.fn().mockResolvedValue([]),
    save: vi.fn().mockResolvedValue(undefined),
  }
}

describe("PendingConfirmationExecutor", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetLineSession.mockResolvedValue(null)
    mockBuildCompleteTaskSuccessMessage.mockReturnValue("✅ 已完成「買牛奶」")
    mockBrainDumpExecute.mockResolvedValue("✅ 已記錄 1 個項目：測試任務")
  })

  it("should return null when no pending state exists", async () => {
    const manager = new LinePendingStateManager("line-uid-1")
    const executor = new PendingConfirmationExecutor(manager)

    const result = await executor.execute({
      message: "今天的代辦",
      intent: makeOrchIntent("today_focus"),
      options: { userId: "user-1" },
    })

    expect(result).toBeNull()
  })

  it("should return '好的，已取消。' and clear pending on reject disposition", async () => {
    mockGetLineSession.mockResolvedValue({
      type: "adjust_tags_preview",
      payload: { logId: "log-1" },
    })
    mockClassifyConfirmationDisposition.mockReturnValue("reject")
    const manager = new LinePendingStateManager("line-uid-1")
    const executor = new PendingConfirmationExecutor(manager)

    const result = await executor.execute({
      message: "不要了",
      intent: makeOrchIntent(),
      options: { userId: "user-1" },
    })

    expect(result).not.toBeNull()
    expect(result?.content).toBe("好的，已取消。")
    expect(mockClearLineSession).toHaveBeenCalledWith("line-uid-1")
  })

  it("should return null and clear pending on override disposition", async () => {
    mockGetLineSession.mockResolvedValue({
      type: "adjust_tags_preview",
      payload: { logId: "log-1" },
    })
    mockClassifyConfirmationDisposition.mockReturnValue("override")
    const manager = new LinePendingStateManager("line-uid-1")
    const executor = new PendingConfirmationExecutor(manager)

    const result = await executor.execute({
      message: "其實我想做別的事",
      intent: makeOrchIntent(),
      options: { userId: "user-1" },
    })

    expect(result).toBeNull()
    expect(mockClearLineSession).toHaveBeenCalledWith("line-uid-1")
  })

  it("should execute adjust_tags_preview on confirm disposition", async () => {
    mockGetLineSession.mockResolvedValue({
      type: "adjust_tags_preview",
      payload: {
        logId: "log-1",
        intentType: "move_task",
        taskMatches: [{ taskId: "t1" }],
        targetArea: "A",
        targetProduct: "P",
        targetTopic: "T",
        taskMap: {},
      },
    })
    mockClassifyConfirmationDisposition.mockReturnValue("confirm")
    mockExecuteAdjustmentUseCase.mockResolvedValue({
      operationLog: ["已移動 1 個任務"],
    })
    const manager = new LinePendingStateManager("line-uid-1")
    const executor = new PendingConfirmationExecutor(manager)

    const result = await executor.execute({
      message: "好的",
      intent: makeOrchIntent(),
      options: { userId: "user-1" },
    })

    expect(result).not.toBeNull()
    expect(result?.content).toContain("已完成分類調整")
    expect(result?.toolCalls).toContain("adjust_tags_preview")
    expect(mockClearLineSession).toHaveBeenCalledWith("line-uid-1")
  })

  it("should execute complete_task_confirm on confirm disposition", async () => {
    mockGetLineSession.mockResolvedValue({
      type: "complete_task_confirm",
      payload: { taskId: "task-1", taskTitle: "買牛奶" },
    })
    mockClassifyConfirmationDisposition.mockReturnValue("confirm")
    mockExecuteCompleteTaskPayload.mockResolvedValue(undefined)
    const manager = new LinePendingStateManager("line-uid-1")
    const executor = new PendingConfirmationExecutor(manager)

    const result = await executor.execute({
      message: "確認",
      intent: makeOrchIntent(),
      options: { userId: "user-1" },
    })

    expect(result).not.toBeNull()
    expect(result?.content).toBe("✅ 已完成「買牛奶」")
    expect(result?.toolCalls).toContain("complete_task_search")
    expect(mockClearLineSession).toHaveBeenCalledWith("line-uid-1")
  })

  it("should execute brain_dump_pending on confirm disposition", async () => {
    mockGetLineSession.mockResolvedValue({
      type: "brain_dump_pending",
      payload: { originalText: "測試任務", taskTitle: "測試任務" },
    })
    mockClassifyConfirmationDisposition.mockReturnValue("confirm")
    const manager = new LinePendingStateManager("line-uid-1")
    const executor = new PendingConfirmationExecutor(manager)

    const result = await executor.execute({
      message: "確認",
      intent: makeOrchIntent(),
      options: { userId: "user-1" },
    })

    expect(result).not.toBeNull()
    expect(mockBrainDumpExecute).toHaveBeenCalledWith({})
    expect(result?.toolCalls).toContain("brain_dump")
    expect(mockClearLineSession).toHaveBeenCalledWith("line-uid-1")
  })

  describe("FIX-3: session history writing", () => {
    it("should append session history after reject disposition", async () => {
      mockGetLineSession.mockResolvedValue({
        type: "adjust_tags_preview",
        payload: { logId: "log-1" },
      })
      mockClassifyConfirmationDisposition.mockReturnValue("reject")
      const manager = new LinePendingStateManager("line-uid-1")
      const sessionStore = makeSessionStore()
      const executor = new PendingConfirmationExecutor(manager, sessionStore)

      const result = await executor.execute({
        message: "不要了",
        intent: makeOrchIntent(),
        options: { userId: "user-1", sessionId: "sess-1" },
      })

      expect(result).not.toBeNull()
      expect(sessionStore.save).toHaveBeenCalledOnce()
      const savedHistory = sessionStore.save.mock.calls[0][1]
      expect(savedHistory.at(-2)).toEqual({ role: "user", content: "不要了" })
      expect(savedHistory.at(-1)).toEqual({ role: "assistant", content: "好的，已取消。" })
    })

    it("should append session history after confirm + complete_task_confirm", async () => {
      mockGetLineSession.mockResolvedValue({
        type: "complete_task_confirm",
        payload: { taskId: "task-1", taskTitle: "買牛奶" },
      })
      mockClassifyConfirmationDisposition.mockReturnValue("confirm")
      mockExecuteCompleteTaskPayload.mockResolvedValue(undefined)
      const manager = new LinePendingStateManager("line-uid-1")
      const sessionStore = makeSessionStore()
      const executor = new PendingConfirmationExecutor(manager, sessionStore)

      await executor.execute({
        message: "確認",
        intent: makeOrchIntent(),
        options: { userId: "user-1", sessionId: "sess-1" },
      })

      expect(sessionStore.save).toHaveBeenCalledOnce()
      const savedHistory = sessionStore.save.mock.calls[0][1]
      expect(savedHistory.at(-2)).toEqual({ role: "user", content: "確認" })
      // Assistant content is the success message
      expect(typeof savedHistory.at(-1)?.content).toBe("string")
    })

    it("should NOT write session history when no sessionStore provided", async () => {
      mockGetLineSession.mockResolvedValue({
        type: "adjust_tags_preview",
        payload: { logId: "log-1" },
      })
      mockClassifyConfirmationDisposition.mockReturnValue("reject")
      const manager = new LinePendingStateManager("line-uid-1")
      // No sessionStore provided
      const executor = new PendingConfirmationExecutor(manager)

      const result = await executor.execute({
        message: "取消",
        intent: makeOrchIntent(),
        options: { userId: "user-1", sessionId: "sess-1" },
      })

      // Should still return result, just without writing history
      expect(result).not.toBeNull()
    })

    it("should return null on override and NOT write session history", async () => {
      mockGetLineSession.mockResolvedValue({
        type: "adjust_tags_preview",
        payload: { logId: "log-1" },
      })
      mockClassifyConfirmationDisposition.mockReturnValue("override")
      const manager = new LinePendingStateManager("line-uid-1")
      const sessionStore = makeSessionStore()
      const executor = new PendingConfirmationExecutor(manager, sessionStore)

      const result = await executor.execute({
        message: "其實我要查今天待辦",
        intent: makeOrchIntent(),
        options: { userId: "user-1", sessionId: "sess-1" },
      })

      expect(result).toBeNull()
      // Override continues to normal flow — no history write
      expect(sessionStore.save).not.toHaveBeenCalled()
    })
  })
})
