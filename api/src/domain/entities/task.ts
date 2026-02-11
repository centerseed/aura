/**
 * Task Domain Entity - 任務領域實體
 *
 * 這是有行為的 Domain Entity，包含業務規則與不變性（Invariants）
 * 與 task.entity.ts (interface) 不同，這是 Class-based Entity
 */

import { TaskStatus, TaskStatusVO } from '../value-objects/task-status'
import { ValidationException, ConflictException } from '@/lib/api-response'

// ============================================================================
// Value Objects & Sub-Entities
// ============================================================================

export interface Reference {
  id: string
  type: 'url' | 'note'
  content: string
  title?: string | null
  createdAt: Date
}

export interface SubItem {
  id: string
  content: string
  completed: boolean
  createdAt: Date
  completedAt: Date | null
  order: number
  startDate: Date | null
  dueDate: Date | null
}

export interface AIAnalysis {
  narrative?: string
  lifecycle?: string
  strategyUsed?: string
  reasoning?: string
  mergedItems?: string[]
}

// ============================================================================
// Task Entity
// ============================================================================

export class Task {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public productId: string,
    public topicId: string | null,
    public content: string,
    private _status: TaskStatusVO,
    public aiAnalysis: AIAnalysis | null,
    public references: Reference[],
    public subItems: SubItem[],
    public startDate: Date | null,
    public dueDate: Date | null,
    public timeConfidence: number | null,
    public inferredFromMilestone: string | null,
    public readonly createdAt: Date,
    public updatedAt: Date
  ) {
    this.validate()
  }

  // ============================================================================
  // Getters
  // ============================================================================

  get status(): TaskStatus {
    return this._status.getValue()
  }

  get narrative(): string | null {
    return this.aiAnalysis?.narrative || null
  }

  get lifecycle(): string | null {
    return this.aiAnalysis?.lifecycle || 'embryo'
  }

  // ============================================================================
  // Factory Methods
  // ============================================================================

  static create(params: {
    id: string
    userId: string
    productId: string
    topicId?: string | null
    content: string
    status?: TaskStatus
  }): Task {
    return new Task(
      params.id,
      params.userId,
      params.productId,
      params.topicId || null,
      params.content,
      params.status
        ? TaskStatusVO.fromString(params.status)
        : TaskStatusVO.inbox(),
      null,
      [],
      [],
      null,
      null,
      null,
      null,
      new Date(),
      new Date()
    )
  }

  // ============================================================================
  // Business Logic Methods
  // ============================================================================

  /**
   * 驗證任務的不變性（Invariants）
   */
  private validate(): void {
    if (!this.content || this.content.trim().length === 0) {
      throw new ValidationException('Task content cannot be empty', 'content')
    }

    if (this.content.length > 500) {
      throw new ValidationException(
        'Task content must be less than 500 characters',
        'content'
      )
    }

    // 業務規則：ACTIVE 任務應該有截止日期
    if (this.status === TaskStatus.ACTIVE && !this.dueDate) {
      // 警告但不阻止（可以在 Use Case 層處理）
      console.warn(`[Task ${this.id}] ACTIVE task should have a due date`)
    }
  }

  /**
   * 更新狀態
   */
  changeStatus(newStatus: TaskStatus): void {
    const newStatusVO = TaskStatusVO.fromString(newStatus)

    // 同狀態不需要轉換
    if (this._status.equals(newStatusVO)) {
      return
    }

    // 檢查是否允許轉換
    if (!this._status.canTransitionTo(newStatusVO)) {
      throw new ConflictException(
        `Cannot transition task from ${this.status} to ${newStatus}`
      )
    }

    // 業務規則：移至 ARCHIVE 時記錄完成時間
    if (newStatus === TaskStatus.ARCHIVE) {
      this.updatedAt = new Date()
    }

    this._status = newStatusVO
  }

  /**
   * 歸檔任務（快捷方法）
   */
  archive(): void {
    this.changeStatus(TaskStatus.ARCHIVE)
  }

  /**
   * 移至 ACTIVE
   */
  activate(): void {
    this.changeStatus(TaskStatus.ACTIVE)
  }

  /**
   * 更新內容
   */
  updateContent(newContent: string): void {
    if (!newContent || newContent.trim().length === 0) {
      throw new ValidationException('Task content cannot be empty', 'content')
    }

    if (newContent.length > 500) {
      throw new ValidationException(
        'Task content must be less than 500 characters',
        'content'
      )
    }

    this.content = newContent.trim()
    this.updatedAt = new Date()
  }

  /**
   * 更新 Narrative
   */
  updateNarrative(narrative: string | null): void {
    if (!this.aiAnalysis) {
      this.aiAnalysis = {}
    }
    this.aiAnalysis.narrative = narrative || undefined
    this.updatedAt = new Date()
  }

  /**
   * 移動到另一個 Product
   */
  moveToProduct(productId: string, topicId: string | null = null): void {
    if (!productId) {
      throw new ValidationException('Product ID is required', 'productId')
    }

    this.productId = productId
    this.topicId = topicId
    this.updatedAt = new Date()
  }

  /**
   * 設定截止日期
   */
  setDueDate(dueDate: Date | null): void {
    // 業務規則：截止日期不能早於開始日期
    if (dueDate && this.startDate && dueDate < this.startDate) {
      throw new ValidationException(
        'Due date cannot be earlier than start date',
        'dueDate'
      )
    }

    this.dueDate = dueDate
    this.updatedAt = new Date()
  }

  /**
   * 設定開始日期
   */
  setStartDate(startDate: Date | null): void {
    // 業務規則：開始日期不能晚於截止日期
    if (startDate && this.dueDate && startDate > this.dueDate) {
      throw new ValidationException(
        'Start date cannot be later than due date',
        'startDate'
      )
    }

    this.startDate = startDate
    this.updatedAt = new Date()
  }

  /**
   * 新增 Reference
   */
  addReference(reference: Omit<Reference, 'createdAt'>): void {
    // 檢查是否已存在相同的 reference
    const exists = this.references.some(
      (r) => r.type === reference.type && r.content === reference.content
    )

    if (exists) {
      throw new ConflictException('Reference already exists')
    }

    this.references.push({
      ...reference,
      createdAt: new Date(),
    })
    this.updatedAt = new Date()
  }

  /**
   * 移除 Reference
   */
  removeReference(referenceId: string): void {
    const index = this.references.findIndex((r) => r.id === referenceId)
    if (index === -1) {
      throw new ValidationException('Reference not found', 'referenceId')
    }

    this.references.splice(index, 1)
    this.updatedAt = new Date()
  }

  /**
   * 新增 Sub-Item
   */
  addSubItem(content: string): void {
    if (!content || content.trim().length === 0) {
      throw new ValidationException('Sub-item content cannot be empty', 'content')
    }

    const newSubItem: SubItem = {
      id: crypto.randomUUID(),
      content: content.trim(),
      completed: false,
      createdAt: new Date(),
      completedAt: null,
      order: this.subItems.length,
      startDate: null,
      dueDate: null,
    }

    this.subItems.push(newSubItem)
    this.updatedAt = new Date()
  }

  /**
   * 完成 Sub-Item
   */
  completeSubItem(subItemId: string): void {
    const subItem = this.subItems.find((s) => s.id === subItemId)
    if (!subItem) {
      throw new ValidationException('Sub-item not found', 'subItemId')
    }

    if (subItem.completed) {
      throw new ConflictException('Sub-item is already completed')
    }

    subItem.completed = true
    subItem.completedAt = new Date()
    this.updatedAt = new Date()
  }

  /**
   * 檢查是否可以與另一個任務合併
   */
  canMergeWith(other: Task): boolean {
    // 業務規則：只有 INBOX 狀態且同一用戶的任務可以合併
    return (
      this._status.canBeMerged() &&
      other._status.canBeMerged() &&
      this.userId === other.userId &&
      this.id !== other.id
    )
  }

  /**
   * 取得子任務統計
   */
  getSubItemsStats(): {
    total: number
    completed: number
    completionRate: number
  } {
    const total = this.subItems.length
    const completed = this.subItems.filter((s) => s.completed).length

    return {
      total,
      completed,
      completionRate: total > 0 ? completed / total : 0,
    }
  }

  /**
   * 檢查任務是否過期
   */
  isOverdue(): boolean {
    if (!this.dueDate) return false
    if (this.status === TaskStatus.ARCHIVE) return false

    return new Date() > this.dueDate
  }

  /**
   * 取得剩餘天數
   */
  getDaysRemaining(): number | null {
    if (!this.dueDate) return null

    const now = new Date()
    const diff = this.dueDate.getTime() - now.getTime()
    return Math.ceil(diff / (1000 * 60 * 60 * 24))
  }

  // ============================================================================
  // Serialization
  // ============================================================================

  /**
   * 轉換為純資料物件（用於 API 回應或儲存）
   */
  toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      userId: this.userId,
      productId: this.productId,
      topicId: this.topicId,
      content: this.content,
      status: this.status,
      aiAnalysis: this.aiAnalysis,
      references: this.references,
      subItems: this.subItems,
      startDate: this.startDate?.toISOString() || null,
      dueDate: this.dueDate?.toISOString() || null,
      timeConfidence: this.timeConfidence,
      inferredFromMilestone: this.inferredFromMilestone,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    }
  }
}
