/**
 * 日期工具函數
 * 對齊 Backend 的日期判斷邏輯
 */

/**
 * 轉換為純日期（去除時間部分）
 * 對齊 Backend timezone-utils.ts 的 toDateOnly
 *
 * @param date - 要轉換的日期
 * @param timezone - 時區（預設 'Asia/Taipei'）
 * @returns 純日期（YYYY-MM-DD 00:00:00 UTC）
 */
export function toDateOnly(date: Date, timezone = 'Asia/Taipei'): Date {
  const dateStr = date.toLocaleDateString('en-CA', { timeZone: timezone })
  return new Date(dateStr + 'T00:00:00.000Z')
}

/**
 * 判斷 date 是否在今天起三天內（今天、明天、後天）
 * 對齊 Backend plan-sync.ts 的邏輯
 *
 * @param date - 要檢查的日期
 * @param timezone - 時區（預設 'Asia/Taipei'）
 * @returns 是否在三天內
 */
/**
 * 將日期轉為 UTC 中午的 ISO 字串，避免時區轉換導致日期偏移。
 * 例：台北 2/17 00:00 → "2026-02-17T12:00:00.000Z"，而非 "2026-02-16T16:00:00.000Z"
 */
export function toDateOnlyISOString(date: Date): string {
  const d = toDateOnly(date)
  // toDateOnly 回傳 YYYY-MM-DDT00:00:00.000Z，改為中午
  return new Date(d.getTime() + 12 * 60 * 60 * 1000).toISOString()
}

export function isWithinThreeDays(
  date: Date | string | null,
  timezone = 'Asia/Taipei'
): boolean {
  if (!date) return false

  const targetDate = typeof date === 'string' ? new Date(date) : date
  if (isNaN(targetDate.getTime())) return false

  const today = new Date()

  // 轉換為純日期（去除時間）
  const targetDateOnly = toDateOnly(targetDate, timezone)
  const todayOnly = toDateOnly(today, timezone)
  const threeDaysLater = new Date(todayOnly.getTime() + 3 * 24 * 60 * 60 * 1000)

  // 判斷範圍：今天 <= targetDate < 三天後
  return targetDateOnly >= todayOnly && targetDateOnly < threeDaysLater
}
