/**
 * SubTask Utilities - sub_tasks 表的輔助函數
 */

import { prisma } from '@/lib/db'

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
