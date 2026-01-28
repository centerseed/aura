/**
 * Merge References Use Case - 參考資料去重合併
 *
 * 統一參考資料去重邏輯，消除重複實作
 * 原本重複定義在：
 * - app/api/tasks/[taskId]/merge-into/route.ts
 * - app/api/products/[id]/apply-reorganization/route.ts
 */

import type { Reference } from '@/domain/entities/task.entity'

/**
 * 合併參考資料並去重
 *
 * 規則：
 * 1. URL 類型的參考資料：根據 content 去重（不區分大小寫）
 * 2. Note 類型的參考資料：直接合併，不去重
 *
 * @param targetRefs - 目標參考資料列表
 * @param sourceRefs - 來源參考資料列表
 * @returns 合併後的參考資料列表
 *
 * @example
 * ```typescript
 * const target = [
 *   { id: '1', type: 'url', content: 'https://example.com', created_at: '2024-01-01' }
 * ]
 * const source = [
 *   { id: '2', type: 'url', content: 'https://example.com', created_at: '2024-01-02' }, // 重複
 *   { id: '3', type: 'url', content: 'https://other.com', created_at: '2024-01-03' }
 * ]
 *
 * const result = mergeReferences(target, source)
 * // result.length === 2 (重複的被過濾)
 * ```
 */
export function mergeReferences(
  targetRefs: Reference[],
  sourceRefs: Reference[]
): Reference[] {
  const merged: Reference[] = [...targetRefs]

  // 建立 URL 去重集合（不區分大小寫）
  const existingUrls = new Set(
    targetRefs
      .filter((ref) => ref.type === 'url')
      .map((ref) => ref.content.toLowerCase().trim())
  )

  // 合併來源參考資料
  for (const ref of sourceRefs) {
    if (ref.type === 'url') {
      const normalizedUrl = ref.content.toLowerCase().trim()

      // URL 已存在則跳過
      if (!existingUrls.has(normalizedUrl)) {
        merged.push(ref)
        existingUrls.add(normalizedUrl)
      }
    } else {
      // Note 類型直接添加
      merged.push(ref)
    }
  }

  return merged
}

/**
 * 檢查參考資料是否重複
 *
 * @param refs - 參考資料列表
 * @returns 是否有重複的 URL
 */
export function hasDuplicateReferences(refs: Reference[]): boolean {
  const urls = refs.filter((ref) => ref.type === 'url').map((ref) => ref.content.toLowerCase().trim())

  return urls.length !== new Set(urls).size
}

/**
 * 移除重複的參考資料
 *
 * @param refs - 參考資料列表
 * @returns 去重後的參考資料列表
 */
export function deduplicateReferences(refs: Reference[]): Reference[] {
  return mergeReferences([], refs)
}
