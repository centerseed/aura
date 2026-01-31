/**
 * mergeReferences 單元測試
 */

import { describe, it, expect } from 'vitest'
import {
  mergeReferences,
  hasDuplicateReferences,
  deduplicateReferences,
} from '@/application/use-cases/merge-references'
import type { Reference } from '@/domain/entities/task.entity'

describe('mergeReferences', () => {
  it('應該合併參考資料並去除重複的 URL', () => {
    const target: Reference[] = [
      {
        id: '1',
        type: 'url',
        content: 'https://example.com',
        title: 'Example',
        createdAt: new Date('2024-01-01'),
      },
    ]

    const source: Reference[] = [
      {
        id: '2',
        type: 'url',
        content: 'https://example.com', // 重複
        title: 'Example',
        createdAt: new Date('2024-01-02'),
      },
      {
        id: '3',
        type: 'url',
        content: 'https://other.com',
        title: 'Other',
        createdAt: new Date('2024-01-03'),
      },
    ]

    const result = mergeReferences(target, source)

    expect(result.length).toBe(2)
    expect(result.find(r => r.content === 'https://other.com')).toBeDefined()
  })

  it('應該保留所有 note 類型的參考資料', () => {
    const target: Reference[] = [
      {
        id: '1',
        type: 'note',
        content: 'Note 1',
        title: null,
        createdAt: new Date(),
      },
    ]

    const source: Reference[] = [
      {
        id: '2',
        type: 'note',
        content: 'Note 1', // 內容相同但 note 不去重
        title: null,
        createdAt: new Date(),
      },
    ]

    const result = mergeReferences(target, source)

    expect(result.length).toBe(2)
  })

  it('應該不區分大小寫去重 URL', () => {
    const target: Reference[] = [
      {
        id: '1',
        type: 'url',
        content: 'HTTPS://EXAMPLE.COM',
        title: null,
        createdAt: new Date(),
      },
    ]

    const source: Reference[] = [
      {
        id: '2',
        type: 'url',
        content: 'https://example.com',
        title: null,
        createdAt: new Date(),
      },
    ]

    const result = mergeReferences(target, source)

    expect(result.length).toBe(1)
  })
})

describe('hasDuplicateReferences', () => {
  it('應該檢測重複的 URL', () => {
    const refs: Reference[] = [
      {
        id: '1',
        type: 'url',
        content: 'https://example.com',
        title: null,
        createdAt: new Date(),
      },
      {
        id: '2',
        type: 'url',
        content: 'https://example.com',
        title: null,
        createdAt: new Date(),
      },
    ]

    expect(hasDuplicateReferences(refs)).toBe(true)
  })

  it('應該返回 false 當沒有重複', () => {
    const refs: Reference[] = [
      {
        id: '1',
        type: 'url',
        content: 'https://example.com',
        title: null,
        createdAt: new Date(),
      },
      {
        id: '2',
        type: 'url',
        content: 'https://other.com',
        title: null,
        createdAt: new Date(),
      },
    ]

    expect(hasDuplicateReferences(refs)).toBe(false)
  })
})

describe('deduplicateReferences', () => {
  it('應該去除重複的參考資料', () => {
    const refs: Reference[] = [
      {
        id: '1',
        type: 'url',
        content: 'https://example.com',
        title: null,
        createdAt: new Date(),
      },
      {
        id: '2',
        type: 'url',
        content: 'https://example.com',
        title: null,
        createdAt: new Date(),
      },
      {
        id: '3',
        type: 'note',
        content: 'Note',
        title: null,
        createdAt: new Date(),
      },
    ]

    const result = deduplicateReferences(refs)

    expect(result.length).toBe(2)
  })
})
