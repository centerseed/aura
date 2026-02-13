/**
 * Coach 模組共用常數
 *
 * 集中定義避免散落多處。未來可改為從 user profile 讀取。
 */

export const WORK_HOURS_PER_DAY = 8
export const ESTIMATED_MINUTES_PER_TASK = 60
export const STAGNANT_PRODUCT_THRESHOLD_DAYS = 7
export const STUCK_TASK_THRESHOLD_DAYS = 5

/**
 * 動態停滯門檻 — 根據 due_date 距離調整
 * 越接近截止日，容忍的停滯天數越低
 */
export const STUCK_TASK_THRESHOLDS = {
  URGENT: 2,        // due_date <= 3 天
  APPROACHING: 3,   // due_date <= 7 天
  NORMAL: 5,        // due_date <= 14 天
  RELAXED: 7,       // due_date > 14 天
  NO_DUE_DATE: 10,  // 無截止日
} as const

export const STAGNANT_PRODUCT_THRESHOLDS = {
  FINITE: 7,
  PERPETUAL: 14,
} as const

export const STUCK_SUBTASK_THRESHOLD_DAYS = 3
