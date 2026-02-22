/**
 * DashboardStats - Dashboard 統計卡片
 *
 * 顯示今日任務、進行中、已歸檔等統計數據
 */

'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Calendar, Rocket, Archive, FolderOpen, Package } from 'lucide-react'
import type { DashboardStats as Stats } from '../context/types'

interface DashboardStatsProps {
  stats: Stats
}

/**
 * 統計項目配置
 */
const STAT_ITEMS: {
  key: keyof Stats
  icon: typeof Calendar
  label: string
  color: string
}[] = [
  { key: 'total', icon: Calendar, label: '今日任務', color: 'text-amber-500' },
  { key: 'active', icon: Rocket, label: '進行中', color: 'text-blue-500' },
  { key: 'archived', icon: Archive, label: '已歸檔', color: 'text-slate-400' },
  { key: 'areas', icon: FolderOpen, label: '領域', color: 'text-green-500' },
  { key: 'products', icon: Package, label: '項目', color: 'text-blue-500' },
]

export function DashboardStats({ stats }: DashboardStatsProps) {
  return (
    <div className="grid grid-cols-5 gap-4 mb-6">
      {STAT_ITEMS.map(({ key, icon: Icon, label, color }) => (
        <Card key={key} className="bg-white/5 border-white/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg bg-white/5 ${color}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats[key]}</p>
                <p className="text-xs text-white/50">{label}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
