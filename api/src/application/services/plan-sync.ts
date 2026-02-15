/**
 * Plan Sync Service
 *
 * 當任務新增/更新 due_date 到三天內時，自動插入現有 plan 的 overflow 區
 */

import { prisma } from '@/lib/db'
import { toDateOnly } from '@/lib/timezone-utils'
import { PrismaDailyPlanRepository } from '@/infrastructure/repositories/prisma-daily-plan-repository'

interface SyncParams {
  userId: string
  taskId: string
  subTaskId?: string | null
  dueDate: string | Date | null | undefined
  timezone?: string
}

export async function syncPlanOnTaskChange(params: SyncParams): Promise<void> {
  const { userId, taskId, subTaskId, dueDate, timezone = 'Asia/Taipei' } = params

  // 1. 無 dueDate 則不處理
  if (!dueDate) return

  const dueDateObj = typeof dueDate === 'string' ? new Date(dueDate) : dueDate
  if (isNaN(dueDateObj.getTime())) return

  // 2. 判斷 dueDate 是否在 3 天內
  const now = new Date()
  const todayStart = toDateOnly(now, timezone)
  const threeDaysLater = new Date(todayStart.getTime() + 3 * 24 * 60 * 60 * 1000)
  const dueDateOnly = toDateOnly(dueDateObj, timezone)

  if (dueDateOnly < todayStart || dueDateOnly >= threeDaysLater) return

  // 3. 查今天的 plan
  const repo = new PrismaDailyPlanRepository()
  const plan = await repo.findByDate(userId, todayStart)
  if (!plan) return

  // 4. 檢查是否已有此 task/subtask
  const alreadyExists = plan.items.some(item =>
    item.taskId === taskId &&
    (subTaskId ? item.subTaskId === subTaskId : !item.subTaskId)
  )
  if (alreadyExists) return

  // 5. 查 task 資訊
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: {
      content: true,
      due_date: true,
      product: {
        select: {
          name: true,
          area: { select: { name: true } },
        },
      },
    },
  })
  if (!task) return

  // 如果是 subtask，查 subtask 的 content 和 estimated_minutes
  let itemContent = task.content
  let itemDueDate = task.due_date
  let estimatedMinutes: number | null = null
  if (subTaskId) {
    const subTask = await prisma.subTask.findUnique({
      where: { id: subTaskId },
      select: { content: true, due_date: true, estimated_minutes: true },
    })
    if (subTask) {
      itemContent = subTask.content
      if (subTask.due_date) itemDueDate = subTask.due_date
      estimatedMinutes = subTask.estimated_minutes
    }
  }

  // 6. 計算 order（現有 items 最大 order + 1）
  const maxOrder = plan.items.length > 0
    ? Math.max(...plan.items.map(i => i.order))
    : -1

  // 7. 插入 overflow item
  await repo.addItem(plan.id, {
    taskId,
    subTaskId: subTaskId ?? null,
    content: itemContent,
    areaName: task.product?.area.name ?? 'Unknown',
    productName: task.product?.name ?? 'Unknown',
    estimatedMinutes: estimatedMinutes,
    dueDate: itemDueDate,
    order: maxOrder + 1,
    reasoning: null,
    status: 'overflow',
  })
}
