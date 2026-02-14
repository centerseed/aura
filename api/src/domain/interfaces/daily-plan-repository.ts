/**
 * DailyPlanRepository Interface - 每日計畫儲存庫介面
 *
 * Domain Layer 定義的契約，由 Infrastructure Layer 實作
 */

// ============================================================================
// Domain Types (camelCase)
// ============================================================================

export type PlanItemType = 'task' | 'subtask'

export type PlanItemStatus = 'today' | 'overflow'

export interface DailyPlanItemData {
  id: string
  planId: string
  itemType: PlanItemType
  taskId: string
  subTaskId: string | null
  content: string
  areaName: string
  productName: string
  estimatedMinutes: number | null
  dueDate: Date | null
  order: number
  reasoning: string | null
  completed: boolean
  completedAt: Date | null
  actualMinutes: number | null
  pinned: boolean
  deferred: boolean
  status: PlanItemStatus
  userAdjusted: boolean
  adjustedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface OverflowItem {
  itemId: string
  content: string
  productName: string
  suggestion: string
}

export interface DailyPlanData {
  id: string
  userId: string
  planDate: Date
  coachMessage: string | null
  capacityNote: string | null
  availableMinutes: number | null
  meetingMinutes: number | null
  plannedMinutes: number | null
  overflowItems: OverflowItem[]
  items: DailyPlanItemData[]
  createdAt: Date
  updatedAt: Date
}

export interface CreateDailyPlanData {
  userId: string
  planDate: Date
  coachMessage: string | null
  capacityNote: string | null
  availableMinutes: number | null
  meetingMinutes: number | null
  plannedMinutes: number | null
  overflowItems?: OverflowItem[]
  items: Array<{
    taskId: string
    subTaskId: string | null
    content: string
    areaName: string
    productName: string
    estimatedMinutes: number | null
    dueDate: Date | null
    order: number
    reasoning: string | null
    status?: PlanItemStatus
    userAdjusted?: boolean
  }>
}

export interface UpdateDailyPlanItemData {
  order?: number
  completed?: boolean
  completedAt?: Date | null
  actualMinutes?: number
  pinned?: boolean
  deferred?: boolean
  status?: PlanItemStatus
  userAdjusted?: boolean
}

// ============================================================================
// Repository Interface
// ============================================================================

export interface IDailyPlanRepository {
  findByDate(userId: string, date: Date): Promise<DailyPlanData | null>

  upsert(data: CreateDailyPlanData): Promise<DailyPlanData>

  updateItem(itemId: string, data: UpdateDailyPlanItemData): Promise<DailyPlanItemData>
}
