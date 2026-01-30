/**
 * TaskStatus - 任務狀態值對象（對應雙軸管理模型的「何時該看」維度）
 *
 * 這是 Immutable Value Object，包含狀態轉換的業務規則
 */

import { ValidationException } from '@/lib/api-response'

export enum TaskStatus {
  INBOX = 'INBOX',         // 收件匣：新進任務，待處理
  ACTIVE = 'ACTIVE',       // 進行中：有期限、需主動推進
  MAINTAIN = 'MAINTAIN',   // 營運：穩定維護，異常時亮燈
  REFERENCE = 'REFERENCE', // 知識庫：無時效性，AI 自動關聯
  ARCHIVE = 'ARCHIVE',     // 歸檔：已完成或不再需要
}

/**
 * TaskStatus Value Object with Business Rules
 */
export class TaskStatusVO {
  private constructor(private readonly value: TaskStatus) {}

  static fromString(value: string): TaskStatusVO {
    const upperValue = value.toUpperCase()
    if (!(upperValue in TaskStatus)) {
      throw new ValidationException(
        `Invalid task status: ${value}. Must be one of: ${Object.values(TaskStatus).join(', ')}`,
        'status'
      )
    }
    return new TaskStatusVO(TaskStatus[upperValue as keyof typeof TaskStatus])
  }

  static inbox(): TaskStatusVO {
    return new TaskStatusVO(TaskStatus.INBOX)
  }

  static active(): TaskStatusVO {
    return new TaskStatusVO(TaskStatus.ACTIVE)
  }

  static maintain(): TaskStatusVO {
    return new TaskStatusVO(TaskStatus.MAINTAIN)
  }

  static reference(): TaskStatusVO {
    return new TaskStatusVO(TaskStatus.REFERENCE)
  }

  static archive(): TaskStatusVO {
    return new TaskStatusVO(TaskStatus.ARCHIVE)
  }

  getValue(): TaskStatus {
    return this.value
  }

  toString(): string {
    return this.value
  }

  equals(other: TaskStatusVO): boolean {
    return this.value === other.value
  }

  // ============================================================================
  // Business Rules: 狀態轉換規則
  // ============================================================================

  /**
   * 是否可以合併（只有 INBOX 狀態的任務可以合併）
   */
  canBeMerged(): boolean {
    return this.value === TaskStatus.INBOX
  }

  /**
   * 是否需要主動推進（ACTIVE 任務需要持續關注）
   */
  needsActiveAttention(): boolean {
    return this.value === TaskStatus.ACTIVE
  }

  /**
   * 是否已完成（ARCHIVE 狀態）
   */
  isCompleted(): boolean {
    return this.value === TaskStatus.ARCHIVE
  }

  /**
   * 是否可以設定截止日期（只有 ACTIVE 狀態可以設定）
   */
  canHaveDueDate(): boolean {
    return this.value === TaskStatus.ACTIVE
  }

  /**
   * 檢查是否允許轉換到目標狀態
   */
  canTransitionTo(target: TaskStatusVO): boolean {
    const from = this.value
    const to = target.value

    // 業務規則：允許的狀態轉換
    const allowedTransitions: Record<TaskStatus, TaskStatus[]> = {
      [TaskStatus.INBOX]: [
        TaskStatus.ACTIVE,
        TaskStatus.MAINTAIN,
        TaskStatus.REFERENCE,
        TaskStatus.ARCHIVE,
      ],
      [TaskStatus.ACTIVE]: [
        TaskStatus.INBOX,
        TaskStatus.MAINTAIN,
        TaskStatus.REFERENCE,
        TaskStatus.ARCHIVE,
      ],
      [TaskStatus.MAINTAIN]: [
        TaskStatus.INBOX,
        TaskStatus.ACTIVE,
        TaskStatus.REFERENCE,
        TaskStatus.ARCHIVE,
      ],
      [TaskStatus.REFERENCE]: [
        TaskStatus.INBOX,
        TaskStatus.ACTIVE,
        TaskStatus.MAINTAIN,
        TaskStatus.ARCHIVE,
      ],
      [TaskStatus.ARCHIVE]: [
        TaskStatus.INBOX, // 可以重新打開已歸檔的任務
      ],
    }

    return allowedTransitions[from]?.includes(to) ?? false
  }

  /**
   * 取得狀態轉換的建議訊息
   */
  getTransitionHint(target: TaskStatusVO): string {
    if (this.equals(target)) {
      return 'Task is already in this status'
    }

    if (!this.canTransitionTo(target)) {
      return `Cannot transition from ${this.value} to ${target.value}`
    }

    const hints: Record<string, string> = {
      [`${TaskStatus.INBOX}->${TaskStatus.ACTIVE}`]: 'Moving to active board. Consider setting a due date.',
      [`${TaskStatus.ACTIVE}->${TaskStatus.ARCHIVE}`]: 'Completing task. Great job!',
      [`${TaskStatus.ARCHIVE}->${TaskStatus.INBOX}`]: 'Reopening archived task.',
      [`${TaskStatus.INBOX}->${TaskStatus.REFERENCE}`]: 'Moving to knowledge base.',
    }

    return hints[`${this.value}->${target.value}`] || 'Status updated'
  }
}

/**
 * 向後相容：保留原有的 type alias
 */
export type DrawerStatus = keyof typeof TaskStatus
