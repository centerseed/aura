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

/**
 * 根據 dueDate 決定 plan item 的 status
 */
function determineItemStatus(
  dueDateOnly: Date,
  todayStart: Date
): 'today' | 'tomorrow' | 'overflow' {
  const tomorrow = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000)

  if (dueDateOnly.getTime() === todayStart.getTime()) {
    return 'today'
  } else if (dueDateOnly.getTime() === tomorrow.getTime()) {
    return 'tomorrow'
  } else {
    return 'overflow'
  }
}

export async function syncPlanOnTaskChange(params: SyncParams): Promise<void> {
  const { userId, taskId, subTaskId, dueDate, timezone = 'Asia/Taipei' } = params
  console.log('[PlanSync] called:', { taskId, subTaskId, dueDate, timezone })

  // 1. 無 dueDate 則不處理
  if (!dueDate) {
    console.log('[PlanSync] skip: no dueDate')
    return
  }

  const dueDateObj = typeof dueDate === 'string' ? new Date(dueDate) : dueDate
  if (isNaN(dueDateObj.getTime())) {
    console.log('[PlanSync] skip: invalid dueDate')
    return
  }

  // 2. 判斷 dueDate 是否在 3 天內
  const now = new Date()
  const todayStart = toDateOnly(now, timezone)
  const threeDaysLater = new Date(todayStart.getTime() + 3 * 24 * 60 * 60 * 1000)
  const dueDateOnly = toDateOnly(dueDateObj, timezone)

  console.log('[PlanSync] dates:', { todayStart: todayStart.toISOString(), dueDateOnly: dueDateOnly.toISOString(), threeDaysLater: threeDaysLater.toISOString() })

  if (dueDateOnly < todayStart || dueDateOnly >= threeDaysLater) {
    console.log('[PlanSync] skip: dueDate out of 3-day range')
    return
  }

  // 3. 查今天的 plan
  const repo = new PrismaDailyPlanRepository()
  const plan = await repo.findByDate(userId, todayStart)
  if (!plan) {
    console.log('[PlanSync] skip: no plan found for today')
    return
  }
  console.log('[PlanSync] found plan:', plan.id, 'with', plan.items.length, 'items')

  // 4. 檢查是否已有此 task/subtask
  const existingItem = plan.items.find(item =>
    item.taskId === taskId &&
    (subTaskId ? item.subTaskId === subTaskId : !item.subTaskId)
  )
  if (existingItem) {
    // 已存在：更新 status（due_date 可能變了）
    const finalDueDateOnly = toDateOnly(dueDateObj, timezone)
    const newStatus = determineItemStatus(finalDueDateOnly, todayStart)
    if (existingItem.status !== newStatus && !existingItem.userAdjusted) {
      console.log('[PlanSync] updating existing item status:', existingItem.id, existingItem.status, '→', newStatus)
      await repo.updateItem(existingItem.id, { status: newStatus })
    } else {
      console.log('[PlanSync] skip: task already in plan with correct status')
    }
    return
  }

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

  // 7. 根據最終的 dueDate 決定 status（考慮 subtask 可能覆蓋 task 的 due_date）
  const finalDueDateOnly = itemDueDate ? toDateOnly(itemDueDate, timezone) : dueDateOnly
  const itemStatus = determineItemStatus(finalDueDateOnly, todayStart)
  console.log('[PlanSync] inserting item for task:', taskId, 'with status:', itemStatus)

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
    status: itemStatus,
  })
}
