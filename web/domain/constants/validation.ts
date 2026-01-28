/**
 * Validation Constants - 驗證常數
 *
 * 統一驗證邏輯，消除重複定義
 * 原本重複定義在 5 個 API 路由檔案中
 */

/**
 * UUID 驗證正則表達式
 *
 * 標準 UUID v4 格式：xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
 */
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * 驗證字串是否為有效的 UUID
 *
 * @param id - 要驗證的字串
 * @returns 是否為有效 UUID
 *
 * @example
 * ```typescript
 * isValidUUID('123e4567-e89b-12d3-a456-426614174000') // true
 * isValidUUID('invalid-uuid') // false
 * ```
 */
export function isValidUUID(id: string): boolean {
  return UUID_PATTERN.test(id)
}

/**
 * 驗證並拋出錯誤（若無效）
 *
 * @param id - 要驗證的字串
 * @param fieldName - 欄位名稱（用於錯誤訊息）
 * @throws {Error} 若 UUID 無效
 *
 * @example
 * ```typescript
 * validateUUID(taskId, 'taskId') // 若無效則拋出錯誤
 * ```
 */
export function validateUUID(id: string, fieldName: string = 'id'): void {
  if (!isValidUUID(id)) {
    throw new Error(`Invalid ${fieldName}: must be a valid UUID`)
  }
}
