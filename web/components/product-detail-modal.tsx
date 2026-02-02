"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  X,
  Package,
  AlertCircle,
  Loader2,
  Sparkles,
  Trash2,
  Link as LinkIcon,
  FileText,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Plus,
  Archive,
  Pencil,
  Check,
} from "lucide-react";
import { auth } from "@/lib/firebase";
import { API_BASE_URL } from "@/lib/api-client";

interface Reference {
  id: string;
  type: "url" | "note";
  content: string;
  title?: string | null;
  created_at: string;
  source: "product" | "task";
  taskId?: string;
  taskContent?: string;
}

interface ProductDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  userId: string;
  product: {
    id: string;
    name: string;
    description?: string | null;
    lifecycle: "FINITE" | "PERPETUAL";
    status: string;
  } | null;
  initialTab?: "edit" | "references";
}

// 簡單的 Markdown 渲染器
function renderMarkdown(text: string): React.ReactNode {
  if (!text) return null;

  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];

  lines.forEach((line, lineIndex) => {
    if (line.startsWith("### ")) {
      elements.push(
        <h4 key={lineIndex} className="text-sm font-semibold text-white/90 mt-3 mb-1">
          {processLineFormatting(line.slice(4))}
        </h4>
      );
    } else if (line.startsWith("## ")) {
      elements.push(
        <h3 key={lineIndex} className="text-base font-semibold text-white mt-4 mb-2">
          {processLineFormatting(line.slice(3))}
        </h3>
      );
    } else if (line.startsWith("# ")) {
      elements.push(
        <h2 key={lineIndex} className="text-lg font-bold text-white mt-4 mb-2">
          {processLineFormatting(line.slice(2))}
        </h2>
      );
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      elements.push(
        <li key={lineIndex} className="text-sm text-white/70 ml-4 list-disc">
          {processLineFormatting(line.slice(2))}
        </li>
      );
    } else if (line.trim() === "") {
      elements.push(<br key={lineIndex} />);
    } else {
      elements.push(
        <p key={lineIndex} className="text-sm text-white/70 leading-relaxed">
          {processLineFormatting(line)}
        </p>
      );
    }
  });

  return <div className="space-y-1">{elements}</div>;
}

function processLineFormatting(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let keyIndex = 0;

  while (remaining.length > 0) {
    const linkMatch = remaining.match(/\[([^\]]+)\]\(([^)]+)\)/);
    if (linkMatch && linkMatch.index !== undefined) {
      if (linkMatch.index > 0) {
        parts.push(processInlineFormatting(remaining.slice(0, linkMatch.index), keyIndex++));
      }
      parts.push(
        <a
          key={keyIndex++}
          href={linkMatch[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-indigo-400 hover:text-indigo-300 underline"
        >
          {linkMatch[1]}
        </a>
      );
      remaining = remaining.slice(linkMatch.index + linkMatch[0].length);
      continue;
    }
    parts.push(processInlineFormatting(remaining, keyIndex++));
    break;
  }

  return parts.length === 1 ? parts[0] : <>{parts}</>;
}

