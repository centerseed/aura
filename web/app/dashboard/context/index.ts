/**
 * Dashboard Context Index - 統一匯出
 */

export {
  DashboardProvider,
  useDashboard,
  useDashboardDataContext,
  useDashboardTasks,
  useDashboardModals,
  useDashboardDnD,
  useDashboardUI,
} from './dashboard-context'

export type {
  ViewMode,
  ApiArea,
  ApiProduct,
  ProductSuggestion,
  PendingMerge,
  EditingProduct,
  EditingArea,
  DashboardStats,
  DashboardDataState,
  DashboardUIState,
  DashboardModalState,
  DashboardOperationState,
  DashboardContextValue,
} from './types'
