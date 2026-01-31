/**
 * useDashboardData Hook - Dashboard 資料管理
 *
 * 處理 Dashboard 核心資料的載入、更新和狀態管理
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { auth } from '@/lib/firebase'
import { API } from '@/lib/api-client'
import type { Milestone, TaskCard } from '@/types'
import type { ApiArea, DashboardDataState, DashboardStats } from '../context/types'

/**
 * useDashboardData Hook
 *
 * 管理 Dashboard 的核心資料狀態
 */
export function useDashboardData() {
  const router = useRouter()

  // 核心資料狀態
  const [userId, setUserId] = useState<string | null>(null)
  const [userName, setUserName] = useState<string>('User')
  const [areas, setAreas] = useState<ApiArea[]>([])
  const [milestones, setMilestones] = useState<Milestone[]>([])

  // 載入狀態
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 今日完成和已歸檔
  const [completedTodayTasks, setCompletedTodayTasks] = useState<TaskCard[]>([])
  const [recentArchivedTasks, setRecentArchivedTasks] = useState<TaskCard[]>([])
  const [isLoadingArchived, setIsLoadingArchived] = useState(false)
  const [archivedLoaded, setArchivedLoaded] = useState(false)

  /**
   * 載入今日完成的任務
   */
  const loadCompletedToday = useCallback(async () => {
    try {
      const tasks = await API.tasks.list({ completed_today: 'true' })
      setCompletedTodayTasks(tasks)
    } catch (err) {
      console.error('Failed to load completed today tasks:', err)
    }
  }, [])

  /**
   * 載入最近兩週的已歸檔任務
   */
  const loadRecentArchived = useCallback(async () => {
    if (archivedLoaded || isLoadingArchived) return
    setIsLoadingArchived(true)
    try {
      const twoWeeksAgo = new Date()
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)
      const fromDate = twoWeeksAgo.toISOString()
      const tasks = await API.tasks.list({ status: 'ARCHIVE', from: fromDate })
      setRecentArchivedTasks(tasks)
      setArchivedLoaded(true)
    } catch (err) {
      console.error('Failed to load archived tasks:', err)
    } finally {
      setIsLoadingArchived(false)
    }
  }, [archivedLoaded, isLoadingArchived])

  /**
   * 重新載入所有資料
   */
  const refreshData = useCallback(async () => {
    try {
      // 並行載入 library 和 milestones
      const [libraryData, milestonesData] = await Promise.all([
        API.library(),
        API.milestones.list(),
      ])

      setAreas(libraryData)
      setMilestones(milestonesData)

      // 重新載入今日完成
      loadCompletedToday()

      // 重置已歸檔狀態以便下次載入
      setArchivedLoaded(false)
    } catch (err) {
      console.error('Failed to refresh data:', err)
      setError(err instanceof Error ? err.message : '刷新資料失敗')
    }
  }, [loadCompletedToday])

  /**
   * 初始載入用戶資料
   */
  useEffect(() => {
    async function loadData() {
      setIsLoading(true)
      setError(null)

      try {
        const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
          if (!firebaseUser) {
            router.push('/')
            return
          }

          try {
            // 獲取用戶資料
            const userData = await API.users.me()

            setUserId(userData.id)
            setUserName(userData.displayName || userData.name || userData.email || 'User')

            // 獲取 Library
            const libraryData = await API.library()
            setAreas(libraryData)

            // 獲取 Milestones
            const milestonesData = await API.milestones.list()
            setMilestones(milestonesData)
          } catch (err) {
            setError(err instanceof Error ? err.message : '載入失敗')
          } finally {
            setIsLoading(false)
          }
        })

        return () => unsubscribe()
      } catch (err) {
        setError(err instanceof Error ? err.message : '載入失敗')
        setIsLoading(false)
      }
    }

    loadData()
  }, [router])

  // 初始載入今日完成任務
  useEffect(() => {
    if (userId) {
      loadCompletedToday()
    }
  }, [userId, loadCompletedToday])

  /**
   * 計算統計數據
   */
  const stats: DashboardStats = {
    total: (() => {
      const now = new Date()
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000)
      return areas.reduce(
        (sum, area) =>
          sum +
          area.products.reduce(
            (ps, p) =>
              ps +
              p.tasks.filter((t) => {
                if (t.drawer === 'ARCHIVE') return false
                if (!t.due_date) return false
                const dueDate = new Date(t.due_date)
                return dueDate >= todayStart && dueDate < todayEnd
              }).length,
            0
          ),
        0
      )
    })(),
    active: areas.reduce(
      (sum, area) =>
        sum +
        area.products.reduce(
          (ps, p) => ps + p.tasks.filter((t) => t.drawer === 'ACTIVE').length,
          0
        ),
      0
    ),
    archived: areas.reduce(
      (sum, area) =>
        sum +
        area.products.reduce(
          (ps, p) => ps + p.tasks.filter((t) => t.drawer === 'ARCHIVE').length,
          0
        ),
      0
    ),
    areas: areas.length,
    products: areas.reduce((sum, area) => sum + area.products.length, 0),
  }

  /**
   * 檢查是否有任務（用於歡迎模式判斷）
   */
  const hasTasks = areas.some((a) =>
    a.products.some((p) => p.tasks.filter((t) => t.drawer !== 'ARCHIVE').length > 0)
  )

  // 組合資料狀態
  const dataState: DashboardDataState = {
    userId,
    userName,
    areas,
    milestones,
    isLoading,
    error,
    completedTodayTasks,
    recentArchivedTasks,
    isLoadingArchived,
    archivedLoaded,
  }

  return {
    // 狀態
    ...dataState,
    stats,
    hasTasks,

    // 狀態更新器（供其他 hooks 使用）
    setAreas,
    setMilestones,
    setCompletedTodayTasks,
    setRecentArchivedTasks,

    // 方法
    refreshData,
    loadCompletedToday,
    loadRecentArchived,
  }
}

export type UseDashboardDataReturn = ReturnType<typeof useDashboardData>
