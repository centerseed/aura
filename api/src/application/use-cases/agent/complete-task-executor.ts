import type { CompleteTaskPayload } from "@/lib/line-session"
import { CompleteTaskUseCase } from "@/application/use-cases/tasks/complete-task"
import { UpdateSubItemUseCase } from "@/application/use-cases/tasks/update-sub-item"
import { UpdatePlanItemUseCase } from "@/application/use-cases/coach/update-plan-item"

export async function executeCompleteTaskPayload(userId: string, payload: CompleteTaskPayload): Promise<void> {
  if (payload.sourceType === "sub_task" && payload.taskId && payload.subTaskId) {
    await new UpdateSubItemUseCase().execute({
      taskId: payload.taskId,
      subItemId: payload.subTaskId,
      userId,
      completed: true,
    })
    return
  }

  if (payload.sourceType === "daily_plan_item" && payload.planItemId) {
    await new UpdatePlanItemUseCase().execute({
      itemId: payload.planItemId,
      userId,
      completed: true,
    })
    return
  }

  if (payload.taskId) {
    await new CompleteTaskUseCase().execute({
      taskId: payload.taskId,
      userId,
    })
    return
  }

  throw new Error("Invalid complete task payload")
}

export function buildCompleteTaskSuccessMessage(taskTitle: string): string {
  return `✅ 已完成「${taskTitle}」`
}
