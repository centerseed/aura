/**
 * IDataCollector - 資料收集介面 (Domain Layer)
 *
 * Application 層透過此介面依賴資料收集，而非直接依賴 Infrastructure 實作
 * 符合 Clean Architecture 的依賴反向原則
 */

export interface UnifiedRawData {
  allTasks: Array<{
    id: string
    content: string
    status: string
    due_date: Date | null
    start_date: Date | null
    updated_at: Date
    completed_at: Date | null
    area_name: string
    product_id: string
    product_name: string
    product_description: string | null
    inferred_from_milestone: string | null
    date_source: string | null
  }>
  allSubTasks: Array<{
    id: string
    task_id: string
    content: string
    completed: boolean
    due_date: Date | null
    start_date: Date | null
    estimated_minutes: number | null
    order: number
    updated_at: Date
  }>
  todayCalendar: Array<{
    id: string
    summary: string
    start_date_time: Date
    end_date_time: Date
    meet_link: string | null
    event_link: string
    attendees: string[]
    task_id: string | null
  }>
  tomorrowCalendar: Array<{
    id: string
    summary: string
    start_date_time: Date
    end_date_time: Date
    meet_link: string | null
    event_link: string
    attendees: string[]
    task_id: string | null
  }>
  weeklyCalendar: Map<string, number>
  completedTasks: Array<{
    id: string
    content: string
    completed_at: Date
    area_name: string
    product_name: string
  }>
  unscheduledTasks: Array<{
    id: string
    content: string
    status: string
    area_name: string
    product_id: string
    product_name: string
    product_description: string | null
    due_date: Date | null
    start_date: Date | null
    updated_at: Date
    completed_at: Date | null
    inferred_from_milestone: string | null
    date_source: string | null
  }>
  milestones: Array<{
    id: string
    name: string
    target_date: Date
    entity_type: string
    entity_name: string
  }>
}

export interface IDataCollector {
  /**
   * 收集指定用戶的統一資料
   */
  collect(
    userId: string,
    date: Date,
    timezone: string
  ): Promise<UnifiedRawData>
}
