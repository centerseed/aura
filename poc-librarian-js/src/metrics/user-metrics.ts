/**
 * POC Librarian Engine - User Metrics Tracker
 *
 * 追蹤用戶的修正率和學習效果
 */

import type { UserMetrics, PhaseMetrics } from '../core/types.js';

// ============================================================================
// User Metrics Tracker
// ============================================================================

export class UserMetricsTracker {
  private userId: string;
  private phases: Map<number, PhaseMetrics>;
  private totalInputs: number;
  private totalCorrections: number;

  constructor(userId: string) {
    this.userId = userId;
    this.phases = new Map();
    this.totalInputs = 0;
    this.totalCorrections = 0;
  }

  /**
   * 記錄一次輸入
   */
  recordInput(
    phaseNumber: number,
    wasCorrection: boolean,
    rulesApplied: number = 0,
    wasEffective: boolean = false
  ): void {
    // 確保階段存在
    if (!this.phases.has(phaseNumber)) {
      this.phases.set(phaseNumber, {
        phaseNumber,
        inputs: 0,
        corrections: 0,
        correctionRate: 0,
        rulesApplied: 0,
        rulesEffective: 0,
      });
    }

    const phase = this.phases.get(phaseNumber)!;

    // 更新階段指標
    phase.inputs++;
    if (wasCorrection) {
      phase.corrections++;
    }
    phase.rulesApplied += rulesApplied;
    if (wasEffective && rulesApplied > 0) {
      phase.rulesEffective++;
    }
    phase.correctionRate = phase.corrections / phase.inputs;

    // 更新總計
    this.totalInputs++;
    if (wasCorrection) {
      this.totalCorrections++;
    }
  }

  /**
   * 取得階段指標
   */
  getPhaseMetrics(phaseNumber: number): PhaseMetrics | undefined {
    return this.phases.get(phaseNumber);
  }

  /**
   * 取得所有指標
   */
  getMetrics(): UserMetrics {
    const phasesArray = Array.from(this.phases.values()).sort(
      (a, b) => a.phaseNumber - b.phaseNumber
    );

    const learningCurve = phasesArray.map(p => p.correctionRate);

    // 計算改善幅度
    let improvement = 0;
    if (learningCurve.length >= 2) {
      const firstRate = learningCurve[0];
      const lastRate = learningCurve[learningCurve.length - 1];
      if (firstRate > 0) {
        improvement = (firstRate - lastRate) / firstRate;
      }
    }

    return {
      userId: this.userId,
      totalInputs: this.totalInputs,
      totalCorrections: this.totalCorrections,
      correctionRate: this.totalInputs > 0 ? this.totalCorrections / this.totalInputs : 0,
      phases: phasesArray,
      learningCurve,
      improvement,
    };
  }

  /**
   * 重置指標
   */
  reset(): void {
    this.phases.clear();
    this.totalInputs = 0;
    this.totalCorrections = 0;
  }
}

// ============================================================================
// Metrics Analysis
// ============================================================================

/**
 * 分析學習效果
 */
export function analyzeLearningEffect(metrics: UserMetrics): {
  isSuccessful: boolean;
  summary: string;
  details: string[];
} {
  const details: string[] = [];
  let isSuccessful = true;

  // 檢查修正率下降
  if (metrics.learningCurve.length >= 2) {
    const firstRate = metrics.learningCurve[0];
    const lastRate = metrics.learningCurve[metrics.learningCurve.length - 1];

    if (lastRate >= firstRate) {
      isSuccessful = false;
      details.push(`❌ 修正率未下降 (${(firstRate * 100).toFixed(0)}% → ${(lastRate * 100).toFixed(0)}%)`);
    } else {
      details.push(`✅ 修正率下降 (${(firstRate * 100).toFixed(0)}% → ${(lastRate * 100).toFixed(0)}%)`);
    }
  }

  // 檢查改善幅度
  if (metrics.improvement < 0.5) {
    // 改善幅度 < 50%
    if (metrics.improvement > 0) {
      details.push(`⚠️ 改善幅度較小 (${(metrics.improvement * 100).toFixed(0)}%)`);
    } else {
      isSuccessful = false;
      details.push(`❌ 未見改善 (${(metrics.improvement * 100).toFixed(0)}%)`);
    }
  } else {
    details.push(`✅ 顯著改善 (${(metrics.improvement * 100).toFixed(0)}%)`);
  }

  // 檢查最終修正率
  const finalRate = metrics.learningCurve[metrics.learningCurve.length - 1] || 0;
  if (finalRate > 0.2) {
    // 最終修正率 > 20%
    details.push(`⚠️ 最終修正率偏高 (${(finalRate * 100).toFixed(0)}%)`);
  } else {
    details.push(`✅ 最終修正率良好 (${(finalRate * 100).toFixed(0)}%)`);
  }

  const summary = isSuccessful
    ? `✅ 學習效果良好：修正率從 ${(metrics.learningCurve[0] * 100).toFixed(0)}% 下降到 ${(finalRate * 100).toFixed(0)}%`
    : `❌ 學習效果不佳：改善幅度 ${(metrics.improvement * 100).toFixed(0)}%`;

  return {
    isSuccessful,
    summary,
    details,
  };
}

/**
 * 比較多個用戶的學習效果
 */
export function compareUserMetrics(
  metrics: Record<string, UserMetrics>
): {
  bestPerformer: string;
  worstPerformer: string;
  avgImprovement: number;
} {
  const entries = Object.entries(metrics);

  if (entries.length === 0) {
    return {
      bestPerformer: 'N/A',
      worstPerformer: 'N/A',
      avgImprovement: 0,
    };
  }

  let bestPerformer = entries[0][0];
  let worstPerformer = entries[0][0];
  let totalImprovement = 0;

  for (const [userId, userMetrics] of entries) {
    totalImprovement += userMetrics.improvement;

    if (userMetrics.improvement > metrics[bestPerformer].improvement) {
      bestPerformer = userId;
    }
    if (userMetrics.improvement < metrics[worstPerformer].improvement) {
      worstPerformer = userId;
    }
  }

  return {
    bestPerformer,
    worstPerformer,
    avgImprovement: totalImprovement / entries.length,
  };
}
