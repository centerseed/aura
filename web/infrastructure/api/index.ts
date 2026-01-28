/**
 * API Client Index - 統一匯出所有 API 客戶端
 *
 * 提供單一入口點來訪問所有 API 客戶端
 */

// 基礎設施
export { apiGet, apiPost, apiPatch, apiDelete, apiRequest } from './client'
export type { ApiRequestConfig } from './client'
export {
  ApiError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ValidationError,
  ServerError,
  handleError,
  throwApiError,
} from './error-handler'

// API 客戶端
export { TasksAPI } from './tasks.api'
export type {
  CreateTaskDTO,
  UpdateTaskDTO,
  BatchUpdateTasksDTO,
  MergeTaskDTO,
  CreateReferenceDTO,
  CreateSubItemDTO,
  UpdateSubItemDTO,
} from './tasks.api'

export { ProductsAPI } from './products.api'
export type {
  CreateProductDTO,
  UpdateProductDTO,
  ReorganizeTopicsDTO,
  ApplyReorganizationDTO,
  ReorderProductsDTO,
  RestoreRecentTasksDTO,
} from './products.api'

export { AreasAPI } from './areas.api'
export type { CreateAreaDTO, UpdateAreaDTO } from './areas.api'

export { MilestonesAPI } from './milestones.api'
export type { CreateMilestoneDTO, UpdateMilestoneDTO } from './milestones.api'

export { BrainDumpAPI } from './brain-dump.api'
export type {
  BrainDumpDTO,
  BrainDumpResponse,
  StructuredItem,
  SubItem,
  SourceAttribution,
} from './brain-dump.api'

export { ReorganizeAPI } from './reorganize.api'
export type {
  ReorganizeDTO,
  ReorganizeResult,
  ReorganizePreviewResponse,
  ReorganizeConfirmResponse,
  MergeSuggestion,
  ReclassificationSuggestion,
} from './reorganize.api'
