"use client";

import { useState, useRef, useEffect } from "react";
import {
  MessageSquarePlus,
  X,
  Send,
  Loader2,
  ChevronDown,
  Sparkles,
  CheckCircle2,
  Tag,
  FolderOpen,
  Package,
  ArrowRightLeft,
  ArrowRight,
  Merge,
  FileText,
  Calendar,
  AlertCircle,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/firebase";

interface ProcessedItem {
  id: string;
  title: string;
  narrative: string;
  tag: {
    area: string;
    product: string;
    topic: string;
  };
  strategy_used: string;
  reasoning: string;
  // 時間推斷資訊
  due_date?: string | null;
  time_confidence?: number | null;
  time_reasoning?: string | null;
  inferred_from_milestone?: string | null;
}

interface AdjustStructuredOperation {
  type: "move" | "change_topic";
  reason: string;
  from: { area?: string; product: string; topic?: string; taskTitle: string };
  to: { area?: string; product?: string; topic?: string };
}

interface AdjustmentResult {
  success: boolean;
  preview?: boolean;
  intent_type: string;
  reasoning: string;
  operations?: string[];
  preview_operations?: string[];
  structured_operations?: AdjustStructuredOperation[];
  task_matches?: Array<{
    task_id: string;
    current_location: string;
    match_reason: string;
  }>;
  changes?: {
    moved: number;
  };
  message?: string;
}

interface StructuredOperation {
  id: string; // 唯一標識符，用於選擇執行
  type: "merge" | "reclassify";
  reason: string;
  from: { area?: string; product: string; taskTitle?: string };
  to: { area?: string; product: string };
  taskCount?: number;
}

interface ReorganizePreview {
  success: boolean;
  preview: boolean;
  analysis: string;
  preview_operations: string[];
  structured_operations?: StructuredOperation[];
  estimated_changes: {
    merges: number;
    reclassifications: number;
  };
}

interface AreaWithProducts {
  id: string;
  name: string;
  products: Array<{
    id: string;
    name: string;
  }>;
}

interface QuickCaptureProps {
  userId: string | null;
  onItemsCreated: () => void;
  areas?: AreaWithProducts[];
  welcomeMode?: boolean;
}

export function QuickCapture({ userId, onItemsCreated, areas = [], welcomeMode = false }: QuickCaptureProps) {
  const [isExpanded, setIsExpanded] = useState(welcomeMode);
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedItems, setProcessedItems] = useState<ProcessedItem[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [adjustmentResult, setAdjustmentResult] = useState<AdjustmentResult | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingOperation, setPendingOperation] = useState<{
    type: "adjust" | "reorganize";
    data: AdjustmentResult | ReorganizePreview | null;
    originalInput?: string;
  } | null>(null);
  const [selectedOperationIds, setSelectedOperationIds] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // @ mention 相關狀態
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionStartPos, setMentionStartPos] = useState<number | null>(null);
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  // 追蹤輸入法組合狀態（注音選字等）
  const [isComposing, setIsComposing] = useState(false);

  // 從 areas 提取所有 products（帶有 area 資訊）
  const allProducts = areas.flatMap(area =>
    area.products.map(product => ({
      id: product.id,
      name: product.name,
      areaName: area.name,
    }))
  );

  // 過濾符合搜尋條件的 products
  const filteredProducts = mentionQuery
    ? allProducts.filter(p =>
        p.name.toLowerCase().includes(mentionQuery.toLowerCase()) ||
        p.areaName.toLowerCase().includes(mentionQuery.toLowerCase())
      )
    : allProducts;

  // 自動聚焦
  useEffect(() => {
    if (isExpanded && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isExpanded]);

  // welcomeMode 時自動聚焦
  useEffect(() => {
    if (welcomeMode && inputRef.current) {
      inputRef.current.focus();
    }
  }, [welcomeMode]);

  // 當下拉選單選項變化時，重置選中索引
  useEffect(() => {
    setSelectedMentionIndex(0);
  }, [filteredProducts.length]);

  // 處理輸入變化，偵測 @ mention
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart || 0;
    setInput(value);

    // 找到游標前最近的 @
    const textBeforeCursor = value.slice(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf("@");

    if (lastAtIndex !== -1) {
      // 確認 @ 前面是空白或是開頭（避免 email 觸發）
      const charBefore = lastAtIndex > 0 ? value[lastAtIndex - 1] : " ";
      if (charBefore === " " || charBefore === "\n" || lastAtIndex === 0) {
        // 取得 @ 後的搜尋文字（到游標位置）
        const query = value.slice(lastAtIndex + 1, cursorPos);
        // 如果搜尋文字中沒有空白，顯示下拉選單
        if (!query.includes(" ") && !query.includes("\n")) {
          setMentionQuery(query);
          setMentionStartPos(lastAtIndex);
          setShowMentionDropdown(true);
          return;
        }
      }
    }

    // 其他情況隱藏下拉選單
    setShowMentionDropdown(false);
    setMentionQuery("");
    setMentionStartPos(null);
  };

  // 選擇專案並插入到輸入框
  const handleSelectProduct = (product: { name: string }) => {
    if (mentionStartPos === null || !inputRef.current) return;

    const cursorPos = inputRef.current.selectionStart || 0;
    const beforeMention = input.slice(0, mentionStartPos);
    const afterCursor = input.slice(cursorPos);

    // 插入 @專案名稱 並加上空白
    const newValue = `${beforeMention}@${product.name} ${afterCursor}`;
    setInput(newValue);

    // 重置 mention 狀態
    setShowMentionDropdown(false);
    setMentionQuery("");
    setMentionStartPos(null);

    // 聚焦並移動游標到插入位置之後
    setTimeout(() => {
      if (inputRef.current) {
        const newCursorPos = beforeMention.length + product.name.length + 2; // +2 for @ and space
        inputRef.current.focus();
        inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  };

  // 處理鍵盤事件
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showMentionDropdown && filteredProducts.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedMentionIndex(prev =>
          prev < filteredProducts.length - 1 ? prev + 1 : 0
        );
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedMentionIndex(prev =>
          prev > 0 ? prev - 1 : filteredProducts.length - 1
        );
        return;
      }
      if (e.key === "Enter" && !e.shiftKey && !isComposing) {
        e.preventDefault();
        handleSelectProduct(filteredProducts[selectedMentionIndex]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setShowMentionDropdown(false);
        return;
      }
    }

    // 一般的 Enter 送出（必須不在輸入法組合中）
    if (e.key === "Enter" && !e.shiftKey && !isComposing) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSubmit = async () => {
    if (!userId || !input.trim() || isProcessing) return;

    setIsProcessing(true);
    setShowResults(true);
    setProcessedItems([]);
    setAdjustmentResult(null);

    try {
      // 獲取 Firebase token
      const user = auth.currentUser;
      if (!user) {
        throw new Error("未登入");
      }
      const token = await user.getIdToken();

      // 純歸檔模式：直接創建新 Task，不做調整判斷
      // 調整標籤功能已移至「整理標籤」按鈕和 Product 層級的重組功能
      const res = await fetch("/api/brain-dump", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ text: input, userId }),
      });

      if (!res.ok) {
        throw new Error("AI 處理失敗");
      }

      const data = await res.json();
      setProcessedItems(data.items || []);
      setInput("");

      // 通知父組件刷新數據
      onItemsCreated();

      // 5 秒後自動隱藏結果
      setTimeout(() => {
        setShowResults(false);
        setProcessedItems([]);
      }, 5000);
    } catch (err) {
      console.error("Quick capture failed:", err);
    } finally {
      setIsProcessing(false);
    }
  };


  // 確認執行操作
  const handleConfirmOperation = async () => {
    if (!pendingOperation || !userId) return;

    setShowConfirmDialog(false);
    setIsProcessing(true);
    setShowResults(true);

    try {
      // 獲取 Firebase token
      const user = auth.currentUser;
      if (!user) {
        throw new Error("未登入");
      }
      const token = await user.getIdToken();

      if (pendingOperation.type === "adjust") {
        // 執行調整操作
        const res = await fetch("/api/adjust-tags", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
          },
          body: JSON.stringify({
            text: pendingOperation.originalInput,
            userId,
            confirmed: true,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          setAdjustmentResult(data);
          setInput("");
          onItemsCreated();

          setTimeout(() => {
            setShowResults(false);
            setAdjustmentResult(null);
          }, 6000);
        }
      }
    } catch (err) {
      console.error("Operation failed:", err);
    } finally {
      setIsProcessing(false);
      setPendingOperation(null);
    }
  };

  // 取消操作
  const handleCancelOperation = () => {
    setShowConfirmDialog(false);
    setPendingOperation(null);
    setIsProcessing(false);
    setSelectedOperationIds(new Set());
  };

  // 收起時的浮動按鈕（welcomeMode 時不顯示）
  if (!isExpanded && !welcomeMode) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-r from-indigo-600 to-indigo-600 hover:from-indigo-500 hover:to-indigo-500 shadow-lg shadow-indigo-500/30 flex items-center justify-center transition-all hover:scale-110 group"
      >
        <MessageSquarePlus className="w-6 h-6 text-white group-hover:scale-110 transition-transform" />
      </button>
    );
  }

  // welcomeMode：置中放大的輸入區域
  if (welcomeMode) {
    return (
      <>
        {/* @ Mention 選擇器 */}
        {showMentionDropdown && (
          <div className="fixed inset-0 z-[9999] flex items-start justify-center pt-[15vh]">
            <div
              className="absolute inset-0 bg-black/50"
              onClick={() => setShowMentionDropdown(false)}
            />
            <div
              ref={dropdownRef}
              className="relative w-full max-w-md mx-4 bg-slate-900 border border-white/20 rounded-xl shadow-2xl overflow-hidden"
            >
              <div className="px-4 py-3 border-b border-white/10 bg-gradient-to-r from-purple-900/30 to-indigo-900/30">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-indigo-400" />
                  <span className="text-sm font-medium text-white">選擇專案</span>
                  <span className="text-xs text-white/40 ml-auto">↑↓ 選擇 · Enter 確認 · Esc 取消</span>
                </div>
                {mentionQuery && (
                  <p className="text-xs text-white/50 mt-1">搜尋：{mentionQuery}</p>
                )}
              </div>
              <div className="max-h-[50vh] overflow-y-auto">
                {filteredProducts.length > 0 ? (
                  <div className="py-1">
                    {filteredProducts.map((product, index) => (
                      <button
                        key={product.id}
                        onClick={() => handleSelectProduct(product)}
                        onMouseEnter={() => setSelectedMentionIndex(index)}
                        className={`w-full px-4 py-3 text-left flex items-center gap-3 transition-colors ${
                          index === selectedMentionIndex
                            ? "bg-indigo-500/30 text-white"
                            : "hover:bg-white/5 text-white/80"
                        }`}
                      >
                        <Package className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                        <span className="text-sm font-medium truncate flex-1">{product.name}</span>
                        <span className="text-xs text-white/50 flex-shrink-0 bg-white/10 px-2 py-1 rounded">{product.areaName}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="px-4 py-8 text-center">
                    <p className="text-sm text-white/50">找不到符合「{mentionQuery}」的專案</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 置中的輸入面板 */}
        <div className="w-full max-w-xl mx-auto">
          <div className="bg-slate-900/80 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl shadow-indigo-500/20 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-gradient-to-r from-purple-900/30 to-indigo-900/30">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-400" />
                <span className="text-base font-medium text-white">快速記錄</span>
              </div>
            </div>

            {/* 處理結果顯示 */}
            {showResults && processedItems.length > 0 && (
              <div className="max-h-64 overflow-y-auto border-b border-white/10">
                <div className="p-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm text-green-400">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>AI 已整理 {processedItems.length} 個項目</span>
                  </div>
                  {processedItems.map((item, index) => (
                    <div
                      key={item.id || index}
                      className="p-3 rounded-lg bg-white/5 border border-white/10 animate-in fade-in slide-in-from-bottom-2 duration-300"
                      style={{ animationDelay: `${index * 100}ms` }}
                    >
                      <h4 className="font-medium text-white text-sm mb-1">{item.title}</h4>
                      <div className="flex items-center gap-1.5 text-xs text-white/50">
                        <FolderOpen className="w-3 h-3" />
                        <span className="text-indigo-400">{item.tag.area}</span>
                        <span className="text-white/30">/</span>
                        <Package className="w-3 h-3" />
                        <span className="text-blue-400">{item.tag.product}</span>
                        <span className="text-white/30">/</span>
                        <Tag className="w-3 h-3" />
                        <span className="text-green-400">{item.tag.topic}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 處理中動畫 */}
            {isProcessing && (
              <div className="p-5 border-b border-white/10 bg-gradient-to-r from-purple-900/20 to-indigo-900/20">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
                    <div className="absolute inset-0 w-6 h-6 bg-indigo-500/20 rounded-full animate-ping" />
                  </div>
                  <div>
                    <p className="text-base text-white">AI 正在歸檔...</p>
                    <p className="text-sm text-white/50">分析內容、歸類標籤、推斷時間</p>
                  </div>
                </div>
              </div>
            )}

            {/* 輸入區域 */}
            <div className="p-5">
              <div className="relative">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  onCompositionStart={() => setIsComposing(true)}
                  onCompositionEnd={() => {
                    // 延遲設置以確保 keydown 事件先處理完
                    setTimeout(() => setIsComposing(false), 0);
                  }}
                  placeholder="輸入任何想法..."
                  disabled={isProcessing}
                  rows={4}
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/20 text-white text-base placeholder:text-white/40 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all disabled:opacity-50"
                />
              </div>

              {/* 提示 */}
              <div className="mt-3 px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <p className="text-sm text-blue-300/90 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>
                    使用 <code className="px-1.5 py-0.5 rounded bg-white/10">1)</code> 或 <code className="px-1.5 py-0.5 rounded bg-white/10">-</code> 可自動拆分為待辦事項
                  </span>
                </p>
              </div>

              <div className="flex items-center justify-end mt-4">
                <Button
                  size="lg"
                  onClick={handleSubmit}
                  disabled={!input.trim() || isProcessing}
                  className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white px-6"
                >
                  {isProcessing ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Send className="w-5 h-5 mr-2" />
                      送出
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {/* @ Mention 選擇器 - Command Palette 風格 */}
      {showMentionDropdown && (
        <div className="fixed inset-0 z-[9999] flex items-start justify-center pt-[15vh]">
          {/* 背景遮罩 */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowMentionDropdown(false)}
          />

          {/* 選單本體 */}
          <div
            ref={dropdownRef}
            className="relative w-full max-w-md mx-4 bg-slate-900 border border-white/20 rounded-xl shadow-2xl overflow-hidden"
          >
            {/* 標題 */}
            <div className="px-4 py-3 border-b border-white/10 bg-gradient-to-r from-purple-900/30 to-indigo-900/30">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-indigo-400" />
                <span className="text-sm font-medium text-white">選擇專案</span>
                <span className="text-xs text-white/40 ml-auto">↑↓ 選擇 · Enter 確認 · Esc 取消</span>
              </div>
              {mentionQuery && (
                <p className="text-xs text-white/50 mt-1">搜尋：{mentionQuery}</p>
              )}
            </div>

            {/* 專案列表 */}
            <div className="max-h-[50vh] overflow-y-auto">
              {filteredProducts.length > 0 ? (
                <div className="py-1">
                  {filteredProducts.map((product, index) => (
                    <button
                      key={product.id}
                      onClick={() => handleSelectProduct(product)}
                      onMouseEnter={() => setSelectedMentionIndex(index)}
                      className={`w-full px-4 py-3 text-left flex items-center gap-3 transition-colors ${
                        index === selectedMentionIndex
                          ? "bg-indigo-500/30 text-white"
                          : "hover:bg-white/5 text-white/80"
                      }`}
                    >
                      <Package className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                      <span className="text-sm font-medium truncate flex-1">{product.name}</span>
                      <span className="text-xs text-white/50 flex-shrink-0 bg-white/10 px-2 py-1 rounded">{product.areaName}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="px-4 py-8 text-center">
                  <p className="text-sm text-white/50">找不到符合「{mentionQuery}」的專案</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 確認對話框 */}
      {showConfirmDialog && pendingOperation && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={handleCancelOperation}
          />

          {/* Modal */}
          <div className="relative w-full max-w-3xl mx-4 bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="px-6 py-4 border-b border-white/10 bg-gradient-to-r from-amber-900/30 to-orange-900/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">
                    {pendingOperation.type === "adjust" ? "確認調整操作" : "確認整理標籤"}
                  </h3>
                  <p className="text-sm text-white/50">
                    請檢查以下操作是否正確
                  </p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="px-6 py-4 max-h-96 overflow-y-auto">
              {/* AI 分析 */}
              <div className="mb-4">
                <p className="text-xs text-white/50 mb-2 font-medium uppercase tracking-wider">AI 分析</p>
                <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <p className="text-sm text-white/90">
                    {pendingOperation.type === "adjust"
                      ? (pendingOperation.data as AdjustmentResult).reasoning
                      : (pendingOperation.data as ReorganizePreview).analysis}
                  </p>
                </div>
              </div>

              {/* 將要執行的操作 - 視覺化呈現 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-white/50 font-medium uppercase tracking-wider">將要執行的操作</p>
                  {pendingOperation.type === "reorganize" && (pendingOperation.data as ReorganizePreview).structured_operations && (
                    <button
                      onClick={() => {
                        const ops = (pendingOperation.data as ReorganizePreview).structured_operations!;
                        if (selectedOperationIds.size === ops.length) {
                          // 全選 -> 全不選
                          setSelectedOperationIds(new Set());
                        } else {
                          // 部分選擇/全不選 -> 全選
                          setSelectedOperationIds(new Set(ops.map(op => op.id)));
                        }
                      }}
                      className="text-xs text-blue-400 hover:text-blue-300 underline"
                    >
                      {selectedOperationIds.size === (pendingOperation.data as ReorganizePreview).structured_operations!.length ? "取消全選" : "全選"}
                    </button>
                  )}
                </div>
                <div className="space-y-3">
                  {pendingOperation.type === "adjust" && (
                    <>
                      {/* 優先使用結構化數據，否則降級使用舊格式 */}
                      {(pendingOperation.data as AdjustmentResult).structured_operations ? (
                        (pendingOperation.data as AdjustmentResult).structured_operations!.map((op, idx) => (
                          <div
                            key={idx}
                            className={`p-3 rounded-xl border ${
                              op.type === "move"
                                ? "bg-teal-500/10 border-teal-500/20"
                                : "bg-amber-500/10 border-amber-500/20"
                            }`}
                          >
                            {/* 操作類型標籤 */}
                            <div className="flex items-center gap-2 mb-2">
                              {op.type === "move" ? (
                                <>
                                  <ArrowRightLeft className="w-4 h-4 text-teal-400" />
                                  <span className="text-xs font-medium text-teal-300">移動任務</span>
                                </>
                              ) : (
                                <>
                                  <Tag className="w-4 h-4 text-amber-400" />
                                  <span className="text-xs font-medium text-amber-300">變更主題</span>
                                </>
                              )}
                            </div>

                            {/* 視覺化移動關係 */}
                            <div className="flex items-center gap-2">
                              {/* 來源 */}
                              <div className="flex-1 p-2 rounded-lg bg-white/5 border border-white/10">
                                <div className="flex items-center gap-1.5 mb-1">
                                  <FileText className="w-3 h-3 text-white/40" />
                                  <span className="text-xs text-white/70 truncate">{op.from.taskTitle}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <FolderOpen className="w-3 h-3 text-white/40" />
                                  <span className="text-xs text-white/50">{op.from.area}</span>
                                  <span className="text-white/30">/</span>
                                  <Package className="w-3 h-3 text-white/40" />
                                  <span className="text-xs text-white/70">{op.from.product}</span>
                                  {op.from.topic && (
                                    <>
                                      <span className="text-white/30">/</span>
                                      <Tag className="w-3 h-3 text-white/40" />
                                      <span className="text-xs text-white/50">{op.from.topic}</span>
                                    </>
                                  )}
                                </div>
                              </div>

                              {/* 箭頭 */}
                              <div className="flex-shrink-0">
                                <ArrowRight className={`w-5 h-5 ${
                                  op.type === "move" ? "text-teal-400" : "text-amber-400"
                                }`} />
                              </div>

                              {/* 目標 */}
                              <div className={`flex-1 p-2 rounded-lg border ${
                                op.type === "move"
                                  ? "bg-teal-500/20 border-teal-500/30"
                                  : "bg-amber-500/20 border-amber-500/30"
                              }`}>
                                <div className="flex items-center gap-1.5">
                                  {op.to.area && (
                                    <>
                                      <FolderOpen className="w-3 h-3 text-white/50" />
                                      <span className="text-xs text-white/70">{op.to.area}</span>
                                      <span className="text-white/30">/</span>
                                    </>
                                  )}
                                  {op.to.product && (
                                    <>
                                      <Package className="w-3 h-3 text-white/50" />
                                      <span className="text-xs text-white font-medium">{op.to.product}</span>
                                    </>
                                  )}
                                  {op.to.topic && (
                                    <>
                                      <Tag className="w-3 h-3 text-white/50" />
                                      <span className="text-xs text-white font-medium">{op.to.topic}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* 原因說明 */}
                            {op.reason && (
                              <p className="mt-2 text-xs text-white/50 italic">
                                {op.reason}
                              </p>
                            )}
                          </div>
                        ))
                      ) : (
                        // 降級：使用舊的字串格式
                        (pendingOperation.data as AdjustmentResult).preview_operations?.map((op, idx) => (
                          <div key={idx} className="p-3 rounded-lg bg-teal-500/10 border border-teal-500/20">
                            <p className="text-sm text-white/90 whitespace-pre-line">{op}</p>
                          </div>
                        ))
                      )}
                    </>
                  )}
                  {pendingOperation.type === "reorganize" && (
                    <>
                      {/* 優先使用結構化數據，否則降級使用舊格式 */}
                      {(pendingOperation.data as ReorganizePreview).structured_operations ? (
                        (pendingOperation.data as ReorganizePreview).structured_operations!.map((op, idx) => (
                          <div
                            key={idx}
                            className={`p-3 rounded-xl border ${
                              op.type === "merge"
                                ? "bg-indigo-500/10 border-indigo-500/20"
                                : "bg-teal-500/10 border-teal-500/20"
                            } ${!selectedOperationIds.has(op.id) ? "opacity-40" : ""}`}
                          >
                            {/* 操作類型標籤 + Checkbox */}
                            <div className="flex items-center gap-2 mb-2">
                              <input
                                type="checkbox"
                                checked={selectedOperationIds.has(op.id)}
                                onChange={(e) => {
                                  const newSet = new Set(selectedOperationIds);
                                  if (e.target.checked) {
                                    newSet.add(op.id);
                                  } else {
                                    newSet.delete(op.id);
                                  }
                                  setSelectedOperationIds(newSet);
                                }}
                                className="w-4 h-4 rounded border-white/20 bg-white/10 text-indigo-600 focus:ring-indigo-500 focus:ring-2 cursor-pointer"
                              />
                              {op.type === "merge" ? (
                                <>
                                  <Merge className="w-4 h-4 text-indigo-400" />
                                  <span className="text-xs font-medium text-indigo-300">合併專案</span>
                                </>
                              ) : (
                                <>
                                  <ArrowRightLeft className="w-4 h-4 text-teal-400" />
                                  <span className="text-xs font-medium text-teal-300">移動任務</span>
                                </>
                              )}
                              {op.taskCount !== undefined && (
                                <span className="ml-auto text-xs text-white/50 bg-white/10 px-2 py-0.5 rounded-full">
                                  {op.taskCount} 個任務
                                </span>
                              )}
                            </div>

                            {/* 視覺化移動關係 */}
                            <div className="flex items-center gap-2">
                              {/* 來源 */}
                              <div className="flex-1 p-2 rounded-lg bg-white/5 border border-white/10">
                                {op.from.taskTitle && (
                                  <div className="flex items-center gap-1.5 mb-1">
                                    <FileText className="w-3 h-3 text-white/40" />
                                    <span className="text-xs text-white/70 truncate">{op.from.taskTitle}</span>
                                  </div>
                                )}
                                <div className="flex items-center gap-1.5">
                                  {op.from.area && (
                                    <>
                                      <FolderOpen className="w-3 h-3 text-white/40" />
                                      <span className="text-xs text-white/50">{op.from.area}</span>
                                      <span className="text-white/30">/</span>
                                    </>
                                  )}
                                  <Package className="w-3 h-3 text-white/40" />
                                  <span className="text-xs text-white/70">{op.from.product}</span>
                                </div>
                              </div>

                              {/* 箭頭 */}
                              <div className="flex-shrink-0">
                                <ArrowRight className={`w-5 h-5 ${
                                  op.type === "merge" ? "text-indigo-400" : "text-teal-400"
                                }`} />
                              </div>

                              {/* 目標 */}
                              <div className={`flex-1 p-2 rounded-lg border ${
                                op.type === "merge"
                                  ? "bg-indigo-500/20 border-indigo-500/30"
                                  : "bg-teal-500/20 border-teal-500/30"
                              }`}>
                                <div className="flex items-center gap-1.5">
                                  {op.to.area && (
                                    <>
                                      <FolderOpen className="w-3 h-3 text-white/50" />
                                      <span className="text-xs text-white/70">{op.to.area}</span>
                                      <span className="text-white/30">/</span>
                                    </>
                                  )}
                                  <Package className="w-3 h-3 text-white/50" />
                                  <span className="text-xs text-white font-medium">{op.to.product}</span>
                                </div>
                              </div>
                            </div>

                            {/* 原因說明 */}
                            {op.reason && (
                              <p className="mt-2 text-xs text-white/50 italic">
                                {op.reason}
                              </p>
                            )}
                          </div>
                        ))
                      ) : (
                        // 降級：使用舊的字串格式
                        (pendingOperation.data as ReorganizePreview).preview_operations?.map((op, idx) => (
                          <div key={idx} className="p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                            <p className="text-sm text-white/90 whitespace-pre-line">{op}</p>
                          </div>
                        ))
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* 統計信息 */}
              <div className="mt-4 p-3 rounded-lg bg-white/5 border border-white/10">
                <p className="text-xs text-white/50 mb-2">預計變更</p>
                <div className="flex items-center gap-4 text-sm">
                  {pendingOperation.type === "adjust" && (
                    <div className="flex items-center gap-2">
                      <span className="text-white/60">移動任務：</span>
                      <span className="text-white font-bold">
                        {(pendingOperation.data as AdjustmentResult).changes?.moved || 0} 個
                      </span>
                    </div>
                  )}
                  {pendingOperation.type === "reorganize" && (() => {
                    const data = pendingOperation.data as ReorganizePreview;
                    const selectedOps = data.structured_operations?.filter(op => selectedOperationIds.has(op.id)) || [];
                    const selectedMerges = selectedOps.filter(op => op.type === "merge").length;
                    const selectedReclassifications = selectedOps.filter(op => op.type === "reclassify").length;

                    return (
                      <>
                        <div className="flex items-center gap-2">
                          <span className="text-white/60">已選：</span>
                          <span className="text-white font-bold">
                            {selectedOps.length} / {data.structured_operations?.length || 0}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-white/60">合併：</span>
                          <span className="text-white font-bold">
                            {selectedMerges}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-white/60">重新分類：</span>
                          <span className="text-white font-bold">
                            {selectedReclassifications}
                          </span>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/10 bg-white/5">
              <Button
                onClick={handleCancelOperation}
                variant="outline"
                className="border-white/10 bg-white/5 hover:bg-white/10 text-white"
              >
                取消
              </Button>
              <Button
                onClick={handleConfirmOperation}
                disabled={pendingOperation?.type === "reorganize" && selectedOperationIds.size === 0}
                className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                確認執行 {pendingOperation?.type === "reorganize" && selectedOperationIds.size > 0 && `(${selectedOperationIds.size})`}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="fixed bottom-6 right-6 z-50 w-96 animate-in slide-in-from-bottom-4 duration-200">
        {/* 主面板 */}
        <div className="bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl shadow-indigo-500/20 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-gradient-to-r from-purple-900/30 to-indigo-900/30">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <span className="text-sm font-medium text-white">快速記錄</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowResults(!showResults)}
              className={`p-1.5 rounded-lg hover:bg-white/10 transition-colors ${
                (processedItems.length > 0 || adjustmentResult) ? 'text-indigo-400' : 'text-white/30'
              }`}
              disabled={!processedItems.length && !adjustmentResult}
            >
              <ChevronDown className={`w-4 h-4 transition-transform ${showResults ? 'rotate-180' : ''}`} />
            </button>
            <button
              onClick={() => {
                setIsExpanded(false);
                setShowResults(false);
              }}
              className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

            {/* 處理結果顯示 - 快速記錄 */}
          {showResults && processedItems.length > 0 && (
            <div className="max-h-64 overflow-y-auto border-b border-white/10">
            <div className="p-3 space-y-2">
              <div className="flex items-center gap-2 text-xs text-green-400">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>AI 已整理 {processedItems.length} 個項目</span>
              </div>

              {processedItems.map((item, index) => {
                // 計算相對時間
                const getRelativeTimeDesc = (dueDate: string) => {
                  const now = new Date();
                  now.setHours(0, 0, 0, 0);
                  const due = new Date(dueDate);
                  due.setHours(0, 0, 0, 0);
                  const diffMs = due.getTime() - now.getTime();
                  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
                  if (diffDays < 0) return { text: `逾期 ${Math.abs(diffDays)} 天`, isOverdue: true };
                  if (diffDays === 0) return { text: "今天", isOverdue: false };
                  if (diffDays === 1) return { text: "明天", isOverdue: false };
                  if (diffDays <= 7) return { text: `${diffDays} 天後`, isOverdue: false };
                  return { text: `${Math.floor(diffDays / 7)} 週後`, isOverdue: false };
                };

                const timeInfo = item.due_date ? getRelativeTimeDesc(item.due_date) : null;
                const isLowConfidence = item.time_confidence !== null && item.time_confidence !== undefined && item.time_confidence < 0.6;

                return (
                  <div
                    key={item.id || index}
                    className="p-3 rounded-lg bg-white/5 border border-white/10 animate-in fade-in slide-in-from-bottom-2 duration-300"
                    style={{ animationDelay: `${index * 100}ms` }}
                  >
                    <h4 className="font-medium text-white text-sm mb-1">{item.title}</h4>

                    {/* 標籤路徑 + 時間標籤 */}
                    <div className="flex items-center gap-1.5 text-xs text-white/50 mb-2 flex-wrap">
                      <FolderOpen className="w-3 h-3" />
                      <span className="text-indigo-400">{item.tag.area}</span>
                      <span className="text-white/30">/</span>
                      <Package className="w-3 h-3" />
                      <span className="text-blue-400">{item.tag.product}</span>
                      <span className="text-white/30">/</span>
                      <Tag className="w-3 h-3" />
                      <span className="text-green-400">{item.tag.topic}</span>

                      {/* 時間標籤 */}
                      {timeInfo && (
                        <>
                          <span className="text-white/20 mx-1">|</span>
                          <div className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs ${
                            timeInfo.isOverdue
                              ? "bg-red-500/20 text-red-400"
                              : "bg-blue-500/20 text-blue-400"
                          }`}>
                            {timeInfo.isOverdue ? (
                              <AlertCircle className="w-3 h-3" />
                            ) : (
                              <Calendar className="w-3 h-3" />
                            )}
                            {timeInfo.text}
                            {isLowConfidence && (
                              <span className="text-orange-400 ml-0.5" title="AI 信心較低，建議手動確認">⚠</span>
                            )}
                          </div>
                        </>
                      )}
                    </div>

                    {/* AI 思考過程 */}
                    <div className="text-xs text-white/40 bg-white/5 rounded-md p-2 space-y-1">
                      <div>
                        <span className="text-indigo-400/70">分類思路：</span> {item.reasoning}
                      </div>
                      {item.time_reasoning && (
                        <div className="border-t border-white/10 pt-1 mt-1">
                          <span className="text-blue-400/70">
                            <Clock className="w-3 h-3 inline mr-1" />
                            時間推斷：
                          </span>{" "}
                          {item.time_reasoning}
                          {item.time_confidence !== null && item.time_confidence !== undefined && (
                            <span
                              className={`ml-2 cursor-help ${
                                item.time_confidence >= 0.8 ? "text-green-400/70" :
                                item.time_confidence >= 0.5 ? "text-blue-400/70" :
                                "text-orange-400/70"
                              }`}
                              title={`AI 時間推斷信心度：${Math.round(item.time_confidence * 100)}%\n\n此功能正在開發中\n${item.time_confidence < 0.6 ? '信心度較低，建議手動確認截止日期' : '系統根據 Milestone 與任務語意自動推斷'}`}
                            >
                              (信心 {Math.round(item.time_confidence * 100)}%)
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          )}

          {/* 處理結果顯示 - 標籤調整（對話框樣式）*/}
          {showResults && adjustmentResult && (
            <div className="max-h-80 overflow-y-auto border-b border-white/10 bg-gradient-to-b from-emerald-900/10 to-teal-900/10">
            <div className="p-4 space-y-3">
              {/* 成功/失敗狀態 */}
              <div className="flex gap-2">
                <div className={`w-8 h-8 rounded-full ${
                  adjustmentResult.success
                    ? "bg-gradient-to-br from-green-500 to-emerald-600"
                    : "bg-gradient-to-br from-orange-500 to-amber-600"
                } flex items-center justify-center flex-shrink-0`}>
                  {adjustmentResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-white" />
                  ) : (
                    <ArrowRightLeft className="w-4 h-4 text-white" />
                  )}
                </div>
                <div className="flex-1">
                  <div className={`${
                    adjustmentResult.success
                      ? "bg-green-500/20 border-green-500/30"
                      : "bg-orange-500/20 border-orange-500/30"
                  } border rounded-2xl rounded-tl-sm p-3`}>
                    <p className={`text-xs mb-1 font-medium ${
                      adjustmentResult.success ? "text-green-300" : "text-orange-300"
                    }`}>
                      {adjustmentResult.success ? "✅ 調整完成" : "⚠️ 無法執行"}
                    </p>
                    <p className="text-sm text-white/90">{adjustmentResult.reasoning}</p>
                    {adjustmentResult.message && (
                      <p className="text-xs text-white/60 mt-2 italic">{adjustmentResult.message}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* 執行的操作（對話氣泡）*/}
              {adjustmentResult.operations && adjustmentResult.operations.length > 0 && (
                <div className="flex gap-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center flex-shrink-0">
                    <ArrowRightLeft className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="bg-teal-500/20 border border-teal-500/30 rounded-2xl rounded-tl-sm p-3">
                      <p className="text-xs text-teal-300 mb-2 font-medium">執行的調整</p>
                      <div className="space-y-1.5">
                        {adjustmentResult.operations.map((op, idx) => (
                          <p key={idx} className="text-xs text-white/80 leading-relaxed whitespace-pre-line">
                            {op}
                          </p>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 變更統計 */}
              {adjustmentResult.changes && (
                <div className="flex gap-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-emerald-600 flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="bg-indigo-500/20 border border-indigo-500/30 rounded-2xl rounded-tl-sm p-3">
                      <p className="text-xs text-indigo-300 mb-2 font-medium">變更統計</p>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-white/50">移動任務：</span>
                        <span className="text-white font-bold">{adjustmentResult.changes.moved} 個</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          )}

          {/* 處理中動畫 - 快速記錄 */}
          {isProcessing && (
            <div className="p-4 border-b border-white/10 bg-gradient-to-r from-purple-900/20 to-indigo-900/20">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
                <div className="absolute inset-0 w-5 h-5 bg-indigo-500/20 rounded-full animate-ping" />
              </div>
              <div>
                <p className="text-sm text-white">AI 正在歸檔...</p>
                <p className="text-xs text-white/50">分析內容、歸類標籤、推斷時間</p>
              </div>
            </div>
          </div>
          )}

          {/* 輸入區域 */}
          <div className="p-3">
          <div className="relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onCompositionStart={() => setIsComposing(true)}
              onCompositionEnd={() => {
                // 延遲設置以確保 keydown 事件先處理完
                setTimeout(() => setIsComposing(false), 0);
              }}
              placeholder="輸入任何想法... 用 @ 快速指定專案"
              disabled={isProcessing}
              rows={3}
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/30 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all disabled:opacity-50"
            />

          </div>

          {/* Sub-items 使用提示 */}
          <div className="mt-2 px-2 py-1.5 rounded-md bg-blue-500/10 border border-blue-500/20">
            <p className="text-xs text-blue-300/90 flex items-center gap-1.5">
              <CheckCircle2 className="w-3 h-3 shrink-0" />
              <span>
                <strong>清單模式</strong>：使用 <code className="px-1 py-0.5 rounded bg-white/10">1)</code>, <code className="px-1 py-0.5 rounded bg-white/10">-</code>, <code className="px-1 py-0.5 rounded bg-white/10">•</code> 標記可自動拆分為待辦事項
              </span>
            </p>
          </div>

          <div className="flex items-center justify-end mt-2 gap-2">
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={!input.trim() || isProcessing}
              className="bg-gradient-to-r from-indigo-600 to-indigo-600 hover:from-indigo-500 hover:to-indigo-500 text-white"
            >
              {isProcessing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Send className="w-4 h-4 mr-1" />
                  送出
                </>
              )}
            </Button>
          </div>
        </div>
        </div>
      </div>
    </>
  );
}
