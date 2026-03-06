'use client'

import { useState, useEffect, useCallback } from 'react'
import { API } from '@/lib/api-client'

export interface MagicMomentData {
  detected: boolean
  stagnant_p0_products: Array<{ id: string; name: string; days_stagnant: number }>
  momentum_products: Array<{ id: string; name: string; priority: string; completed_count: number }>
}

function getDismissedKey(): string {
  const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
  return `zentropy_mm_dismissed_${today}`
}

export function useMagicMoment() {
  // 同步讀取 localStorage，避免 banner 閃爍 + 避免已 dismiss 時多餘的 API 呼叫
  const [isDismissed, setIsDismissed] = useState<boolean>(
    () => typeof window !== 'undefined' && !!localStorage.getItem(getDismissedKey())
  )
  const [data, setData] = useState<MagicMomentData | null>(null)
  const [isRefocusing, setIsRefocusing] = useState<boolean>(false)

  useEffect(() => {
    // 已 dismiss 時跳過 API 呼叫
    if (isDismissed) return
    API.coach.getMagicMoment()
      .then((result: MagicMomentData) => setData(result))
      .catch((err) => console.error('[MagicMoment] fetch error:', err))
  }, [isDismissed])

  const dismiss = useCallback(() => {
    localStorage.setItem(getDismissedKey(), '1')
    setIsDismissed(true)
  }, [])

  const refocus = useCallback(async () => {
    setIsRefocusing(true)
    try {
      await API.coach.plan.generate()
      window.dispatchEvent(new CustomEvent('plan-updated'))
    } catch (err) {
      console.error('[MagicMoment] refocus error:', err)
    } finally {
      setIsRefocusing(false)
    }
  }, [])

  return { data, isDismissed, dismiss, refocus, isRefocusing }
}
