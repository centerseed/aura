'use client'

import { Loader2, X, Zap, CheckCircle2 } from 'lucide-react'
import { useMagicMoment } from '../hooks/use-magic-moment'
import { useCallback, useEffect, useRef, useState } from 'react'

export function MagicMomentBanner() {
  const { data, isDismissed, dismiss, refocus, isRefocusing } = useMagicMoment()
  const [refocused, setRefocused] = useState(false)
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current)
    }
  }, [])

  const handleRefocus = useCallback(async () => {
    await refocus()
    setRefocused(true)
    resetTimerRef.current = setTimeout(() => setRefocused(false), 4000)
  }, [refocus])

  if (!data?.detected || isDismissed) return null

  // 選出完成數最高的爆發 Project
  const topMomentum = data.momentum_products.reduce((best, cur) =>
    cur.completed_count > best.completed_count ? cur : best
  )
  const stagnantName = data.stagnant_p0_products[0]?.name

  return (
    <div className="relative rounded-xl overflow-hidden mb-4 border border-amber-500/30">
      {/* 漸層背景 */}
      <div className="absolute inset-0 bg-gradient-to-r from-amber-500/20 via-orange-500/15 to-amber-400/10 pointer-events-none" />

      <div className="relative flex items-center gap-3 px-4 py-3">
        {/* 圖示 */}
        <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-amber-500/20 flex items-center justify-center">
          <Zap className="w-5 h-5 text-amber-400" />
        </div>

        {/* 文字 */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-amber-200">動能偵測：焦點已轉移</p>
          <p className="text-xs text-amber-200/70 mt-0.5 truncate">
            <span className="font-medium text-amber-300">{topMomentum.name}</span>
            {' '}近 7 天完成了 {topMomentum.completed_count} 項，但{' '}
            <span className="font-medium text-white/80">{stagnantName}</span>（P0）已超過 5 天無進展
          </p>
        </div>

        {/* 重新對焦按鈕 */}
        {refocused ? (
          <span className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-green-400 text-xs font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" />
            計畫已更新
          </span>
        ) : (
          <button
            onClick={handleRefocus}
            disabled={isRefocusing}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/30 hover:bg-amber-500/50 border border-amber-500/40 text-amber-200 text-xs font-medium transition-colors disabled:opacity-60"
          >
            {isRefocusing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Zap className="w-3.5 h-3.5" />
            )}
            重新對焦
          </button>
        )}

        {/* 關閉按鈕 */}
        <button
          onClick={dismiss}
          className="flex-shrink-0 p-1 rounded-md hover:bg-white/10 text-white/40 hover:text-white/70 transition-colors"
          aria-label="關閉"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
