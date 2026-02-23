"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { X, Sparkles, Layers, TrendingDown, Plus, ChevronDown, ArrowRight, Merge } from "lucide-react";

interface TopicCluster {
  topic_name: string;
  task_ids: string[];
}

interface TaskConsolidation {
  parent_task_id: string;
  sub_task_ids: string[];
  consolidated_title: string;
  reasoning: string;
}

interface TaskContext {
  id: string;
  title: string;
  current_topic: string;
  current_due_date: string | null;
  c_role?: 'p' | 's'; // p=parent, s=sub
  pending_sub_items?: Array<{ id: string; content: string }>;
  completed_sub_items?: Array<{ id: string; content: string }>;
}

type TopicOperation =
  | { action: "keep"; topic_name: string }
  | { action: "rename"; old_name: string; new_name: string; reasoning: string }
  | { action: "merge"; source_names: string[]; target_name: string; reasoning: string };

interface ReorganizeProposal {
  product_id: string;
  product_name: string;
  current_topics: string[];
  current_topic_count?: number;
  topic_operations?: TopicOperation[];
  proposed_clusters: TopicCluster[];
  task_consolidations?: TaskConsolidation[];
  tasks_context?: TaskContext[];
  logId?: string;
}

interface ReorganizeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (options: { applyTopicOps: boolean; applyConsolidations: boolean }) => void;
  proposal: ReorganizeProposal | null;
  isApplying?: boolean;
}

// 流動資料
interface TopicFlow {
  fromTopic: string;
  toTopic: string;
  taskCount: number;
  isNew: boolean;
  isSame: boolean;
}

