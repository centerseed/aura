/**
 * PlanCandidate Entity - 計畫候選項型別定義
 *
 * 這些型別用於：
 * 1. UnifiedDataTransformer 的輸出格式
 * 2. CoachPlanGenerator 的輸入格式
 */

export interface PlanCandidate {
  itemType: 'task' | 'subtask'
  taskId: string
  subTaskId: string | null
  content: string
  areaName: string
  productName: string
  productDescription: string | null
  taskContent: string
  subTaskOrder: number | null
  estimatedMinutes: number | null
  dueDate: Date | null
  startDate: Date | null
  daysOverdue: number | null
  daysRemaining: number | null
  daysStagnant: number
  milestoneId: string | null
  dateSource: string | null
}

export interface MilestoneContext {
  id: string
  name: string
  targetDate: Date
  priority: number
  entityType: string
  entityName: string
}

export interface ProductContext {
  productId: string
  productName: string
  productDescription: string | null
  areaName: string
  taskSummaries: Array<{
    id: string
    content: string
    status: string
    dueDate: string | null
  }>
}

export interface WeeklyDayInfo {
  date: string          // YYYY-MM-DD
  dayOfWeek: string     // 星期X
  meetingMinutes: number
  availableMinutes: number
  tasksDue: number
  totalEstimatedMinutes: number
}

export interface CollectedData {
  candidates: PlanCandidate[]
  unscheduledTasks: PlanCandidate[]
  milestones: MilestoneContext[]
  productContexts: ProductContext[]
  meetingMinutes: number
  availableMinutes: number
  weeklyOverview: WeeklyDayInfo[]
}
