/**
 * Token Manager - Token 管理
 *
 * 統一管理 Firebase 認證 Token
 */

import { getAuth } from 'firebase/auth'

/**
 * 獲取當前用戶的 ID Token
 *
 * @returns Firebase ID Token，用於 API 認證
 * @throws {Error} 若用戶未登入
 */
export async function getAuthToken(): Promise<string> {
  const auth = getAuth()
  const user = auth.currentUser

  if (!user) {
    throw new Error('用戶未登入')
  }

  return await user.getIdToken()
}

/**
 * 獲取當前用戶 ID
 *
 * @returns 用戶 ID，若未登入則返回 null
 */
export function getCurrentUserId(): string | null {
  const auth = getAuth()
  return auth.currentUser?.uid ?? null
}

/**
 * 檢查用戶是否已登入
 *
 * @returns 是否已登入
 */
export function isAuthenticated(): boolean {
  const auth = getAuth()
  return auth.currentUser !== null
}
