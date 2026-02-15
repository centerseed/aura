/**
 * IDataTransformer - 資料轉換介面 (Domain Layer)
 *
 * Application 層透過此介面依賴資料轉換，而非直接依賴 Infrastructure 實作
 * 符合 Clean Architecture 的依賴反向原則
 */

import type { UnifiedRawData } from './data-collector'
import type { AggregatedData } from '@/infrastructure/services/coach-data-aggregator'
import type { CollectedData } from '@/domain/entities/plan-candidate.entity'

export interface IDataTransformer {
  /**
   * 轉換原始資料成 Briefing 需要的格式
   */
  toBriefingData(
    raw: UnifiedRawData,
    todayStart: Date,
    threeDaysLater: Date
  ): AggregatedData

  /**
   * 轉換原始資料成 Plan 需要的格式
   */
  toPlanCollectedData(
    raw: UnifiedRawData,
    todayStart: Date,
    timezone: string
  ): CollectedData
}
