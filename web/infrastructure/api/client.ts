/**
 * API Client - 統一 API 請求客戶端
 *
 * 統一所有 API 調用，內建：
 * - 自動認證 Token 注入
 * - 統一錯誤處理（消除 17 處重複的認證錯誤檢查）
 * - 類型安全
 * - 請求/響應攔截
 */

import { getAuthToken } from '../auth/token-manager'
import {
  ApiError,
  AuthenticationError,
  throwApiError,
  handleError,
} from './error-handler'

/**
 * API 請求配置
 */
export interface ApiRequestConfig extends RequestInit {
  /**
   * 是否跳過自動注入 Auth Token（預設 false）
   * 用於公開 API 或特殊情況
   */
  skipAuth?: boolean

  /**
   * 自定義錯誤處理
   */
  onError?: (error: ApiError) => void
}

/**
 * 統一 API 請求函數
 *
 * 所有前端 API 調用的核心函數，自動處理：
 * 1. 認證 Token 注入
 * 2. 錯誤處理與分類
 * 3. JSON 序列化/反序列化
 *
 * @param url - API 端點 URL
 * @param options - 請求配置
 * @returns 響應數據
 * @throws {AuthenticationError} 認證失敗（401）
 * @throws {ApiError} 其他 API 錯誤
 *
 * @example
 * ```typescript
 * // GET 請求
 * const tasks = await apiRequest<Task[]>('/api/tasks')
 *
 * // POST 請求
 * const newTask = await apiRequest<Task>('/api/tasks', {
 *   method: 'POST',
 *   body: JSON.stringify({ content: '新任務' })
 * })
 * ```
 */
export async function apiRequest<T = unknown>(
  url: string,
  options: ApiRequestConfig = {}
): Promise<T> {
  const { skipAuth = false, onError, ...fetchOptions } = options

  try {
    // 準備請求頭
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(fetchOptions.headers as Record<string, string>),
    }

    // 自動注入認證 Token（除非明確跳過）
    if (!skipAuth) {
      try {
        const token = await getAuthToken()
        headers['Authorization'] = `Bearer ${token}`
      } catch (error) {
        // Token 獲取失敗，拋出認證錯誤
        throw new AuthenticationError('無法獲取認證 Token，請重新登入')
      }
    }

    // 發送請求
    const response = await fetch(url, {
      ...fetchOptions,
      headers,
    })

    // 處理錯誤響應
    if (!response.ok) {
      let errorMessage = `請求失敗: ${response.statusText}`

      // 嘗試解析錯誤訊息
      try {
        const errorData = await response.json()
        errorMessage = errorData.error || errorData.message || errorMessage
      } catch {
        // 無法解析 JSON，使用預設訊息
      }

      throwApiError(response.status, errorMessage)
    }

    // 解析成功響應
    const data = await response.json()
    return data as T
  } catch (error) {
    // 統一錯誤處理
    const apiError = handleError(error)

    // 執行自定義錯誤處理（如果提供）
    onError?.(apiError)

    // 拋出錯誤
    throw apiError
  }
}

/**
 * GET 請求快捷方法
 */
export async function apiGet<T = unknown>(
  url: string,
  config?: ApiRequestConfig
): Promise<T> {
  return apiRequest<T>(url, { ...config, method: 'GET' })
}

/**
 * POST 請求快捷方法
 */
export async function apiPost<T = unknown>(
  url: string,
  data?: unknown,
  config?: ApiRequestConfig
): Promise<T> {
  return apiRequest<T>(url, {
    ...config,
    method: 'POST',
    body: data ? JSON.stringify(data) : undefined,
  })
}

/**
 * PATCH 請求快捷方法
 */
export async function apiPatch<T = unknown>(
  url: string,
  data?: unknown,
  config?: ApiRequestConfig
): Promise<T> {
  return apiRequest<T>(url, {
    ...config,
    method: 'PATCH',
    body: data ? JSON.stringify(data) : undefined,
  })
}

/**
 * PUT 請求快捷方法
 */
export async function apiPut<T = unknown>(
  url: string,
  data?: unknown,
  config?: ApiRequestConfig
): Promise<T> {
  return apiRequest<T>(url, {
    ...config,
    method: 'PUT',
    body: data ? JSON.stringify(data) : undefined,
  })
}

/**
 * DELETE 請求快捷方法
 */
export async function apiDelete<T = unknown>(
  url: string,
  config?: ApiRequestConfig
): Promise<T> {
  return apiRequest<T>(url, { ...config, method: 'DELETE' })
}
