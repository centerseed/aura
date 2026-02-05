/**
 * GetTasksUseCase - 查詢任務清單
 *
 * Application Layer Use Case
 * 編排業務邏輯工作流，協調 Repository 與 Domain Entities
 */

import type {
  ITaskRepository,
  TaskData,
  TaskFilters,
} from '@/domain/interfaces/task-repository'
import { PrismaTaskRepository } from '@/infrastructure/repositories/prisma-task-repository'
import { TaskStatus } from '@/domain/value-objects/task-status'

// ============================================================================
// DTOs (Data Transfer Objects)
// ============================================================================

export interface GetTasksRequest {
  userId: string
  status?: string
  productId?: string
  topicId?: string
  completedToday?: boolean
  startDateFrom?: string
  startDateTo?: string
  dueDateFrom?: string
  dueDateTo?: string
  updatedAtFrom?: string
  updatedAtTo?: string
}

export interface GetTasksResponse {
  tasks: TaskData[]
  meta: {
    total: number
    filtered: number
  }
}

// ============================================================================
// Use Case
// ============================================================================

export class GetTasksUseCase {
  constructor(
    private readonly taskRepository: ITaskRepository = new PrismaTaskRepository()
  ) {}

  async execute(request: GetTasksRequest): Promise<GetTasksResponse> {
    // 1. 驗證與轉換輸入
    const filters = this.buildFilters(request)

    // 2. 透過 Repository 查詢
    const tasks = await this.taskRepository.findMany(filters)

    // 3. 應用業務規則：只在需要複雜排序時才執行（SQL 已做基本排序）
    // completed_today 場景不需要額外排序
    const sortedTasks = request.completedToday ? tasks : this.sortTasks(tasks)

    // 4. 🚀 優化：移除額外的 count 查詢，使用查詢結果長度
    // 對於大多數場景，filtered 就是實際需要的數量
    return {
      tasks: sortedTasks,
      meta: {
        total: sortedTasks.length, // 避免額外 DB round-trip
        filtered: sortedTasks.length,
      },
    }
  }

  /**
   * 建立查詢過濾條件
   */
  private buildFilters(request: GetTasksRequest): TaskFilters {
    const filters: TaskFilters = {
      userId: request.userId,
      includeDeleted: false,
    }

    // 狀態過濾
    if (request.status) {
      const upperStatus = request.status.toUpperCase()
      if (upperStatus in TaskStatus) {
        filters.status = TaskStatus[upperStatus as keyof typeof TaskStatus]
      }
    }

    // Product/Topic 過濾
    if (request.productId) {
      filters.productId = request.productId
    }

    if (request.topicId) {
      filters.topicId = request.topicId
    }

    // 今日完成篩選
    if (request.completedToday) {
      filters.completedToday = true
    }

    // 日期範圍
    if (request.startDateFrom) {
      filters.startDateFrom = new Date(request.startDateFrom)
    }
    if (request.startDateTo) {
      filters.startDateTo = new Date(request.startDateTo)
    }
    if (request.dueDateFrom) {
      filters.dueDateFrom = new Date(request.dueDateFrom)
    }
    if (request.dueDateTo) {
      filters.dueDateTo = new Date(request.dueDateTo)
    }
    if (request.updatedAtFrom) {
      filters.updatedAtFrom = new Date(request.updatedAtFrom)
    }
    if (request.updatedAtTo) {
      filters.updatedAtTo = new Date(request.updatedAtTo)
    }

    return filters
  }

  /**
   * 業務規則：任務排序邏輯
   *
   * 優先級：
   * 1. 過期任務（ACTIVE 且過期）
   * 2. 有截止日期的任務（按日期升序）
   * 3. 其他任務（按更新時間降序）
   */
  private sortTasks(tasks: TaskData[]): TaskData[] {
    return tasks.sort((a, b) => {
      // 過期任務優先
      const aOverdue = this.isOverdue(a)
      const bOverdue = this.isOverdue(b)

      if (aOverdue && !bOverdue) return -1
      if (!aOverdue && bOverdue) return 1

      // 有截止日期的任務按日期排序
      if (a.dueDate && b.dueDate) {
        return a.dueDate.getTime() - b.dueDate.getTime()
      }

      if (a.dueDate && !b.dueDate) return -1
      if (!a.dueDate && b.dueDate) return 1

      // 其他任務按更新時間降序
      return b.updatedAt.getTime() - a.updatedAt.getTime()
    })
  }

  /**
   * 檢查任務是否過期
   */
  private isOverdue(task: TaskData): boolean {
    if (!task.dueDate) return false
    if (task.status === TaskStatus.ARCHIVE) return false

    return new Date() > task.dueDate
  }
}
