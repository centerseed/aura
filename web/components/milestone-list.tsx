"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Target, Calendar, Edit2, Trash2, ChevronRight } from "lucide-react";
import type { Milestone } from "@/types";

interface MilestoneListProps {
  milestones: Milestone[];
  onEdit: (milestone: Milestone) => void;
  onDelete: (milestoneId: string) => void;
}

// 狀態顏色配置
const STATUS_COLORS: Record<string, string> = {
  planned: "text-gray-400 bg-gray-500/10",
  in_progress: "text-blue-400 bg-blue-500/10",
  completed: "text-green-400 bg-green-500/10",
  delayed: "text-orange-400 bg-orange-500/10",
  cancelled: "text-red-400 bg-red-500/10",
};

const STATUS_LABELS: Record<string, string> = {
  planned: "計畫中",
  in_progress: "進行中",
  completed: "已完成",
  delayed: "延遲",
  cancelled: "已取消",
};

// 計算剩餘天數
function getDaysRemaining(targetDate: string): number {
  const now = new Date();
  const target = new Date(targetDate);
  const diffMs = target.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

export function MilestoneList({ milestones, onEdit, onDelete }: MilestoneListProps) {
  // 過濾並排序：只顯示未完成、未取消、且未過期的，按日期排序
  const activeMilestones = (Array.isArray(milestones) ? milestones : [])
    .filter((m) => {
      // 排除已完成和已取消的
      if (m.status === "completed" || m.status === "cancelled") return false;

      // 排除已過期的
      const daysRemaining = getDaysRemaining(m.target_date);
      if (daysRemaining < 0) return false;

      return true;
    })
    .sort((a, b) => new Date(a.target_date).getTime() - new Date(b.target_date).getTime());

  if (activeMilestones.length === 0) {
    return (
      <Card className="bg-white/5 border-white/10 backdrop-blur-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-white/50 uppercase tracking-wider flex items-center gap-2">
            <Target className="w-4 h-4" />
            即將到來的里程碑
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-white/30">
            <Target className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">尚無里程碑</p>
            <p className="text-xs mt-1">點擊上方「設定里程碑」開始</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white/5 border-white/10 backdrop-blur-xl">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-white/50 uppercase tracking-wider flex items-center gap-2">
          <Target className="w-4 h-4" />
          即將到來的里程碑
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {activeMilestones.slice(0, 5).map((milestone) => {
          const daysRemaining = getDaysRemaining(milestone.target_date);
          const isUrgent = daysRemaining <= 7 && daysRemaining >= 0;
          const isOverdue = daysRemaining < 0;

          return (
            <div
              key={milestone.id}
              className="group p-3 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all"
            >
              {/* 里程碑名稱和狀態 */}
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-white text-sm leading-snug truncate">
                    {/* 如果有關聯的 Product,顯示專案標籤 */}
                    {milestone.product && (
                      <span className="text-blue-400 font-normal mr-1.5">
                        [{milestone.product.name}]
                      </span>
                    )}
                    {/* 如果有關聯的 Area,顯示領域標籤 */}
                    {milestone.area && !milestone.product && (
                      <span className="text-indigo-400 font-normal mr-1.5">
                        [{milestone.area.name}]
                      </span>
                    )}
                    {/* 如果有關聯的 Topic,顯示主題標籤 */}
                    {milestone.topic && !milestone.product && !milestone.area && (
                      <span className="text-green-400 font-normal mr-1.5">
                        [{milestone.topic.name}]
                      </span>
                    )}
                    {milestone.name}
                  </h4>
                  <div
                    className={`inline-flex items-center px-2 py-0.5 rounded text-xs mt-1 ${
                      STATUS_COLORS[milestone.status] || STATUS_COLORS.planned
                    }`}
                  >
                    {STATUS_LABELS[milestone.status] || milestone.status}
                  </div>
                </div>

                {/* 操作按鈕（hover 顯示）*/}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => onEdit(milestone)}
                    className="p-1.5 rounded hover:bg-white/10 transition-colors"
                    title="編輯"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-blue-400" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`確定要刪除「${milestone.name}」嗎？`)) {
                        onDelete(milestone.id);
                      }
                    }}
                    className="p-1.5 rounded hover:bg-white/10 transition-colors"
                    title="刪除"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                  </button>
                </div>
              </div>

              {/* 日期和剩餘時間 */}
              <div className="flex items-center gap-2 text-xs">
                <Calendar className="w-3 h-3 text-white/40" />
                <span className="text-white/50">
                  {new Date(milestone.target_date).toLocaleDateString("zh-TW")}
                </span>
                <span className="text-white/30">·</span>
                {isOverdue ? (
                  <span className="text-red-400 font-medium">
                    已逾期 {Math.abs(daysRemaining)} 天
                  </span>
                ) : isUrgent ? (
                  <span className="text-orange-400 font-medium">
                    剩餘 {daysRemaining} 天
                  </span>
                ) : (
                  <span className="text-white/40">
                    剩餘 {daysRemaining} 天
                  </span>
                )}
              </div>

              {/* 描述（如果有）*/}
              {milestone.description && (
                <p className="text-xs text-white/40 mt-2 line-clamp-2">
                  {milestone.description}
                </p>
              )}
            </div>
          );
        })}

        {activeMilestones.length > 5 && (
          <button className="w-full py-2 text-xs text-white/50 hover:text-white/70 transition-colors flex items-center justify-center gap-1">
            查看全部 {activeMilestones.length} 個里程碑
            <ChevronRight className="w-3 h-3" />
          </button>
        )}
      </CardContent>
    </Card>
  );
}
