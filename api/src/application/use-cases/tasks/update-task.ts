/**
 * UpdateTaskUseCase - 更新任務
 *
 * Application Layer Use Case
 * 處理任務更新的業務工作流，包含驗證與狀態轉換規則
 */

import type {
  ITaskRepository,
  TaskData,
  TaskUpdateData,
} from '@/domain/interfaces/task-repository'
import { PrismaTaskRepository } from '@/infrastructure/repositories/prisma-task-repository'
import { Task } from '@/domain/entities/task'
import { TaskStatus, TaskStatusVO } from '@/domain/value-objects/task-status'
import {
  ValidationException,
  NotFoundException,
  ConflictException,
} from '@/lib/api-response'
import { librarianObserve } from '@/lib/librarian-client'
import { prisma } from '@/lib/db'
import { syncSubTasksToJson } from '@/infrastructure/repositories/sub-task-sync'
import { PrismaCoachBriefingRepository } from '@/infrastructure/repositories/prisma-coach-briefing-repository'

// ============================================================================
// DTOs
// ============================================================================

export interface UpdateTaskRequest {
  taskId: string
  userId: string
  status?: string
  productId?: string
  topicId?: string | null
  content?: string
  narrative?: string | null
  startDate?: string | null
  dueDate?: string | null
  timeConfidence?: number | null
  inferredFromMilestone?: string | null
  remindAt?: string | null
  reminderEnabled?: boolean
  reminderTimezone?: string | null
  notificationId?: number | null
}

export interface UpdateTaskResponse {
  task: TaskData
  message?: string
}

// ============================================================================
// Use Case
// ============================================================================

export class UpdateTaskUseCase {
  constructor(
    private readonly taskRepository: ITaskRepository = new PrismaTaskRepository()
  ) {}

