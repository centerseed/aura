/**
 * DrawerStatus - 抽屜狀態值對象
 *
 * 定義任務的狀態分類（對應雙軸管理模型的「何時該看」維度）
 */

export type DrawerStatus =
  | 'INBOX'      // 收件匣：新進任務，待處理
  | 'ACTIVE'     // 進行中：有期限、需主動推進
  | 'MAINTAIN'   // 營運：穩定維護，異常時亮燈
  | 'REFERENCE'  // 知識庫：無時效性，AI 自動關聯
  | 'ARCHIVE'    // 歸檔：已完成或不再需要
