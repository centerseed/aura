/**
 * AC7 + AC14: ConfirmationStateMachine 單元測試
 */

import { describe, expect, it, vi } from "vitest"
import { ConfirmationStateMachine } from "@/application/use-cases/agent/confirmation-state-machine"

describe("ConfirmationStateMachine", () => {
  describe("initial state", () => {
    it("should start in IDLE state", () => {
      const sm = new ConfirmationStateMachine()
      expect(sm.getState("sess-1")).toBe("IDLE")
    })

    it("should return null pending when IDLE", () => {
      const sm = new ConfirmationStateMachine()
      expect(sm.getPending("sess-1")).toBeNull()
    })
  })

  describe("IDLE → PREVIEW_SENT via preview()", () => {
    it("should transition to PREVIEW_SENT after preview", () => {
      const sm = new ConfirmationStateMachine()
      const success = sm.preview("sess-1", "adjust_tags_preview", { logId: "log-1" })

      expect(success).toBe(true)
      expect(sm.getState("sess-1")).toBe("PREVIEW_SENT")
    })

    it("should store the payload when in PREVIEW_SENT", () => {
      const sm = new ConfirmationStateMachine()
      sm.preview("sess-1", "complete_task_confirm", { taskTitle: "買牛奶" })

      const pending = sm.getPending("sess-1")
      expect(pending?.type).toBe("complete_task_confirm")
      expect(pending?.payload).toEqual({ taskTitle: "買牛奶" })
    })
  })

  describe("PREVIEW_SENT → user actions", () => {
    it("should transition to AWAITING on confirm from PREVIEW_SENT", () => {
      const sm = new ConfirmationStateMachine()
      sm.preview("sess-1", "adjust_tags_preview", {})
      const success = sm.confirm("sess-1")

      expect(success).toBe(true)
      expect(sm.getState("sess-1")).toBe("AWAITING")
    })

    it("should transition to IDLE on reject from PREVIEW_SENT", () => {
      const sm = new ConfirmationStateMachine()
      sm.preview("sess-1", "brain_dump_pending", {})
      const success = sm.reject("sess-1")

      expect(success).toBe(true)
      expect(sm.getState("sess-1")).toBe("IDLE")
      expect(sm.getPending("sess-1")).toBeNull()
    })

    it("should transition to IDLE on override from PREVIEW_SENT", () => {
      const sm = new ConfirmationStateMachine()
      sm.preview("sess-1", "brain_dump_pending", {})
      const success = sm.override("sess-1")

      expect(success).toBe(true)
      expect(sm.getState("sess-1")).toBe("IDLE")
      expect(sm.getPending("sess-1")).toBeNull()
    })
  })

  describe("AWAITING → user actions", () => {
    it("should transition to EXECUTING on confirm from AWAITING", () => {
      const sm = new ConfirmationStateMachine()
      sm.preview("sess-1", "adjust_tags_preview", {})
      sm.confirm("sess-1")  // PREVIEW_SENT → AWAITING
      const success = sm.confirm("sess-1")  // AWAITING → EXECUTING

      expect(success).toBe(true)
      expect(sm.getState("sess-1")).toBe("EXECUTING")
    })

    it("should clear pending on reject from AWAITING", () => {
      const sm = new ConfirmationStateMachine()
      sm.preview("sess-1", "adjust_tags_preview", {})
      sm.confirm("sess-1")  // → AWAITING
      sm.reject("sess-1")

      expect(sm.getState("sess-1")).toBe("IDLE")
      expect(sm.getPending("sess-1")).toBeNull()
    })
  })

  describe("illegal transitions", () => {
    it("should reject confirm from IDLE (returns false)", () => {
      const sm = new ConfirmationStateMachine()
      const success = sm.confirm("sess-1")

      expect(success).toBe(false)
      expect(sm.getState("sess-1")).toBe("IDLE")
    })

    it("should reject preview when already in PREVIEW_SENT", () => {
      const sm = new ConfirmationStateMachine()
      sm.preview("sess-1", "type-1", {})
      const success = sm.preview("sess-1", "type-2", {})

      // PREVIEW_SENT has no valid transition for 'preview'
      expect(success).toBe(false)
    })
  })

  describe("timeout", () => {
    it("should auto-clear when TTL expires", () => {
      vi.useFakeTimers()
      const sm = new ConfirmationStateMachine()
      sm.preview("sess-1", "adjust_tags_preview", {}, 5000)  // 5 second TTL

      expect(sm.getState("sess-1")).toBe("PREVIEW_SENT")

      vi.advanceTimersByTime(6000)

      expect(sm.getState("sess-1")).toBe("IDLE")
      expect(sm.getPending("sess-1")).toBeNull()
      vi.useRealTimers()
    })

    it("should explicitly timeout from PREVIEW_SENT", () => {
      const sm = new ConfirmationStateMachine()
      sm.preview("sess-1", "brain_dump_pending", {})
      const success = sm.timeout("sess-1")

      expect(success).toBe(true)
      expect(sm.getState("sess-1")).toBe("IDLE")
    })
  })

  describe("complete()", () => {
    it("should clear pending state", () => {
      const sm = new ConfirmationStateMachine()
      sm.preview("sess-1", "adjust_tags_preview", {})
      sm.complete("sess-1")

      expect(sm.getState("sess-1")).toBe("IDLE")
      expect(sm.getPending("sess-1")).toBeNull()
    })
  })

  describe("session isolation", () => {
    it("should isolate state per sessionId", () => {
      const sm = new ConfirmationStateMachine()
      sm.preview("sess-a", "adjust_tags_preview", { logId: "a" })

      expect(sm.getState("sess-a")).toBe("PREVIEW_SENT")
      expect(sm.getState("sess-b")).toBe("IDLE")
    })
  })
})
