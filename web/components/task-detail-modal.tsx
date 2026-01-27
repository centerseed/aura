"use client";

import { useState, useEffect } from "react";
import { X, Calendar, Plus, Circle, CheckCircle, Trash2, Edit2, ExternalLink, FileText, Loader2 } from "lucide-react";
import type { TaskCard, SubItem, Reference } from "@/types";

interface TaskDetailModalProps {
  task: TaskCard;
  isOpen: boolean;
  onClose: () => void;
  onEditTitle?: (taskId: string, newTitle: string) => void;
  onEditNarrative?: (taskId: string, newNarrative: string) => void;
  onSetDueDate?: (taskId: string) => void;
  onSetStartDate?: (taskId: string) => void;
  onToggleSubItem?: (taskId: string, subItemId: string, completed: boolean) => void;
  onAddSubItem?: (taskId: string, content: string) => void;
  onDeleteSubItem?: (taskId: string, subItemId: string) => void;
  onEditSubItem?: (taskId: string, subItemId: string, newContent: string) => void;
  onAddReference?: (taskId: string, type: "url" | "note", content: string, title?: string) => Promise<void>;
  onDeleteReference?: (taskId: string, referenceId: string) => void;
  onComplete?: (taskId: string) => void;
  onDelete?: (taskId: string) => void;
}