function processInlineFormatting(text: string, baseKey: number): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let keyIndex = 0;

  while (remaining.length > 0) {
    const boldMatch = remaining.match(/\*\*([^*]+)\*\*/);
    if (boldMatch && boldMatch.index !== undefined) {
      if (boldMatch.index > 0) {
        parts.push(<span key={`${baseKey}-${keyIndex++}`}>{remaining.slice(0, boldMatch.index)}</span>);
      }
      parts.push(
        <strong key={`${baseKey}-${keyIndex++}`} className="font-semibold text-white/90">
          {boldMatch[1]}
        </strong>
      );
      remaining = remaining.slice(boldMatch.index + boldMatch[0].length);
      continue;
    }

    const italicMatch = remaining.match(/\*([^*]+)\*/);
    if (italicMatch && italicMatch.index !== undefined) {
      if (italicMatch.index > 0) {
        parts.push(<span key={`${baseKey}-${keyIndex++}`}>{remaining.slice(0, italicMatch.index)}</span>);
      }
      parts.push(
        <em key={`${baseKey}-${keyIndex++}`} className="italic">
          {italicMatch[1]}
        </em>
      );
      remaining = remaining.slice(italicMatch.index + italicMatch[0].length);
      continue;
    }

    const codeMatch = remaining.match(/`([^`]+)`/);
    if (codeMatch && codeMatch.index !== undefined) {
      if (codeMatch.index > 0) {
        parts.push(<span key={`${baseKey}-${keyIndex++}`}>{remaining.slice(0, codeMatch.index)}</span>);
      }
      parts.push(
        <code key={`${baseKey}-${keyIndex++}`} className="px-1.5 py-0.5 rounded bg-white/10 text-indigo-300 text-xs font-mono">
          {codeMatch[1]}
        </code>
      );
      remaining = remaining.slice(codeMatch.index + codeMatch[0].length);
      continue;
    }

    parts.push(<span key={`${baseKey}-${keyIndex++}`}>{remaining}</span>);
    break;
  }

  return parts.length === 1 ? parts[0] : <>{parts}</>;
}

export function ProductDetailModal({
  isOpen,
  onClose,
  userId,
  onSuccess,
  product,
  initialTab = "edit",
}: ProductDetailModalProps) {
  const [activeTab, setActiveTab] = useState<"edit" | "references">(initialTab);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // References 相關狀態
  const [references, setReferences] = useState<Reference[]>([]);
  const [isLoadingRefs, setIsLoadingRefs] = useState(false);
  const [selectedReference, setSelectedReference] = useState<Reference | null>(null);

  // 新增 Reference 相關狀態
  const [showAddForm, setShowAddForm] = useState(false);
  const [newRefType, setNewRefType] = useState<"url" | "note">("url");
  const [newRefTitle, setNewRefTitle] = useState("");
  const [newRefContent, setNewRefContent] = useState("");
  const [isAddingRef, setIsAddingRef] = useState(false);
  const [deletingRefId, setDeletingRefId] = useState<string | null>(null);

  // 筆記收折/展開狀態 (key: refId, value: true=展開)
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});

  // 筆記編輯狀態
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteTitle, setEditingNoteTitle] = useState("");
  const [editingNoteContent, setEditingNoteContent] = useState("");
  const [isUpdatingRef, setIsUpdatingRef] = useState(false);

  // 載入 references
  const loadReferences = useCallback(async () => {
    if (!product?.id) return;

    setIsLoadingRefs(true);
    try {
      const user = auth.currentUser;
      if (!user) return;
      const token = await user.getIdToken();

      const res = await fetch(`${API_BASE_URL}/api/products/${product.id}/references`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        setReferences(data.references || []);
      }
    } catch (err) {
      console.error("Failed to load references:", err);
    } finally {
      setIsLoadingRefs(false);
    }
  }, [product?.id]);

  // 重置或填充表單
  useEffect(() => {
    if (isOpen && product) {
      setName(product.name);
      setDescription(product.description || "");
      setError(null);
      setShowAddForm(false);
      setNewRefType("url");
      setNewRefTitle("");
      setNewRefContent("");
      setActiveTab(initialTab);
      setSelectedReference(null);
      loadReferences();
    }
  }, [isOpen, product, loadReferences, initialTab]);

  const handleSubmit = async () => {
    if (!name.trim() || !product) {
      setError("請輸入產品名稱");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error("未登入");
      }
      const token = await user.getIdToken();

      const res = await fetch(`${API_BASE_URL}/api/products/${product.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          lifecycle: product.lifecycle,
          status: product.status,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "更新失敗");
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新失敗");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!product) return;

    if (
      !confirm(
        `確定要刪除「${product.name}」這個專案嗎？\n\n注意：如果專案下有任務,將無法刪除。請先刪除或移動所有任務。`
      )
    ) {
      return;
    }

    setIsDeleting(true);
    setError(null);

    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error("未登入");
      }
      const token = await user.getIdToken();

      const res = await fetch(`${API_BASE_URL}/api/products/${product.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.details || data.error || "刪除失敗");
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "刪除失敗");
    } finally {
      setIsDeleting(false);
    }
  };

  // 新增 Reference
  const handleAddReference = async () => {
    if (!product || !newRefContent.trim()) return;

    setIsAddingRef(true);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("未登入");
      const token = await user.getIdToken();

      const res = await fetch(`${API_BASE_URL}/api/products/${product.id}/references`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          type: newRefType,
          content: newRefContent.trim(),
          title: newRefTitle.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "新增失敗");
      }

      // 重新載入 references
      await loadReferences();

      // 重置表單
      setShowAddForm(false);
      setNewRefType("url");
      setNewRefTitle("");
      setNewRefContent("");
    } catch (err) {
      console.error("Failed to add reference:", err);
      setError(err instanceof Error ? err.message : "新增失敗");
    } finally {
      setIsAddingRef(false);
    }
  };

  // 更新 Reference（編輯筆記）
  const handleUpdateReference = async (refId: string, taskId?: string) => {
    if (!product || !editingNoteContent.trim()) return;

    setIsUpdatingRef(true);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("未登入");
      const token = await user.getIdToken();

      const res = await fetch(`${API_BASE_URL}/api/products/${product.id}/references`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          referenceId: refId,
          taskId: taskId,
          title: editingNoteTitle.trim() || null,
          content: editingNoteContent.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "更新失敗");
      }

      // 重新載入 references
      await loadReferences();

      // 重置編輯狀態
      setEditingNoteId(null);
      setEditingNoteTitle("");
      setEditingNoteContent("");
    } catch (err) {
      console.error("Failed to update reference:", err);
      setError(err instanceof Error ? err.message : "更新失敗");
    } finally {
      setIsUpdatingRef(false);
    }
  };

  // 開始編輯筆記
  const startEditingNote = (ref: Reference) => {
    setEditingNoteId(ref.id);
    setEditingNoteTitle(ref.title || "");
    setEditingNoteContent(ref.content);
  };

  // 取消編輯
  const cancelEditingNote = () => {
    setEditingNoteId(null);
    setEditingNoteTitle("");
    setEditingNoteContent("");
  };

  // 切換筆記展開狀態
  const toggleNoteExpanded = (refId: string) => {
    setExpandedNotes((prev) => ({
      ...prev,
      [refId]: !prev[refId],
    }));
  };

  // 取得筆記預覽（前三行）
  const getNotePreview = (content: string): string => {
    const lines = content.split("\n").slice(0, 3);
    return lines.join("\n");
  };

  // 判斷筆記是否需要收折（超過三行）
  const needsCollapse = (content: string): boolean => {
    return content.split("\n").length > 3;
  };

  // 刪除 Reference
  const handleDeleteReference = async (refId: string, taskId?: string) => {
    if (!product) return;

    setDeletingRefId(refId);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("未登入");
      const token = await user.getIdToken();

      const url = taskId
        ? `/api/products/${product.id}/references?referenceId=${refId}&taskId=${taskId}`
        : `/api/products/${product.id}/references?referenceId=${refId}`;

      const res = await fetch(url, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "刪除失敗");
      }

      // 重新載入 references
      await loadReferences();
    } catch (err) {
      console.error("Failed to delete reference:", err);
      setError(err instanceof Error ? err.message : "刪除失敗");
    } finally {
      setDeletingRefId(null);
    }
  };

  if (!isOpen || !product) return null;

  // 分組 references by type
  const urlReferences = references.filter((r) => r.type === "url");
  const noteReferences = references.filter((r) => r.type === "note");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <Card className="relative w-full max-w-4xl mx-4 bg-slate-900 border-white/10 shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center">
              <Package className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">{product.name}</h2>
              <p className="text-sm text-white/50">
                {activeTab === "edit" ? "編輯專案資訊" : "相關資料"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Tab 切換按鈕 */}
            <div className="flex rounded-lg bg-white/5 p-1">
              <button
                onClick={() => setActiveTab("edit")}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  activeTab === "edit"
                    ? "bg-indigo-500 text-white"
                    : "text-white/60 hover:text-white"
                }`}
              >
                <Pencil className="w-4 h-4 inline-block mr-1.5" />
                編輯
              </button>
              <button
                onClick={() => setActiveTab("references")}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  activeTab === "references"
                    ? "bg-amber-500 text-white"
                    : "text-white/60 hover:text-white"
                }`}
              >
                <FileText className="w-4 h-4 inline-block mr-1.5" />
                相關資料
                {references.length > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-white/20 text-xs">
                    {references.length}
                  </span>
                )}
              </button>
            </div>
            <button
              onClick={onClose}
              className="text-white/50 hover:text-white transition-colors ml-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        {activeTab === "edit" ? (
          /* Edit Mode - Two Column Layout */
          <div className="flex-1 overflow-hidden flex">
            {/* Left Column - Edit Form */}
            <div className="w-1/2 p-6 border-r border-white/10 overflow-y-auto">
            <div className="space-y-5">
              {/* Error Message */}
              {error && (
                <div className="flex items-start gap-3 p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                  <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-red-400">操作失敗</p>
                    <p className="text-sm text-red-300/70 mt-1">{error}</p>
                  </div>
                </div>
              )}

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">
                  專案名稱 <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Zentropy 後端系統、個人部落格..."
                  className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  autoFocus
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">
                  描述（選填）
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="這個專案的目標與範圍..."
                  rows={6}
                  className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none"
                />
              </div>
            </div>
          </div>

          {/* Right Column - References */}
          <div className="w-1/2 p-6 overflow-y-auto bg-slate-950/50">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-white/70 uppercase tracking-wider">
                  相關資料
                </h3>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-white/40">
                    {references.length} 項
                  </span>
                  <button
                    onClick={() => setShowAddForm(!showAddForm)}
                    className="p-1.5 rounded-md bg-indigo-500/10 border border-indigo-500/30 hover:bg-indigo-500/20 transition-colors"
                    title="新增資料"
                  >
                    <Plus className="w-3.5 h-3.5 text-indigo-400" />
                  </button>
                </div>
              </div>

              {/* Add Reference Form */}
              {showAddForm && (
                <div className="p-4 rounded-lg bg-white/5 border border-white/10 space-y-3">
                  <div className="flex gap-2">
                    <button
                      onClick={() => setNewRefType("url")}
                      className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
                        newRefType === "url"
                          ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                          : "bg-white/5 text-white/50 border border-white/10 hover:bg-white/10"
                      }`}
                    >
                      <LinkIcon className="w-3.5 h-3.5 inline mr-1.5" />
                      連結
                    </button>
                    <button
                      onClick={() => setNewRefType("note")}
                      className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
                        newRefType === "note"
                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                          : "bg-white/5 text-white/50 border border-white/10 hover:bg-white/10"
                      }`}
                    >
                      <FileText className="w-3.5 h-3.5 inline mr-1.5" />
                      筆記
                    </button>
                  </div>

                  <input
                    type="text"
                    value={newRefTitle}
                    onChange={(e) => setNewRefTitle(e.target.value)}
                    placeholder="標題（選填）"
                    className="w-full px-3 py-2 rounded-md bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                  />

                  {newRefType === "url" ? (
                    <input
                      type="url"
                      value={newRefContent}
                      onChange={(e) => setNewRefContent(e.target.value)}
                      placeholder="https://..."
                      className="w-full px-3 py-2 rounded-md bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                    />
                  ) : (
                    <textarea
                      value={newRefContent}
                      onChange={(e) => setNewRefContent(e.target.value)}
                      placeholder="筆記內容（支援 Markdown）..."
                      rows={10}
                      className="w-full px-3 py-2 rounded-md bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 resize-none"
                    />
                  )}

                  <div className="flex justify-end gap-2">
                    <Button
                      onClick={() => {
                        setShowAddForm(false);
                        setNewRefTitle("");
                        setNewRefContent("");
                      }}
                      variant="outline"
                      size="sm"
                      className="border-white/10 bg-white/5 hover:bg-white/10 text-white"
                    >
                      取消
                    </Button>
                    <Button
                      onClick={handleAddReference}
                      disabled={!newRefContent.trim() || isAddingRef}
                      size="sm"
                      className="bg-indigo-600 hover:bg-indigo-500 text-white"
                    >
                      {isAddingRef ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        "新增"
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {isLoadingRefs ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 text-white/40 animate-spin" />
                </div>
              ) : references.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="w-8 h-8 mx-auto mb-2 text-white/20" />
                  <p className="text-sm text-white/40">尚無相關資料</p>
                  <p className="text-xs text-white/30 mt-1">
                    點擊上方 + 按鈕新增資料
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* URL References */}
                  {urlReferences.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <LinkIcon className="w-3.5 h-3.5 text-blue-400" />
                        <span className="text-xs font-medium text-white/50 uppercase tracking-wider">
                          連結 ({urlReferences.length})
                        </span>
                      </div>
                      <div className="space-y-2">
                        {urlReferences.map((ref) => (
                          <div
                            key={ref.id}
                            className="group flex items-start gap-3 p-3 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all"
                          >
                            <ExternalLink className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <a
                                href={ref.content}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm font-medium text-white/90 truncate hover:text-blue-300 transition-colors block"
                              >
                                {ref.title || ref.content}
                              </a>
                              {ref.title && (
                                <p className="text-xs text-white/40 truncate mt-0.5">
                                  {ref.content}
                                </p>
                              )}
                              <p className="text-xs text-white/30 mt-1 flex items-center gap-1">
                                {ref.source === "product" ? (
                                  <Archive className="w-3 h-3" />
                                ) : (
                                  <ChevronRight className="w-3 h-3" />
                                )}
                                {ref.taskContent && ref.taskContent.length > 40
                                  ? ref.taskContent.slice(0, 40) + "..."
                                  : ref.taskContent || "專案層級"}
                              </p>
                            </div>
                            <button
                              onClick={() => handleDeleteReference(ref.id, ref.source === "task" ? ref.taskId : undefined)}
                              disabled={deletingRefId === ref.id}
                              className="p-1.5 rounded-md opacity-0 group-hover:opacity-100 hover:bg-red-500/20 text-red-400 transition-all"
                              title="刪除"
                            >
                              {deletingRefId === ref.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Note References */}
                  {noteReferences.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <FileText className="w-3.5 h-3.5 text-amber-400" />
                        <span className="text-xs font-medium text-white/50 uppercase tracking-wider">
                          筆記 ({noteReferences.length})
                        </span>
                      </div>
                      <div className="space-y-2">
                        {noteReferences.map((ref) => {
                          const isExpanded = expandedNotes[ref.id] || false;
                          const isEditing = editingNoteId === ref.id;
                          const shouldCollapse = needsCollapse(ref.content);

                          return (
                            <div
                              key={ref.id}
                              className="group p-3 rounded-lg bg-white/5 border border-white/10"
                            >
                              {isEditing ? (
                                // 編輯模式
                                <div className="space-y-3">
                                  <input
                                    type="text"
                                    value={editingNoteTitle}
                                    onChange={(e) => setEditingNoteTitle(e.target.value)}
                                    placeholder="標題（選填）"
                                    className="w-full px-3 py-2 rounded-md bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                                  />
                                  <textarea
                                    value={editingNoteContent}
                                    onChange={(e) => setEditingNoteContent(e.target.value)}
                                    placeholder="筆記內容（支援 Markdown）..."
                                    rows={10}
                                    className="w-full px-3 py-2 rounded-md bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 resize-none"
                                  />
                                  <div className="flex justify-end gap-2">
                                    <Button
                                      onClick={cancelEditingNote}
                                      variant="outline"
                                      size="sm"
                                      className="border-white/10 bg-white/5 hover:bg-white/10 text-white"
                                      disabled={isUpdatingRef}
                                    >
                                      取消
                                    </Button>
                                    <Button
                                      onClick={() => handleUpdateReference(ref.id, ref.source === "task" ? ref.taskId : undefined)}
                                      disabled={!editingNoteContent.trim() || isUpdatingRef}
                                      size="sm"
                                      className="bg-indigo-600 hover:bg-indigo-500 text-white"
                                    >
                                      {isUpdatingRef ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                      ) : (
                                        <>
                                          <Check className="w-3.5 h-3.5 mr-1" />
                                          儲存
                                        </>
                                      )}
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                // 顯示模式
                                <>
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1 min-w-0">
                                      {ref.title && (
                                        <p className="text-sm font-medium text-white/90 mb-2">
                                          {ref.title}
                                        </p>
                                      )}
                                      <div className="text-sm text-white/70">
                                        {renderMarkdown(
                                          isExpanded || !shouldCollapse
                                            ? ref.content
                                            : getNotePreview(ref.content)
                                        )}
                                      </div>
                                      {/* 展開/收折按鈕 */}
                                      {shouldCollapse && (
                                        <button
                                          onClick={() => toggleNoteExpanded(ref.id)}
                                          className="mt-2 flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                                        >
                                          {isExpanded ? (
                                            <>
                                              <ChevronUp className="w-3.5 h-3.5" />
                                              收折
                                            </>
                                          ) : (
                                            <>
                                              <ChevronDown className="w-3.5 h-3.5" />
                                              展開更多
                                            </>
                                          )}
                                        </button>
                                      )}
                                    </div>
                                    {/* 操作按鈕 */}
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all shrink-0">
                                      <button
                                        onClick={() => startEditingNote(ref)}
                                        className="p-1.5 rounded-md hover:bg-indigo-500/20 text-indigo-400 transition-all"
                                        title="編輯"
                                      >
                                        <Pencil className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        onClick={() => handleDeleteReference(ref.id, ref.source === "task" ? ref.taskId : undefined)}
                                        disabled={deletingRefId === ref.id}
                                        className="p-1.5 rounded-md hover:bg-red-500/20 text-red-400 transition-all"
                                        title="刪除"
                                      >
                                        {deletingRefId === ref.id ? (
                                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        ) : (
                                          <Trash2 className="w-3.5 h-3.5" />
                                        )}
                                      </button>
                                    </div>
                                  </div>
                                  <p className="text-xs text-white/30 mt-2 flex items-center gap-1 pt-2 border-t border-white/5">
                                    {ref.source === "product" ? (
                                      <Archive className="w-3 h-3" />
                                    ) : (
                                      <ChevronRight className="w-3 h-3" />
                                    )}
                                    {ref.taskContent && ref.taskContent.length > 40
                                      ? ref.taskContent.slice(0, 40) + "..."
                                      : ref.taskContent || "專案層級"}
                                  </p>
                                </>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        ) : (
          /* References Mode - Two Column Layout (List | Content) */
          <div className="flex-1 overflow-hidden flex">
            {/* Left Column - References List */}
            <div className="w-2/5 border-r border-white/10 overflow-y-auto">
              {/* 新增按鈕 */}
              <div className="p-4 border-b border-white/10">
                <Button
                  onClick={() => {
                    setShowAddForm(true);
                    setSelectedReference(null);
                  }}
                  size="sm"
                  className="w-full bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  新增資料
                </Button>
              </div>

              {isLoadingRefs ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-white/50" />
                </div>
              ) : references.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                  <FileText className="w-12 h-12 text-white/20 mb-3" />
                  <p className="text-sm text-white/50">尚無相關資料</p>
                  <p className="text-xs text-white/30 mt-1">點擊上方按鈕新增</p>
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {references.map((ref) => (
                    <button
                      key={ref.id}
                      onClick={() => {
                        setSelectedReference(ref);
                        setShowAddForm(false);
                      }}
                      className={`w-full p-4 text-left hover:bg-white/5 transition-colors ${
                        selectedReference?.id === ref.id ? "bg-white/10" : ""
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {ref.type === "url" ? (
                          <LinkIcon className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                        ) : (
                          <FileText className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white/90 truncate">
                            {ref.title || (ref.type === "url" ? ref.content : "未命名筆記")}
                          </p>
                          <p className="text-xs text-white/40 mt-1 truncate">
                            {ref.type === "url" ? ref.content : ref.content.slice(0, 50)}
                          </p>
                          <p className="text-xs text-white/30 mt-1 flex items-center gap-1">
                            {ref.source === "product" ? (
                              <Archive className="w-3 h-3" />
                            ) : (
                              <ChevronRight className="w-3 h-3" />
                            )}
                            {ref.taskContent ? (ref.taskContent.length > 20 ? ref.taskContent.slice(0, 20) + "..." : ref.taskContent) : "專案層級"}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Right Column - Selected Reference Content or Add Form */}
            <div className="w-3/5 p-6 overflow-y-auto bg-slate-950/50">
              {showAddForm ? (
                /* 新增表單 */
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-white mb-4">新增相關資料</h3>

                  {/* 類型選擇 */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => setNewRefType("url")}
                      className={`flex-1 py-2 px-4 rounded-lg border transition-all ${
                        newRefType === "url"
                          ? "bg-blue-500/20 border-blue-500/50 text-blue-300"
                          : "bg-white/5 border-white/10 text-white/60 hover:border-white/20"
                      }`}
                    >
                      <LinkIcon className="w-4 h-4 inline-block mr-2" />
                      連結
                    </button>
                    <button
                      onClick={() => setNewRefType("note")}
                      className={`flex-1 py-2 px-4 rounded-lg border transition-all ${
                        newRefType === "note"
                          ? "bg-amber-500/20 border-amber-500/50 text-amber-300"
                          : "bg-white/5 border-white/10 text-white/60 hover:border-white/20"
                      }`}
                    >
                      <FileText className="w-4 h-4 inline-block mr-2" />
                      筆記
                    </button>
                  </div>

                  {/* 標題 */}
                  <input
                    type="text"
                    value={newRefTitle}
                    onChange={(e) => setNewRefTitle(e.target.value)}
                    placeholder="標題（選填）"
                    className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  />

                  {/* 內容 */}
                  {newRefType === "url" ? (
                    <input
                      type="url"
                      value={newRefContent}
                      onChange={(e) => setNewRefContent(e.target.value)}
                      placeholder="https://..."
                      className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    />
                  ) : (
                    <textarea
                      value={newRefContent}
                      onChange={(e) => setNewRefContent(e.target.value)}
                      placeholder="筆記內容（支援 Markdown）..."
                      rows={12}
                      className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-amber-500/50 resize-none"
                    />
                  )}

                  {/* 按鈕 */}
                  <div className="flex justify-end gap-2 pt-2">
                    <Button
                      onClick={() => {
                        setShowAddForm(false);
                        setNewRefTitle("");
                        setNewRefContent("");
                      }}
                      variant="outline"
                      className="border-white/10 bg-white/5 hover:bg-white/10 text-white"
                    >
                      取消
                    </Button>
                    <Button
                      onClick={handleAddReference}
                      disabled={!newRefContent.trim() || isAddingRef}
                      className="bg-amber-600 hover:bg-amber-500 text-white"
                    >
                      {isAddingRef ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <Plus className="w-4 h-4 mr-2" />
                          新增
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ) : selectedReference ? (
                /* 顯示選中的 Reference */
                <div className="space-y-4">
                  {/* Header with actions */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      {selectedReference.type === "url" ? (
                        <LinkIcon className="w-5 h-5 text-blue-400" />
                      ) : (
                        <FileText className="w-5 h-5 text-amber-400" />
                      )}
                      <span className="text-xs text-white/40 uppercase tracking-wider">
                        {selectedReference.type === "url" ? "連結" : "筆記"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {selectedReference.type === "note" && (
                        <button
                          onClick={() => startEditingNote(selectedReference)}
                          className="p-2 rounded-md hover:bg-indigo-500/20 text-indigo-400 transition-all"
                          title="編輯"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteReference(selectedReference.id, selectedReference.source === "task" ? selectedReference.taskId : undefined)}
                        disabled={deletingRefId === selectedReference.id}
                        className="p-2 rounded-md hover:bg-red-500/20 text-red-400 transition-all"
                        title="刪除"
                      >
                        {deletingRefId === selectedReference.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Title */}
                  {selectedReference.title && (
                    <h3 className="text-xl font-semibold text-white">
                      {selectedReference.title}
                    </h3>
                  )}

                  {/* Content */}
                  {selectedReference.type === "url" ? (
                    <a
                      href={selectedReference.content}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors break-all"
                    >
                      <ExternalLink className="w-4 h-4 shrink-0" />
                      {selectedReference.content}
                    </a>
                  ) : editingNoteId === selectedReference.id ? (
                    /* 編輯筆記模式 */
                    <div className="space-y-4">
                      <input
                        type="text"
                        value={editingNoteTitle}
                        onChange={(e) => setEditingNoteTitle(e.target.value)}
                        placeholder="標題（選填）"
                        className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                      />
                      <textarea
                        value={editingNoteContent}
                        onChange={(e) => setEditingNoteContent(e.target.value)}
                        placeholder="筆記內容（支援 Markdown）..."
                        rows={15}
                        className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none"
                      />
                      <div className="flex justify-end gap-2">
                        <Button
                          onClick={cancelEditingNote}
                          variant="outline"
                          className="border-white/10 bg-white/5 hover:bg-white/10 text-white"
                          disabled={isUpdatingRef}
                        >
                          取消
                        </Button>
                        <Button
                          onClick={() => handleUpdateReference(selectedReference.id, selectedReference.source === "task" ? selectedReference.taskId : undefined)}
                          disabled={!editingNoteContent.trim() || isUpdatingRef}
                          className="bg-indigo-600 hover:bg-indigo-500 text-white"
                        >
                          {isUpdatingRef ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <Check className="w-4 h-4 mr-2" />
                              儲存
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="prose prose-invert max-w-none">
                      {renderMarkdown(selectedReference.content)}
                    </div>
                  )}

                  {/* Source info */}
                  <div className="pt-4 mt-4 border-t border-white/10">
                    <p className="text-xs text-white/40 flex items-center gap-1">
                      {selectedReference.source === "product" ? (
                        <>
                          <Archive className="w-3 h-3" />
                          專案層級
                        </>
                      ) : (
                        <>
                          <ChevronRight className="w-3 h-3" />
                          來自任務：{selectedReference.taskContent || "未知任務"}
                        </>
                      )}
                    </p>
                  </div>
                </div>
              ) : (
                /* 未選擇任何 Reference */
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <FileText className="w-16 h-16 text-white/10 mb-4" />
                  <p className="text-white/50">選擇左側的資料以查看詳情</p>
                  <p className="text-white/30 text-sm mt-1">或點擊「新增資料」按鈕</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-white/10 shrink-0">
          {/* Delete Button */}
          <Button
            onClick={handleDelete}
            disabled={isDeleting || isSubmitting}
            variant="outline"
            className="border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300"
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                刪除中...
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4 mr-2" />
                刪除專案
              </>
            )}
          </Button>

          <div className="flex items-center gap-3">
            <Button
              onClick={onClose}
              variant="outline"
              className="border-white/10 bg-white/5 hover:bg-white/10 text-white"
              disabled={isSubmitting || isDeleting}
            >
              取消
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!name.trim() || isSubmitting || isDeleting}
              className="bg-gradient-to-r from-indigo-600 to-indigo-600 hover:from-indigo-500 hover:to-indigo-500 text-white"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  更新中...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  更新專案
                </>
              )}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
