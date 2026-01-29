/**
 * DashboardContent - Dashboard 主要內容（簡化版）
 *
 * 使用新的 Context 和 Hooks 整合 Dashboard 基礎功能
 * 這是漸進式遷移的第一步，只處理基本的狀態和載入邏輯
 */

'use client'

import { useDashboard } from '../context'
import { DashboardLoading, DashboardError, DashboardWelcome } from './dashboard-states'

/**
 * DashboardContent - 使用 Context 的 Dashboard 內容
 *
 * 目前只處理載入、錯誤和歡迎狀態
 * 主要的結構視圖仍使用原始的 page.tsx 實現
 */
export function DashboardContent() {
  const { data, ui } = useDashboard()

  // 載入中
  if (data.isLoading && data.areas.length === 0) {
    return <DashboardLoading />
  }

  // 錯誤
  if (data.error) {
    return <DashboardError error={data.error} />
  }

  // 歡迎模式
  if (ui.isWelcomeMode && !data.isLoading) {
    return (
      <DashboardWelcome
        userName={data.userName}
        userId={data.userId}
        areas={data.areas}
        onItemsCreated={async () => {
          await data.refreshData()
        }}
      />
    )
  }

  // 主要內容（暫時返回 null，讓原始 page.tsx 處理）
  // 這允許漸進式遷移，不會破壞現有功能
  return null
}

/**
 * DashboardContentWrapper - 帶有 Context Provider 的 Dashboard 內容
 *
 * 用於測試 Context 是否正常工作
 */
export function DashboardContentWrapper({
  children,
}: {
  children?: React.ReactNode
}) {
  const { data } = useDashboard()

  // 如果 Context 正常工作，children 會被渲染
  // 否則會顯示錯誤
  if (!data.userId && !data.isLoading && data.areas.length === 0) {
    return <DashboardLoading />
  }

  return <>{children}</>
}
