/**
 * DashboardModals - Dashboard 所有 Modal 集合
 *
 * 包含 MilestoneModal, ProductModal, AreaModal 等
 */

'use client'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  X,
  CheckCircle2,
  Loader2,
  Sparkles,
  Target,
  ChevronDown,
} from 'lucide-react'
import type { TaskCard, Milestone, ReorganizeProposal } from '@/types'
import type { ApiArea, ProductSuggestion, PendingMerge, EditingProduct, EditingArea } from '../context/types'
import { MilestoneModal } from '@/components/milestone-modal'
import { ProductModal } from '@/components/product-modal'
import { ProductDetailModal } from '@/components/product-detail-modal'
import { AreaModal } from '@/components/area-modal'
import { TaskDueDateModal } from '@/components/task-due-date-modal'
import { ReorganizeModal } from '@/components/reorganize-modal'
import { TaskDetailModal } from '@/components/task-detail-modal'

export interface DashboardModalsProps {
  userId: string | null
  areas: ApiArea[]
  // Milestone Modal
  isMilestoneModalOpen: boolean
  editingMilestone: Milestone | null
  onCloseMilestoneModal: () => void
  onMilestoneSuccess: () => void
  // Product Modal
  isProductModalOpen: boolean
  selectedAreaForProduct: { id: string; name: string } | null
  editingProduct: EditingProduct | null
  onCloseProductModal: () => void
  onProductSuccess: () => void
  // Product Detail Modal
  isProductDetailModalOpen: boolean
  productDetailInitialTab: 'edit' | 'references'
  onCloseProductDetailModal: () => void
  onProductDetailSuccess: () => void
  // Area Modal
  isAreaModalOpen: boolean
  editingArea: EditingArea | null
  onCloseAreaModal: () => void
  onAreaSuccess: () => void
  // Task Due Date Modal
  isDueDateModalOpen: boolean
  editingTaskForDueDate: TaskCard | null
  dateModalType: 'due' | 'start'
  onCloseDueDateModal: () => void
  onDueDateSuccess: () => void
  // Reorganize Modal
  isReorganizeModalOpen: boolean
  reorganizeProposal: ReorganizeProposal | null
  isApplying: boolean
  onCloseReorganizeModal: () => void
  onApplyReorganization: () => void
  // Task Detail Modal
  isTaskDetailModalOpen: boolean
  selectedTask: TaskCard | null
  onCloseTaskDetailModal: () => void
  onEditTitle: (taskId: string, title: string) => void
  onEditNarrative: (taskId: string, narrative: string) => void
  onSetDueDate: (taskId: string) => void
  onSetStartDate: (taskId: string) => void
  onToggleSubItem: (taskId: string, subItemId: string, completed: boolean) => void
  onAddSubItem: (taskId: string, content: string) => void
  onDeleteSubItem: (taskId: string, subItemId: string) => void
  onEditSubItem: (taskId: string, subItemId: string, updates: string | { content?: string; start_date?: string | null; due_date?: string | null }) => void
  onReorderSubItems: (taskId: string, subItemIds: string[]) => Promise<void>
  onAddReference: (taskId: string, type: 'url' | 'note', content: string, title?: string) => Promise<void>
  onDeleteReference: (taskId: string, referenceId: string) => void
  onComplete: (taskId: string) => void
  onDelete: (taskId: string) => void
  onStatusChange: (taskId: string, newStatus: import('@/types').DrawerStatus) => void
  // Product Suggestion Modal
  showProductSuggestionModal: boolean
  productSuggestion: ProductSuggestion | null
  onCloseProductSuggestionModal: () => void
  onConfirmProductSuggestion: (name: string) => void
  // Merge Confirm Modal
  showMergeConfirmModal: boolean
  pendingMerge: PendingMerge | null
  isMerging: boolean
  onCancelMerge: () => void
  onConfirmMerge: () => void
  // Completion Feedback
  completionFeedback: string | null
  // Completed Today Sheet
  showCompletedSheet: boolean
  completedTodayTasks: TaskCard[]
  onCloseCompletedSheet: () => void
}

