const STRICT_TODAY_PENDING_PATTERN = /今天.*(?:還有.*沒做|還沒完成|未完成|沒做完|還沒做)/i

export function shouldUseStrictTodayFocus(message: string): boolean {
  return STRICT_TODAY_PENDING_PATTERN.test(message.trim())
}
