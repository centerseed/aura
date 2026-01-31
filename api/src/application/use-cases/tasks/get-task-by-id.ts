/**
 * GetTaskByIdUseCase - 取得單一任務詳情
 *
 * Application Layer Use Case
 * 查詢單一任務並驗證權限
 */

import type {
  ITaskRepository,
  TaskData,
} from '@/domain/interfaces/task-repository'
import { PrismaTaskRepository } from '@/infrastructure/repositories/prisma-task-repository'
import { NotFoundException } from '@/lib/api-response'

// ============================================================================
// DTOs (Data Transfer Objects)
// ============================================================================

export interface GetTaskByIdRequest {
  taskId: string
  userId: string
}

export interface GetTaskByIdResponse {
  task: TaskData
}

// ============================================================================
// Use Case
// ============================================================================

export class GetTaskByIdUseCase {
  constructor(
    private readonly taskRepository: ITaskRepository = new PrismaTaskRepository()
  ) {}

  async execute(request: GetTaskByIdRequest): Promise<GetTaskByIdResponse> {
    // 1. 查詢任務
    const task = await this.taskRepository.findById(
      request.taskId,
      request.userId
    )

    // 2. 檢查是否存在
    if (!task) {
      throw new NotFoundException('Task')
    }

    return {
      task,
    }
  }
}