  async execute(request: UpdateTaskRequest): Promise<UpdateTaskResponse> {
    // 1. 驗證輸入
    this.validateRequest(request)

    // 2. 查詢現有任務
    const existingTaskData = await this.taskRepository.findById(
      request.taskId,
      request.userId
    )

    if (!existingTaskData) {
      throw new NotFoundException('Task')
    }

    // 3. 轉換為 Domain Entity（保留完整狀態）
    const task = this.toDomainEntity(existingTaskData)

    // 4. 應用業務規則與更新
    let statusMessage: string | undefined

    if (request.status) {
      const newStatus = TaskStatus[request.status.toUpperCase() as keyof typeof TaskStatus]
      if (!newStatus) {
        throw new ValidationException(`Invalid status: ${request.status}`, 'status')
      }

      // 使用 Domain Entity 的業務邏輯驗證狀態轉換
      task.changeStatus(newStatus)

      // 切換為 ACTIVE 且 start_date 為空 → 自動設為今天
      if (newStatus === TaskStatus.ACTIVE && !existingTaskData.startDate) {
        const now = new Date()
        if (!task.dueDate || task.dueDate >= now) {
          task.setStartDate(now)
        }
      }

      const newStatusVO = TaskStatusVO.fromString(newStatus)
      const oldStatusVO = TaskStatusVO.fromString(existingTaskData.status)
      statusMessage = oldStatusVO.getTransitionHint(newStatusVO)
    }

    if (request.content) {
      task.updateContent(request.content)
    }

    if (request.narrative !== undefined) {
      task.updateNarrative(request.narrative)
    }

    if (request.productId || request.topicId !== undefined) {
      task.moveToProduct(
        request.productId || existingTaskData.productId,
        request.topicId !== undefined ? request.topicId : existingTaskData.topicId
      )
    }

    if (request.dueDate !== undefined) {
      task.setDueDate(request.dueDate ? new Date(request.dueDate) : null)
    }

    if (request.startDate !== undefined) {
      task.setStartDate(request.startDate ? new Date(request.startDate) : null)
    }

    // 4.5 due_date 與 status 連動邏輯（僅在未明確指定 status 時觸發）
    let statusChangedByDueDate = false
    if (request.dueDate !== undefined && !request.status) {
      const currentStatus = task.status

      // 設定 due_date 且目前是 INBOX → 自動改成 ACTIVE
      if (request.dueDate && currentStatus === TaskStatus.INBOX) {
        task.changeStatus(TaskStatus.ACTIVE)
        // 同步設定 start_date（只在 due_date >= 今天時）
        if (!existingTaskData.startDate && task.dueDate && task.dueDate >= new Date()) {
          task.setStartDate(new Date())
        }
        statusMessage = '已設定截止日期，狀態自動變更為進行中'
        statusChangedByDueDate = true
      }

      // 清除 due_date 且目前是 ACTIVE → 自動改回 INBOX
      if (!request.dueDate && currentStatus === TaskStatus.ACTIVE) {
        task.changeStatus(TaskStatus.INBOX)
        statusMessage = '已清除截止日期，狀態自動變更為規劃中'
        statusChangedByDueDate = true
      }
    }

    // 5. 準備更新資料
    const updateData: TaskUpdateData = {}

    if (request.status || statusChangedByDueDate) {
      updateData.status = task.status
    }
    if (request.productId) {
      updateData.productId = task.productId
    }
    if (request.topicId !== undefined) {
      updateData.topicId = task.topicId
    }
    if (request.content) {
      updateData.content = task.content
    }
    if (request.narrative !== undefined) {
      updateData.narrative = task.narrative
    }
    if (request.startDate !== undefined || (task.startDate && !existingTaskData.startDate)) {
      updateData.startDate = task.startDate
    }
    if (request.dueDate !== undefined) {
      updateData.dueDate = task.dueDate
    }
    if (request.timeConfidence !== undefined) {
      updateData.timeConfidence = request.timeConfidence
    }
    if (request.inferredFromMilestone !== undefined) {
      updateData.inferredFromMilestone = request.inferredFromMilestone
    }
    if (request.remindAt !== undefined) {
      updateData.remindAt = request.remindAt ? new Date(request.remindAt) : null
    }
    if (request.reminderEnabled !== undefined) {
      updateData.reminderEnabled = request.reminderEnabled
    }
    if (request.reminderTimezone !== undefined) {
      updateData.reminderTimezone = request.reminderTimezone
    }
    if (request.notificationId !== undefined) {
      updateData.notificationId = request.notificationId
    }

    // 5.5 用戶修改日期 → 設 date_source='user'（保護不被 Coach 覆寫）
    if (request.startDate !== undefined || request.dueDate !== undefined) {
      updateData.dateSource = 'user'
    }

    // 6. 透過 Repository 更新
    const updatedTask = await this.taskRepository.update(
      request.taskId,
      request.userId,
      updateData
    )

    // 6.5. Task 完成連動：同步更新對應的 DailyPlanItem
    if (request.status && updateData.status) {
      const isNowArchived = updateData.status === TaskStatus.ARCHIVE
      const wasArchived = existingTaskData.status === TaskStatus.ARCHIVE

      // 狀態變更為 ARCHIVE 或從 ARCHIVE 變回其他狀態時，同步更新 plan item
      if (isNowArchived !== wasArchived) {
        await this.syncPlanItemCompletion(
          request.taskId,
          null, // 不是 subtask
          isNowArchived,
          isNowArchived ? updatedTask : null // 傳入任務資料用於自動補入 plan
        )

        // 父 task 完成時，自動完成所有未完成的 subtask
        if (isNowArchived) {
          await this.completeAllSubItems(request.taskId)
          // 從今日 briefing 移除已完成的任務
          await this.removeTaskFromBriefing(request.userId, request.taskId)
        }
      }
    }

    // 7. 非同步推送分類修正到 Librarian Service
    if (request.productId && request.productId !== existingTaskData.productId) {
      // 查詢 product names（Librarian 需要可讀文字，不能用 UUID）
      const [oldProduct, newProduct] = await Promise.all([
        prisma.product.findUnique({
          where: { id: existingTaskData.productId },
          select: { name: true },
        }),
        prisma.product.findUnique({
          where: { id: request.productId },
          select: { name: true },
        }),
      ])

      if (oldProduct && newProduct) {
        librarianObserve({
          userId: request.userId,
          taskContent: existingTaskData.content,
          originalProduct: oldProduct.name,
          correctedProduct: newProduct.name,
        }).catch(() => {})
      }
    }

    if (request.topicId !== undefined && request.topicId !== existingTaskData.topicId) {
      // Topic 變更：保持 product 不變，只改 topic
      const product = await prisma.product.findUnique({
        where: { id: existingTaskData.productId },
        select: { name: true },
      })

      const [oldTopic, newTopic] = await Promise.all([
        existingTaskData.topicId
          ? prisma.topic.findUnique({
              where: { id: existingTaskData.topicId },
              select: { name: true },
            })
          : Promise.resolve(null),
        request.topicId
          ? prisma.topic.findUnique({
              where: { id: request.topicId },
              select: { name: true },
            })
          : Promise.resolve(null),
      ])

      if (product) {
        librarianObserve({
          userId: request.userId,
          taskContent: existingTaskData.content,
          originalProduct: product.name,
          correctedProduct: product.name,
          originalTopic: oldTopic?.name ?? null,
          correctedTopic: newTopic?.name ?? null,
        }).catch(() => {})
      }
    }

    // 8. 返回結果
    return {
      task: updatedTask,
      message: statusMessage,
    }
  }

