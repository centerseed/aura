/**
 * Dashboard States - 載入、錯誤、歡迎狀態組件
 *
 * 處理 Dashboard 的各種狀態顯示
 */

'use client'

import { useRouter } from 'next/navigation'
import { Loader2, AlertCircle, Sparkles, Settings } from 'lucide-react'
import { QuickCapture } from '@/components/quick-capture'
import type { ApiArea } from '../context/types'

/**
 * 載入狀態
 */
export function DashboardLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-4" />
        <p className="text-white/50">載入資料中...</p>
      </div>
    </div>
  )
}

/**
 * 錯誤狀態
 */
interface DashboardErrorProps {
  error: string
}

export function DashboardError({ error }: DashboardErrorProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <p className="text-white/80 mb-2">載入失敗</p>
        <p className="text-sm text-white/50">{error}</p>
      </div>
    </div>
  )
}

/**
 * 歡迎模式（新用戶）
 */
interface DashboardWelcomeProps {
  userName: string
  userId: string | null
  areas: ApiArea[]
  onItemsCreated: () => Promise<void>
}

export function DashboardWelcome({
  userName,
  userId,
  areas,
  onItemsCreated,
}: DashboardWelcomeProps) {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      {/* Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
      </div>

      {/* Minimal Header */}
      <header className="sticky top-0 z-50 bg-slate-900/80 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-[1600px] mx-auto px-6 h-16 flex items-center justify-between">
          <h1 className="text-xl font-bold bg-gradient-to-r from-white via-white to-white/50 bg-clip-text text-transparent">
            Zentropy
          </h1>
          <button
            onClick={() => router.push('/settings')}
            className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-all"
            title="設定"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Centered Welcome Content */}
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-64px)] px-4">
        <div className="w-full max-w-xl text-center space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          {/* Welcome Message */}
          <div className="space-y-4">
            <div className="w-20 h-20 mx-auto rounded-2xl bg-cta flex items-center justify-center shadow-lg shadow-blue-500/30">
              <Sparkles className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-3xl font-bold text-white">
              嗨 {userName}！想到什麼就記下來
            </h2>
            <p className="text-lg text-white/60">AI 會自動幫你分類、整理、安排時間</p>
          </div>

          {/* Enlarged Input Area */}
          <QuickCapture
            userId={userId}
            areas={areas}
            welcomeMode={true}
            onItemsCreated={onItemsCreated}
          />

          {/* Example Suggestions */}
          <div className="space-y-3">
            <p className="text-sm text-white/40">試試看：</p>
            <div className="flex flex-wrap justify-center gap-2">
              {['下週要交報告', '買咖啡豆、洗衣精', '跟老闆討論專案進度'].map((example, i) => (
                <span
                  key={i}
                  className="px-4 py-2 rounded-full bg-white/5 border border-white/10 text-sm text-white/50"
                >
                  「{example}」
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
