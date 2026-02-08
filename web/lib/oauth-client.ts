/**
 * OAuth Client - Frontend API Client for OAuth operations
 */

import { API_BASE_URL } from './api-client'

export type OAuthProvider = 'google_calendar' | 'google_drive' | 'zoom'

export interface OAuthStatus {
  authorized: boolean
  provider: string
  authorized_email: string | null
  scopes: string[]
  expires_at: string | null
  auth_url: string | null
}

export interface OAuthDisconnectResponse {
  message: string
}

/**
 * 取得 OAuth 授權狀態
 */
export async function getOAuthStatus(
  provider: OAuthProvider,
  token: string
): Promise<OAuthStatus> {
  const response = await fetch(
    `${API_BASE_URL}/api/oauth/status?provider=${provider}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    }
  )

  if (!response.ok) {
    throw new Error(`Failed to get OAuth status: ${response.statusText}`)
  }

  const result = await response.json()
  return result.data
}

/**
 * 開始 OAuth 授權流程（開啟新視窗）
 */
export async function startOAuthFlow(
  provider: OAuthProvider,
  token: string
): Promise<void> {
  // 先取得授權 URL（帶上 token）
  const status = await getOAuthStatus(provider, token)

  if (!status.auth_url) {
    throw new Error('Unable to get authorization URL')
  }

  // 開啟 OAuth 彈窗
  const width = 600
  const height = 700
  const left = window.screen.width / 2 - width / 2
  const top = window.screen.height / 2 - height / 2

  const popup = window.open(
    status.auth_url,
    'oauth',
    `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`
  )

  if (!popup) {
    // 如果彈窗被阻擋，直接重定向
    window.location.href = status.auth_url
  }
}

/**
 * 解除 OAuth 授權
 */
export async function disconnectOAuth(
  provider: OAuthProvider,
  token: string
): Promise<OAuthDisconnectResponse> {
  const response = await fetch(`${API_BASE_URL}/api/oauth/disconnect`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ provider }),
  })

  if (!response.ok) {
    throw new Error(`Failed to disconnect OAuth: ${response.statusText}`)
  }

  const result = await response.json()
  return result.data
}

/**
 * OAuth Provider 顯示名稱映射
 */
export const OAUTH_PROVIDER_NAMES: Record<OAuthProvider, string> = {
  google_calendar: 'Google Calendar',
  google_drive: 'Google Drive',
  zoom: 'Zoom',
}

/**
 * OAuth Provider 說明
 */
export const OAUTH_PROVIDER_DESCRIPTIONS: Record<OAuthProvider, string> = {
  google_calendar: '查看可用時間、創建會議並自動生成 Google Meet 連結',
  google_drive: '儲存會議記錄與檔案',
  zoom: '創建 Zoom Meeting 連結',
}

/**
 * OAuth Provider 圖示
 */
export const OAUTH_PROVIDER_ICONS: Record<OAuthProvider, string> = {
  google_calendar: '📅',
  google_drive: '💾',
  zoom: '📹',
}
