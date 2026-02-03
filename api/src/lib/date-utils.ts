/**
 * 安全的日期轉換工具
 *
 * 處理可能無效的 Date 物件，避免 toISOString() 拋出 RangeError
 */

/**
 * 安全地將 Date 轉換為 ISO 字串
 * @param date - 可能為 null/undefined 或無效的 Date
 * @returns ISO 字串或 null
 */
export function safeToISOString(date: Date | null | undefined): string | null {
  if (!date) return null;

  try {
    // 檢查是否為有效的 Date
    if (isNaN(date.getTime())) {
      console.warn('[date-utils] Invalid date detected:', date);
      return null;
    }
    return date.toISOString();
  } catch (error) {
    console.warn('[date-utils] Error converting date:', error);
    return null;
  }
}

/**
 * 安全地將 Date 轉換為 ISO 字串（必填欄位版本）
 * 如果日期無效，返回當前時間
 * @param date - Date 物件
 * @returns ISO 字串
 */
export function safeToISOStringRequired(date: Date): string {
  if (!date) {
    console.warn('[date-utils] Missing required date, using current time');
    return new Date().toISOString();
  }

  try {
    if (isNaN(date.getTime())) {
      console.warn('[date-utils] Invalid required date detected, using current time:', date);
      return new Date().toISOString();
    }
    return date.toISOString();
  } catch (error) {
    console.warn('[date-utils] Error converting required date:', error);
    return new Date().toISOString();
  }
}
