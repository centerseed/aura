const NON_CAPTURE_PATTERNS: RegExp[] = [
  /今天.*(有哪些|有什麼|要做什麼|任務|待辦|代辦)/i,
  /(有哪些|有什麼).*(任務|待辦|代辦)/i,
  /((我|你)(剛才|剛剛)|剛才|剛剛).*(說了什麼|問了什麼|記了什麼|記的是什麼)/i,
  /(你是誰|你可以做什麼|可以做什麼)/i,
  /(完成了什麼|做了什麼)/i,
  /(查詢|列出|顯示).*(任務|待辦|代辦)/i,
  /(還剩什麼|剩下什麼)/i,
]

const EXPLICIT_CAPTURE_PATTERNS: RegExp[] = [
  /(記錄|記下|記一下|幫我記|幫我加|新增任務)/i,
  /^(?:待辦|代辦|todo)(?:\s*[:：-]\s*|\s+\S+|\s*\n\s*\S+)/i,
  /(再加一個|再加|補一個|另外一個)/i,
]

export function hasExplicitCaptureFrame(message: string): boolean {
  const text = message.trim()
  if (!text) return false
  if (NON_CAPTURE_PATTERNS.some((pattern) => pattern.test(text))) return false
  return EXPLICIT_CAPTURE_PATTERNS.some((pattern) => pattern.test(text))
}
