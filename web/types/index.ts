/**
 * Type Re-exports - 類型重新導出
 *
 * 此文件將 domain 層的類型重新導出，保持向下兼容
 * 所有新代碼應該直接從 domain 層導入，但舊代碼仍可從 @/types 導入
 *
 * 遷移路徑：
 * 舊代碼: import { Task } from '@/types'
 * 新代碼: import { Task } from '@/domain/entities/task.entity'
 */

// ===== Value Objects =====
export type { DrawerStatus } from '../domain/value-objects/drawer-status'
export type { LifecycleStatus } from '../domain/value-objects/lifecycle'

// ===== Entities =====

// Task 相關實體
export type {
  Task,
  SubItem,
  SubItemsMeta,
  Reference,
  Topic,
  TaskTag,
  TaskCard,
  KanbanColumn,
  StructuredOutput,
} from '../domain/entities/task.entity'

// Product 相關實體
export type {
  Area,
  Product,
  TopicCluster,
  TaskTimeInference,
  TaskConsolidation,
  TaskContext,
  ReorganizeProposal,
  GovernanceAction,
} from '../domain/entities/product.entity'

// Milestone 相關實體
export type {
  Milestone,
  MilestoneStatus,
  EntityType,
} from '../domain/entities/milestone.entity'

// ===== Validation =====
export { UUID_PATTERN, isValidUUID, validateUUID } from '../domain/constants/validation'
