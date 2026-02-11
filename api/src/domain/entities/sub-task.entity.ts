/**
 * SubTask Entity - 子任務領域實體
 *
 * 從 Task.sub_items JSON 升級為獨立資料庫表，
 * 支援獨立排程（start_date, due_date）和時間估算。
 */

export type SubTaskSource = 'user' | 'coach' | 'reorganize'

/**
 * SubTask - 子任務核心實體
 */
export interface SubTaskData {
  id: string
  taskId: string
  userId: string
  content: string
  completed: boolean
  completedAt: Date | null
  order: number
  startDate: Date | null
  dueDate: Date | null
  estimatedMinutes: number | null
  source: SubTaskSource
  originalTaskId: string | null
  createdAt: Date
  updatedAt: Date
}

/**
 * SubTask API 回應格式（snake_case + ISO string）
 * 相容於舊 SubItem JSON 格式，新增可選欄位
 */
export interface SubTaskResponse {
  id: string
  content: string
  completed: boolean
  created_at: string
  completed_at: string | null
  order: number
  // 新增欄位（可選，相容舊格式）
  start_date?: string | null
  due_date?: string | null
  estimated_minutes?: number | null
  source?: SubTaskSource
  original_task_id?: string | null
}

/**
 * 將 Domain SubTaskData 轉換為 API Response 格式
 * 保持與舊 SubItem JSON 格式的相容性
 */
export function toSubTaskResponse(data: SubTaskData): SubTaskResponse {
  return {
    id: data.id,
    content: data.content,
    completed: data.completed,
    created_at: data.createdAt.toISOString(),
    completed_at: data.completedAt?.toISOString() ?? null,
    order: data.order,
    start_date: data.startDate?.toISOString() ?? null,
    due_date: data.dueDate?.toISOString() ?? null,
    estimated_minutes: data.estimatedMinutes,
    source: data.source,
    original_task_id: data.originalTaskId,
  }
}
