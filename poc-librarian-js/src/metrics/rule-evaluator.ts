/**
 * POC Librarian Engine - Rule Evaluator
 *
 * 評估規則的有效性
 */

import type { Rule, RuleMetrics } from '../core/types.js';

// ============================================================================
// Rule Metrics Calculation
// ============================================================================

/**
 * 計算規則指標
 */
export function calculateRuleMetrics(rule: Rule): RuleMetrics {
  const accuracy = rule.timesApplied > 0
    ? rule.timesCorrect / rule.timesApplied
    : 0;

  return {
    ruleId: rule.id,
    userId: rule.userId,
    description: rule.description,
    confidence: rule.confidence,
    timesApplied: rule.timesApplied,
    timesCorrect: rule.timesCorrect,
    accuracy,
    isActive: rule.isActive,
    createdAt: rule.createdAt,
    lastUsedAt: rule.lastUsedAt,
  };
}

/**
 * 批次計算規則指標
 */
export function calculateAllRuleMetrics(rules: Rule[]): RuleMetrics[] {
  return rules.map(calculateRuleMetrics);
}

// ============================================================================
// Rule Quality Analysis
// ============================================================================

/**
 * 分析規則品質
 */
export function analyzeRuleQuality(rules: Rule[]): {
  totalRules: number;
  activeRules: number;
  avgConfidence: number;
  avgAccuracy: number;
  highQualityRules: number;
  lowQualityRules: number;
  unusedRules: number;
} {
  if (rules.length === 0) {
    return {
      totalRules: 0,
      activeRules: 0,
      avgConfidence: 0,
      avgAccuracy: 0,
      highQualityRules: 0,
      lowQualityRules: 0,
      unusedRules: 0,
    };
  }

  const activeRules = rules.filter(r => r.isActive);
  const usedRules = rules.filter(r => r.timesApplied > 0);
  const unusedRules = rules.filter(r => r.timesApplied === 0);

  const totalConfidence = rules.reduce((sum, r) => sum + r.confidence, 0);
  const avgConfidence = totalConfidence / rules.length;

  // 計算平均準確率（只計算有使用過的規則）
  let totalAccuracy = 0;
  let accuracyCount = 0;
  for (const rule of usedRules) {
    const accuracy = rule.timesCorrect / rule.timesApplied;
    totalAccuracy += accuracy;
    accuracyCount++;
  }
  const avgAccuracy = accuracyCount > 0 ? totalAccuracy / accuracyCount : 0;

  // 高品質規則：準確率 > 80% 且使用次數 >= 3
  const highQualityRules = usedRules.filter(r => {
    const accuracy = r.timesCorrect / r.timesApplied;
    return accuracy >= 0.8 && r.timesApplied >= 3;
  });

  // 低品質規則：準確率 < 50% 且使用次數 >= 3
  const lowQualityRules = usedRules.filter(r => {
    const accuracy = r.timesCorrect / r.timesApplied;
    return accuracy < 0.5 && r.timesApplied >= 3;
  });

  return {
    totalRules: rules.length,
    activeRules: activeRules.length,
    avgConfidence,
    avgAccuracy,
    highQualityRules: highQualityRules.length,
    lowQualityRules: lowQualityRules.length,
    unusedRules: unusedRules.length,
  };
}

// ============================================================================
// Rule Comparison
// ============================================================================

/**
 * 比較不同用戶的規則庫
 */
export function compareUserRules(
  userRules: Record<string, Rule[]>
): {
  userStats: Record<string, { ruleCount: number; avgAccuracy: number }>;
  differentiation: {
    uniquePatterns: number;
    sharedPatterns: number;
  };
} {
  const userStats: Record<string, { ruleCount: number; avgAccuracy: number }> = {};

  // 收集每個用戶的觸發條件
  const userPatterns: Record<string, Set<string>> = {};

  for (const [userId, rules] of Object.entries(userRules)) {
    const analysis = analyzeRuleQuality(rules);
    userStats[userId] = {
      ruleCount: rules.length,
      avgAccuracy: analysis.avgAccuracy,
    };

    // 收集觸發條件
    userPatterns[userId] = new Set();
    for (const rule of rules) {
      for (const condition of rule.triggerConditions) {
        userPatterns[userId].add(condition);
      }
    }
  }

  // 計算差異化指標
  const allPatterns = new Set<string>();
  const sharedPatterns = new Set<string>();

  const userIds = Object.keys(userPatterns);
  for (const userId of userIds) {
    for (const pattern of userPatterns[userId]) {
      if (allPatterns.has(pattern)) {
        sharedPatterns.add(pattern);
      }
      allPatterns.add(pattern);
    }
  }

  const uniquePatterns = allPatterns.size - sharedPatterns.size;

  return {
    userStats,
    differentiation: {
      uniquePatterns,
      sharedPatterns: sharedPatterns.size,
    },
  };
}

// ============================================================================
// Rule Formatting
// ============================================================================

/**
 * 格式化規則為表格行
 */
export function formatRuleAsTableRow(rule: Rule, index: number): string {
  const accuracy = rule.timesApplied > 0
    ? `${((rule.timesCorrect / rule.timesApplied) * 100).toFixed(0)}%`
    : 'N/A';

  return `| ${index + 1} | ${rule.description} | ${(rule.confidence * 100).toFixed(0)}% | ${rule.timesApplied} | ${accuracy} |`;
}

/**
 * 格式化規則庫為 Markdown 表格
 */
export function formatRulesAsTable(rules: Rule[]): string {
  if (rules.length === 0) {
    return '（無規則）';
  }

  const header = '| # | 規則描述 | 信心度 | 應用次數 | 準確率 |';
  const separator = '|---|---------|--------|---------|--------|';
  const rows = rules.map((rule, idx) => formatRuleAsTableRow(rule, idx));

  return [header, separator, ...rows].join('\n');
}
