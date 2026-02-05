/**
 * CreateTaskUseCase - 建立任務
 *
 * Application Layer Use Case
 * 處理任務建立的業務邏輯,包含驗證與初始化
 */

import type {
  ITaskRepository,
  TaskData,
} from '@/domain/interfaces/task-repository'
import { PrismaTaskRepository } from '@/infrastructure/repositories/prisma-task-repository'
import { TaskStatus } from '@/domain/value-objects/task-status'
import { ValidationException } from '@/lib/api-response'

// ============================================================================
// DTOs (Data Transfer Objects)
// ============================================================================

export interface CreateTaskRequest {
  userId: string
  productId?: string | null
  topicId?: string | null
  content: string
  status?: string
  startDate?: string | null
  dueDate?: string | null
  timeConfidence?: number | null
  inferredFromMilestone?: string | null
}

export interface CreateTaskResponse {
  task: TaskData
  message: string
}

// ============================================================================
// Use Case
// ============================================================================

export class CreateTaskUseCase {
  constructor(
    private readonly taskRepository: ITaskRepository = new PrismaTaskRepository()
  ) {}

  async execute(request: CreateTaskRequest): Promise<CreateTaskResponse> {
    // 1. 驗證輸入
    this.validateRequest(request)

    // 2. 檢查重複（防止創建相同標題的任務）
    await this.checkDuplicates(request)

    // 3. 解析狀態
    const status = this.parseStatus(request.status)

    // 4. 準備任務資料
    const taskData: Omit<TaskData, 'id' | 'createdAt' | 'updatedAt'> = {
      userId: request.userId,
      productId: request.productId || null,
      topicId: request.topicId || null,
      content: request.content.trim(),
      status,
      aiAnalysis: null,
      references: [],
      subItems: [],
      startDate: request.startDate ? new Date(request.startDate) : null,
      dueDate: request.dueDate ? new Date(request.dueDate) : null,
      timeConfidence: request.timeConfidence || null,
      inferredFromMilestone: request.inferredFromMilestone || null,
      remindAt: null,
      reminderEnabled: false,
      reminderTimezone: null,
      notificationId: null,
    }

    // 4. 業務規則驗證
    this.validateBusinessRules(taskData)

    // 5. 建立任務
    const task = await this.taskRepository.create(taskData)

    return {
      task,
      message: `Task created successfully with status ${status}`,
    }
  }

  /**
   * 檢查是否已存在相同標題的任務（最近 24 小時內）
   * 🚀 優化：直接在 DB 層用 content 過濾，避免載入所有任務
   */
  private async checkDuplicates(request: CreateTaskRequest): Promise<void> {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

    // 直接用 content 和 createdAtFrom 過濾，只查詢重複的
    const existingTasks = await this.taskRepository.findMany({
      userId: request.userId,
      content: request.content.trim(),
      createdAtFrom: twentyFourHoursAgo,
      includeDeleted: false,
    })

    if (existingTasks.length > 0) {
      throw new ValidationException(
        `已存在相同標題的任務: "${request.content.trim()}"`,
        'content'
      )
    }
  }

  /**
   * 驗證請求資料
   */
  private validateRequest(request: CreateTaskRequest): void {
    if (!request.userId) {
      throw new ValidationException('User ID is required', 'userId')
    }

    // productId 為可選: INBOX 任務可以不指定 product
    // 但如果提供了,必須是有效的 UUID (不接受空字串)
    if (request.productId !== undefined && request.productId !== null) {
      if (!request.productId.trim()) {
        throw new ValidationException('Product ID cannot be empty', 'productId')
      }

      // 驗證 UUID 格式
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      if (!uuidRegex.test(request.productId)) {
        throw new ValidationException('Invalid Product ID format', 'productId')
      }
    }

    if (!request.content || request.content.trim().length === 0) {
      throw new ValidationException('Task content cannot be empty', 'content')
    }

    if (request.content.length > 500) {
      throw new ValidationException(
        'Task content must be less than 500 characters',
        'content'
      )
    }

    if (
      request.timeConfidence !== undefined &&
      request.timeConfidence !== null
    ) {
      if (
        request.timeConfidence < 0 ||
        request.timeConfidence > 1
      ) {
        throw new ValidationException(
          'Time confidence must be between 0 and 1',
          'timeConfidence'
        )
      }
    }
  }

  /**
   * 解析狀態字串為 TaskStatus
   */
  private parseStatus(status?: string): TaskStatus {
    if (!status) {
      return TaskStatus.INBOX
    }

    const upperStatus = status.toUpperCase()
    if (!(upperStatus in TaskStatus)) {
      throw new ValidationException(
        `Invalid status: ${status}. Must be one of: ${Object.values(TaskStatus).join(', ')}`,
        'status'
      )
    }

    return TaskStatus[upperStatus as keyof typeof TaskStatus]
  }

  /**
   * 驗證業務規則
   */
  private validateBusinessRules(
    taskData: Omit<TaskData, 'id' | 'createdAt' | 'updatedAt'>
  ): void {
    // 業務規則：截止日期不能早於開始日期
    if (taskData.dueDate && taskData.startDate) {
      if (taskData.dueDate < taskData.startDate) {
        throw new ValidationException(
          'Due date cannot be earlier than start date',
          'dueDate'
        )
      }
    }

    // 業務規則：ACTIVE 任務應該有截止日期（警告）
    if (taskData.status === TaskStatus.ACTIVE && !taskData.dueDate) {
      console.warn(
        '[CreateTaskUseCase] Creating ACTIVE task without due date:',
        taskData.content
      )
    }
  }
}