export function ReorganizeModal({
  isOpen,
  onClose,
  onApply,
  proposal,
  isApplying = false
}: ReorganizeModalProps) {

  const [applyTopicOps, setApplyTopicOps] = useState(true);
  const [applyConsolidations, setApplyConsolidations] = useState(true);

  // Topic operations 過濾（只顯示 rename 和 merge）
  const visibleTopicOps = useMemo(() => {
    if (!proposal?.topic_operations) return [];
    return proposal.topic_operations.filter(op => op.action !== "keep");
  }, [proposal?.topic_operations]);

  // 建立 task id -> context 的映射
  const taskContextMap = useMemo(() => {
    if (!proposal?.tasks_context) return new Map<string, TaskContext>();
    return new Map(proposal.tasks_context.map(t => [t.id, t]));
  }, [proposal?.tasks_context]);

  // 計算流動資料
  const flowData = useMemo(() => {
    if (!proposal?.tasks_context || !proposal?.proposed_clusters) {
      return { flows: [], currentTopicStats: new Map(), newTopicStats: new Map() };
    }

    // 建立 taskId -> newTopic 的映射
    const taskToNewTopic = new Map<string, string>();
    proposal.proposed_clusters.forEach(cluster => {
      cluster.task_ids.forEach(id => {
        taskToNewTopic.set(id, cluster.topic_name);
      });
    });

    // 統計每個流動
    const flowMap = new Map<string, { from: string; to: string; count: number }>();
    proposal.tasks_context.forEach(task => {
      const newTopic = taskToNewTopic.get(task.id) || "未分類";
      const key = `${task.current_topic}|${newTopic}`;
      const existing = flowMap.get(key);
      if (existing) {
        existing.count++;
      } else {
        flowMap.set(key, { from: task.current_topic, to: newTopic, count: 1 });
      }
    });

    // 計算原本的 Topic 統計
    const currentTopicStats = new Map<string, number>();
    proposal.tasks_context.forEach(task => {
      currentTopicStats.set(task.current_topic, (currentTopicStats.get(task.current_topic) || 0) + 1);
    });

    // 計算新的 Topic 統計
    const newTopicStats = new Map<string, number>();
    proposal.proposed_clusters.forEach(cluster => {
      newTopicStats.set(cluster.topic_name, cluster.task_ids.length);
    });

    // 轉換成流動陣列
    const flows: TopicFlow[] = Array.from(flowMap.values()).map(f => ({
      fromTopic: f.from,
      toTopic: f.to,
      taskCount: f.count,
      isNew: !currentTopicStats.has(f.to),
      isSame: f.from === f.to
    }));

    // 按照 fromTopic 排序
    flows.sort((a, b) => a.fromTopic.localeCompare(b.fromTopic));

    return { flows, currentTopicStats, newTopicStats };
  }, [proposal?.tasks_context, proposal?.proposed_clusters]);

  // 計算新增的 Topics
  const newTopics = useMemo(() => {
    if (!proposal) return [];
    const currentTopicsSet = new Set(proposal.current_topics);
    return proposal.proposed_clusters
      .map(c => c.topic_name)
      .filter(name => !currentTopicsSet.has(name));
  }, [proposal?.current_topics, proposal?.proposed_clusters]);

  if (!isOpen || !proposal) return null;

  const currentTopicCount = proposal.current_topic_count ?? proposal.current_topics.length;
  const newTopicCount = proposal.proposed_clusters.length;
  const totalTasks = proposal.tasks_context?.length || 0;
  const hasConsolidations = proposal.task_consolidations && proposal.task_consolidations.length > 0;
  const topicDiff = newTopicCount - currentTopicCount;

  // 計算有變動的流動數
  const changedFlows = flowData.flows.filter(f => !f.isSame);
  const unchangedCount = flowData.flows.filter(f => f.isSame).reduce((acc, f) => acc + f.taskCount, 0);
  const changedCount = totalTasks - unchangedCount;

  // 判斷是否有實質性變化
  const hasNoChanges = topicDiff === 0 && !hasConsolidations && changedCount === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal Card */}
      <Card className="relative w-[calc(100vw-2rem)] md:max-w-2xl max-h-[85vh] overflow-hidden bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 md:px-6 py-4 border-b border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900">
          <div className="flex-1">
            <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900 dark:text-white">
              <Sparkles className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
              AI 重組建議
            </h2>
            {/* 變化摘要 */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm">
              {/* Topic 數量變化 - 強調減少的正面效果 */}
              {topicDiff < 0 && (
                <div className="flex items-center gap-2 text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-500/10 px-3 py-1.5 rounded-lg">
                  <TrendingDown className="w-4 h-4" />
                  <span className="font-medium">
                    ✨ 太棒了！從 {currentTopicCount} 個主題簡化為 {newTopicCount} 個
                  </span>
                </div>
              )}
              {topicDiff === 0 && (
                <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                  <span className="font-medium">維持 {currentTopicCount} 個主題</span>
                </div>
              )}
              {topicDiff >= 1 && (
                <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                  <Plus className="w-4 h-4" />
                  <span className="font-medium">新增了 {topicDiff} 個主題</span>
                </div>
              )}

              {/* 任務整合數量 */}
              {hasConsolidations && (
                <div className="flex items-center gap-1.5 text-indigo-500 dark:text-indigo-400/80">
                  <Layers className="w-3.5 h-3.5" />
                  <span>{proposal.task_consolidations!.length} 組整合</span>
                </div>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 dark:text-white/60 hover:text-slate-600 dark:hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body - Scrollable */}
        <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4 space-y-5">
          {/* 當 AI 判定不需要調整時的訊息 */}
          {hasNoChanges && visibleTopicOps.length === 0 && (
            <div className="rounded-lg bg-gradient-to-br from-green-50 to-white dark:from-green-950/40 dark:to-slate-900/40 border border-green-300 dark:border-green-500/30 p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-500/20 flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <div className="flex-1">
                  <div className="text-base font-semibold text-green-800 dark:text-green-200 mb-1">
                    目前的主題組織已經很合理
                  </div>
                  <div className="text-sm text-green-600 dark:text-green-300/70">
                    AI 分析後認為現有的 {currentTopicCount} 個主題和任務分布都很清晰，不需要進行調整。
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========== Section 1: 分類重組（topic ops + cluster 分配） ========== */}
          {(!hasNoChanges || visibleTopicOps.length > 0) && (
            <div className={`rounded-xl border ${applyTopicOps ? 'border-indigo-300 dark:border-indigo-500/30' : 'border-slate-200 dark:border-white/10 opacity-50'} overflow-hidden transition-all`}>
              {/* Section Header = Checkbox */}
              <label className="flex items-center gap-3 px-4 py-3 cursor-pointer bg-indigo-50 dark:bg-indigo-500/10 border-b border-indigo-200 dark:border-indigo-500/20">
                <input
                  type="checkbox"
                  checked={applyTopicOps}
                  onChange={(e) => setApplyTopicOps(e.target.checked)}
                  className="w-4 h-4 rounded border-indigo-400 dark:border-indigo-500 text-indigo-600 focus:ring-indigo-500"
                />
                <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span className="font-semibold text-indigo-900 dark:text-indigo-200">
                  主題重組
                </span>
                <span className="text-sm text-indigo-600 dark:text-indigo-300/70">
                  {currentTopicCount} → {newTopicCount} 個主題
                  {changedCount > 0 && `，${changedCount} 個任務移動`}
                </span>
              </label>

              <div className="px-4 py-3 space-y-4">
                {/* Topic operations（rename / merge） */}
                {visibleTopicOps.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-amber-700 dark:text-amber-300/80 uppercase tracking-wider">
                      主題整理
                    </div>
                    {visibleTopicOps.map((op, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-sm py-1.5">
                        {op.action === "rename" ? (
                          <>
                            <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 flex-shrink-0 mt-0.5">改名</span>
                            <span className="line-through text-slate-400 dark:text-white/40">{op.old_name}</span>
                            <ArrowRight className="w-3.5 h-3.5 text-slate-400 dark:text-white/40 flex-shrink-0 mt-0.5" />
                            <span className="font-medium text-slate-900 dark:text-white">{op.new_name}</span>
                            <span className="text-xs text-slate-400 dark:text-white/40 ml-auto flex-shrink-0">{op.reasoning}</span>
                          </>
                        ) : op.action === "merge" ? (
                          <>
                            <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 flex-shrink-0 mt-0.5">合併</span>
                            <div className="flex flex-wrap items-center gap-1 min-w-0">
                              {op.source_names.map((name, i) => (
                                <span key={i} className="text-slate-500 dark:text-white/60">
                                  {name}{i < op.source_names.length - 1 ? ' +' : ''}
                                </span>
                              ))}
                              <ArrowRight className="w-3.5 h-3.5 text-slate-400 dark:text-white/40 flex-shrink-0" />
                              <span className="font-medium text-slate-900 dark:text-white">{op.target_name}</span>
                            </div>
                            <span className="text-xs text-slate-400 dark:text-white/40 ml-auto flex-shrink-0">{op.reasoning}</span>
                          </>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}

                {/* Cluster 分配 */}
                <div className="space-y-2">
                  {visibleTopicOps.length > 0 && (
                    <div className="text-xs font-medium text-indigo-700 dark:text-indigo-300/80 uppercase tracking-wider">
                      任務分配
                    </div>
                  )}
                  {proposal.proposed_clusters.map((cluster, idx) => {
                    const tasksInCluster = cluster.task_ids.map(id => {
                      const context = taskContextMap.get(id);
                      const currentTopic = context?.current_topic || "未分類";
                      const isMoved = context && currentTopic !== cluster.topic_name;
                      const isFromUncategorized = currentTopic === "未分類";
                      return {
                        id,
                        title: context?.title || id,
                        fromTopic: currentTopic,
                        isMoved,
                        isFromUncategorized,
                      };
                    });
                    const isNew = !proposal.current_topics.includes(cluster.topic_name);
                    const movedTasks = tasksInCluster.filter(t => t.isMoved);

                    return (
                      <div key={idx} className="rounded-lg border border-slate-100 dark:border-white/5 overflow-hidden">
                        {/* Cluster header */}
                        <div className={`flex items-center gap-2 px-3 py-2 ${isNew ? 'bg-indigo-50 dark:bg-indigo-500/10' : 'bg-slate-50 dark:bg-white/[0.03]'}`}>
                          <span className="text-sm font-medium text-slate-900 dark:text-white">
                            {cluster.topic_name}
                          </span>
                          {isNew && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300">新</span>
                          )}
                          <span className="text-xs text-slate-400 dark:text-white/40 ml-auto">
                            {cluster.task_ids.length} 個任務
                          </span>
                        </div>
                        {/* Task list */}
                        <div className="px-3 py-2 space-y-1">
                          {tasksInCluster.map(task => (
                            <div key={task.id} className="flex items-start gap-2 text-xs py-0.5">
                              <span className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${task.isMoved && !task.isFromUncategorized ? 'bg-amber-500' : 'bg-slate-300 dark:bg-white/30'}`} />
                              <div className="min-w-0 flex-1">
                                <span className={`${task.isMoved && !task.isFromUncategorized ? 'text-amber-700 dark:text-amber-300' : 'text-slate-600 dark:text-white/70'}`}>
                                  {task.title}
                                </span>
                                {task.isMoved && !task.isFromUncategorized && (
                                  <span className="ml-2 text-slate-400 dark:text-white/30">
                                    從「{task.fromTopic}」移入
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ========== Section 3: 任務整合 ========== */}
          {hasConsolidations && (
            <div className={`rounded-xl border ${applyConsolidations ? 'border-blue-200 dark:border-blue-500/20 bg-blue-50/30 dark:bg-blue-950/10' : 'border-slate-200 dark:border-white/10 opacity-50'} overflow-hidden transition-all`}>
              {/* Section Header = Checkbox */}
              <label className="flex items-center gap-3 px-4 py-3 cursor-pointer bg-blue-50 dark:bg-blue-500/10 border-b border-blue-200 dark:border-blue-500/20">
                <input
                  type="checkbox"
                  checked={applyConsolidations}
                  onChange={(e) => setApplyConsolidations(e.target.checked)}
                  className="w-4 h-4 rounded border-blue-400 dark:border-blue-500 text-blue-600 focus:ring-blue-500"
                />
                <Layers className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span className="font-semibold text-blue-900 dark:text-blue-200">
                  任務整合
                </span>
                <span className="text-sm text-blue-600 dark:text-blue-300/70">
                  {proposal.task_consolidations!.length} 組細碎任務合併
                </span>
              </label>

              {/* Consolidation Items */}
              <div className="divide-y divide-blue-100 dark:divide-blue-500/10">
                {proposal.task_consolidations!.map((consolidation, idx) => {
                  const parentTask = taskContextMap.get(consolidation.parent_task_id);
                  const subTasks = consolidation.sub_task_ids.map(id => taskContextMap.get(id)).filter(Boolean);

                  return (
                    <div key={idx} className="px-4 py-3 space-y-2">
                      {/* 整合結果標題 */}
                      <div className="flex items-start gap-2">
                        <div className="font-medium text-sm text-blue-900 dark:text-blue-100">
                          {consolidation.consolidated_title}
                        </div>
                        <span className="text-xs text-blue-500 dark:text-blue-300/60 flex-shrink-0 mt-0.5">
                          {consolidation.reasoning}
                        </span>
                      </div>

                      {/* 被整合的任務列表 */}
                      <div className="ml-2 space-y-1 border-l-2 border-blue-200 dark:border-blue-500/20 pl-3">
                        <div className="text-xs text-slate-600 dark:text-white/70 flex items-center gap-1.5">
                          <span className="text-[10px] px-1 py-0.5 rounded bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300">主</span>
                          {parentTask?.title || consolidation.parent_task_id}
                        </div>
                        {subTasks.map((task, subIdx) => (
                          <div key={subIdx} className="text-xs text-slate-500 dark:text-white/50 flex items-center gap-1.5">
                            <span className="text-[10px] px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-700/50 text-slate-500 dark:text-white/50">子</span>
                            {task?.title || consolidation.sub_task_ids[subIdx]}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer - 簡潔 */}
        <div className="flex items-center justify-end gap-3 px-4 md:px-6 py-4 border-t border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isApplying}
            className="border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-700/50 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-white/90 hover:text-slate-900 dark:hover:text-white"
          >
            取消
          </Button>
          {(!hasNoChanges || visibleTopicOps.length > 0) && (
            <Button
              onClick={() => onApply({ applyTopicOps, applyConsolidations })}
              disabled={isApplying || (!applyTopicOps && !applyConsolidations)}
              variant="cta"
            >
              {isApplying ? "應用中..." : "套用勾選項目"}
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