export function TaskDetailModal({
  task,
  isOpen,
  onClose,
  onEditTitle,
  onEditNarrative,
  onSetDueDate,
  onSetStartDate,
  onToggleSubItem,
  onAddSubItem,
  onDeleteSubItem,
  onEditSubItem,
  onAddReference,
  onDeleteReference,
  onComplete,
  onDelete,
}: TaskDetailModalProps) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [editingNarrative, setEditingNarrative] = useState(false);
  const [narrative, setNarrative] = useState(task.narrative || "");
  const [isAddingSubItem, setIsAddingSubItem] = useState(false);
  const [newSubItemContent, setNewSubItemContent] = useState("");
  const [editingSubItemId, setEditingSubItemId] = useState<string | null>(null);
  const [editSubItemContent, setEditSubItemContent] = useState("");
  const [isAddingReference, setIsAddingReference] = useState(false);
  const [isSubmittingReference, setIsSubmittingReference] = useState(false);
  const [newRefType, setNewRefType] = useState<"url" | "note">("url");
  const [newRefContent, setNewRefContent] = useState("");
  const [newRefTitle, setNewRefTitle] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // 同步 task prop 的變化
  useEffect(() => {
    setTitle(task.title);
    setNarrative(task.narrative || "");
  }, [task.title, task.narrative]);

  if (!isOpen) return null;

  const handleSaveTitle = () => {
    if (title.trim() && title !== task.title) {
      onEditTitle?.(task.id, title.trim());
    }
    setEditingTitle(false);
  };

  const handleSaveNarrative = () => {
    if (narrative.trim() !== (task.narrative || "")) {
      onEditNarrative?.(task.id, narrative.trim());
    }
    setEditingNarrative(false);
  };

  const handleAddSubItem = () => {
    if (newSubItemContent.trim()) {
      onAddSubItem?.(task.id, newSubItemContent.trim());
      setNewSubItemContent("");
      setIsAddingSubItem(false);
    }
  };

  const handleEditSubItem = (subItemId: string) => {
    if (editSubItemContent.trim()) {
      onEditSubItem?.(task.id, subItemId, editSubItemContent.trim());
      setEditingSubItemId(null);
      setEditSubItemContent("");
    }
  };

  const handleAddReference = async () => {
    if (!newRefContent.trim()) return;

    setIsSubmittingReference(true);
    try {
      await onAddReference?.(task.id, newRefType, newRefContent.trim(), newRefTitle.trim() || undefined);
      setNewRefContent("");
      setNewRefTitle("");
      setIsAddingReference(false);
    } catch (error) {
      console.error("Failed to add reference:", error);
    } finally {
      setIsSubmittingReference(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col border border-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-white/10">
          <div className="flex-1 mr-4">
            {editingTitle ? (
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={handleSaveTitle}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveTitle();
                  if (e.key === "Escape") {
                    setTitle(task.title);
                    setEditingTitle(false);
                  }
                }}
                autoFocus
                className="w-full text-2xl font-semibold bg-transparent border-b-2 border-indigo-400 text-white focus:outline-none"
              />
            ) : (
              <h2
                className="text-2xl font-semibold text-white cursor-pointer hover:text-indigo-300 transition-colors"
                onClick={() => setEditingTitle(true)}
              >
                {task.title}
              </h2>
            )}
            <div className="flex items-center gap-2 mt-2 text-sm text-white/60">
              <span>{task.tag.area}</span>
              <span>→</span>
              <span>{task.tag.product}</span>
              <span>→</span>
              <span>{task.tag.topic}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content - Left/Right Split */}
        <div className="flex-1 overflow-hidden flex">
          {/* Left Column - Main Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm font-medium text-white/80 mb-2">開始日期</h3>
                <button
                  onClick={() => onSetStartDate?.(task.id)}
                  className="w-full flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 hover:border-indigo-400/50 hover:bg-white/10 transition-colors"
                >
                  <Calendar className="w-4 h-4 text-white/60" />
                  <span className="text-sm text-white/80">
                    {task.start_date ? new Date(task.start_date).toLocaleDateString('zh-TW') : "設定日期"}
                  </span>
                </button>
              </div>
              <div>
                <h3 className="text-sm font-medium text-white/80 mb-2">截止日期</h3>
                <button
                  onClick={() => onSetDueDate?.(task.id)}
                  className="w-full flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 hover:border-indigo-400/50 hover:bg-white/10 transition-colors"
                >
                  <Calendar className="w-4 h-4 text-white/60" />
                  <span className="text-sm text-white/80">
                    {task.due_date ? new Date(task.due_date).toLocaleDateString('zh-TW') : "設定日期"}
                  </span>
                </button>
              </div>
            </div>

            {/* Narrative */}
            <div>
              <h3 className="text-sm font-medium text-white/80 mb-2">說明</h3>
              {editingNarrative ? (
                <textarea
                  value={narrative}
                  onChange={(e) => setNarrative(e.target.value)}
                  onBlur={handleSaveNarrative}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      setNarrative(task.narrative || "");
                      setEditingNarrative(false);
                    }
                  }}
                  autoFocus
                  rows={4}
                  className="w-full px-4 py-3 text-sm rounded-lg bg-white/5 border border-indigo-400/50 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-400/50 resize-none"
                  placeholder="輸入任務說明..."
                />
              ) : (
                <div
                  onClick={() => setEditingNarrative(true)}
                  className="px-4 py-3 text-sm text-white/70 leading-relaxed rounded-lg bg-white/5 border border-white/10 hover:border-indigo-400/50 hover:bg-white/10 cursor-pointer transition-colors min-h-[100px]"
                >
                  {task.narrative || <span className="text-white/40 italic">點擊新增說明...</span>}
                </div>
              )}
            </div>

            {/* Sub-items */}
            <div>
              <h3 className="text-sm font-medium text-white/80 mb-3">待辦事項</h3>
              <div className="space-y-2">
                {task.sub_items && task.sub_items.length > 0 ? (
                  task.sub_items.map((item) => (
                    <div key={item.id} className="group flex items-center gap-2">
                      {editingSubItemId === item.id ? (
                        <input
                          type="text"
                          value={editSubItemContent}
                          onChange={(e) => setEditSubItemContent(e.target.value)}
                          onBlur={() => handleEditSubItem(item.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleEditSubItem(item.id);
                            if (e.key === "Escape") {
                              setEditingSubItemId(null);
                              setEditSubItemContent("");
                            }
                          }}
                          autoFocus
                          className="flex-1 px-3 py-2 text-sm rounded-lg border border-indigo-400/50 bg-white/5 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-400/50"
                        />
                      ) : (
                        <>
                          <button
                            onClick={() => onToggleSubItem?.(task.id, item.id, !item.completed)}
                            className="flex items-center gap-3 flex-1 px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors text-left"
                          >
                            {item.completed ? (
                              <CheckCircle className="w-5 h-5 text-green-400 shrink-0" />
                            ) : (
                              <Circle className="w-5 h-5 text-white/30 shrink-0" />
                            )}
                            <span className={`text-sm ${item.completed ? "line-through text-white/40" : "text-white/80"}`}>
                              {item.content}
                            </span>
                          </button>
                          <button
                            onClick={() => {
                              setEditingSubItemId(item.id);
                              setEditSubItemContent(item.content);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-2 rounded hover:bg-white/10 text-white/60 hover:text-indigo-300 transition-all"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => onDeleteSubItem?.(task.id, item.id)}
                            className="opacity-0 group-hover:opacity-100 p-2 rounded hover:bg-red-500/20 text-white/60 hover:text-red-400 transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-white/40 italic px-3 py-2">尚無待辦事項</p>
                )}

                {/* Add Sub-item */}
                {isAddingSubItem ? (
                  <div className="flex items-center gap-2 pt-2">
                    <input
                      type="text"
                      value={newSubItemContent}
                      onChange={(e) => setNewSubItemContent(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleAddSubItem();
                        if (e.key === "Escape") {
                          setIsAddingSubItem(false);
                          setNewSubItemContent("");
                        }
                      }}
                      placeholder="輸入待辦事項..."
                      autoFocus
                      className="flex-1 px-3 py-2 text-sm rounded-lg bg-white/5 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:border-indigo-400/50 focus:ring-1 focus:ring-indigo-400/50"
                    />
                    <button
                      onClick={handleAddSubItem}
                      className="px-4 py-2 text-sm font-medium rounded-lg bg-indigo-500 text-white hover:bg-indigo-600 transition-colors"
                    >
                      新增
                    </button>
                    <button
                      onClick={() => {
                        setIsAddingSubItem(false);
                        setNewSubItemContent("");
                      }}
                      className="px-4 py-2 text-sm font-medium rounded-lg bg-white/10 text-white/80 hover:bg-white/20 transition-colors"
                    >
                      取消
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setIsAddingSubItem(true)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border-2 border-dashed border-white/20 text-white/60 hover:border-indigo-400/50 hover:text-white/80 hover:bg-white/5 transition-all mt-2"
                  >
                    <Plus className="w-4 h-4" />
                    新增待辦事項
                  </button>
                )}

                {/* Progress */}
                {task.sub_items_meta && task.sub_items_meta.total > 0 && (
                  <div className="mt-4 pt-4 border-t border-white/10">
                    <div className="flex items-center justify-between text-sm text-white/70 mb-2">
                      <span>進度</span>
                      <span>{task.sub_items_meta.completed} / {task.sub_items_meta.total}</span>
                    </div>
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 transition-all duration-300"
                        style={{ width: `${(task.sub_items_meta.completion_rate || 0) * 100}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>


          {/* Right Column - References */}
          <div className="w-96 border-l border-white/10 overflow-y-auto p-6 bg-white/5">
            <h3 className="text-lg font-semibold text-white mb-4">參考資料</h3>
            <div className="space-y-3">
              {task.references && task.references.length > 0 ? (
                task.references.map((ref) => (
                  <div
                    key={ref.id}
                    className="group p-3 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-colors"
                  >
                    <div className="flex items-start gap-3 mb-2">
                      {ref.type === "url" ? (
                        <ExternalLink className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                      ) : (
                        <FileText className="w-5 h-5 text-white/60 shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1 min-w-0">
                        {ref.type === "url" ? (
                          <>
                            {ref.title && (
                              <div className="text-sm font-medium text-white/90 mb-1 break-words">{ref.title}</div>
                            )}
                            <a
                              href={ref.content}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-400 hover:text-blue-300 hover:underline break-all"
                            >
                              {ref.content}
                            </a>
                          </>
                        ) : (
                          <div className="text-sm text-white/80 break-words whitespace-pre-wrap">
                            {ref.content}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => onDeleteReference?.(task.id, ref.id)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded hover:bg-red-500/20 text-white/60 hover:text-red-400 transition-all shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-white/40 italic text-center py-8">尚無參考資料</p>
              )}

              {/* Add Reference */}
              {isAddingReference ? (
                <div className="p-4 rounded-lg bg-white/10 border border-white/20 space-y-3">
                  <div className="flex gap-2">
                    <button
                      onClick={() => setNewRefType("url")}
                      className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                        newRefType === "url"
                          ? "bg-indigo-500 text-white"
                          : "bg-white/10 text-white/70 hover:bg-white/20"
                      }`}
                    >
                      <ExternalLink className="w-3.5 h-3.5 inline mr-1.5" />
                      網址
                    </button>
                    <button
                      onClick={() => setNewRefType("note")}
                      className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                        newRefType === "note"
                          ? "bg-indigo-500 text-white"
                          : "bg-white/10 text-white/70 hover:bg-white/20"
                      }`}
                    >
                      <FileText className="w-3.5 h-3.5 inline mr-1.5" />
                      註記
                    </button>
                  </div>
                  {newRefType === "url" && (
                    <input
                      type="text"
                      placeholder="標題 (選填)"
                      value={newRefTitle}
                      onChange={(e) => setNewRefTitle(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-lg bg-white/5 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:border-indigo-400/50 focus:ring-1 focus:ring-indigo-400/50"
                    />
                  )}
                  <textarea
                    placeholder={newRefType === "url" ? "https://example.com" : "輸入註記內容..."}
                    value={newRefContent}
                    onChange={(e) => setNewRefContent(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && e.metaKey) handleAddReference();
                      if (e.key === "Escape") {
                        setIsAddingReference(false);
                        setNewRefContent("");
                        setNewRefTitle("");
                      }
                    }}
                    autoFocus
                    rows={3}
                    className="w-full px-3 py-2 text-sm rounded-lg bg-white/5 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:border-indigo-400/50 focus:ring-1 focus:ring-indigo-400/50 resize-none"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleAddReference}
                      disabled={!newRefContent.trim() || isSubmittingReference}
                      className="flex-1 px-3 py-2 text-sm font-medium rounded-lg bg-indigo-500 text-white hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                    >
                      {isSubmittingReference && <Loader2 className="w-4 h-4 animate-spin" />}
                      {isSubmittingReference ? "新增中..." : "新增"}
                    </button>
                    <button
                      onClick={() => {
                        setIsAddingReference(false);
                        setNewRefContent("");
                        setNewRefTitle("");
                      }}
                      disabled={isSubmittingReference}
                      className="flex-1 px-3 py-2 text-sm font-medium rounded-lg bg-white/10 text-white/80 hover:bg-white/20 disabled:opacity-50 transition-colors"
                    >
                      取消
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setIsAddingReference(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 border-dashed border-white/20 text-white/60 hover:border-indigo-400/50 hover:text-white/80 hover:bg-white/5 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  新增參考資料
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-white/10 bg-black/20">
          <div className="flex items-center gap-3">
            {onComplete && (
              <button
                onClick={() => {
                  onComplete(task.id);
                  onClose();
                }}
                className={`px-6 py-2.5 text-sm font-medium rounded-lg border transition-colors ${
                  task.drawer === "ARCHIVE"
                    ? "bg-amber-500/20 text-amber-400 border-amber-500/30 hover:bg-amber-500/30 hover:border-amber-500/50"
                    : "bg-green-500/20 text-green-400 border-green-500/30 hover:bg-green-500/30 hover:border-green-500/50"
                }`}
              >
                {task.drawer === "ARCHIVE" ? "取消標記完成" : "標記為完成"}
              </button>
            )}
            {onDelete && !showDeleteConfirm && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="px-6 py-2.5 text-sm font-medium rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 hover:border-red-500/50 transition-colors flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                刪除任務
              </button>
            )}
            {showDeleteConfirm && onDelete && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-white/80">確定要刪除此任務?</span>
                <button
                  onClick={() => {
                    onDelete?.(task.id);
                    onClose();
                  }}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors"
                >
                  確定刪除
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-white/10 text-white/80 hover:bg-white/20 transition-colors"
                >
                  取消
                </button>
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-6 py-2.5 text-sm font-medium rounded-lg bg-white/10 text-white/80 hover:bg-white/20 transition-colors"
          >
            關閉
          </button>
        </div>
      </div>
    </div>
  );
}
