/**
 * DashboardHeader - Dashboard 頂部標題欄
 *
 * 顯示標題、視圖切換和設定按鈕
 */

'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Settings, LayoutGrid, Clock, Target } from 'lucide-react'
import type { ViewMode } from '../context/types'

interface DashboardHeaderProps {
  userName: string
  minimal?: boolean
  viewMode?: ViewMode
  onViewModeChange?: (mode: ViewMode) => void
  children?: React.ReactNode
}

/**
 * 視圖模式配置
 */
const VIEW_MODES: { mode: ViewMode; icon: typeof LayoutGrid; label: string }[] = [
  { mode: 'structure', icon: LayoutGrid, label: '結構視圖' },
  { mode: 'timeline', icon: Clock, label: '時間視圖' },
  { mode: 'load', icon: Target, label: '負載視圖' },
]

export function DashboardHeader({ userName, minimal, viewMode, onViewModeChange, children }: DashboardHeaderProps) {
  const router = useRouter()

  return (
    <header className="sticky top-0 z-50 bg-slate-900 border-b border-white/10">
      <div className="max-w-[1600px] mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo and Title */}
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold bg-gradient-to-r from-white via-white to-white/50 bg-clip-text text-transparent">
            Zentropy
          </h1>
          {!minimal && userName && (
            <>
              <span className="text-sm text-white/40">|</span>
              <span className="text-sm text-white/60">{userName}</span>
            </>
          )}
        </div>

        {/* Right side: view toggle + extra children + settings */}
        <div className="flex items-center gap-2">
          {!minimal && viewMode && onViewModeChange && (
            <div className="flex bg-white/5 rounded-lg p-1">
              {VIEW_MODES.map(({ mode, icon: Icon, label }) => (
                <button
                  key={mode}
                  onClick={() => onViewModeChange(mode)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
                    viewMode === mode
                      ? 'bg-blue-500 text-white'
                      : 'text-white/60 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </div>
          )}

          {children}

          {/* Settings Button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/settings')}
            className="text-white/60 hover:text-white hover:bg-white/10"
          >
            <Settings className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </header>
  )
}
