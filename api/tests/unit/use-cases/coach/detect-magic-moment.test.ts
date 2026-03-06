/**
 * detectMagicMoment 單元測試
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { detectMagicMoment } from '@/application/use-cases/coach/detect-magic-moment'

// Mock prisma
const mockQueryRaw = vi.fn()
vi.mock('@/lib/db', () => ({
  prisma: {
    $queryRaw: mockQueryRaw,
  },
}))

const mockPrisma = { $queryRaw: mockQueryRaw } as any

const NOW = new Date('2026-03-06T12:00:00Z')

function daysAgo(days: number): Date {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000)
}

describe('detectMagicMoment', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.setSystemTime(NOW)
  })

  it('P0 停滯但無非 P0 動能 → detected: false', async () => {
    mockQueryRaw.mockResolvedValueOnce([
      {
        id: 'p1',
        name: 'P0 Project',
        priority: 'P0',
        completed_count_7d: BigInt(0),
        last_archive_at: daysAgo(10), // 10 天前，停滯
      },
      {
        id: 'p2',
        name: 'P1 Project',
        priority: 'P1',
        completed_count_7d: BigInt(2), // 未達 3 個
        last_archive_at: daysAgo(1),
      },
    ])

    const result = await detectMagicMoment('user-1', mockPrisma)

    expect(result.detected).toBe(false)
    expect(result.stagnant_p0_products).toHaveLength(1)
    expect(result.momentum_products).toHaveLength(0)
  })

  it('P0 停滯 + 非 P0 爆發 → detected: true', async () => {
    mockQueryRaw.mockResolvedValueOnce([
      {
        id: 'p1',
        name: 'P0 Project',
        priority: 'P0',
        completed_count_7d: BigInt(0),
        last_archive_at: daysAgo(8), // 停滯
      },
      {
        id: 'p2',
        name: 'Side Project',
        priority: 'P2',
        completed_count_7d: BigInt(5), // 爆發
        last_archive_at: daysAgo(1),
      },
    ])

    const result = await detectMagicMoment('user-1', mockPrisma)

    expect(result.detected).toBe(true)
    expect(result.stagnant_p0_products).toHaveLength(1)
    expect(result.stagnant_p0_products[0].name).toBe('P0 Project')
    expect(result.momentum_products).toHaveLength(1)
    expect(result.momentum_products[0].name).toBe('Side Project')
    expect(result.momentum_products[0].completed_count).toBe(5)
  })

  it('無 P0 產品 → detected: false', async () => {
    mockQueryRaw.mockResolvedValueOnce([
      {
        id: 'p1',
        name: 'P1 Project',
        priority: 'P1',
        completed_count_7d: BigInt(0),
        last_archive_at: null,
      },
      {
        id: 'p2',
        name: 'P2 Project',
        priority: 'P2',
        completed_count_7d: BigInt(10),
        last_archive_at: daysAgo(1),
      },
    ])

    const result = await detectMagicMoment('user-1', mockPrisma)

    expect(result.detected).toBe(false)
    expect(result.stagnant_p0_products).toHaveLength(0)
  })

  it('P0 有近期活動（未停滯）→ detected: false', async () => {
    mockQueryRaw.mockResolvedValueOnce([
      {
        id: 'p1',
        name: 'P0 Project',
        priority: 'P0',
        completed_count_7d: BigInt(2),
        last_archive_at: daysAgo(3), // 3 天前，未停滯（閾值 5 天）
      },
      {
        id: 'p2',
        name: 'P2 Project',
        priority: 'P2',
        completed_count_7d: BigInt(5),
        last_archive_at: daysAgo(1),
      },
    ])

    const result = await detectMagicMoment('user-1', mockPrisma)

    expect(result.detected).toBe(false)
    expect(result.stagnant_p0_products).toHaveLength(0)
  })

  it('P0 從未完成任何任務（last_archive_at null）→ 視為停滯', async () => {
    mockQueryRaw.mockResolvedValueOnce([
      {
        id: 'p1',
        name: 'P0 Project',
        priority: 'P0',
        completed_count_7d: BigInt(0),
        last_archive_at: null, // 從未完成，視為 Infinity 天前
      },
      {
        id: 'p2',
        name: 'P1 Project',
        priority: 'P1',
        completed_count_7d: BigInt(4),
        last_archive_at: daysAgo(2),
      },
    ])

    const result = await detectMagicMoment('user-1', mockPrisma)

    expect(result.detected).toBe(true)
    expect(result.stagnant_p0_products[0].days_stagnant).toBe(999)
  })
})