export function DashboardModals({
  userId,
  areas,
  // Milestone Modal
  isMilestoneModalOpen,
  editingMilestone,
  onCloseMilestoneModal,
  onMilestoneSuccess,
  // Product Modal
  isProductModalOpen,
  selectedAreaForProduct,
  editingProduct,
  onCloseProductModal,
  onProductSuccess,
  // Product Detail Modal
  isProductDetailModalOpen,
  productDetailInitialTab,
  onCloseProductDetailModal,
  onProductDetailSuccess,
  // Area Modal
  isAreaModalOpen,
  editingArea,
  onCloseAreaModal,
  onAreaSuccess,
  // Task Due Date Modal
  isDueDateModalOpen,
  editingTaskForDueDate,
  dateModalType,
  onCloseDueDateModal,
  onDueDateSuccess,
  // Reorganize Modal
  isReorganizeModalOpen,
  reorganizeProposal,
  isApplying,
  onCloseReorganizeModal,
  onApplyReorganization,
  // Task Detail Modal
  isTaskDetailModalOpen,
  selectedTask,
  onCloseTaskDetailModal,
  onEditTitle,
  onEditNarrative,
  onSetDueDate,
  onSetStartDate,
  onToggleSubItem,
  onAddSubItem,
  onDeleteSubItem,
  onEditSubItem,
  onReorderSubItems,
  onAddReference,
  onDeleteReference,
  onComplete,
  onDelete,
  onStatusChange,
  // Product Suggestion Modal
  showProductSuggestionModal,
  productSuggestion,
  onCloseProductSuggestionModal,
  onConfirmProductSuggestion,
  // Merge Confirm Modal
  showMergeConfirmModal,
  pendingMerge,
  isMerging,
  onCancelMerge,
  onConfirmMerge,
  // Completion Feedback
  completionFeedback,
  // Completed Today Sheet
  showCompletedSheet,
  completedTodayTasks,
  onCloseCompletedSheet,
}: DashboardModalsProps) {
  return (
    <>
      {/* Milestone Modal */}
      <MilestoneModal
        isOpen={isMilestoneModalOpen}
        onClose={onCloseMilestoneModal}
        onSuccess={onMilestoneSuccess}
        userId={userId || ''}
        areas={areas}
        editingMilestone={editingMilestone}
      />

      {/* Product Modal */}
      <ProductModal
        isOpen={isProductModalOpen}
        onClose={onCloseProductModal}
        onSuccess={onProductSuccess}
        userId={userId || ''}
        areaId={selectedAreaForProduct?.id}
        areaName={selectedAreaForProduct?.name}
        editingProduct={editingProduct}
      />

      {/* Product Detail Modal */}
      <ProductDetailModal
        isOpen={isProductDetailModalOpen}
        onClose={onCloseProductDetailModal}
        onSuccess={onProductDetailSuccess}
        userId={userId || ''}
        product={editingProduct}
        initialTab={productDetailInitialTab}
      />

      {/* Area Modal */}
      <AreaModal
        isOpen={isAreaModalOpen}
        onClose={onCloseAreaModal}
        onSuccess={onAreaSuccess}
        userId={userId || ''}
        editingArea={editingArea}
      />

      {/* Task Due Date Modal */}
      {editingTaskForDueDate && (
        <TaskDueDateModal
          isOpen={isDueDateModalOpen}
          onClose={onCloseDueDateModal}
          onSuccess={onDueDateSuccess}
          taskId={editingTaskForDueDate.id}
          taskTitle={editingTaskForDueDate.title}
          dateType={dateModalType}
          currentDueDate={editingTaskForDueDate.due_date}
          currentStartDate={editingTaskForDueDate.start_date}
        />
      )}

      {/* Reorganize Modal */}
      <ReorganizeModal
        isOpen={isReorganizeModalOpen}
        onClose={onCloseReorganizeModal}
        onApply={onApplyReorganization}
        proposal={reorganizeProposal}
        isApplying={isApplying}
      />

      {/* Task Detail Modal */}
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          isOpen={isTaskDetailModalOpen}
          onClose={onCloseTaskDetailModal}
          onEditTitle={onEditTitle}
          onEditNarrative={onEditNarrative}
          onSetDueDate={onSetDueDate}
          onSetStartDate={onSetStartDate}
          onToggleSubItem={onToggleSubItem}
          onAddSubItem={onAddSubItem}
          onDeleteSubItem={onDeleteSubItem}
          onEditSubItem={onEditSubItem}
          onReorderSubItems={onReorderSubItems}
          onAddReference={onAddReference}
          onDeleteReference={onDeleteReference}
          onComplete={onComplete}
          onDelete={onDelete}
          onStatusChange={onStatusChange}
        />
      )}

      {/* Product Suggestion Modal */}
      {showProductSuggestionModal && productSuggestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onCloseProductSuggestionModal}
          />

          {/* Modal */}
          <Card className="relative w-full max-w-lg mx-4 bg-slate-900 border-white/10 shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-gradient-to-r from-teal-900/30 to-cyan-900/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">AI 推薦專案名稱</h2>
                  <p className="text-sm text-white/50">
                    為「{productSuggestion.taskContent}」建立專案
                  </p>
                </div>
              </div>
              <button
                onClick={onCloseProductSuggestionModal}
                className="text-white/50 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="px-6 py-5 space-y-4">
              {/* AI 分析 */}
              <div>
                <p className="text-xs text-white/50 mb-2 font-medium uppercase tracking-wider">AI 分析</p>
                <div className="p-3 rounded-lg bg-teal-500/10 border border-teal-500/20">
                  <p className="text-sm text-white/90">{productSuggestion.reasoning}</p>
                </div>
              </div>

              {/* 推薦名稱 */}
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">
                  推薦的專案名稱
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 px-4 py-3 rounded-lg bg-white/5 border-2 border-teal-500/50 text-white font-medium">
                    {productSuggestion.suggestedName}
                  </div>
                  <Button
                    onClick={() => onConfirmProductSuggestion(productSuggestion.suggestedName)}
                    className="bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 text-white"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    使用此名稱
                  </Button>
                </div>
              </div>

              {/* 其他選項 */}
              {productSuggestion.alternatives && productSuggestion.alternatives.length > 0 && (
                <div>
                  <p className="text-xs text-white/50 mb-2 font-medium uppercase tracking-wider">其他建議</p>
                  <div className="grid grid-cols-2 gap-2">
                    {productSuggestion.alternatives.map((alt, idx) => (
                      <button
                        key={idx}
                        onClick={() => onConfirmProductSuggestion(alt)}
                        className="px-3 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 hover:border-teal-500/50 text-white text-sm transition-all"
                      >
                        {alt}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 自訂名稱 */}
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">
                  或自訂名稱
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    id="custom-product-name"
                    placeholder="輸入專案名稱..."
                    className="flex-1 px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                  />
                  <Button
                    onClick={() => {
                      const input = document.getElementById('custom-product-name') as HTMLInputElement
                      if (input && input.value.trim()) {
                        onConfirmProductSuggestion(input.value.trim())
                      }
                    }}
                    variant="outline"
                    className="border-white/20 bg-white/5 hover:bg-white/10 text-white"
                  >
                    確認
                  </Button>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-white/10 bg-white/5 flex items-center justify-between">
              <p className="text-xs text-white/40">
                目標：{productSuggestion.areaName}
              </p>
              <Button
                onClick={onCloseProductSuggestionModal}
                variant="outline"
                className="border-white/10 bg-white/5 hover:bg-white/10 text-white"
              >
                取消
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Task Merge Confirm Modal */}
      {showMergeConfirmModal && pendingMerge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onCancelMerge}
          />

          {/* Modal */}
          <Card className="relative w-full max-w-lg mx-4 bg-slate-900 border-white/10 shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-gradient-to-r from-blue-900/30 to-blue-900/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cta flex items-center justify-center">
                  <Target className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">合併為待辦事項</h2>
                  <p className="text-sm text-white/50">
                    將任務合併到另一個任務的 todo list 中
                  </p>
                </div>
              </div>
              <button
                onClick={onCancelMerge}
                className="text-white/50 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="px-6 py-5 space-y-4">
              {/* 來源任務 */}
              <div>
                <p className="text-xs text-white/50 mb-2 font-medium uppercase tracking-wider">要移動的任務</p>
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                  <p className="text-sm text-white font-medium">{pendingMerge.sourceTask.title}</p>
                  <p className="text-xs text-white/50 mt-1">
                    {pendingMerge.sourceTask.tag.area} → {pendingMerge.sourceTask.tag.product}
                  </p>
                </div>
              </div>

              {/* 箭頭 */}
              <div className="flex justify-center">
                <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                  <ChevronDown className="w-5 h-5 text-blue-400" />
                </div>
              </div>

              {/* 目標任務 */}
              <div>
                <p className="text-xs text-white/50 mb-2 font-medium uppercase tracking-wider">合併到</p>
                <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                  <p className="text-sm text-white font-medium">{pendingMerge.targetTask.title}</p>
                  <p className="text-xs text-white/50 mt-1">
                    {pendingMerge.targetTask.tag.area} → {pendingMerge.targetTask.tag.product}
                  </p>
                  {pendingMerge.targetTask.sub_items && pendingMerge.targetTask.sub_items.length > 0 && (
                    <p className="text-xs text-blue-400 mt-2">
                      目前有 {pendingMerge.targetTask.sub_items.length} 個待辦事項
                    </p>
                  )}
                </div>
              </div>

              {/* 說明 */}
              <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                <p className="text-xs text-white/60">
                  合併後，「{pendingMerge.sourceTask.title}」將成為「{pendingMerge.targetTask.title}」的一個待辦事項，原任務將被刪除。
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-white/10 bg-white/5 flex items-center justify-end gap-3">
              <Button
                onClick={onCancelMerge}
                variant="outline"
                className="border-white/10 bg-white/5 hover:bg-white/10 text-white"
              >
                取消
              </Button>
              <Button
                onClick={onConfirmMerge}
                disabled={isMerging}
                variant="cta"
              >
                {isMerging ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    合併中...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    確認合併
                  </>
                )}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* 完成回饋 Toast */}
      {completionFeedback && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-green-500/90 text-white shadow-lg backdrop-blur-sm">
            <CheckCircle2 className="w-5 h-5" />
            <span className="font-medium">{completionFeedback}</span>
          </div>
        </div>
      )}

      {/* 今日完成清單 Sheet */}
      {showCompletedSheet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onCloseCompletedSheet}
          />
          {/* Sheet */}
          <div className="relative w-full max-w-md mx-4 bg-slate-800 rounded-xl border border-white/10 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-400" />
                <h3 className="text-lg font-semibold text-white">今日完成</h3>
                <span className="px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 text-xs font-semibold">
                  {completedTodayTasks.length}
                </span>
              </div>
              <button
                onClick={onCloseCompletedSheet}
                className="p-1 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {/* Content */}
            <div className="max-h-[60vh] overflow-y-auto">
              {completedTodayTasks.length === 0 ? (
                <div className="py-12 text-center text-white/50">
                  <p>今天還沒有完成任何任務</p>
                </div>
              ) : (
                <ul className="divide-y divide-white/5">
                  {completedTodayTasks.map((task) => (
                    <li key={task.id} className="px-5 py-3 hover:bg-white/5 transition-colors">
                      <div className="flex items-start gap-3">
                        <CheckCircle2 className="w-4 h-4 mt-0.5 text-green-400 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-white/70 line-through">
                            {task.title}
                          </p>
                          {task.tag && (
                            <p className="text-xs text-white/40 mt-0.5">
                              {task.tag.area} &gt; {task.tag.product}
                            </p>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {/* Footer */}
            <div className="px-5 py-3 border-t border-white/10 bg-white/5">
              <p className="text-xs text-white/40 text-center">
                每日成就會在午夜重置
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
