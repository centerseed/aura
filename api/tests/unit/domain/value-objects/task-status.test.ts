/**
 * TaskStatus Value Object 單元測試
 */

import { describe, it, expect } from 'vitest'
import { TaskStatus, TaskStatusVO } from '@/domain/value-objects/task-status'
import { ValidationException } from '@/lib/api-response'

describe('TaskStatusVO', () => {
  describe('factory methods', () => {
    it('應該從字串建立 TaskStatusVO', () => {
      const status = TaskStatusVO.fromString('INBOX')
      expect(status.getValue()).toBe(TaskStatus.INBOX)
    })

    it('應該不區分大小寫', () => {
      const status1 = TaskStatusVO.fromString('inbox')
      const status2 = TaskStatusVO.fromString('INBOX')
      const status3 = TaskStatusVO.fromString('InBox')

      expect(status1.getValue()).toBe(TaskStatus.INBOX)
      expect(status2.getValue()).toBe(TaskStatus.INBOX)
      expect(status3.getValue()).toBe(TaskStatus.INBOX)
    })

    it('應該拋出 ValidationException 對於無效的狀態', () => {
      expect(() => TaskStatusVO.fromString('INVALID')).toThrow(ValidationException)
      expect(() => TaskStatusVO.fromString('')).toThrow(ValidationException)
    })

    it('應該使用靜態工廠方法建立', () => {
      expect(TaskStatusVO.inbox().getValue()).toBe(TaskStatus.INBOX)
      expect(TaskStatusVO.active().getValue()).toBe(TaskStatus.ACTIVE)
      expect(TaskStatusVO.maintain().getValue()).toBe(TaskStatus.MAINTAIN)
      expect(TaskStatusVO.reference().getValue()).toBe(TaskStatus.REFERENCE)
      expect(TaskStatusVO.archive().getValue()).toBe(TaskStatus.ARCHIVE)
    })
  })

  describe('toString', () => {
    it('應該返回狀態字串', () => {
      expect(TaskStatusVO.inbox().toString()).toBe('INBOX')
      expect(TaskStatusVO.active().toString()).toBe('ACTIVE')
      expect(TaskStatusVO.archive().toString()).toBe('ARCHIVE')
    })
  })

  describe('equals', () => {
    it('應該比較兩個狀態是否相等', () => {
      const status1 = TaskStatusVO.inbox()
      const status2 = TaskStatusVO.inbox()
      const status3 = TaskStatusVO.active()

      expect(status1.equals(status2)).toBe(true)
      expect(status1.equals(status3)).toBe(false)
    })
  })

  describe('Business Rules', () => {
    describe('canBeMerged', () => {
      it('應該只允許 INBOX 狀態的任務被合併', () => {
        expect(TaskStatusVO.inbox().canBeMerged()).toBe(true)
        expect(TaskStatusVO.active().canBeMerged()).toBe(false)
        expect(TaskStatusVO.maintain().canBeMerged()).toBe(false)
        expect(TaskStatusVO.reference().canBeMerged()).toBe(false)
        expect(TaskStatusVO.archive().canBeMerged()).toBe(false)
      })
    })

    describe('needsActiveAttention', () => {
      it('應該只有 ACTIVE 狀態需要主動關注', () => {
        expect(TaskStatusVO.inbox().needsActiveAttention()).toBe(false)
        expect(TaskStatusVO.active().needsActiveAttention()).toBe(true)
        expect(TaskStatusVO.maintain().needsActiveAttention()).toBe(false)
        expect(TaskStatusVO.reference().needsActiveAttention()).toBe(false)
        expect(TaskStatusVO.archive().needsActiveAttention()).toBe(false)
      })
    })

    describe('isCompleted', () => {
      it('應該只有 ARCHIVE 狀態被視為已完成', () => {
        expect(TaskStatusVO.inbox().isCompleted()).toBe(false)
        expect(TaskStatusVO.active().isCompleted()).toBe(false)
        expect(TaskStatusVO.maintain().isCompleted()).toBe(false)
        expect(TaskStatusVO.reference().isCompleted()).toBe(false)
        expect(TaskStatusVO.archive().isCompleted()).toBe(true)
      })
    })

    describe('canHaveDueDate', () => {
      it('應該只有 ACTIVE 狀態可以設定截止日期', () => {
        expect(TaskStatusVO.inbox().canHaveDueDate()).toBe(false)
        expect(TaskStatusVO.active().canHaveDueDate()).toBe(true)
        expect(TaskStatusVO.maintain().canHaveDueDate()).toBe(false)
        expect(TaskStatusVO.reference().canHaveDueDate()).toBe(false)
        expect(TaskStatusVO.archive().canHaveDueDate()).toBe(false)
      })
    })
  })

  describe('State Transitions', () => {
    describe('canTransitionTo', () => {
      it('INBOX 可以轉換到任何其他狀態', () => {
        const inbox = TaskStatusVO.inbox()
        expect(inbox.canTransitionTo(TaskStatusVO.active())).toBe(true)
        expect(inbox.canTransitionTo(TaskStatusVO.maintain())).toBe(true)
        expect(inbox.canTransitionTo(TaskStatusVO.reference())).toBe(true)
        expect(inbox.canTransitionTo(TaskStatusVO.archive())).toBe(true)
      })

      it('ACTIVE 可以轉換到除了自己以外的任何狀態', () => {
        const active = TaskStatusVO.active()
        expect(active.canTransitionTo(TaskStatusVO.inbox())).toBe(true)
        expect(active.canTransitionTo(TaskStatusVO.maintain())).toBe(true)
        expect(active.canTransitionTo(TaskStatusVO.reference())).toBe(true)
        expect(active.canTransitionTo(TaskStatusVO.archive())).toBe(true)
      })

      it('ARCHIVE 只能轉換回 INBOX', () => {
        const archive = TaskStatusVO.archive()
        expect(archive.canTransitionTo(TaskStatusVO.inbox())).toBe(true)
        expect(archive.canTransitionTo(TaskStatusVO.active())).toBe(false)
        expect(archive.canTransitionTo(TaskStatusVO.maintain())).toBe(false)
        expect(archive.canTransitionTo(TaskStatusVO.reference())).toBe(false)
      })

      it('不應該轉換到相同狀態（雖然技術上允許）', () => {
        const inbox = TaskStatusVO.inbox()
        // 注意：根據業務規則，這應該被允許（用於冪等性）
        // 但在實際應用中應該在上層檢查
        expect(inbox.canTransitionTo(inbox)).toBe(false)
      })
    })

    describe('getTransitionHint', () => {
      it('應該返回狀態已經相同的提示', () => {
        const inbox = TaskStatusVO.inbox()
        expect(inbox.getTransitionHint(inbox)).toContain('already in this status')
      })

      it('應該返回不允許轉換的提示', () => {
        const archive = TaskStatusVO.archive()
        const hint = archive.getTransitionHint(TaskStatusVO.active())
        expect(hint).toContain('Cannot transition')
      })

      it('應該返回特定轉換的提示訊息', () => {
        const inbox = TaskStatusVO.inbox()
        const active = TaskStatusVO.active()
        const hint = inbox.getTransitionHint(active)
        expect(hint).toContain('active')
      })

      it('應該返回預設提示對於允許但沒有特定訊息的轉換', () => {
        const maintain = TaskStatusVO.maintain()
        const active = TaskStatusVO.active()
        const hint = maintain.getTransitionHint(active)
        expect(hint).toBeTruthy()
      })
    })
  })
})
