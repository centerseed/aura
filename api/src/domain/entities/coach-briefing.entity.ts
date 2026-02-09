/**
 * Coach Briefing Entity - 教練簡報領域實體
 *
 * 定義 Coach Agent 晨報/晚報的核心資料結構
 */

export type BriefingType = 'MORNING' | 'EVENING'

// ============================================================================
// 聚合資料子類型
// ============================================================================

export interface CalendarEventSummary {
  id: string
  summary: string
  start_date_time: string
  end_date_time: string
  meet_link: string | null
  event_link: string
  attendees: string[]
  linked_task_id: string | null
}

export interface TaskSummary {
  id: string
  content: string
  status: string
  due_date: string | null
  area_name: string
  product_name: string
  days_overdue: number | null
  days_remaining: number | null
  days_stagnant: number | null
  urgency_level: string | null
}

export interface ConflictItem {
  type: 'time_overlap' | 'deadline_collision' | 'capacity_overload'
  severity: 'high' | 'medium' | 'low'
  description: string
  involved_items: Array<{
    id: string
    title: string
    type: 'calendar_event' | 'task'
    time: string | null
  }>
}

export interface StagnationItem {
  type: 'stagnant_product' | 'stuck_task' | 'zombie_project'
  entity_id: string
  entity_name: string
  area_name: string
  days_inactive: number
  last_activity: string
  suggestion: string
}

// ============================================================================
// AI 生成內容子類型
// ============================================================================

export interface Recommendation {
  priority: number // 1-3
  action: string
  reasoning: string
  related_task_id: string | null
}

export interface DeferSuggestion {
  task_id: string
  task_content: string
  suggested_action: 'defer' | 'archive' | 'delegate'
  reasoning: string
}

// ============================================================================
// 核心 Entity
// ============================================================================

export interface CoachBriefing {
  id: string
  user_id: string
  type: BriefingType
  briefing_date: string

  // 聚合資料快照
  calendar_events: CalendarEventSummary[]
  overdue_tasks: TaskSummary[]
  approaching_tasks: TaskSummary[]
  conflicts: ConflictItem[]
  stagnations: StagnationItem[]
  completed_tasks: TaskSummary[]
  remaining_tasks: TaskSummary[]
  tomorrow_preview: CalendarEventSummary[]

  // AI 生成內容
  summary: string
  recommendations: Recommendation[]
  defer_suggestions: DeferSuggestion[]

  created_at: string
  updated_at: string
}
