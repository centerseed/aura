'use client'

/**
 * Calendar API 測試頁面
 * 用於測試 Free/Busy 查詢和 Event 創建功能
 */

import { useState, useEffect } from 'react'
import { getCurrentUser, getIdToken } from '@/lib/auth'
import { API_BASE_URL } from '@/lib/api-client'
import { User } from 'firebase/auth'

export default function TestCalendarPage() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [token, setToken] = useState<string>('')
  const [freeBusyResult, setFreeBusyResult] = useState<any>(null)
  const [eventResult, setEventResult] = useState<any>(null)
  const [error, setError] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  // 獲取當前用戶和 token
  useEffect(() => {
    getCurrentUser().then(currentUser => {
      setUser(currentUser)
      setLoading(false)
      if (currentUser) {
        // 初次載入時強制刷新 token，確保拿到最新的
        getIdToken(true).then(t => t && setToken(t))
      }
    })
  }, [])

  // 複製 Token 到剪貼簿（自動刷新）
  const copyToken = async () => {
    try {
      // 每次複製時都強制刷新 token，確保拿到最新的
      const freshToken = await getIdToken(true)
      if (freshToken) {
        setToken(freshToken)
        await navigator.clipboard.writeText(freshToken)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }
    } catch (err) {
      console.error('Failed to copy token:', err)
    }
  }

  // 測試 Free/Busy API
  const testFreeBusy = async () => {
    setIsLoading(true)
    setError('')
    setFreeBusyResult(null)

    try {
      // 查詢本週的空檔
      const now = new Date()
      const timeMin = new Date(now)
      timeMin.setHours(0, 0, 0, 0)

      const timeMax = new Date(now)
      timeMax.setDate(timeMax.getDate() + 7)
      timeMax.setHours(23, 59, 59, 999)

      const response = await fetch(`${API_BASE_URL}/api/calendar/free-busy`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          timeMin: timeMin.toISOString(),
          timeMax: timeMax.toISOString(),
          workingHours: { start: 9, end: 18 },
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(JSON.stringify(errorData, null, 2))
      }

      const data = await response.json()
      setFreeBusyResult(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  // 測試 Create Event API
  const testCreateEvent = async () => {
    setIsLoading(true)
    setError('')
    setEventResult(null)

    try {
      // 創建一個測試會議（明天下午 2 點）
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      tomorrow.setHours(14, 0, 0, 0)

      const endTime = new Date(tomorrow)
      endTime.setHours(15, 0, 0, 0)

      const response = await fetch(`${API_BASE_URL}/api/calendar/create-event`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          summary: '測試會議 - Zentropy Calendar Integration',
          description: '這是一個測試會議，用於驗證 Zentropy Calendar 整合功能',
          startDateTime: tomorrow.toISOString(),
          endDateTime: endTime.toISOString(),
          generateMeetLink: true,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(JSON.stringify(errorData, null, 2))
      }

      const data = await response.json()
      setEventResult(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white">載入中...</div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white">請先登入</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-900 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-8">
          📅 Calendar API 測試
        </h1>

        {/* Firebase Token */}
        <div className="mb-8 p-4 bg-slate-800 border border-slate-700 rounded-lg">
          <h3 className="text-slate-300 font-medium mb-3">🔑 Firebase Token</h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <code className="flex-1 px-3 py-2 bg-slate-900 text-slate-400 rounded text-xs font-mono overflow-x-auto">
                {token ? `${token.substring(0, 20)}...${token.substring(token.length - 20)}` : '載入中...'}
              </code>
              <button
                onClick={copyToken}
                disabled={!token}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded font-medium text-sm"
              >
                {copied ? '✅ 已複製' : '📋 複製完整 Token'}
              </button>
            </div>
            <div className="text-slate-400 text-sm space-y-2">
              <p>💡 每次點擊「複製」都會自動刷新 token，確保拿到最新的！</p>
              <p>複製後在終端執行：</p>
              <code className="block px-3 py-2 bg-slate-900 rounded text-xs">
                npm run test:calendar-crud -- --token=&quot;貼上token&quot;
              </code>
              <p className="text-xs text-slate-500">
                Token 有效期 1 小時，過期後重新複製即可
              </p>
            </div>
          </div>
        </div>

        {/* 測試按鈕 */}
        <div className="space-y-4 mb-8">
          <button
            onClick={testFreeBusy}
            disabled={isLoading || !token}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg font-medium"
          >
            {isLoading ? '測試中...' : '測試 Free/Busy API（查詢本週空檔）'}
          </button>

          <button
            onClick={testCreateEvent}
            disabled={isLoading || !token}
            className="ml-4 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-600 text-white rounded-lg font-medium"
          >
            {isLoading ? '測試中...' : '測試 Create Event API（創建測試會議）'}
          </button>
        </div>

        {/* 錯誤訊息 */}
        {error && (
          <div className="mb-8 p-4 bg-red-900/50 border border-red-500 rounded-lg">
            <h3 className="text-red-400 font-semibold mb-2">❌ 錯誤</h3>
            <pre className="text-red-300 text-sm overflow-auto">
              {error}
            </pre>
          </div>
        )}

        {/* Free/Busy 結果 */}
        {freeBusyResult && (
          <div className="mb-8 p-4 bg-slate-800 border border-slate-700 rounded-lg">
            <h3 className="text-emerald-400 font-semibold mb-4">
              ✅ Free/Busy 查詢結果
            </h3>

            <div className="space-y-4">
              <div>
                <h4 className="text-indigo-400 font-medium mb-2">
                  📅 可用時段（{freeBusyResult.data?.availableSlots?.length || 0} 個）
                </h4>
                <div className="space-y-2">
                  {freeBusyResult.data?.availableSlots?.slice(0, 5).map((slot: any, i: number) => (
                    <div key={i} className="text-slate-300 text-sm">
                      ✅ {new Date(slot.start).toLocaleString('zh-TW')} - {new Date(slot.end).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })} ({slot.durationMinutes} 分鐘)
                    </div>
                  ))}
                  {(freeBusyResult.data?.availableSlots?.length || 0) > 5 && (
                    <div className="text-slate-500 text-sm">
                      ...還有 {freeBusyResult.data.availableSlots.length - 5} 個時段
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h4 className="text-red-400 font-medium mb-2">
                  ❌ 已佔用時段（{freeBusyResult.data?.busySlots?.length || 0} 個）
                </h4>
                <div className="space-y-2">
                  {freeBusyResult.data?.busySlots?.map((slot: any, i: number) => (
                    <div key={i} className="text-slate-400 text-sm">
                      ❌ {new Date(slot.start).toLocaleString('zh-TW')} - {new Date(slot.end).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}
                      {slot.summary && ` - ${slot.summary}`}
                    </div>
                  ))}
                </div>
              </div>

              <details className="mt-4">
                <summary className="text-slate-400 cursor-pointer hover:text-slate-300">
                  查看完整 JSON
                </summary>
                <pre className="text-slate-300 text-xs overflow-auto mt-2 p-4 bg-slate-900 rounded">
                  {JSON.stringify(freeBusyResult, null, 2)}
                </pre>
              </details>
            </div>
          </div>
        )}

        {/* Event 創建結果 */}
        {eventResult && (
          <div className="mb-8 p-4 bg-slate-800 border border-slate-700 rounded-lg">
            <h3 className="text-emerald-400 font-semibold mb-4">
              ✅ 會議創建成功
            </h3>

            <div className="space-y-3">
              <div>
                <span className="text-slate-400">會議標題：</span>
                <span className="text-white ml-2">{eventResult.data?.summary}</span>
              </div>

              <div>
                <span className="text-slate-400">開始時間：</span>
                <span className="text-white ml-2">
                  {new Date(eventResult.data?.startDateTime).toLocaleString('zh-TW')}
                </span>
              </div>

              <div>
                <span className="text-slate-400">結束時間：</span>
                <span className="text-white ml-2">
                  {new Date(eventResult.data?.endDateTime).toLocaleString('zh-TW')}
                </span>
              </div>

              {eventResult.data?.meetLink && (
                <div>
                  <span className="text-slate-400">Google Meet：</span>
                  <a
                    href={eventResult.data.meetLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-400 hover:text-indigo-300 ml-2 underline"
                  >
                    {eventResult.data.meetLink}
                  </a>
                </div>
              )}

              <div>
                <span className="text-slate-400">Calendar 連結：</span>
                <a
                  href={eventResult.data?.eventLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-400 hover:text-indigo-300 ml-2 underline"
                >
                  在 Google Calendar 中查看
                </a>
              </div>

              <details className="mt-4">
                <summary className="text-slate-400 cursor-pointer hover:text-slate-300">
                  查看完整 JSON
                </summary>
                <pre className="text-slate-300 text-xs overflow-auto mt-2 p-4 bg-slate-900 rounded">
                  {JSON.stringify(eventResult, null, 2)}
                </pre>
              </details>
            </div>
          </div>
        )}

        {/* 說明 */}
        <div className="mt-8 p-4 bg-slate-800/50 border border-slate-700/50 rounded-lg">
          <h3 className="text-slate-300 font-medium mb-2">📝 測試說明</h3>
          <ul className="text-slate-400 text-sm space-y-1">
            <li>• Free/Busy API：查詢本週（未來 7 天）的可用時段</li>
            <li>• Create Event API：創建一個明天下午 2-3 點的測試會議</li>
            <li>• 會議會自動生成 Google Meet 連結</li>
            <li>• 可以在 Google Calendar 中查看創建的會議</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
