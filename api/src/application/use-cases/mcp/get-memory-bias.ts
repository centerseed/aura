/**
 * GetMemoryBiasUseCase - 暴露估時偏差數據
 *
 * MCP Resource: zentropy://memory/bias
 * 包裝 CoachCalibration.calculate()，輸出 MCP 格式。
 */

import { CoachCalibration, type CalibrationResult } from '@/application/services/coach-calibration'
import { ValidationException } from '@/lib/api-response'

const MIN_SAMPLES_FOR_AREA = 3

export interface GetMemoryBiasRequest {
  userId: string
}

export interface MemoryBiasAreaData {
  bias: number
  sample_size: number
  trend: 'stable' | 'improving' | 'worsening' | 'insufficient_data'
}

export interface GetMemoryBiasResponse {
  overall_bias_ratio: number
  by_area: Record<string, MemoryBiasAreaData>
  insight: string
}

export class GetMemoryBiasUseCase {
  constructor(
    private readonly calibration: CoachCalibration = new CoachCalibration(),
  ) {}

  async execute(request: GetMemoryBiasRequest): Promise<GetMemoryBiasResponse> {
    if (!request.userId) {
      throw new ValidationException('User ID is required', 'userId')
    }

    const result = await this.calibration.calculate(request.userId)

    if (result.totalSamples === 0) {
      return {
        overall_bias_ratio: 1.0,
        by_area: {},
        insight: 'insufficient data — no completed tasks with time tracking yet.',
      }
    }

    const byArea: Record<string, MemoryBiasAreaData> = {}
    for (const area of result.byArea) {
      if (area.sampleCount >= MIN_SAMPLES_FOR_AREA) {
        byArea[area.areaName] = {
          bias: Math.round(area.ratio * 100) / 100,
          sample_size: area.sampleCount,
          trend: this.determineTrend(area.sampleCount),
        }
      }
    }

    return {
      overall_bias_ratio: Math.round(result.overallRatio * 100) / 100,
      by_area: byArea,
      insight: this.generateInsight(result),
    }
  }

  private determineTrend(sampleSize: number): MemoryBiasAreaData['trend'] {
    if (sampleSize < 5) return 'insufficient_data'
    // Future: compare recent 5 vs overall to determine trend
    return 'stable'
  }

  private generateInsight(result: CalibrationResult): string {
    if (result.totalSamples < MIN_SAMPLES_FOR_AREA) {
      return 'insufficient data — need at least 3 completed tasks for calibration.'
    }

    const lines: string[] = []

    if (result.overallRatio > 1.3) {
      lines.push(`Overall tendency to underestimate by ${((result.overallRatio - 1) * 100).toFixed(0)}%.`)
    } else if (result.overallRatio < 0.7) {
      lines.push(`Overall tendency to overestimate by ${((1 - result.overallRatio) * 100).toFixed(0)}%.`)
    } else {
      lines.push('Estimation accuracy is within acceptable range.')
    }

    for (const area of result.byArea) {
      if (area.sampleCount >= MIN_SAMPLES_FOR_AREA && area.ratio > 1.5) {
        lines.push(`${area.areaName} tasks consistently underestimated (${area.ratio.toFixed(1)}x), suggest multiplying estimates by ${area.ratio.toFixed(1)}.`)
      }
    }

    return lines.join(' ')
  }
}
