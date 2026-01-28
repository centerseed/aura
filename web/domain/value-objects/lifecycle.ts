/**
 * LifecycleStatus - 生命週期狀態值對象
 *
 * 定義任務/專案的生命週期階段
 */

export type LifecycleStatus =
  | 'embryo'   // 胚胎期：剛開始，尚未成熟
  | 'active'   // 活躍期：正在積極進行
  | 'mature'   // 成熟期：穩定運作
  | 'dormant'  // 休眠期：暫停或低活躍度
