"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { X, Sparkles, CheckCircle2, AlertCircle, Clock, Target, Layers, ArrowRight } from "lucide-react";

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

interface ReorganizeProposal {
  product_id: string;
  product_name: string;
  current_topics: string[];
  proposed_clusters: TopicCluster[];
  time_inferences: TaskTimeInference[];
  task_consolidations?: TaskConsolidation[];
  reasoning: string;
}

interface ReorganizeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: () => void;
  proposal: ReorganizeProposal | null;
  isApplying?: boolean;
}

export function ReorganizeModal({
  isOpen,
  onClose,
  onApply,
  proposal,
  isApplying = false
}: ReorganizeModalProps) {
  if (!isOpen || !proposal) return null;

  const getUrgencyColor = (level: string) => {
    switch (level) {
      case "critical": return "text-red-500 bg-red-500/10 border-red-500/20";
      case "high": return "text-orange-500 bg-orange-500/10 border-orange-500/20";
      case "medium": return "text-yellow-500 bg-yellow-500/10 border-yellow-500/20";
      case "low": return "text-blue-500 bg-blue-500/10 border-blue-500/20";
      default: return "text-slate-500 bg-slate-500/10 border-slate-500/20";
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "未設定";
    const date = new Date(dateStr);
    return date.toLocaleDateString("zh-TW", { month: "short", day: "numeric" });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal Card */}
      <Card className="relative w-full max-w-4xl max-h-[80vh] overflow-y-auto bg-slate-900 border-white/10 shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-white/10 bg-slate-900/95 backdrop-blur-sm">
          <h2 className="flex items-center gap-2 text-2xl font-bold text-white">
            <Sparkles className="w-6 h-6 text-purple-400" />
            AI 重組建議 - {proposal.product_name}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-6 px-6 py-4">
          {/* 1. 分析結果 */}
          <div className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/20">
            <h3 className="font-semibold text-purple-300 mb-2 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              分析結果
            </h3>
            <p className="text-sm text-white/70">{proposal.reasoning}</p>
          </div>

          {/* 2. 變更提醒 */}
          <div className="p-3 rounded-lg bg-slate-800 border border-white/10 text-xs text-white/60">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="w-4 h-4 text-yellow-400" />
              <span className="font-medium text-yellow-400">變更提醒</span>
            </div>
            <ul className="space-y-1 ml-6 list-disc">
              <li>將重新分配所有 Tasks 到新的 Topic 群組</li>
              <li>將更新 {proposal.time_inferences.filter(t => t.suggested_due_date).length} 個 Tasks 的截止日期</li>
              {proposal.task_consolidations && proposal.task_consolidations.length > 0 && (
                <li className="text-purple-300">
                  將整合 {proposal.task_consolidations.reduce((acc, c) => acc + c.sub_task_ids.length + 1, 0)} 個細碎 Tasks 為 {proposal.task_consolidations.length} 個帶待辦事項的主 Task
                </li>
              )}
              <li>原有的 Topics 將被保留,但 Tasks 會重新分配</li>
            </ul>
          </div>

          {/* 3. 細項整合 */}
          {proposal.task_consolidations && proposal.task_consolidations.length > 0 && (
            <div>
              <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                <Layers className="w-4 h-4" />
                細項整合 ({proposal.task_consolidations.length} 組)
              </h3>
              <div className="space-y-3">
                {proposal.task_consolidations.map((consolidation, idx) => (
                  <div key={idx} className="p-3 rounded-lg bg-gradient-to-br from-purple-900/30 to-indigo-900/30 border border-purple-500/20">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h4 className="font-medium text-purple-200">{consolidation.consolidated_title}</h4>
                        <p className="text-xs text-white/50 mt-1">{consolidation.consolidated_narrative}</p>
                      </div>
                      <span className="shrink-0 ml-2 px-2 py-0.5 rounded-full text-xs border border-purple-400/30 text-purple-300">
                        信心度 {Math.round(consolidation.confidence * 100)}%
                      </span>
                    </div>
                    <div className="text-xs text-white/40 mb-2">
                      <span className="text-purple-400">原因：</span>{consolidation.reasoning}
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-white/50">{consolidation.sub_task_ids.length + 1} 個細項</span>
                      <ArrowRight className="w-3 h-3 text-purple-400" />
                      <span className="text-purple-300">1 個主 Task + {consolidation.sub_task_ids.length} 個待辦事項</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 4. Topic 重組（簡化） */}
          <div>
            <h3 className="font-semibold text-white mb-3">📁 Topic 重組 ({proposal.proposed_clusters.length} 個群組)</h3>
            <div className="space-y-2">
              {proposal.proposed_clusters.map((cluster, idx) => (
                <div key={idx} className="p-2.5 rounded-lg bg-slate-800 border border-white/10">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-white text-sm">{cluster.topic_name}</h4>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-white/40">
                        {cluster.task_ids.length} 個 Task
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-xs border border-white/20 text-white/60">
                        {Math.round(cluster.confidence * 100)}%
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 5. 時間推斷（簡化） */}
          <div>
            <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              時間推斷 ({proposal.time_inferences.length} 個 Task)
            </h3>
            <div className="space-y-2 max-h-[250px] overflow-y-auto">
              {proposal.time_inferences.map((inference, idx) => (
                <div key={idx} className="p-2.5 rounded-lg bg-slate-800 border border-white/10 text-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-white/60 text-xs">Task {idx + 1}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs border ${getUrgencyColor(inference.urgency_level)}`}>
                        {inference.urgency_level.toUpperCase()}
                      </span>
                      {inference.inferred_from_milestone_id && (
                        <div className="flex items-center gap-1 text-xs text-purple-400">
                          <Target className="w-3 h-3" />
                          里程碑
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="font-medium text-white text-sm">
                        {formatDate(inference.suggested_due_date)}
                      </div>
                      <div className="text-xs text-white/30">
                        {Math.round(inference.time_confidence * 100)}%
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex items-center justify-end gap-3 px-6 py-4 border-t border-white/10 bg-slate-900/95 backdrop-blur-sm">
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
            className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white"
          >
            {isApplying ? "應用中..." : "應用重組"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
