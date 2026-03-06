/**
 * RecurringTaskRepository Interface - 週期任務儲存庫介面
 */

// ============================================================================
// Domain Types
// ============================================================================

export type RecurringTaskStatus = 'ACTIVE' | 'PAUSED' | 'ARCHIVED'
export type RecurrenceFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY'

export interface RecurrenceRule {
  frequency: RecurrenceFrequency
  interval: number          // 每 N 天/週/月
  daysOfWeek?: number[]     // WEEKLY: 0=週日, 6=週六
  dayOfMonth?: number       // MONTHLY: 1-31
  timeOfDay?: string        // 'HH:mm'
  timezone: string          // IANA，如 'Asia/Taipei'
  startDate: string         // 'YYYY-MM-DD'
  endDate?: string          // 'YYYY-MM-DD'（選填）
}

export interface RecurringTaskData {
  id: string
  userId: string
  productId: string | null
  topicId: string | null
  title: string
  status: RecurringTaskStatus
  recurrenceRule: RecurrenceRule
  leadDays: number
  nextOccurrenceAt: Date | null
  estimatedDurationHours: number | null
  createdAt: Date
  updatedAt: Date
}

// ============================================================================
// Create / Update DTOs
// ============================================================================

export type RecurringTaskCreateData = Omit<RecurringTaskData, 'id' | 'createdAt' | 'updatedAt'>

export interface RecurringTaskUpdateData {
  title?: string
  status?: RecurringTaskStatus
  recurrenceRule?: RecurrenceRule
  leadDays?: number
  nextOccurrenceAt?: Date | null
  productId?: string | null
  topicId?: string | null
  estimatedDurationHours?: number | null
}

// ============================================================================
// Repository Interface
// ============================================================================

export interface IRecurringTaskRepository {
  create(data: RecurringTaskCreateData): Promise<RecurringTaskData>
  findById(id: string, userId: string): Promise<RecurringTaskData | null>
  findByUserId(userId: string): Promise<RecurringTaskData[]>
  findPendingForUser(userId: string, beforeDate: Date): Promise<RecurringTaskData[]>
  update(id: string, userId: string, data: RecurringTaskUpdateData): Promise<RecurringTaskData>
  softDelete(id: string, userId: string): Promise<void>
}
