/**
 * API 格式化輔助函數
 *
 * 統一處理 TaskData 到前端格式的轉換
 * 用於減少重複代碼並確保一致性
 */

import type { TaskData } from '@/domain/interfaces/task-repository'
import { TaskStatus } from '@/domain/value-objects/task-status'

/**
 * 將 TaskData 格式化為前端格式
 */
export function formatTaskForFrontend(task: TaskData) {
  const analysis = task.aiAnalysis || {}
  const subItems = task.subItems || []

  return {
    id: task.id,
    title: task.content,
    narrative: analysis.narrative || null,
    drawer: task.status,
    lifecycle: analysis.lifecycle || 'embryo',
    tag: {
      area: task.product?.area.name || 'Unknown',
      product: task.product?.name || 'Unknown',
      topic: task.topic?.name || '未分類',
    },
    // Raw fields for Mobile App / Sync
    product_id: task.productId,
    topic_id: task.topicId,
    user_id: task.userId,
    content: task.content,
    status: task.status,
    sub_items: subItems.map((s) => ({
      id: s.id,
      content: s.content,
      completed: s.completed,
      created_at: s.createdAt.toISOString(),
      completed_at: s.completedAt?.toISOString() || null,
      order: s.order,
    })),
    strategy_used: analysis.strategyUsed || null,
    reasoning: analysis.reasoning || null,
    start_date: task.startDate?.toISOString() || null,
    due_date: task.dueDate?.toISOString() || null,
    time_confidence: task.timeConfidence || null,
    inferred_from_milestone: task.inferredFromMilestone || null,
    updated_at: task.updatedAt.toISOString(),
    created_at: task.createdAt.toISOString(),
    references: task.references.map((r) => ({
      id: r.id,
      type: r.type,
      content: r.content,
      title: r.title || null,
      created_at: r.createdAt.toISOString(),
    })),
  }
}

/**
 * 批量格式化任務列表
 */
export function formatTasksForFrontend(tasks: TaskData[]) {
  return tasks.map((task) => formatTaskForFrontend(task))
}

/**
 * 計算 SubItems 統計資訊
 */
export function calculateSubItemsStats(subItems: Array<{ completed: boolean }>) {
  const total = subItems.length
  const completed = subItems.filter((item) => item.completed).length

  return {
    total,
    completed,
    completion_rate: total > 0 ? completed / total : 0,
  }
}
