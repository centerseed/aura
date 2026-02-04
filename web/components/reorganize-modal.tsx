"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { X, Sparkles, Layers, TrendingDown, Plus, ChevronDown } from "lucide-react";

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

interface ReorganizeProposal {
  product_id: string;
  product_name: string;
  current_topics: string[];
  current_topic_count?: number;
  proposed_clusters: TopicCluster[];
  task_consolidations?: TaskConsolidation[];
  tasks_context?: TaskContext[];
  logId?: string;
}

interface ReorganizeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: () => void;
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
      <Card className="relative w-[calc(100vw-2rem)] md:max-w-2xl max-h-[85vh] overflow-hidden bg-slate-900 border-white/10 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 md:px-6 py-4 border-b border-white/10 bg-slate-900">
          <div className="flex-1">
            <h2 className="flex items-center gap-2 text-xl font-bold text-white">
              <Sparkles className="w-5 h-5 text-indigo-400" />
              AI 重組建議
            </h2>
            {/* 變化摘要 */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm">
              {/* Topic 數量變化 - 強調減少的正面效果 */}
              {topicDiff < 0 && (
                <div className="flex items-center gap-2 text-green-400 bg-green-500/10 px-3 py-1.5 rounded-lg">
                  <TrendingDown className="w-4 h-4" />
                  <span className="font-medium">
                    ✨ 太棒了！從 {currentTopicCount} 個分類簡化為 {newTopicCount} 個
                  </span>
                </div>
              )}
              {topicDiff === 0 && (
                <div className="flex items-center gap-2 text-blue-400">
                  <span className="font-medium">維持 {currentTopicCount} 個分類</span>
                </div>
              )}
              {topicDiff >= 1 && (
                <div className="flex items-center gap-2 text-indigo-400">
                  <Plus className="w-4 h-4" />
                  <span className="font-medium">新增了 {topicDiff} 個分類</span>
                </div>
              )}

              {/* 任務整合數量 */}
              {hasConsolidations && (
                <div className="flex items-center gap-1.5 text-indigo-400/80">
                  <Layers className="w-3.5 h-3.5" />
                  <span>{proposal.task_consolidations!.length} 組整合</span>
                </div>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body - Scrollable */}
        <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4 space-y-4">
          {/* 當 AI 判定不需要調整時的訊息 */}
          {hasNoChanges && (
            <div className="rounded-lg bg-gradient-to-br from-green-950/40 to-slate-900/40 border border-green-500/30 p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-5 h-5 text-green-400" />
                </div>
                <div className="flex-1">
                  <div className="text-base font-semibold text-green-200 mb-1">
                    ✅ 目前的分類組織已經很合理
                  </div>
                  <div className="text-sm text-green-300/70">
                    AI 分析後認為現有的 {currentTopicCount} 個分類和任務分布都很清晰，不需要進行調整。
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 1. 任務整合建議 - 放最前面！ */}
          {hasConsolidations && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-white font-medium">
                <Layers className="w-4 h-4 text-indigo-400" />
                <span>任務整合建議</span>
                <span className="text-sm text-white/50">
                  ({proposal.task_consolidations!.length} 組)
                </span>
              </div>

              {proposal.task_consolidations!.map((consolidation, idx) => {
                // 取得主任務和子任務的標題
                const parentTask = taskContextMap.get(consolidation.parent_task_id);
                const subTasks = consolidation.sub_task_ids.map(id => taskContextMap.get(id)).filter(Boolean);

                // 計算整合後的總項目數（包含所有 sub-items）
                const parentSubItemsCount =
                  (parentTask?.pending_sub_items?.length || 0) +
                  (parentTask?.completed_sub_items?.length || 0);

                const subTasksSubItemsCount = subTasks.reduce((sum, task) =>
                  sum + (task?.pending_sub_items?.length || 0) + (task?.completed_sub_items?.length || 0), 0
                );

                const totalTasksCount = 1 + subTasks.length; // 主任務 + 子任務
                const totalItemsCount = totalTasksCount + parentSubItemsCount + subTasksSubItemsCount;

                return (
                  <div
                    key={idx}
                    className="rounded-lg bg-slate-800/50 border border-slate-700 overflow-hidden"
                  >
                    {/* 頂部：整合結果（最重要，最突出） */}
                    <div className="bg-gradient-to-br from-indigo-600/20 to-indigo-500/10 border-b border-indigo-500/30 p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-indigo-500/30 flex items-center justify-center flex-shrink-0">
                          <Layers className="w-5 h-5 text-indigo-300" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-base font-semibold text-indigo-100 mb-1">
                            {consolidation.consolidated_title}
                          </div>
                          <div className="text-sm text-indigo-300/80">
                            💡 {consolidation.reasoning}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 中間：整合流程 */}
                    <div className="p-4 space-y-3">
                      {/* 整合前：直接列出任務 */}
                      <div>
                        <div className="text-xs font-medium text-white/50 mb-2 uppercase tracking-wide">
                          將這些任務
                        </div>
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2.5 text-sm bg-slate-800/30 rounded-lg px-3 py-2 border border-slate-700/50">
                            <div className="w-1.5 h-1.5 rounded-full bg-slate-400"></div>
                            <span className="text-white/80">{parentTask?.title || consolidation.parent_task_id}</span>
                          </div>
                          {subTasks.map((task, subIdx) => (
                            <div key={subIdx} className="flex items-center gap-2.5 text-sm bg-slate-800/30 rounded-lg px-3 py-2 border border-slate-700/50">
                              <div className="w-1.5 h-1.5 rounded-full bg-slate-400"></div>
                              <span className="text-white/80">{task?.title || consolidation.sub_task_ids[subIdx]}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* 向下箭頭（醒目） */}
                      <div className="flex items-center justify-center py-1">
                        <div className="flex items-center gap-2 text-indigo-400">
                          <div className="h-px w-16 bg-gradient-to-r from-transparent via-indigo-400/50 to-transparent"></div>
                          <ChevronDown className="w-4 h-4" />
                          <div className="h-px w-16 bg-gradient-to-r from-transparent via-indigo-400/50 to-transparent"></div>
                        </div>
                      </div>

                      {/* 整合後：樹狀結構（最突出） */}
                      <div>
                        <div className="text-xs font-medium text-indigo-300 mb-2 uppercase tracking-wide">
                          整合為
                        </div>
                        <div className="bg-gradient-to-br from-indigo-950/40 to-slate-900/40 border border-indigo-500/20 rounded-lg p-4">
                          {/* 主任務（大勾選框） */}
                          <div className="flex items-start gap-3">
                            <div className="w-5 h-5 rounded border-2 border-indigo-400 flex items-center justify-center text-indigo-300 flex-shrink-0 mt-0.5">
                              <span className="text-xs">☐</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-base font-medium text-indigo-100 leading-snug">
                                {consolidation.consolidated_title}
                              </div>
                            </div>
                          </div>

                          {/* 子任務（樹狀縮排） */}
                          {subTasks.length > 0 && (
                            <div className="ml-8 mt-3 space-y-2 border-l-2 border-indigo-400/30 pl-4">
                              {subTasks.map((task, subIdx) => (
                                <div key={subIdx} className="flex items-center gap-2.5">
                                  <div className="w-3.5 h-3.5 rounded-sm border border-white/50 flex items-center justify-center text-white/50 flex-shrink-0">
                                    <span className="text-[10px]">☐</span>
                                  </div>
                                  <span className="text-sm text-white/70">{task?.title || consolidation.sub_task_ids[subIdx]}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 2. 新增的 Topics（如果有）- 折疊 */}
          {newTopics.length > 0 && (
            <details className="group rounded-lg bg-slate-800/30 border border-white/10">
              <summary className="cursor-pointer px-3 py-2 text-sm text-white/70 hover:text-white hover:bg-slate-700/30 transition-colors flex items-center gap-2">
                <ChevronDown className="w-3 h-3 transition-transform group-open:rotate-180" />
                <span>📌 新增了 {newTopics.length} 個分類</span>
              </summary>
              <div className="px-3 pb-3 pt-1 flex flex-wrap gap-2">
                {newTopics.map((topic, idx) => (
                  <span key={idx} className="px-2 py-1 rounded bg-indigo-500/20 text-indigo-300 text-xs">
                    {topic}
                  </span>
                ))}
              </div>
            </details>
          )}

          {/* 3. Topic 分群與任務分布 */}
          {proposal.proposed_clusters.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-white/70 text-sm">
                <span>📋 重組後的分類結構</span>
                {hasConsolidations && (
                  <span className="text-xs text-white/50">
                    (「主」任務會保留，「子」任務會變成待辦事項)
                  </span>
                )}
              </div>
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
                    cRole: context?.c_role
                  };
                });

                const isNew = !proposal.current_topics.includes(cluster.topic_name);

                return (
                  <div key={idx} className="rounded-lg bg-slate-800/50 border border-white/10 overflow-hidden">
                    {/* Topic Header */}
                    <div className="bg-slate-700/30 px-3 py-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white">
                          {cluster.topic_name}
                        </span>
                        {isNew && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300">
                            新
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-white/50">
                        {cluster.task_ids.length} 個任務
                      </span>
                    </div>

                    {/* Tasks List */}
                    <div className="p-3 space-y-1.5">
                      {tasksInCluster.map(task => (
                        <div
                          key={task.id}
                          className="flex items-center justify-between gap-2 text-xs"
                        >
                          <div className="flex items-center gap-1.5 truncate">
                            <span className={`truncate ${task.isMoved ? 'text-amber-300' : 'text-white/70'}`}>
                              {task.title}
                            </span>
                            {task.cRole && (
                              <span
                                className={`text-[10px] px-1 py-0.5 rounded ${
                                  task.cRole === 'p'
                                    ? 'bg-indigo-500/20 text-indigo-300'
                                    : 'bg-indigo-500/10 text-indigo-400/60'
                                }`}
                                title={task.cRole === 'p' ? '保留為主任務' : '會變成主任務的待辦事項'}
                              >
                                {task.cRole === 'p' ? '主' : '子'}
                              </span>
                            )}
                          </div>
                          {/* 只在真的從其他 topic 移動過來時才顯示來源（排除「未分類」） */}
                          {task.isMoved && !task.isFromUncategorized && (
                            <span className="text-white/30 whitespace-nowrap flex-shrink-0">
                              ← {task.fromTopic}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-4 md:px-6 py-4 border-t border-white/10 bg-slate-900">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isApplying}
            className="border-slate-600 bg-slate-700/50 hover:bg-slate-600 text-white/90 hover:text-white"
          >
            {hasNoChanges ? "關閉" : "取消"}
          </Button>
          {!hasNoChanges && (
            <Button
              onClick={onApply}
              disabled={isApplying}
              className="bg-gradient-to-r from-indigo-600 to-indigo-600 hover:from-indigo-500 hover:to-indigo-500 text-white"
            >
              {isApplying ? "應用中..." : "應用重組"}
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
