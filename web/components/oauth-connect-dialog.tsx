/**
 * OAuth Connect Dialog - 授權說明彈窗
 *
 * 當使用者首次使用需要 OAuth 的功能時顯示
 */

"use client"

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Calendar, Shield, Info } from 'lucide-react'
import {
  OAuthProvider,
  OAUTH_PROVIDER_NAMES,
  OAUTH_PROVIDER_DESCRIPTIONS,
  OAUTH_PROVIDER_ICONS,
  startOAuthFlow,
} from '@/lib/oauth-client'

interface OAuthConnectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  provider: OAuthProvider
  token: string
  onSuccess?: () => void
}

export function OAuthConnectDialog({
  open,
  onOpenChange,
  provider,
  token,
  onSuccess,
}: OAuthConnectDialogProps) {
  const [isConnecting, setIsConnecting] = useState(false)

  const providerName = OAUTH_PROVIDER_NAMES[provider]
  const providerDescription = OAUTH_PROVIDER_DESCRIPTIONS[provider]
  const providerIcon = OAUTH_PROVIDER_ICONS[provider]

  const handleConnect = async () => {
    setIsConnecting(true)

    // 監聽 OAuth callback
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return

      if (event.data.type === 'oauth-success') {
        setIsConnecting(false)
        onOpenChange(false)
        onSuccess?.()
        window.removeEventListener('message', handleMessage)
      } else if (event.data.type === 'oauth-error') {
        setIsConnecting(false)
        alert(`授權失敗: ${event.data.error}`)
        window.removeEventListener('message', handleMessage)
      }
    }

    try {
      window.addEventListener('message', handleMessage)

      // 開始 OAuth 流程
      await startOAuthFlow(provider, token)
    } catch (error) {
      console.error('OAuth error:', error)
      setIsConnecting(false)
      window.removeEventListener('message', handleMessage)
      alert('授權流程啟動失敗，請稍後再試')
    }
  }

  const features = {
    google_calendar: [
      '查看可用時間（不用切換到 Calendar）',
      '創建會議並自動生成 Google Meet 連結',
      '設定會議提醒',
    ],
    google_drive: [
      '儲存會議記錄',
      '附加檔案到任務',
      '自動備份重要文件',
    ],
    zoom: [
      '創建 Zoom Meeting',
      '自動生成會議連結',
      '與任務關聯',
    ],
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-slate-900 border-slate-800 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center text-xl">
            <span className="text-2xl mr-2">{providerIcon}</span>
            連接 {providerName}
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            {providerDescription}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* 功能說明 */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-300">
              {providerName} 功能需要連接你的帳號，用於：
            </p>
            <ul className="space-y-2">
              {features[provider].map((feature, index) => (
                <li key={index} className="flex items-start text-sm text-slate-300">
                  <span className="text-emerald-400 mr-2">✓</span>
                  {feature}
                </li>
              ))}
            </ul>
          </div>

          {/* 提示訊息 */}
          <Alert className="bg-indigo-950/50 border-indigo-500/30">
            <Info className="h-4 w-4 text-indigo-400" />
            <AlertDescription className="text-slate-300">
              <span className="font-medium">提示：</span>
              {' '}即使你使用 Apple ID 或 Email 登入 Zentropy，仍可連接 {providerName}
            </AlertDescription>
          </Alert>

          {/* 隱私保護 */}
          <div className="bg-slate-800/50 rounded-lg p-4 space-y-2">
            <div className="flex items-center text-sm font-medium text-slate-300">
              <Shield className="w-4 h-4 mr-2 text-emerald-400" />
              隱私保護
            </div>
            <ul className="space-y-1 text-xs text-slate-400">
              <li>• 只讀取/寫入必要的資料</li>
              <li>• 不會存取其他 Google 服務</li>
              <li>• Token 加密儲存，不會分享給第三方</li>
              <li>• 隨時可在設定中解除連接</li>
            </ul>
          </div>
        </div>

        <DialogFooter className="sm:space-x-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isConnecting}
            className="border-slate-700 text-slate-300 hover:bg-slate-800"
          >
            稍後再說
          </Button>
          <Button
            onClick={handleConnect}
            disabled={isConnecting}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isConnecting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                連接中...
              </>
            ) : (
              <>
                <Calendar className="w-4 h-4 mr-2" />
                連接 {providerName}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
