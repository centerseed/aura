/**
 * Daily Plan Entity - 每日計畫領域實體
 *
 * 定義 Coach Agent 每日排程的核心資料結構
 */

// ============================================================================
// Plan Item 子類型
// ============================================================================

export type PlanItemType = 'task' | 'subtask'

export interface DailyPlanItem {
  id: string
  plan_id: string
  task_id: string
  sub_task_id: string | null
  item_type: PlanItemType
  content: string
  area_name: string
  product_name: string
  estimated_minutes: number | null
  due_date: string | null
  order: number
  reasoning: string | null
  completed: boolean
  completed_at: string | null
  pinned: boolean
  deferred: boolean
  is_recurring: boolean
  created_at: string
  updated_at: string
}

// ============================================================================
// 核心 Entity
// ============================================================================

export interface DailyPlan {
  id: string
  user_id: string
  plan_date: string
  coach_message: string | null
  capacity_note: string | null
  available_minutes: number | null
  meeting_minutes: number | null
  planned_minutes: number | null
  items: DailyPlanItem[]
  created_at: string
  updated_at: string
}
