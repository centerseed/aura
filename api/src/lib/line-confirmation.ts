const AFFIRMATIVE_CONFIRMATIONS = new Set([
  "確認",
  "confirm",
  "ok",
  "okay",
  "yes",
  "y",
  "好",
  "好的",
  "是",
  "對",
  "對啊",
  "對的",
  "沒錯",
])

export function isLineSessionConfirmation(text: string): boolean {
  return AFFIRMATIVE_CONFIRMATIONS.has(text.trim().toLowerCase())
}
