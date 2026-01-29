/**
 * Dashboard Context Types - Dashboard 上下文類型定義
 *
 * 定義 Dashboard 所需的所有類型和介面
 */

import type {
  TaskCard,
  DrawerStatus,
  Milestone,
  ReorganizeProposal,
} from '@/types'

/**
 * 視圖模式
 */
export type ViewMode = 'structure' | 'timeline' | 'gantt'

/**
 * API 返回的 Area 結構
 */
export interface ApiArea {
  id: string
  name: string
  description: string | null
  scope: string | null
  products: ApiProduct[]
}

/**
 * API 返回的 Product 結構
 */
export interface ApiProduct {
  id: string
  name: string
  description: string | null
  status: string
  lifecycle: 'FINITE' | 'PERPETUAL'
  referenceCount: number
  tasks: TaskCard[]
}

/**
 * Product 建議
 */
export interface ProductSuggestion {
  taskId: string
  taskContent: string
  areaId: string
  areaName: string
  suggestedName: string
  reasoning: string
  alternatives: string[]
}

/**
 * 待合併任務
 */
export interface PendingMerge {
  sourceTask: TaskCard
  targetTask: TaskCard
}

/**
 * 編輯中的 Product
 */
export interface EditingProduct {
  id: string
  name: string
  description?: string | null
  lifecycle: 'FINITE' | 'PERPETUAL'
  status: string
}

/**
 * 編輯中的 Area
 */
export interface EditingArea {
  id: string
  name: string
  scope?: string | null
  description?: string | null
}

/**
 * 統計數據
 */
export interface DashboardStats {
  total: number
  active: number
  archived: number
  areas: number
  products: number
}

/**
 * Dashboard 核心資料狀態
 */
export interface DashboardDataState {
  // 用戶資料
  userId: string | null
  userName: string

  // 核心資料
  areas: ApiArea[]
  milestones: Milestone[]

  // 載入狀態
  isLoading: boolean
  error: string | null

  // 今日完成和已歸檔
  completedTodayTasks: TaskCard[]
  recentArchivedTasks: TaskCard[]
  isLoadingArchived: boolean
  archivedLoaded: boolean
}

/**
 * Dashboard UI 狀態
 */
export interface DashboardUIState {
  // 視圖
  viewMode: ViewMode
  selectedArea: string | null
  expandedAreas: Set<string>
  showArchive: boolean

  // 歡迎模式
  isWelcomeMode: boolean
  showQuickInputGuide: boolean
  showAIButtonTip: boolean
  showCompletedSheet: boolean
}

/**
 * Dashboard Modal 狀態
 */
export interface DashboardModalState {
  // Milestone Modal
  isMilestoneModalOpen: boolean
  editingMilestone: Milestone | null

  // Product Modal
  isProductModalOpen: boolean
  isProductDetailModalOpen: boolean
  productDetailInitialTab: 'edit' | 'references'
  selectedAreaForProduct: { id: string; name: string } | null
  editingProduct: EditingProduct | null

  // Area Modal
  isAreaModalOpen: boolean
  editingArea: EditingArea | null

  // Due Date Modal
  isDueDateModalOpen: boolean
  editingTaskForDueDate: TaskCard | null
  dateModalType: 'due' | 'start'

  // Task Detail Modal
  isTaskDetailModalOpen: boolean
  selectedTask: TaskCard | null

  // Product Suggestion Modal
  showProductSuggestionModal: boolean
  productSuggestion: ProductSuggestion | null

  // Reorganize Modal
  isReorganizeModalOpen: boolean
  reorganizeProposal: ReorganizeProposal | null

  // Merge Confirm Modal
  showMergeConfirmModal: boolean
  pendingMerge: PendingMerge | null
}

/**
 * Dashboard 操作狀態
 */
export interface DashboardOperationState {
  // 拖放
  activeTask: TaskCard | null
  activeProduct: { id: string; name: string } | null
  overDropId: string | null

  // 重組
  isReorganizing: boolean
  isApplying: boolean
  reorganizingProductId: string | null
  isRestoring: boolean
  lastReorganizedProductId: string | null

  // 合併
  isMerging: boolean
}

/**
 * Dashboard Context 值（完整狀態和方法）
 */
export interface DashboardContextValue {
  // 狀態
  data: DashboardDataState
  ui: DashboardUIState
  modals: DashboardModalState
  operations: DashboardOperationState
  stats: DashboardStats

  // 資料操作
  refreshData: () => Promise<void>
  loadCompletedToday: () => Promise<void>
  loadRecentArchived: () => Promise<void>

  // UI 操作
  setViewMode: (mode: ViewMode) => void
  toggleArea: (areaName: string) => void
  setShowArchive: (show: boolean) => void
  setShowCompletedSheet: (show: boolean) => void
  setShowQuickInputGuide: (show: boolean) => void
  setShowAIButtonTip: (show: boolean) => void

  // Modal 操作
  openMilestoneModal: (milestone?: Milestone) => void
  closeMilestoneModal: () => void
  openProductModal: (areaId: string, areaName: string, product?: EditingProduct) => void
  closeProductModal: () => void
  openProductDetailModal: (product: EditingProduct, initialTab?: 'edit' | 'references') => void
  closeProductDetailModal: () => void
  openAreaModal: (area?: EditingArea) => void
  closeAreaModal: () => void
  openDueDateModal: (task: TaskCard, type?: 'due' | 'start') => void
  closeDueDateModal: () => void
  openTaskDetailModal: (task: TaskCard) => void
  closeTaskDetailModal: () => void
  openReorganizeModal: (productId: string) => void
  closeReorganizeModal: () => void
  openMergeConfirmModal: (sourceTask: TaskCard, targetTask: TaskCard) => void
  closeMergeConfirmModal: () => void

  // 任務操作
  handleTaskComplete: (taskId: string) => Promise<void>
  handleTaskEdit: (taskId: string, newTitle: string) => Promise<void>
  handleTaskStatusChange: (taskId: string, newStatus: DrawerStatus) => Promise<void>
  handleSubItemToggle: (taskId: string, subItemId: string, completed: boolean) => Promise<void>
  handleSubItemDelete: (taskId: string, subItemId: string) => Promise<void>
  handleSubItemEdit: (taskId: string, subItemId: string, content: string) => Promise<void>
  handleSubItemAdd: (taskId: string, content: string) => Promise<void>
  handleReferenceDelete: (taskId: string, referenceId: string) => Promise<void>
  handleTaskMerge: () => Promise<void>

  // Area/Product 操作
  handleAreaSave: (area: { name: string; scope?: string; description?: string }, id?: string) => Promise<void>
  handleAreaDelete: (areaId: string) => Promise<void>
  handleProductSave: (product: { name: string; description?: string; lifecycle: string }, areaId: string, id?: string) => Promise<void>
  handleProductDelete: (productId: string) => Promise<void>

  // Milestone 操作
  handleMilestoneSave: (milestone: Partial<Milestone>) => Promise<void>
  handleMilestoneDelete: (milestoneId: string) => Promise<void>

  // 重組操作
  handleReorganize: (productId: string) => Promise<void>
  handleApplyReorganization: () => Promise<void>
  handleRestoreRecentTasks: (productId: string) => Promise<void>
}
