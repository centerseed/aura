import { UpdateTaskUseCase } from "@/application/use-cases/tasks/update-task"
import type { TaskData } from "@/domain/interfaces/task-repository"

export interface CompleteTaskRequest {
  taskId: string
  userId: string
}

export interface CompleteTaskResponse {
  task: TaskData
  message?: string
}

export class CompleteTaskUseCase {
  constructor(
    private readonly updateTaskUseCase: UpdateTaskUseCase = new UpdateTaskUseCase(),
  ) {}

  async execute(request: CompleteTaskRequest): Promise<CompleteTaskResponse> {
    return this.updateTaskUseCase.execute({
      taskId: request.taskId,
      userId: request.userId,
      status: "ARCHIVE",
    })
  }
}