  /**
   * 同步更新對應的 DailyPlanItem 的完成狀態
   *
   * @param taskId - Task ID
   * @param subTaskId - SubTask ID (如果是 subtask)
   * @param completed - 是否完成
   */
  private async syncPlanItemCompletion(
    taskId: string,
    subTaskId: string | null,
    completed: boolean,
    taskData?: TaskData | null
  ): Promise<void> {
    try {
      // 查找對應的 plan item
      const planItem = await prisma.dailyPlanItem.findFirst({
        where: {
          task_id: taskId,
          ...(subTaskId ? { sub_task_id: subTaskId } : { sub_task_id: null }),
        },
      })

      if (planItem) {
        // 更新 plan item 的完成狀態
        await prisma.dailyPlanItem.update({
          where: { id: planItem.id },
          data: {
            completed,
            completed_at: completed ? new Date() : null,
          },
        })
      } else if (completed && taskData) {
        // Plan 裡沒有對應 item，自動創建一個已完成的 plan item
        const today = new Date()
        const todayDate = today.toISOString().slice(0, 10)

        const todayPlan = await prisma.dailyPlan.findFirst({
          where: {
            user_id: taskData.userId,
            plan_date: todayDate,
          },
        })

        if (todayPlan) {
          // 查詢 product name 和 area name
          const product = await prisma.product.findUnique({
            where: { id: taskData.productId },
            select: { name: true, area: { select: { name: true } } },
          })

          await prisma.dailyPlanItem.create({
            data: {
              plan_id: todayPlan.id,
              task_id: taskId,
              sub_task_id: subTaskId,
              item_type: 'task',
              content: taskData.content,
              area_name: product?.area?.name ?? '',
              product_name: product?.name ?? '',
              estimated_minutes: 30,
              status: 'today',
              completed: true,
              completed_at: new Date(),
              order: 9999,
            },
          })
        }
      }
    } catch (error) {
      // 非關鍵操作，失敗不影響主流程
      console.error('[UpdateTaskUseCase] Failed to sync plan item:', error)
    }
  }

  /**
   * 父 task 完成時，自動完成所有未完成的 subtask
   */
  private async completeAllSubItems(taskId: string): Promise<void> {
    try {
      const now = new Date()

      // 批次更新所有未完成的 subtask
      const { count } = await prisma.subTask.updateMany({
        where: {
          task_id: taskId,
          completed: false,
          deleted_at: null,
        },
        data: {
          completed: true,
          completed_at: now,
        },
      })

      if (count > 0) {
        // 同步 JSON
        await syncSubTasksToJson(taskId)

        // 同步對應的 DailyPlanItem 完成狀態
        await prisma.dailyPlanItem.updateMany({
          where: {
            task_id: taskId,
            sub_task_id: { not: null },
            completed: false,
          },
          data: {
            completed: true,
            completed_at: now,
          },
        })
      }
    } catch (error) {
      console.error('[UpdateTaskUseCase] Failed to complete sub-items:', error)
    }
  }

  /**
   * 從今日 briefing 的所有任務列表中移除已完成的任務
   */
  private async removeTaskFromBriefing(userId: string, taskId: string): Promise<void> {
    try {
      const briefingRepo = new PrismaCoachBriefingRepository()
      await briefingRepo.removeTaskFromBriefing(userId, taskId)
    } catch (error) {
      // 非關鍵操作，失敗不影響主流程
      console.error('[UpdateTaskUseCase] Failed to remove briefing overdue task:', error)
    }
  }

  /**
   * 驗證請求
   */
  private validateRequest(request: UpdateTaskRequest): void {
    if (!request.taskId) {
      throw new ValidationException('Task ID is required', 'taskId')
    }

    if (!request.userId) {
      throw new ValidationException('User ID is required', 'userId')
    }

    // 檢查是否有任何更新資料
    const hasUpdate =
      request.status ||
      request.productId ||
      request.topicId !== undefined ||
      request.content ||
      request.narrative !== undefined ||
      request.startDate !== undefined ||
      request.dueDate !== undefined ||
      request.timeConfidence !== undefined ||
      request.inferredFromMilestone !== undefined ||
      request.remindAt !== undefined ||
      request.reminderEnabled !== undefined ||
      request.reminderTimezone !== undefined ||
      request.notificationId !== undefined

    if (!hasUpdate) {
      throw new ValidationException('No update data provided', 'data')
    }

    // 驗證 timeConfidence 範圍
    if (
      request.timeConfidence !== null &&
      request.timeConfidence !== undefined
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
   * TaskData → Domain Entity
   *
   * 將 Repository 返回的純資料物件轉換為有行為的 Domain Entity
   */
  private toDomainEntity(data: TaskData): Task {
    return new Task(
      data.id,
      data.userId,
      data.productId,
      data.topicId,
      data.content,
      TaskStatusVO.fromString(data.status),
      data.aiAnalysis,
      data.references,
      data.subItems,
      data.startDate,
      data.dueDate,
      data.timeConfidence,
      data.inferredFromMilestone,
      data.createdAt,
      data.updatedAt
    )
  }
}
