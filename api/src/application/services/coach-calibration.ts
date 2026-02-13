/**
 * CoachCalibration - 偏差學習迴路（L4→L5）
 *
 * 分析用戶歷史 DailyPlanItem 的 estimated_minutes vs actual_minutes，
 * 計算個人校準係數，供 AI 估時參考。
 */

import { prisma } from '@/lib/db'

interface CalibrationData {
  areaName: string
  ratio: number
  sampleCount: number
}

interface CalibrationResult {
  overallRatio: number
  byArea: CalibrationData[]
  totalSamples: number
}

const MIN_SAMPLES = 3

export class CoachCalibration {
  /**
   * 取得用戶的個人校準資訊
   * 回傳可注入 prompt 的文字描述，冷啟動回傳 null
   */
  async getCalibrationNote(userId: string): Promise<string | null> {
    const result = await this.calculate(userId)
    if (result.totalSamples < MIN_SAMPLES) return null

    const lines: string[] = []
    lines.push(`此用戶有 ${result.totalSamples} 筆歷史完成記錄。`)
    lines.push(`整體而言，實際花費時間是預估的 ${result.overallRatio.toFixed(2)} 倍。`)

    for (const area of result.byArea) {
      if (area.sampleCount >= MIN_SAMPLES) {
        lines.push(`- ${area.areaName} 類任務：實際/預估 = ${area.ratio.toFixed(2)} (${area.sampleCount} 筆)`)
      }
    }

    if (result.overallRatio > 1.2) {
      lines.push('建議：此用戶傾向低估時間，請適當上調估時。')
    } else if (result.overallRatio < 0.8) {
      lines.push('建議：此用戶傾向高估時間，請適當下調估時。')
    }

    return lines.join('\n')
  }

  private async calculate(userId: string): Promise<CalibrationResult> {
    const items = await prisma.$queryRaw<Array<{
      area_name: string
      estimated_minutes: number
      actual_minutes: number
    }>>`
      SELECT
        dpi.area_name,
        dpi.estimated_minutes,
        dpi.actual_minutes
      FROM daily_plan_items dpi
      JOIN daily_plans dp ON dp.id = dpi.plan_id
      WHERE dp.user_id = ${userId}::uuid
        AND dpi.completed = true
        AND dpi.estimated_minutes IS NOT NULL
        AND dpi.actual_minutes IS NOT NULL
        AND dpi.estimated_minutes > 0
      ORDER BY dpi.completed_at DESC
      LIMIT 100
    `

    if (items.length === 0) {
      return { overallRatio: 1.0, byArea: [], totalSamples: 0 }
    }

    // Overall ratio
    const totalEstimated = items.reduce((s, i) => s + i.estimated_minutes, 0)
    const totalActual = items.reduce((s, i) => s + i.actual_minutes, 0)
    const overallRatio = totalActual / totalEstimated

    // By area
    const byAreaMap = new Map<string, { est: number; act: number; count: number }>()
    for (const item of items) {
      const entry = byAreaMap.get(item.area_name) || { est: 0, act: 0, count: 0 }
      entry.est += item.estimated_minutes
      entry.act += item.actual_minutes
      entry.count++
      byAreaMap.set(item.area_name, entry)
    }

    const byArea: CalibrationData[] = Array.from(byAreaMap.entries()).map(([name, data]) => ({
      areaName: name,
      ratio: data.act / data.est,
      sampleCount: data.count,
    }))

    return { overallRatio, byArea, totalSamples: items.length }
  }
}
