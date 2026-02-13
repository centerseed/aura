/**
 * DraggableTaskItem - 可拖曳的任務卡片
 *
 * 支援拖曳和 Task-to-Task 合併
 */

'use client'

import { useState, useRef } from 'react'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import {
  Tag,
  AlertCircle,
  Calendar,
  CheckCircle2,
  ExternalLink,
  FileText,
  Trash2,
  Plus,
  X,
  GripVertical,
  Package,
  ArrowUpCircle,
} from 'lucide-react'
import type { TaskCard } from '@/types'
import { DRAWER_CONFIG } from '@/domain/constants/drawer-config'

// 計算相對時間描述
function getRelativeTimeDesc(dueDate: Date): { text: string; isOverdue: boolean; isUrgent: boolean } {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const due = new Date(dueDate)
  due.setHours(0, 0, 0, 0)

  const diffMs = due.getTime() - now.getTime()
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays < 0) return { text: `逾期 ${Math.abs(diffDays)} 天`, isOverdue: true, isUrgent: true }
  if (diffDays === 0) return { text: '今天', isOverdue: false, isUrgent: true }
  if (diffDays === 1) return { text: '明天', isOverdue: false, isUrgent: true }
  if (diffDays <= 3) return { text: `${diffDays} 天後`, isOverdue: false, isUrgent: true }
  if (diffDays <= 7) return { text: `${diffDays} 天後`, isOverdue: false, isUrgent: false }
  if (diffDays <= 14) return { text: '下週', isOverdue: false, isUrgent: false }
  if (diffDays <= 30) return { text: `${Math.floor(diffDays / 7)} 週後`, isOverdue: false, isUrgent: false }
  return { text: `${Math.floor(diffDays / 30)} 個月後`, isOverdue: false, isUrgent: false }
}

export interface DraggableTaskItemProps {
  task: TaskCard
  onSetDueDate?: (task: TaskCard) => void
  onComplete?: (taskId: string) => void
  onToggleSubItem?: (taskId: string, subItemId: string, completed: boolean) => void
  onDeleteSubItem?: (taskId: string, subItemId: string) => void
  onPromoteSubItem?: (taskId: string, subItemId: string) => void
  onEditTitle?: (taskId: string, newTitle: string) => void
  onEditSubItem?: (taskId: string, subItemId: string, newContent: string) => void
  onAddSubItem?: (taskId: string, content: string) => void
  onDeleteReference?: (taskId: string, referenceId: string) => void
  onOpenDetail?: () => void
  onOpenSubItemDetail?: (subItemId: string) => void
  isDropTarget?: boolean
  defaultExpandAllSubItems?: boolean
}

