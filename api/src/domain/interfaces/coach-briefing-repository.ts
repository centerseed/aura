/**
 * CoachBriefingRepository Interface - 教練簡報儲存庫介面
 *
 * Domain Layer 定義的契約，由 Infrastructure Layer 實作
 */

import type {
  BriefingType,
  CalendarEventSummary,
  TaskSummary,
  ConflictItem,
  StagnationItem,
  Recommendation,
  DeferSuggestion,
} from '../entities/coach-briefing.entity'

// ============================================================================
// Domain Types
// ============================================================================

export interface CoachBriefingData {
  id: string
  userId: string
  type: BriefingType
  briefingDate: Date

  // 聚合資料快照
  calendarEvents: CalendarEventSummary[]
  overdueTasks: TaskSummary[]
  approachingTasks: TaskSummary[]
  conflicts: ConflictItem[]
  stagnations: StagnationItem[]
  completedTasks: TaskSummary[]
  remainingTasks: TaskSummary[]
  tomorrowPreview: CalendarEventSummary[]

  // AI 生成內容
  summary: string
  recommendations: Recommendation[]
  deferSuggestions: DeferSuggestion[]

  createdAt: Date
  updatedAt: Date
}

export interface CreateCoachBriefingData {
  userId: string
  type: BriefingType
  briefingDate: Date
  calendarEvents: CalendarEventSummary[]
  overdueTasks: TaskSummary[]
  approachingTasks: TaskSummary[]
  conflicts: ConflictItem[]
  stagnations: StagnationItem[]
  completedTasks: TaskSummary[]
  remainingTasks: TaskSummary[]
  tomorrowPreview: CalendarEventSummary[]
  summary: string
  recommendations: Recommendation[]
  deferSuggestions: DeferSuggestion[]
}

// ============================================================================
// Repository Interface
// ============================================================================

export interface ICoachBriefingRepository {
  create(data: CreateCoachBriefingData): Promise<CoachBriefingData>

  findLatest(userId: string, type?: BriefingType): Promise<CoachBriefingData | null>

  findByDate(userId: string, type: BriefingType, date: Date): Promise<CoachBriefingData | null>

  upsertByDate(data: CreateCoachBriefingData): Promise<CoachBriefingData>
}
