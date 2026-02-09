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

// ============================================================================
// Text Input Sanitization
// ============================================================================

const INVALID_TEXT_VALUES = new Set([
  "null", "undefined", "nan", "none", "nil",
  "true", "false",
  "[object object]",
])

const DEFAULT_MAX_TEXT_LENGTH = 2000

/**
 * 清理並驗證用戶輸入的自由文字
 *
 * 防禦措施：
 * - 型別檢查：確保是字串（防止 JSON null/number 等型別混淆）
 * - 移除控制字元和零寬字元（防止隱形字元注入）
 * - 拒絕 JavaScript-style 無意義值（null, undefined 等）
 * - 最大長度限制（防止過大輸入）
 *
 * @throws {Error} 驗證失敗時拋出錯誤
 */
export function sanitizeText(
  raw: unknown,
  options: { fieldName?: string; maxLength?: number; required?: boolean } = {}
): string {
  const { fieldName = "text", maxLength = DEFAULT_MAX_TEXT_LENGTH, required = true } = options

  // 型別檢查
  if (raw === null || raw === undefined) {
    if (required) {
      throw new Error(`${fieldName} is required`)
    }
    return ""
  }

  if (typeof raw !== "string") {
    throw new Error(`${fieldName} must be a string`)
  }

  // 移除控制字元（保留換行 \n 和 tab \t）和零寬字元
  const cleaned = raw
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .replace(/[\u200B-\u200F\u2028-\u202F\uFEFF]/g, "")
    .trim()

  // 空白檢查
  if (required && !cleaned) {
    throw new Error(`${fieldName} is required`)
  }

  // 拒絕 JavaScript-style 無意義值
  if (cleaned && INVALID_TEXT_VALUES.has(cleaned.toLowerCase())) {
    throw new Error(`無效的輸入內容「${cleaned}」，請輸入有意義的文字`)
  }

  // 最大長度限制
  if (cleaned.length > maxLength) {
    throw new Error(`${fieldName} 超過 ${maxLength} 字元限制`)
  }

  return cleaned
}
