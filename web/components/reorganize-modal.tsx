"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { X, Sparkles, ChevronRight, ArrowRight, MoveRight, Layers } from "lucide-react";

interface TopicCluster {
  topic_name: string;
  description: string;
  task_ids: string[];
  confidence: number;
}

interface TaskTimeInference {
  task_id: string;
  suggested_due_date: string | null;
  inferred_from_milestone_id: string | null;
  time_confidence: number;
  urgency_level: string;
  reasoning: string;
}

interface TaskConsolidation {
  parent_task_id: string;
  sub_task_ids: string[];
  consolidated_title: string;
  consolidated_narrative: string;
  reasoning: string;
  confidence: number;
}

interface TaskContext {
  id: string;
  title: string;
  current_topic: string;
  current_due_date: string | null;
}

interface ReorganizeProposal {
  product_id: string;
  product_name: string;
  current_topics: string[];
  current_topic_count?: number;
  proposed_clusters: TopicCluster[];
  time_inferences: TaskTimeInference[];
  task_consolidations?: TaskConsolidation[];
  tasks_context?: TaskContext[];
  reasoning: string;
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
  const [showDetails, setShowDetails] = useState(false);

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

  if (!isOpen || !proposal) return null;

  const currentTopicCount = proposal.current_topic_count ?? proposal.current_topics.length;
  const newTopicCount = proposal.proposed_clusters.length;
  const totalTasks = proposal.tasks_context?.length || 0;
  const hasConsolidations = proposal.task_consolidations && proposal.task_consolidations.length > 0;

  // 計算有變動的流動數
  const changedFlows = flowData.flows.filter(f => !f.isSame);
  const unchangedCount = flowData.flows.filter(f => f.isSame).reduce((acc, f) => acc + f.taskCount, 0);
  const changedCount = totalTasks - unchangedCount;

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
              <div className="flex items-center gap-1.5 text-white/60">
                <span>Topic</span>
                <span className="font-medium text-white">{currentTopicCount}</span>
                <ArrowRight className="w-3 h-3" />
                <span className="font-medium text-indigo-400">{newTopicCount}</span>
              </div>
              {changedCount > 0 && (
                <div className="flex items-center gap-1.5 text-amber-400/80">
                  <MoveRight className="w-3.5 h-3.5" />
                  <span>{changedCount}/{totalTasks} 個任務重新分配</span>
                </div>
              )}
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
          {/* 流動圖 */}
          <div className="space-y-2">
            {/* 有變動的流動 */}
            {changedFlows.length > 0 && (
              <div className="space-y-2">
                {changedFlows.map((flow, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 p-3 rounded-lg bg-slate-800/50 border border-white/5"
                  >
                    {/* From Topic */}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-white/60 truncate">
                        {flow.fromTopic}
                      </div>
                    </div>

                    {/* Arrow with count */}
                    <div className="flex items-center gap-1.5 px-2 flex-shrink-0">
                      <span className="text-xs font-medium text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded">
                        {flow.taskCount}
                      </span>
                      <ChevronRight className="w-4 h-4 text-amber-400" />
                    </div>

                    {/* To Topic */}
                    <div className="flex-1 min-w-0 text-right">
                      <div className="text-sm font-medium text-white truncate">
                        {flow.toTopic}
                        {flow.isNew && (
                          <span className="ml-1.5 text-xs text-indigo-400">(新)</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 不變的統計 */}
            {unchangedCount > 0 && (
              <div className="text-sm text-white/40 text-center py-2">
                其餘 {unchangedCount} 個任務維持原本的分類
              </div>
            )}

            {/* 如果完全沒有變動 */}
            {changedFlows.length === 0 && (
              <div className="text-center py-8 text-white/40">
                <p>所有任務的分類維持不變</p>
                <p className="text-sm mt-1">AI 認為目前的分類已經很好了</p>
              </div>
            )}
          </div>

          {/* 整合提示 */}
          {hasConsolidations && (
            <div className="p-3 rounded-lg bg-indigo-950/30 border border-indigo-500/20">
              <div className="flex items-center gap-2 text-sm text-indigo-200">
                <Layers className="w-4 h-4" />
                <span>
                  {proposal.task_consolidations!.length} 組任務將整合為待辦清單
                </span>
              </div>
            </div>
          )}

          {/* 展開詳細 */}
          {changedFlows.length > 0 && (
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="w-full text-center text-sm text-white/50 hover:text-white/70 py-2 border-t border-white/10"
            >
              {showDetails ? "收起詳細" : "查看詳細任務"}
            </button>
          )}

          {/* 詳細任務列表 */}
          {showDetails && (
            <div className="space-y-3 pt-2">
              {proposal.proposed_clusters.map((cluster, idx) => {
                const tasksInCluster = cluster.task_ids.map(id => {
                  const context = taskContextMap.get(id);
                  return {
                    id,
                    title: context?.title || id,
                    fromTopic: context?.current_topic || "未分類",
                    isMoved: context && context.current_topic !== cluster.topic_name
                  };
                });

                return (
                  <div key={idx} className="rounded-lg bg-slate-800/30 p-3">
                    <div className="font-medium text-white text-sm mb-2">
                      {cluster.topic_name}
                      <span className="text-white/40 font-normal ml-2">
                        {cluster.task_ids.length} 個任務
                      </span>
                    </div>
                    <div className="space-y-1">
                      {tasksInCluster.map(task => (
                        <div
                          key={task.id}
                          className="flex items-center justify-between gap-2 text-xs"
                        >
                          <span className={`truncate ${task.isMoved ? 'text-amber-300' : 'text-white/50'}`}>
                            {task.title}
                          </span>
                          {task.isMoved && (
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
            取消
          </Button>
          <Button
            onClick={onApply}
            disabled={isApplying}
            className="bg-gradient-to-r from-indigo-600 to-indigo-600 hover:from-indigo-500 hover:to-indigo-500 text-white"
          >
            {isApplying ? "應用中..." : "應用重組"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
