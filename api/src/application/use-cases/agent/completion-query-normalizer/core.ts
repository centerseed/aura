export function normalizeCompletionInputText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim()
}