export function DraggableTaskItem({
  task,
  onSetDueDate,
  onComplete,
  onToggleSubItem,
  onDeleteSubItem,
  onPromoteSubItem,
  onEditTitle,
  onEditSubItem,
  onAddSubItem,
  onDeleteReference,
  onOpenDetail,
  onOpenSubItemDetail,
  defaultExpandAllSubItems = false,
}: DraggableTaskItemProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(task.title)
  const [showAllSubItems, setShowAllSubItems] = useState(defaultExpandAllSubItems)
  const [editingSubItemId, setEditingSubItemId] = useState<string | null>(null)
  const [editSubItemContent, setEditSubItemContent] = useState('')
  const [isAddingSubItem, setIsAddingSubItem] = useState(false)
  const [newSubItemContent, setNewSubItemContent] = useState('')
  const isSubmittingRef = useRef(false)

  const { attributes, listeners, setNodeRef: setDragRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: { task },
  })

  // 只在標題區域作為放置目標（接收其他 Task 合併為 sub-item）
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `task-drop-${task.id}`,
    data: { type: 'task', targetTaskId: task.id, targetTask: task },
  })

  const drawerConfig = DRAWER_CONFIG[task.drawer] || DRAWER_CONFIG.INBOX
  const isCompleted = task.drawer === 'ARCHIVE'

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined

  const dueInfo = task.due_date ? getRelativeTimeDesc(new Date(task.due_date)) : null

  return (
    <div
      ref={setDragRef}
      style={style}
      {...(isEditing || isCompleted ? {} : listeners)}
      {...(isEditing || isCompleted ? {} : attributes)}
      onClick={(e) => {
        // 已完成的卡片點擊整個區域可以取消標記
        if (isCompleted && !isEditing) {
          e.stopPropagation()
          onComplete?.(task.id)
        }
      }}
      className={`
        group relative rounded-lg border p-3
        ${isEditing ? 'cursor-default' : isCompleted ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'}
        transition-all duration-150
        ${isCompleted
          ? 'bg-green-500/20 border-green-500/30 hover:bg-green-500/30 hover:border-green-500/40'
          : 'bg-white/10 border-white/10 hover:bg-white/15 hover:border-white/20'
        }
        ${isDragging ? 'opacity-50 scale-105' : ''}
      `}
    >
      <div className="flex items-start gap-3">
        <div
          className={`mt-1.5 w-2 h-2 rounded-full ${drawerConfig.dotColor} shrink-0`}
          title={drawerConfig.label}
        />

        <div className="flex-1 min-w-0">
          {isEditing ? (
            <form
              className="flex items-center gap-1"
              onSubmit={(e) => {
                e.preventDefault()
                e.stopPropagation()
                if (isSubmittingRef.current) return
                isSubmittingRef.current = true
                if (editTitle.trim() && editTitle !== task.title) {
                  onEditTitle?.(task.id, editTitle.trim())
                }
                setIsEditing(false)
                setTimeout(() => { isSubmittingRef.current = false }, 100)
              }}
            >
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                autoFocus
                className="flex-1 bg-white/10 border border-white/30 rounded px-2 py-1 text-white text-sm focus:outline-none focus:border-indigo-400"
                onKeyDown={(e) => {
                  e.stopPropagation()
                  if (e.key === 'Escape') {
                    setEditTitle(task.title)
                    setIsEditing(false)
                  }
                }}
                onBlur={() => {
                  setTimeout(() => {
                    if (!isSubmittingRef.current) {
                      setIsEditing(false)
                      setEditTitle(task.title)
                    }
                  }, 100)
                }}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              />
              <button
                type="submit"
                className="p-1 rounded hover:bg-green-500/20 text-green-400"
                onPointerDown={(e) => e.stopPropagation()}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setEditTitle(task.title)
                  setIsEditing(false)
                }}
                className="p-1 rounded hover:bg-red-500/20 text-red-400"
                onPointerDown={(e) => e.stopPropagation()}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </form>
          ) : (
            <h4
              ref={setDropRef}
              className={`
                font-medium text-white text-sm leading-snug cursor-pointer hover:text-indigo-300 transition-colors
                rounded px-2 py-1 -mx-2
                ${isOver ? 'bg-indigo-500/30 ring-2 ring-indigo-500' : ''}
              `}
              onClick={(e) => {
                e.stopPropagation()
                e.preventDefault()
                if (!isOver) {
                  onOpenDetail?.()
                }
              }}
              onPointerDown={(e) => e.stopPropagation()}
              title={isOver ? '放開以合併為待辦事項' : '點擊查看詳情'}
            >
              {task.title}
            </h4>
          )}

          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <div className="flex items-center gap-1">
              <Tag className="w-3 h-3 text-white/40" />
              <span className="text-xs text-white/50">
                {task.tag.topic}
              </span>
            </div>

            {/* Due Date Badge - Hidden when completed */}
            {!isCompleted && (
              <>
                {dueInfo ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      e.preventDefault()
                      onSetDueDate?.(task)
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs transition-colors
                      ${dueInfo.isOverdue
                        ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                        : dueInfo.isUrgent
                          ? 'bg-orange-500/20 text-orange-400 hover:bg-orange-500/30'
                          : 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'
                      }`}
                  >
                    {dueInfo.isOverdue && <AlertCircle className="w-3 h-3" />}
                    {!dueInfo.isOverdue && <Calendar className="w-3 h-3" />}
                    {dueInfo.text}
                  </button>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      e.preventDefault()
                      onSetDueDate?.(task)
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs text-white/40 hover:text-white/60 hover:bg-white/10 transition-colors"
                  >
                    <Calendar className="w-3 h-3" />
                    設定日期
                  </button>
                )}
              </>
            )}
          </div>

          {/* 進度指示 */}
          {!isCompleted && task.sub_items_meta && task.sub_items_meta.total > 0 && (
            <div className="flex items-center gap-2 mt-2">
              <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 transition-all"
                  style={{ width: `${(task.sub_items_meta.completion_rate || 0) * 100}%` }}
                />
              </div>
              <span className="text-xs text-white/50 font-medium">
                {task.sub_items_meta.completed}/{task.sub_items_meta.total}
              </span>
            </div>
          )}

          {/* Sub-items 簡化顯示 */}
          {!isCompleted && task.sub_items && task.sub_items.length > 0 && (
            <div className="mt-2 space-y-1">
              {(showAllSubItems || defaultExpandAllSubItems ? task.sub_items : task.sub_items.slice(0, 3)).map((subItem) => (
                <div
                  key={subItem.id}
                  className="group/subitem flex items-center gap-1.5 text-xs hover:bg-white/5 rounded px-1 py-0.5 -mx-1"
                >
                  {editingSubItemId === subItem.id ? (
                    <>
                      <div className="w-3 h-3 shrink-0" />
                      <form
                        className="flex-1 flex items-center gap-1"
                        onSubmit={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          if (editSubItemContent.trim() && editSubItemContent !== subItem.content) {
                            onEditSubItem?.(task.id, subItem.id, editSubItemContent.trim())
                          }
                          setEditingSubItemId(null)
                          setEditSubItemContent('')
                        }}
                      >
                        <input
                          type="text"
                          value={editSubItemContent}
                          onChange={(e) => setEditSubItemContent(e.target.value)}
                          autoFocus
                          className="flex-1 bg-white/10 border border-white/30 rounded px-1.5 py-0.5 text-white text-xs focus:outline-none focus:border-indigo-400"
                          onKeyDown={(e) => {
                            e.stopPropagation()
                            if (e.key === 'Escape') {
                              setEditingSubItemId(null)
                              setEditSubItemContent('')
                            }
                          }}
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <button
                          type="submit"
                          className="p-0.5 rounded hover:bg-green-500/20 text-green-400"
                          onPointerDown={(e) => e.stopPropagation()}
                        >
                          <CheckCircle2 className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setEditingSubItemId(null)
                            setEditSubItemContent('')
                          }}
                          className="p-0.5 rounded hover:bg-red-500/20 text-red-400"
                          onPointerDown={(e) => e.stopPropagation()}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </form>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="flex items-center gap-1.5 flex-1 min-w-0"
                        onClick={(e) => {
                          e.stopPropagation()
                          e.preventDefault()
                          onToggleSubItem?.(task.id, subItem.id, !subItem.completed)
                        }}
                        onPointerDown={(e) => e.stopPropagation()}
                      >
                        {subItem.completed ? (
                          <CheckCircle2 className="w-3 h-3 text-green-400 shrink-0" />
                        ) : (
                          <div className="w-3 h-3 rounded-full border border-white/30 shrink-0 hover:border-white/50" />
                        )}
                        <span
                          className={`text-white/60 truncate text-left cursor-pointer ${subItem.completed ? 'line-through text-white/40' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation()
                            e.preventDefault()
                            onOpenSubItemDetail?.(subItem.id) || onOpenDetail?.()
                          }}
                          title="點擊編輯"
                        >
                          {subItem.content}
                        </span>
                        {subItem.due_date && (() => {
                          const info = getRelativeTimeDesc(new Date(subItem.due_date!))
                          return (
                            <span
                              className={`inline-flex items-center gap-0.5 px-1 py-0 rounded text-[10px] shrink-0
                                ${info.isOverdue
                                  ? 'bg-red-500/20 text-red-400'
                                  : info.isUrgent
                                    ? 'bg-orange-500/20 text-orange-400'
                                    : 'bg-blue-500/20 text-blue-400'
                                }`}
                            >
                              {info.isOverdue ? <AlertCircle className="w-2.5 h-2.5" /> : <Calendar className="w-2.5 h-2.5" />}
                              {info.text}
                            </span>
                          )
                        })()}
                      </button>
                      {onPromoteSubItem && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            e.preventDefault()
                            onPromoteSubItem(task.id, subItem.id)
                          }}
                          onPointerDown={(e) => e.stopPropagation()}
                          className="opacity-0 group-hover/subitem:opacity-100 p-0.5 rounded hover:bg-blue-500/20 text-white/30 hover:text-blue-400 transition-all shrink-0"
                          title="轉成獨立任務"
                        >
                          <ArrowUpCircle className="w-3 h-3" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          e.preventDefault()
                          onDeleteSubItem?.(task.id, subItem.id)
                        }}
                        onPointerDown={(e) => e.stopPropagation()}
                        className="opacity-0 group-hover/subitem:opacity-100 p-0.5 rounded hover:bg-red-500/20 text-white/30 hover:text-red-400 transition-all shrink-0"
                        title="刪除此項"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </>
                  )}
                </div>
              ))}
              {task.sub_items.length > 3 && !showAllSubItems && !defaultExpandAllSubItems && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    e.preventDefault()
                    setShowAllSubItems(true)
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  className="w-full text-xs text-white/50 hover:text-white/70 hover:bg-white/10 rounded px-2 py-1.5 mt-1 transition-colors"
                >
                  +{task.sub_items.length - 3} 更多
                </button>
              )}
              {task.sub_items.length > 3 && showAllSubItems && !defaultExpandAllSubItems && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    e.preventDefault()
                    setShowAllSubItems(false)
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  className="w-full text-xs text-white/50 hover:text-white/70 hover:bg-white/10 rounded px-2 py-1.5 mt-1 transition-colors"
                >
                  收起
                </button>
              )}

              {/* 新增 sub-item */}
              {isAddingSubItem ? (
                <form
                  className="flex items-center gap-1 px-1 py-0.5"
                  onSubmit={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    if (newSubItemContent.trim()) {
                      onAddSubItem?.(task.id, newSubItemContent.trim())
                      setNewSubItemContent('')
                      setIsAddingSubItem(false)
                    }
                  }}
                >
                  <div className="w-3 h-3 shrink-0" />
                  <input
                    type="text"
                    value={newSubItemContent}
                    onChange={(e) => setNewSubItemContent(e.target.value)}
                    placeholder="新增待辦事項..."
                    autoFocus
                    className="flex-1 bg-white/10 border border-white/30 rounded px-1.5 py-0.5 text-white text-xs placeholder:text-white/30 focus:outline-none focus:border-indigo-400"
                    onKeyDown={(e) => {
                      e.stopPropagation()
                      if (e.key === 'Escape') {
                        setIsAddingSubItem(false)
                        setNewSubItemContent('')
                      }
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <button
                    type="submit"
                    className="p-0.5 rounded hover:bg-green-500/20 text-green-400"
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    <CheckCircle2 className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setIsAddingSubItem(false)
                      setNewSubItemContent('')
                    }}
                    className="p-0.5 rounded hover:bg-red-500/20 text-red-400"
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    e.preventDefault()
                    setIsAddingSubItem(true)
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  className="w-full text-xs text-white/40 hover:text-white/60 hover:bg-white/10 rounded px-2 py-1.5 mt-1 transition-colors flex items-center justify-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  新增待辦事項
                </button>
              )}
            </div>
          )}

          {/* References 區塊 */}
          {!isCompleted && task.references && task.references.length > 0 && (
            <div className="mt-2">
              <div className="flex items-center gap-1.5 text-xs text-white/40 mb-1">
                <span>參考資料</span>
                {task.references.some((ref) => ref && ref.type === 'note') && (
                  <FileText className="w-3 h-3" />
                )}
              </div>
              <div className="space-y-1">
                {task.references.filter((ref) => ref && ref.type === 'url').map((ref) => (
                  <div
                    key={ref.id}
                    className="group/ref flex items-start gap-1.5 text-xs hover:bg-white/5 rounded px-1 py-0.5 -mx-1"
                  >
                    <ExternalLink className="w-3 h-3 text-blue-400 shrink-0 mt-0.5" />
                    <a
                      href={ref.content}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 text-blue-400 hover:underline break-all"
                      onClick={(e) => e.stopPropagation()}
                      onPointerDown={(e) => e.stopPropagation()}
                    >
                      {ref.title || ref.content}
                    </a>
                    {onDeleteReference && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          e.preventDefault()
                          onDeleteReference(task.id, ref.id)
                        }}
                        onPointerDown={(e) => e.stopPropagation()}
                        className="opacity-0 group-hover/ref:opacity-100 p-0.5 rounded hover:bg-red-500/20 text-white/30 hover:text-red-400 transition-all shrink-0"
                        title="刪除"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Completed Badge or Complete Button */}
        {isCompleted ? (
          <button
            onClick={(e) => {
              e.stopPropagation()
              e.preventDefault()
              onComplete?.(task.id)
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className="flex items-center justify-center w-6 h-6 rounded-full bg-green-500/30 hover:bg-green-500/50 transition-all cursor-pointer"
            title="點擊取消標記為已完成"
          >
            <CheckCircle2 className="w-4 h-4 text-green-400" />
          </button>
        ) : onComplete ? (
          <button
            onClick={(e) => {
              e.stopPropagation()
              e.preventDefault()
              onComplete(task.id)
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className="opacity-0 group-hover:opacity-100 p-1 rounded-md hover:bg-green-500/20 text-green-400 transition-all shrink-0"
            title="標記為已完成"
          >
            <CheckCircle2 className="w-4 h-4" />
          </button>
        ) : null}

        <GripVertical className="w-4 h-4 text-white/30 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
      </div>
    </div>
  )
}

/**
 * 拖曳預覽 - Task
 */
export function DragOverlayTask({ task }: { task: TaskCard }) {
  const drawerConfig = DRAWER_CONFIG[task.drawer] || DRAWER_CONFIG.INBOX

  return (
    <div className="bg-slate-800 rounded-lg border-2 border-indigo-500 p-3 shadow-xl shadow-indigo-500/25 rotate-3 scale-105">
      <div className="flex items-start gap-3">
        <div className={`mt-1.5 w-2 h-2 rounded-full ${drawerConfig.dotColor} shrink-0`} />
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-white text-sm">{task.title}</h4>
          <div className="flex items-center gap-1 mt-1.5">
            <Tag className="w-3 h-3 text-white/40" />
            <span className="text-xs text-white/50">{task.tag.topic}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * 拖曳預覽 - Product
 */
export function DragOverlayProduct({ productName }: { productName: string }) {
  return (
    <div className="bg-slate-800 rounded-xl border-2 border-indigo-500 p-4 shadow-xl shadow-indigo-500/25 rotate-3 scale-105 min-w-[200px]">
      <div className="flex items-center gap-2">
        <Package className="w-4 h-4 text-indigo-400" />
        <span className="font-medium text-white">{productName}</span>
      </div>
    </div>
  )
}

