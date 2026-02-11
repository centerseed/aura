/**
 * SubTask Sync Utility - 雙寫過渡期的 JSON 同步工具
 *
 * 在 sub_tasks 表操作後，同步更新 task.sub_items JSON 欄位，
 * 保持前端相容性（前端目前從 task.sub_items 讀取）。
 *
 * 當前端全面切換為從 sub_tasks 表讀取後，可移除此模組。
 */

import { prisma } from '@/lib/db'

/**
 * 從 sub_tasks 表讀取並同步到 task.sub_items JSON
 */
export async function syncSubTasksToJson(taskId: string): Promise<void> {
  const subTasks = await prisma.subTask.findMany({
    where: { task_id: taskId, deleted_at: null },
    orderBy: { order: 'asc' },
  })

  const jsonSubItems = subTasks.map((st) => ({
    id: st.id,
    content: st.content,
    completed: st.completed,
    created_at: st.created_at.toISOString(),
    completed_at: st.completed_at?.toISOString() ?? null,
    order: st.order,
    ...(st.start_date ? { start_date: st.start_date.toISOString() } : {}),
    ...(st.due_date ? { due_date: st.due_date.toISOString() } : {}),
    ...(st.estimated_minutes !== null ? { estimated_minutes: st.estimated_minutes } : {}),
    ...(st.source !== 'user' ? { source: st.source } : {}),
    ...(st.original_task_id ? { original_task_id: st.original_task_id } : {}),
  }))

  await prisma.task.update({
    where: { id: taskId },
    data: {
      sub_items: jsonSubItems as any,
      updated_at: new Date(),
    },
  })
}

/**
 * 計算 sub_tasks 的統計資訊
 */
export async function getSubTasksMeta(taskId: string) {
  const subTasks = await prisma.subTask.findMany({
    where: { task_id: taskId, deleted_at: null },
    select: { completed: true },
  })

  const total = subTasks.length
  const completed = subTasks.filter((st) => st.completed).length
  const completionRate = total > 0 ? completed / total : 0

  return { total, completed, completionRate }
}
