/**
 * DashboardSidebar - Dashboard 側邊欄
 *
 * 包含身分地圖、Area 列表、里程碑列表等
 */

'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  FolderOpen,
  Package,
  Plus,
  ChevronDown,
  ChevronRight,
  Edit2,
  Archive,
} from 'lucide-react'
import type { Milestone } from '@/types'
import type { ApiArea, DashboardStats } from '../context/types'
import { DRAWER_CONFIG } from '@/domain/constants/drawer-config'
import { MilestoneList } from '@/components/milestone-list'

export interface DashboardSidebarProps {
  areas: ApiArea[]
  milestones: Milestone[]
  stats: DashboardStats
  selectedArea: string | null
  expandedAreas: Set<string>
  showArchive: boolean
  recentArchivedTasksCount: number
  isLoadingArchived: boolean
  archivedLoaded: boolean
  // Handlers
  onSelectArea: (areaName: string | null) => void
  onToggleArea: (areaName: string) => void
  onEditArea: (area: { id: string; name: string; scope?: string | null; description?: string | null }) => void
  onAddArea: () => void
  onToggleShowArchive: () => void
  onEditMilestone: (milestone: Milestone) => void
  onDeleteMilestone: (milestoneId: string) => void
}

export function DashboardSidebar({
  areas,
  milestones,
  stats,
  selectedArea,
  expandedAreas,
  showArchive,
  recentArchivedTasksCount,
  isLoadingArchived,
  archivedLoaded,
  onSelectArea,
  onToggleArea,
  onEditArea,
  onAddArea,
  onToggleShowArchive,
  onEditMilestone,
  onDeleteMilestone,
}: DashboardSidebarProps) {
  return (
    <aside className="w-72 shrink-0 h-[calc(100vh-136px)] sticky top-24 flex flex-col overflow-y-auto">
      <Card className="bg-white/5 border-white/10 backdrop-blur-xl shadow-xl shrink-0">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-white/50 uppercase tracking-wider">
              身分地圖
            </CardTitle>
            <Button
              onClick={onAddArea}
              size="sm"
              className="h-7 px-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs"
            >
              <Plus className="w-3 h-3 mr-1" />
              新增
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-1">
          {/* All Items */}
          <button
            onClick={() => onSelectArea(null)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
              selectedArea === null
                ? 'bg-indigo-500/20 text-indigo-300'
                : 'hover:bg-white/10 text-white/60'
            }`}
          >
            <Package className="w-4 h-4" />
            <span className="font-medium">所有項目</span>
            <span className="ml-auto text-xs bg-white/10 px-2 py-0.5 rounded-full">
              {stats.total}
            </span>
          </button>

          <div className="h-px bg-white/10 my-3" />

          {/* Areas */}
          {areas.map((area) => {
            const isExpanded = expandedAreas.has(area.name)
            const taskCount = area.products.reduce(
              (sum, p) => sum + p.tasks.filter((t) => showArchive || t.drawer !== 'ARCHIVE').length,
              0
            )

            return (
              <div key={area.id} className="group">
                <div className="relative flex items-center">
                  <button
                    onClick={() => {
                      onToggleArea(area.name)
                      onSelectArea(area.name)
                    }}
                    className={`flex-1 flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                      selectedArea === area.name
                        ? 'bg-indigo-500/20 text-indigo-300'
                        : 'hover:bg-white/10 text-white/60'
                    }`}
                  >
                    {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    <FolderOpen className="w-4 h-4" />
                    <span className="font-medium">{area.name}</span>
                    <span className="ml-auto text-xs bg-white/10 px-2 py-0.5 rounded-full">
                      {taskCount}
                    </span>
                  </button>

                  {/* Edit Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onEditArea({
                        id: area.id,
                        name: area.name,
                        scope: area.scope,
                        description: area.description,
                      })
                    }}
                    className="absolute right-1 opacity-0 group-hover:opacity-100 p-1.5 rounded-md hover:bg-white/20 text-white/50 hover:text-white transition-all"
                    title="編輯身分"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {isExpanded && (
                  <div className="ml-8 mt-1 space-y-1">
                    {area.products.length > 0 ? (
                      area.products.map((product) => {
                        const productTaskCount = product.tasks.filter(
                          (t) => showArchive || t.drawer !== 'ARCHIVE'
                        ).length
                        return (
                          <div
                            key={product.id}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-white/40"
                          >
                            <Package className="w-3.5 h-3.5" />
                            <span>{product.name}</span>
                            <span className="ml-auto text-xs">{productTaskCount}</span>
                          </div>
                        )
                      })
                    ) : (
                      <div className="px-3 py-2 text-xs text-white/30 italic">
                        尚無專案，點擊右側查看此身分
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}

          {areas.length === 0 && (
            <div className="text-center py-8 text-white/30">
              <FolderOpen className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">尚無身分資料</p>
              <p className="text-xs mt-1">使用「腦內風暴」開始</p>
            </div>
          )}
        </CardContent>

        {/* Legend */}
        <div className="px-6 pb-4 pt-2 border-t border-white/10">
          <p className="text-xs text-white/40 mb-2 font-medium">狀態圖例</p>
          <div className="grid grid-cols-2 gap-1 mb-3">
            {Object.entries(DRAWER_CONFIG)
              .slice(0, 4)
              .map(([key, config]) => (
                <div key={key} className="flex items-center gap-1.5 text-xs text-white/50">
                  <div className={`w-2 h-2 rounded-full ${config.dotColor}`} />
                  <span>{config.label}</span>
                </div>
              ))}
          </div>

          {/* Show Archive Toggle */}
          <button
            onClick={onToggleShowArchive}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-all ${
              showArchive
                ? 'bg-green-500/20 text-green-300'
                : 'bg-white/5 text-white/50 hover:bg-white/10'
            }`}
          >
            <div className="flex items-center gap-2">
              <Archive className="w-3.5 h-3.5" />
              <span className="text-xs font-medium">近兩週完成</span>
            </div>
            <span className="text-xs bg-white/10 px-1.5 py-0.5 rounded-full">
              {isLoadingArchived ? '...' : archivedLoaded ? recentArchivedTasksCount : '?'}
            </span>
          </button>
        </div>
      </Card>

      {/* Milestone List */}
      <div className="mt-4">
        <MilestoneList
          milestones={milestones}
          onEdit={onEditMilestone}
          onDelete={onDeleteMilestone}
        />
      </div>
    </aside>
  )
}
