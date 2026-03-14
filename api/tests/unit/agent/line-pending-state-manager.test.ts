/**
 * AC2: LinePendingStateManager unit tests
 *
 * Verifies:
 * - Implements BasePendingStateManager interface (getPending/setPending/clearPending)
 * - Always uses confirmationKey as storage key, ignoring sessionId argument
 * - PendingState.createdAt is filled when setPending is called
 */

import { describe, expect, it, vi, beforeEach } from "vitest"

const mockGetLineSession = vi.fn()
const mockSaveLineSession = vi.fn()
const mockClearLineSession = vi.fn()

vi.mock("@/lib/line-session", () => ({
  getLineSession: mockGetLineSession,
  saveLineSession: mockSaveLineSession,
  clearLineSession: mockClearLineSession,
}))

const { LinePendingStateManager } = await import("@/application/use-cases/agent/line-adapter")

describe("LinePendingStateManager", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("getPending", () => {
    it("should return null when no pending state exists", async () => {
      mockGetLineSession.mockResolvedValue(null)
      const manager = new LinePendingStateManager("line-uid-1")

      const result = await manager.getPending("any-session-id")

      expect(result).toBeNull()
      // Always uses confirmationKey, not sessionId
      expect(mockGetLineSession).toHaveBeenCalledWith("line-uid-1")
      expect(mockGetLineSession).not.toHaveBeenCalledWith("any-session-id")
    })

    it("should return PendingState with correct shape when state exists", async () => {
      mockGetLineSession.mockResolvedValue({
        type: "adjust_tags_preview",
        payload: { logId: "log-1", taskMatches: [] },
      })
      const manager = new LinePendingStateManager("line-uid-1")

      const result = await manager.getPending("ignored-session-id")

      expect(result).not.toBeNull()
      expect(result?.type).toBe("adjust_tags_preview")
      expect(result?.payload).toEqual({ logId: "log-1", taskMatches: [] })
      expect(typeof result?.createdAt).toBe("number")
    })

    it("should use confirmationKey as storage key regardless of sessionId argument", async () => {
      mockGetLineSession.mockResolvedValue(null)
      const manager = new LinePendingStateManager("the-real-key")

      await manager.getPending("different-session")

      expect(mockGetLineSession).toHaveBeenCalledWith("the-real-key")
    })
  })

  describe("setPending", () => {
    it("should save pending state via saveLineSession using confirmationKey", async () => {
      mockSaveLineSession.mockResolvedValue(undefined)
      const manager = new LinePendingStateManager("line-uid-1")

      await manager.setPending("ignored-session", {
        type: "brain_dump_pending",
        payload: { originalText: "test task", taskTitle: "test task" },
        createdAt: Date.now(),
      })

      expect(mockSaveLineSession).toHaveBeenCalledWith(
        "line-uid-1",
        "brain_dump_pending",
        expect.objectContaining({ originalText: "test task" }),
      )
    })

    it("should NOT use sessionId argument as storage key", async () => {
      mockSaveLineSession.mockResolvedValue(undefined)
      const manager = new LinePendingStateManager("correct-key")

      await manager.setPending("wrong-session", {
        type: "brain_dump_pending",
        payload: { originalText: "test" },
        createdAt: Date.now(),
      })

      expect(mockSaveLineSession).toHaveBeenCalledWith("correct-key", expect.any(String), expect.anything())
      expect(mockSaveLineSession).not.toHaveBeenCalledWith("wrong-session", expect.anything(), expect.anything())
    })
  })

  describe("clearPending", () => {
    it("should clear pending state using confirmationKey, not sessionId", async () => {
      mockClearLineSession.mockResolvedValue(undefined)
      const manager = new LinePendingStateManager("line-uid-1")

      await manager.clearPending("ignored-session")

      expect(mockClearLineSession).toHaveBeenCalledWith("line-uid-1")
      expect(mockClearLineSession).not.toHaveBeenCalledWith("ignored-session")
    })
  })
})
