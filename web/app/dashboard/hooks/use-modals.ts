/**
 * useModals Hook - Modal 狀態管理
 *
 * 集中管理所有 Modal 的開關狀態和相關數據
 */

'use client'

import { useState, useCallback } from 'react'
import type { Milestone, TaskCard, ReorganizeProposal } from '@/types'
import type {
  EditingProduct,
  EditingArea,
  ProductSuggestion,
  PendingMerge,
  DashboardModalState,
} from '../context/types'

/**
 * useModals Hook
 *
 * 管理 Dashboard 所有 Modal 的狀態
 */
export function useModals() {
  // Milestone Modal
  const [isMilestoneModalOpen, setIsMilestoneModalOpen] = useState(false)
  const [editingMilestone, setEditingMilestone] = useState<Milestone | null>(null)

  // Product Modal
  const [isProductModalOpen, setIsProductModalOpen] = useState(false)
  const [isProductDetailModalOpen, setIsProductDetailModalOpen] = useState(false)
  const [productDetailInitialTab, setProductDetailInitialTab] = useState<'edit' | 'references'>(
    'edit'
  )
  const [selectedAreaForProduct, setSelectedAreaForProduct] = useState<{
    id: string
    name: string
  } | null>(null)
  const [editingProduct, setEditingProduct] = useState<EditingProduct | null>(null)

  // Area Modal
  const [isAreaModalOpen, setIsAreaModalOpen] = useState(false)
  const [editingArea, setEditingArea] = useState<EditingArea | null>(null)

  // Due Date Modal
  const [isDueDateModalOpen, setIsDueDateModalOpen] = useState(false)
  const [editingTaskForDueDate, setEditingTaskForDueDate] = useState<TaskCard | null>(null)
  const [dateModalType, setDateModalType] = useState<'due' | 'start'>('due')

  // Task Detail Modal
  const [isTaskDetailModalOpen, setIsTaskDetailModalOpen] = useState(false)
  const [selectedTask, setSelectedTask] = useState<TaskCard | null>(null)

  // Product Suggestion Modal
  const [showProductSuggestionModal, setShowProductSuggestionModal] = useState(false)
  const [productSuggestion, setProductSuggestion] = useState<ProductSuggestion | null>(null)

  // Reorganize Modal
  const [isReorganizeModalOpen, setIsReorganizeModalOpen] = useState(false)
  const [reorganizeProposal, setReorganizeProposal] = useState<ReorganizeProposal | null>(null)

  // Merge Confirm Modal
  const [showMergeConfirmModal, setShowMergeConfirmModal] = useState(false)
  const [pendingMerge, setPendingMerge] = useState<PendingMerge | null>(null)

  // ========== Milestone Modal ==========
  const openMilestoneModal = useCallback((milestone?: Milestone) => {
    setEditingMilestone(milestone || null)
    setIsMilestoneModalOpen(true)
  }, [])

  const closeMilestoneModal = useCallback(() => {
    setIsMilestoneModalOpen(false)
    setEditingMilestone(null)
  }, [])

  // ========== Product Modal ==========
  const openProductModal = useCallback(
    (areaId: string, areaName: string, product?: EditingProduct) => {
      setSelectedAreaForProduct({ id: areaId, name: areaName })
      setEditingProduct(product || null)
      setIsProductModalOpen(true)
    },
    []
  )

  const closeProductModal = useCallback(() => {
    setIsProductModalOpen(false)
    setSelectedAreaForProduct(null)
    setEditingProduct(null)
  }, [])

  const openProductDetailModal = useCallback(
    (product: EditingProduct, initialTab: 'edit' | 'references' = 'edit') => {
      setEditingProduct(product)
      setProductDetailInitialTab(initialTab)
      setIsProductDetailModalOpen(true)
    },
    []
  )

  const closeProductDetailModal = useCallback(() => {
    setIsProductDetailModalOpen(false)
    setEditingProduct(null)
  }, [])

  // ========== Area Modal ==========
  const openAreaModal = useCallback((area?: EditingArea) => {
    setEditingArea(area || null)
    setIsAreaModalOpen(true)
  }, [])

  const closeAreaModal = useCallback(() => {
    setIsAreaModalOpen(false)
    setEditingArea(null)
  }, [])

  // ========== Due Date Modal ==========
  const openDueDateModal = useCallback((task: TaskCard, type: 'due' | 'start' = 'due') => {
    setEditingTaskForDueDate(task)
    setDateModalType(type)
    setIsDueDateModalOpen(true)
  }, [])

  const closeDueDateModal = useCallback(() => {
    setIsDueDateModalOpen(false)
    setEditingTaskForDueDate(null)
  }, [])

  // ========== Task Detail Modal ==========
  const openTaskDetailModal = useCallback((task: TaskCard) => {
    setSelectedTask(task)
    setIsTaskDetailModalOpen(true)
  }, [])

  const closeTaskDetailModal = useCallback(() => {
    setIsTaskDetailModalOpen(false)
    setSelectedTask(null)
  }, [])

  // ========== Product Suggestion Modal ==========
  const openProductSuggestionModal = useCallback((suggestion: ProductSuggestion) => {
    setProductSuggestion(suggestion)
    setShowProductSuggestionModal(true)
  }, [])

  const closeProductSuggestionModal = useCallback(() => {
    setShowProductSuggestionModal(false)
    setProductSuggestion(null)
  }, [])

  // ========== Reorganize Modal ==========
  const openReorganizeModal = useCallback((proposal: ReorganizeProposal) => {
    setReorganizeProposal(proposal)
    setIsReorganizeModalOpen(true)
  }, [])

  const closeReorganizeModal = useCallback(() => {
    setIsReorganizeModalOpen(false)
    setReorganizeProposal(null)
  }, [])

  // ========== Merge Confirm Modal ==========
  const openMergeConfirmModal = useCallback((sourceTask: TaskCard, targetTask: TaskCard) => {
    setPendingMerge({ sourceTask, targetTask })
    setShowMergeConfirmModal(true)
  }, [])

  const closeMergeConfirmModal = useCallback(() => {
    setShowMergeConfirmModal(false)
    setPendingMerge(null)
  }, [])

  // 組合 Modal 狀態
  const modalState: DashboardModalState = {
    isMilestoneModalOpen,
    editingMilestone,
    isProductModalOpen,
    isProductDetailModalOpen,
    productDetailInitialTab,
    selectedAreaForProduct,
    editingProduct,
    isAreaModalOpen,
    editingArea,
    isDueDateModalOpen,
    editingTaskForDueDate,
    dateModalType,
    isTaskDetailModalOpen,
    selectedTask,
    showProductSuggestionModal,
    productSuggestion,
    isReorganizeModalOpen,
    reorganizeProposal,
    showMergeConfirmModal,
    pendingMerge,
  }

  return {
    // 狀態
    ...modalState,

    // 內部狀態更新器（供其他操作使用）
    setReorganizeProposal,
    setEditingMilestone,

    // Milestone Modal
    openMilestoneModal,
    closeMilestoneModal,

    // Product Modal
    openProductModal,
    closeProductModal,
    openProductDetailModal,
    closeProductDetailModal,

    // Area Modal
    openAreaModal,
    closeAreaModal,

    // Due Date Modal
    openDueDateModal,
    closeDueDateModal,

    // Task Detail Modal
    openTaskDetailModal,
    closeTaskDetailModal,

    // Product Suggestion Modal
    openProductSuggestionModal,
    closeProductSuggestionModal,

    // Reorganize Modal
    openReorganizeModal,
    closeReorganizeModal,

    // Merge Confirm Modal
    openMergeConfirmModal,
    closeMergeConfirmModal,
  }
}

export type UseModalsReturn = ReturnType<typeof useModals>
