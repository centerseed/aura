'use client'

import { useState, useEffect } from 'react'
import { AlertTriangle, ChevronDown, ChevronUp, TrendingDown } from 'lucide-react'
import { auth } from '@/lib/firebase'
import { API_BASE_URL } from '@/lib/api-client'

type Priority = 'P0' | 'P1' | 'P2' | 'P3'

interface ProductFocusData {
  id: string
  name: string
  priority: Priority
  completed_count: number
  last_active_at: string | null
  is_stagnant: boolean
}

interface FocusBiasData {
  period_days: number
  products: ProductFocusData[]
  focus_drift_detected: boolean
  drift_summary: {
    low_priority_completed_ratio: number
    stagnant_high_priority_products: ProductFocusData[]
  }
}

const PRIORITY_COLOR: Record<Priority, string> = {
  P0: 'bg-orange-500',
  P1: 'bg-blue-500',
  P2: 'bg-slate-400',
  P3: 'bg-gray-400',
}

const PRIORITY_TEXT: Record<Priority, string> = {
  P0: 'text-orange-400',
  P1: 'text-blue-400',
  P2: 'text-slate-400',
  P3: 'text-gray-400',
}

interface FocusBiasPanelProps {
  onPriorityUpgrade?: (productId: string) => void
}

export function FocusBiasPanel({ onPriorityUpgrade }: FocusBiasPanelProps) {
  const [data, setData] = useState<FocusBiasData | null>(null)
  const [collapsed, setCollapsed] = useState(true)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchFocusBias()
  }, [])

  async function fetchFocusBias() {
    try {
      const user = auth.currentUser
      if (!user) return
      const token = await user.getIdToken()
      const res = await fetch(`${API_BASE_URL}/api/coach/focus-bias?days=7`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const json = await res.json()
        setData(json.data)
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }

  if (loading || !data) return null

  // Only show if there are products with meaningful data
  const hasProducts = data.products.length > 0
  if (!hasProducts) return null

  // Sort by priority then completed count desc
  const priorityOrder: Record<Priority, number> = { P0: 0, P1: 1, P2: 2, P3: 3 }
  const sortedProducts = [...data.products].sort(
    (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority] || b.completed_count - a.completed_count
  )

  const maxCount = Math.max(...sortedProducts.map(p => p.completed_count), 1)

  return (
    <div className="mb-6 rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          <TrendingDown className="w-4 h-4 text-white/50" />
          <span className="text-sm font-medium text-white/70">焦點追蹤 — 過去 7 天</span>
          {data.focus_drift_detected && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-500/20 border border-orange-500/30 text-orange-400 text-xs">
              <AlertTriangle className="w-3 h-3" />
              焦點偏移
            </span>
          )}
        </div>
        {collapsed ? (
          <ChevronDown className="w-4 h-4 text-white/40" />
        ) : (
          <ChevronUp className="w-4 h-4 text-white/40" />
        )}
      </button>

      {!collapsed && (
        <div className="px-4 pb-4">
          {/* Focus Drift Warning */}
          {data.focus_drift_detected && (
            <div className="mb-3 p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
              <p className="text-sm text-orange-300">
                <span className="font-medium">焦點偏移偵測：</span>
                過去 7 天 {Math.round(data.drift_summary.low_priority_completed_ratio * 100)}% 完成任務集中在 P2/P3，
                但 {data.drift_summary.stagnant_high_priority_products.map(p => p.name).join('、')} 停滯超過 5 天。
              </p>
            </div>
          )}

          {/* Product bars */}
          <div className="space-y-2">
            {sortedProducts.map((product) => (
              <div key={product.id} className="flex items-center gap-3">
                <span className={`w-7 text-center px-1 py-0.5 rounded text-xs font-bold ${
                  product.priority === 'P0' ? 'bg-orange-500 text-white' :
                  product.priority === 'P1' ? 'bg-blue-500 text-white' :
                  product.priority === 'P2' ? 'bg-slate-400 text-white' :
                  'bg-gray-300 text-gray-600'
                }`}>
                  {product.priority}
                </span>
                <span className="w-32 text-xs text-white/70 truncate" title={product.name}>
                  {product.name}
                </span>
                <div className="flex-1 bg-white/5 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${PRIORITY_COLOR[product.priority]}`}
                    style={{ width: `${(product.completed_count / maxCount) * 100}%` }}
                  />
                </div>
                <span className="w-6 text-right text-xs text-white/50">
                  {product.completed_count}
                </span>
                {product.is_stagnant && (
                  <span className="text-xs text-orange-400" title="P0 停滯 >5 天">⚠</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
