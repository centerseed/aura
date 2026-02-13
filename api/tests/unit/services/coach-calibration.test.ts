/**
 * CoachCalibration 單元測試
 *
 * Mock prisma.$queryRaw 來測試校準係數計算和文字輸出
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    $queryRaw: vi.fn(),
  },
}))

import { CoachCalibration } from '@/application/services/coach-calibration'
import { prisma } from '@/lib/db'

const mockQueryRaw = prisma.$queryRaw as any

describe('CoachCalibration', () => {
  let calibration: CoachCalibration

  beforeEach(() => {
    calibration = new CoachCalibration()
    vi.clearAllMocks()
  })

  describe('getCalibrationNote', () => {
    describe('冷啟動', () => {
      it('無歷史記錄時回傳 null', async () => {
        mockQueryRaw.mockResolvedValue([])

        const result = await calibration.getCalibrationNote('user-1')

        expect(result).toBeNull()
      })

      it('樣本數不足 3 筆時回傳 null', async () => {
        mockQueryRaw.mockResolvedValue([
          { area_name: '開發', estimated_minutes: 60, actual_minutes: 90 },
          { area_name: '開發', estimated_minutes: 30, actual_minutes: 40 },
        ])

        const result = await calibration.getCalibrationNote('user-1')

        expect(result).toBeNull()
      })
    })

    describe('正常計算', () => {
      it('3 筆樣本時回傳校準資訊', async () => {
        mockQueryRaw.mockResolvedValue([
          { area_name: '開發', estimated_minutes: 60, actual_minutes: 60 },
          { area_name: '開發', estimated_minutes: 30, actual_minutes: 30 },
          { area_name: '設計', estimated_minutes: 45, actual_minutes: 45 },
        ])

        const result = await calibration.getCalibrationNote('user-1')

        expect(result).not.toBeNull()
        expect(result).toContain('3 筆歷史完成記錄')
        expect(result).toContain('1.00 倍')
      })

      it('低估傾向時顯示上調建議', async () => {
        // actual/estimated = 390/300 = 1.3
        mockQueryRaw.mockResolvedValue([
          { area_name: '開發', estimated_minutes: 100, actual_minutes: 130 },
          { area_name: '開發', estimated_minutes: 100, actual_minutes: 130 },
          { area_name: '開發', estimated_minutes: 100, actual_minutes: 130 },
        ])

        const result = await calibration.getCalibrationNote('user-1')

        expect(result).toContain('1.30 倍')
        expect(result).toContain('低估時間')
        expect(result).toContain('上調估時')
      })

      it('高估傾向時顯示下調建議', async () => {
        // actual/estimated = 210/300 = 0.7
        mockQueryRaw.mockResolvedValue([
          { area_name: '開發', estimated_minutes: 100, actual_minutes: 70 },
          { area_name: '開發', estimated_minutes: 100, actual_minutes: 70 },
          { area_name: '開發', estimated_minutes: 100, actual_minutes: 70 },
        ])

        const result = await calibration.getCalibrationNote('user-1')

        expect(result).toContain('0.70 倍')
        expect(result).toContain('高估時間')
        expect(result).toContain('下調估時')
      })

      it('ratio 在 0.8-1.2 之間不顯示建議', async () => {
        mockQueryRaw.mockResolvedValue([
          { area_name: '開發', estimated_minutes: 100, actual_minutes: 100 },
          { area_name: '開發', estimated_minutes: 100, actual_minutes: 100 },
          { area_name: '開發', estimated_minutes: 100, actual_minutes: 100 },
        ])

        const result = await calibration.getCalibrationNote('user-1')

        expect(result).not.toContain('建議')
      })
    })

    describe('分區域統計', () => {
      it('同一區域 >= 3 筆時顯示區域校準', async () => {
        mockQueryRaw.mockResolvedValue([
          { area_name: '開發', estimated_minutes: 60, actual_minutes: 90 },
          { area_name: '開發', estimated_minutes: 60, actual_minutes: 90 },
          { area_name: '開發', estimated_minutes: 60, actual_minutes: 90 },
        ])

        const result = await calibration.getCalibrationNote('user-1')

        expect(result).toContain('開發 類任務')
        expect(result).toContain('1.50')
        expect(result).toContain('3 筆')
      })

      it('區域不足 3 筆時不顯示區域校準', async () => {
        mockQueryRaw.mockResolvedValue([
          { area_name: '開發', estimated_minutes: 60, actual_minutes: 90 },
          { area_name: '設計', estimated_minutes: 60, actual_minutes: 60 },
          { area_name: '行銷', estimated_minutes: 60, actual_minutes: 60 },
        ])

        const result = await calibration.getCalibrationNote('user-1')

        expect(result).not.toContain('類任務')
      })

      it('多區域各自計算 ratio', async () => {
        mockQueryRaw.mockResolvedValue([
          { area_name: '開發', estimated_minutes: 100, actual_minutes: 150 },
          { area_name: '開發', estimated_minutes: 100, actual_minutes: 150 },
          { area_name: '開發', estimated_minutes: 100, actual_minutes: 150 },
          { area_name: '設計', estimated_minutes: 100, actual_minutes: 80 },
          { area_name: '設計', estimated_minutes: 100, actual_minutes: 80 },
          { area_name: '設計', estimated_minutes: 100, actual_minutes: 80 },
        ])

        const result = await calibration.getCalibrationNote('user-1')

        expect(result).toContain('開發 類任務：實際/預估 = 1.50')
        expect(result).toContain('設計 類任務：實際/預估 = 0.80')
      })
    })
  })
})
