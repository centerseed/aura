/**
 * DashboardContext - Dashboard 狀態上下文
 *
 * 提供 Dashboard 所有狀態和方法的集中管理
 */

'use client'

import { createContext, useContext, useState, useEffect, useMemo, type ReactNode } from 'react'
import {
  useDashboardData,
  useTaskOperations,
  useModals,
  useDragAndDrop,
} from '../hooks'
import type { ViewMode, DashboardUIState } from './types'

/**
 * Dashboard Context 值類型
 */
interface DashboardContextValue {
  // 資料 Hook
  data: ReturnType<typeof useDashboardData>

  // 任務操作 Hook
  tasks: ReturnType<typeof useTaskOperations>

  // Modal Hook
  modals: ReturnType<typeof useModals>

  // 拖放 Hook
  dnd: ReturnType<typeof useDragAndDrop>

  // UI 狀態
  ui: DashboardUIState & {
    setViewMode: (mode: ViewMode) => void
    toggleArea: (areaName: string) => void
    setShowArchive: (show: boolean) => void
    setShowCompletedSheet: (show: boolean) => void
    setShowQuickInputGuide: (show: boolean) => void
    setShowAIButtonTip: (show: boolean) => void
  }
}

const DashboardContext = createContext<DashboardContextValue | null>(null)

/**
 * Dashboard Provider Props
 */
interface DashboardProviderProps {
  children: ReactNode
}

/**
 * Dashboard Provider
 *
 * 提供 Dashboard 所有狀態和方法
 */
export function DashboardProvider({ children }: DashboardProviderProps) {
  // ========== 資料 Hook ==========
  const dataHook = useDashboardData()

  // ========== UI 狀態 ==========
  const [viewMode, setViewMode] = useState<ViewMode>('structure')
  const [selectedArea, setSelectedArea] = useState<string | null>(null)
  const [expandedAreas, setExpandedAreas] = useState<Set<string>>(new Set())
  const [showArchive, setShowArchive] = useState(false)
  const [isWelcomeMode, setIsWelcomeMode] = useState(false)
  const [showQuickInputGuide, setShowQuickInputGuide] = useState(false)
  const [showAIButtonTip, setShowAIButtonTip] = useState(false)
  const [showCompletedSheet, setShowCompletedSheet] = useState(false)

  // 初始展開所有 Areas
  useEffect(() => {
    if (Array.isArray(dataHook.areas) && dataHook.areas.length > 0 && expandedAreas.size === 0) {
      setExpandedAreas(new Set(dataHook.areas.map((a) => a.name)))
    }
  }, [dataHook.areas, expandedAreas.size])

  // 判斷歡迎模式
  useEffect(() => {
    if (!dataHook.isLoading && dataHook.userId) {
      setIsWelcomeMode(!dataHook.hasTasks)
    }
  }, [dataHook.isLoading, dataHook.userId, dataHook.hasTasks])

  const toggleArea = (areaName: string) => {
    setExpandedAreas((prev) => {
      const next = new Set(prev)
      if (next.has(areaName)) next.delete(areaName)
      else next.add(areaName)
      return next
    })
  }

  const uiState: DashboardUIState & {
    setViewMode: (mode: ViewMode) => void
    toggleArea: (areaName: string) => void
    setShowArchive: (show: boolean) => void
    setShowCompletedSheet: (show: boolean) => void
    setShowQuickInputGuide: (show: boolean) => void
    setShowAIButtonTip: (show: boolean) => void
  } = {
    viewMode,
    selectedArea,
    expandedAreas,
    showArchive,
    isWelcomeMode,
    showQuickInputGuide,
    showAIButtonTip,
    showCompletedSheet,
    setViewMode,
    toggleArea,
    setShowArchive,
    setShowCompletedSheet,
    setShowQuickInputGuide,
    setShowAIButtonTip,
  }

  // ========== Modal Hook ==========
  const modalsHook = useModals()

  // ========== 任務操作 Hook ==========
  const tasksHook = useTaskOperations({
    areas: dataHook.areas,
    setAreas: dataHook.setAreas,
    refreshData: dataHook.refreshData,
    loadCompletedToday: dataHook.loadCompletedToday,
  })

  // ========== 拖放 Hook ==========
  const dndHook = useDragAndDrop({
    areas: dataHook.areas,
    setAreas: dataHook.setAreas,
    refreshData: dataHook.refreshData,
    openMergeConfirmModal: modalsHook.openMergeConfirmModal,
  })

  // ========== Context Value ==========
  const value = useMemo<DashboardContextValue>(
    () => ({
      data: dataHook,
      tasks: tasksHook,
      modals: modalsHook,
      dnd: dndHook,
      ui: uiState,
    }),
    [dataHook, tasksHook, modalsHook, dndHook, uiState]
  )

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>
}

/**
 * useDashboard Hook
 *
 * 獲取 Dashboard Context
 */
export function useDashboard() {
  const context = useContext(DashboardContext)
  if (!context) {
    throw new Error('useDashboard must be used within a DashboardProvider')
  }
  return context
}

/**
 * 便捷 Hooks - 直接獲取特定部分
 */
export function useDashboardDataContext() {
  return useDashboard().data
}

export function useDashboardTasks() {
  return useDashboard().tasks
}

export function useDashboardModals() {
  return useDashboard().modals
}

export function useDashboardDnD() {
  return useDashboard().dnd
}

export function useDashboardUI() {
  return useDashboard().ui
}
