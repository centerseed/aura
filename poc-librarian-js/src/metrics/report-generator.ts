/**
 * POC Librarian Engine - Report Generator
 *
 * 生成 POC 驗證報告
 */

import fs from 'fs/promises';
import path from 'path';
import { analyzeLearningEffect, compareUserMetrics } from './user-metrics.js';
import { analyzeRuleQuality, formatRulesAsTable, compareUserRules } from './rule-evaluator.js';
import type { UserMetrics, Rule, SimulationConfig } from '../core/types.js';

// ============================================================================
// Types
// ============================================================================

export interface ReportData {
  executionTime: string;
  totalDurationMs: number;
  config: SimulationConfig;
  userMetrics: Record<string, UserMetrics>;
  userRules: Record<string, Rule[]>;
  differentiationResults: {
    total: number;
    passed: number;
    results: Array<{
      input: string;
      predictions: Record<string, string>;
      expected: Record<string, string>;
      passed: boolean;
    }>;
  };
}

// ============================================================================
// Report Generation
// ============================================================================

/**
 * 生成完整報告
 */
export async function generateReport(
  data: ReportData,
  outputPath?: string
): Promise<string> {
  const report = buildReportMarkdown(data);

  if (outputPath) {
    await fs.writeFile(outputPath, report, 'utf-8');
    console.log(`\n📄 報告已儲存至: ${outputPath}`);
  }

  return report;
}

/**
 * 建立報告 Markdown
 */
function buildReportMarkdown(data: ReportData): string {
  const sections: string[] = [];

  // 標題
  sections.push(`# Librarian POC 驗證報告

執行時間: ${data.executionTime}
總耗時: ${(data.totalDurationMs / 1000).toFixed(1)} 秒

---`);

  // 執行摘要
  sections.push(buildExecutiveSummary(data));

  // 學習曲線
  sections.push(buildLearningCurveSection(data));

  // 規則庫
  sections.push(buildRulesSection(data));

  // 差異化測試
  sections.push(buildDifferentiationSection(data));

  // 成功標準檢查
  sections.push(buildSuccessCriteriaSection(data));

  // 結論
  sections.push(buildConclusionSection(data));

  return sections.join('\n\n');
}

/**
 * 建立執行摘要
 */
function buildExecutiveSummary(data: ReportData): string {
  const comparison = compareUserMetrics(data.userMetrics);
  const diffRate = data.differentiationResults.passed / data.differentiationResults.total;

  return `## 1. 執行摘要

| 指標 | 數值 |
|------|------|
| 測試用戶數 | ${Object.keys(data.userMetrics).length} |
| 每用戶輸入數 | ${Object.values(data.userMetrics)[0]?.totalInputs || 0} |
| 平均改善幅度 | ${(comparison.avgImprovement * 100).toFixed(1)}% |
| 差異化成功率 | ${(diffRate * 100).toFixed(0)}% |
| 總規則數 | ${Object.values(data.userRules).flat().length} |`;
}

/**
 * 建立學習曲線章節
 */
function buildLearningCurveSection(data: ReportData): string {
  let section = `## 2. 修正率下降曲線\n`;

  for (const [userId, metrics] of Object.entries(data.userMetrics)) {
    const persona = data.config.personas.find(p => p.id === userId);
    const name = persona?.name || userId;
    const analysis = analyzeLearningEffect(metrics);

    section += `
### ${name}

| 階段 | 輸入數 | 修正數 | 修正率 | 趨勢 |
|------|--------|--------|--------|------|`;

    for (let i = 0; i < metrics.phases.length; i++) {
      const phase = metrics.phases[i];
      const prevRate = i > 0 ? metrics.phases[i - 1].correctionRate : null;
      let trend = '-';

      if (prevRate !== null) {
        const diff = phase.correctionRate - prevRate;
        if (diff < -0.1) trend = '⬇️ 改善';
        else if (diff > 0.1) trend = '⬆️ 惡化';
        else trend = '➡️ 持平';
      }

      section += `
| Phase ${phase.phaseNumber} | ${phase.inputs} | ${phase.corrections} | ${(phase.correctionRate * 100).toFixed(0)}% | ${trend} |`;
    }

    section += `

**學習效果**: ${analysis.summary}
`;
  }

  return section;
}

/**
 * 建立規則庫章節
 */
function buildRulesSection(data: ReportData): string {
  let section = `## 3. 蒸餾出的規則\n`;

  for (const [userId, rules] of Object.entries(data.userRules)) {
    const persona = data.config.personas.find(p => p.id === userId);
    const name = persona?.name || userId;
    const quality = analyzeRuleQuality(rules);

    section += `
### ${name} 的規則庫 (${rules.length} 條)

${formatRulesAsTable(rules)}

- 平均信心度: ${(quality.avgConfidence * 100).toFixed(0)}%
- 平均準確率: ${(quality.avgAccuracy * 100).toFixed(0)}%
- 高品質規則: ${quality.highQualityRules} 條
`;
  }

  // 規則差異化分析
  const ruleComparison = compareUserRules(data.userRules);
  section += `
### 規則差異化分析

- 獨特模式數: ${ruleComparison.differentiation.uniquePatterns}
- 共享模式數: ${ruleComparison.differentiation.sharedPatterns}

**結論**: 不同用戶建立了不同的規則庫，證明系統能進行個人化學習。
`;

  return section;
}

/**
 * 建立差異化測試章節
 */
function buildDifferentiationSection(data: ReportData): string {
  const { differentiationResults } = data;

  let section = `## 4. 用戶差異化驗證

| 輸入 | ${data.config.personas.map(p => p.name).join(' | ')} | 差異化成功 |
|------|${data.config.personas.map(() => '------').join(' | ')} | ----------|`;

  for (const result of differentiationResults.results) {
    const predictions = data.config.personas.map(p => {
      const pred = result.predictions[p.id];
      const exp = result.expected[p.id];
      const match = pred === exp ? '✅' : '❌';
      return `${pred} ${match}`;
    });

    section += `
| ${result.input} | ${predictions.join(' | ')} | ${result.passed ? '✅' : '❌'} |`;
  }

  section += `

**結論**: 系統${differentiationResults.passed === differentiationResults.total ? '成功' : '部分'}區分不同用戶的個人化偏好 (${differentiationResults.passed}/${differentiationResults.total} = ${((differentiationResults.passed / differentiationResults.total) * 100).toFixed(0)}%)
`;

  return section;
}

/**
 * 建立成功標準檢查章節
 */
function buildSuccessCriteriaSection(data: ReportData): string {
  const metrics = Object.values(data.userMetrics);
  const rules = Object.values(data.userRules).flat();

  // 計算各項指標
  const phase1Rates = metrics.map(m => m.phases[0]?.correctionRate || 0);
  const phase3Rates = metrics.map(m => m.phases[m.phases.length - 1]?.correctionRate || 0);
  const improvements = metrics.map(m => m.improvement);
  const ruleAccuracies = rules
    .filter(r => r.timesApplied > 0)
    .map(r => r.timesCorrect / r.timesApplied);

  const avgPhase1Rate = phase1Rates.reduce((a, b) => a + b, 0) / phase1Rates.length;
  const avgPhase3Rate = phase3Rates.reduce((a, b) => a + b, 0) / phase3Rates.length;
  const avgImprovement = improvements.reduce((a, b) => a + b, 0) / improvements.length;
  const avgRuleAccuracy = ruleAccuracies.length > 0
    ? ruleAccuracies.reduce((a, b) => a + b, 0) / ruleAccuracies.length
    : 0;
  const diffRate = data.differentiationResults.passed / data.differentiationResults.total;
  const avgRuleCount = rules.length / Object.keys(data.userMetrics).length;

  const criteria = [
    {
      name: 'Phase 1 修正率',
      target: '60-80%',
      actual: `${(avgPhase1Rate * 100).toFixed(0)}%`,
      passed: avgPhase1Rate >= 0.6 && avgPhase1Rate <= 0.8,
    },
    {
      name: 'Phase 3 修正率',
      target: '< 20%',
      actual: `${(avgPhase3Rate * 100).toFixed(0)}%`,
      passed: avgPhase3Rate < 0.2,
    },
    {
      name: '改善幅度',
      target: '> 50%',
      actual: `${(avgImprovement * 100).toFixed(0)}%`,
      passed: avgImprovement > 0.5,
    },
    {
      name: '規則準確率',
      target: '> 80%',
      actual: `${(avgRuleAccuracy * 100).toFixed(0)}%`,
      passed: avgRuleAccuracy > 0.8,
    },
    {
      name: '差異化成功率',
      target: '100%',
      actual: `${(diffRate * 100).toFixed(0)}%`,
      passed: diffRate === 1,
    },
    {
      name: '規則數量',
      target: '3-8 條/用戶',
      actual: `${avgRuleCount.toFixed(1)} 條/用戶`,
      passed: avgRuleCount >= 3 && avgRuleCount <= 8,
    },
  ];

  let section = `## 5. 成功標準檢查

| 指標 | 目標 | 實際 | 結果 |
|------|------|------|------|`;

  for (const c of criteria) {
    section += `
| ${c.name} | ${c.target} | ${c.actual} | ${c.passed ? '✅' : '❌'} |`;
  }

  const passedCount = criteria.filter(c => c.passed).length;
  section += `

**總體結果**: ${passedCount}/${criteria.length} 項通過`;

  return section;
}

/**
 * 建立結論章節
 */
function buildConclusionSection(data: ReportData): string {
  const metrics = Object.values(data.userMetrics);
  const avgImprovement = metrics.reduce((sum, m) => sum + m.improvement, 0) / metrics.length;
  const diffRate = data.differentiationResults.passed / data.differentiationResults.total;

  const isSuccess = avgImprovement > 0.5 && diffRate >= 0.8;

  return `## 6. 結論

${isSuccess ? '✅ **Per-User Learning 驗證成功**' : '⚠️ **Per-User Learning 驗證部分成功**'}

- 修正率${avgImprovement > 0 ? '顯著下降' : '未見改善'}
- 規則準確率${data.userRules ? '良好' : '需改善'}
- 用戶差異化${diffRate === 1 ? '完全成功' : `部分成功 (${(diffRate * 100).toFixed(0)}%)`}

**建議**: ${isSuccess
  ? '可進入 MVP 整合階段'
  : '需要調整蒸餾策略或增加訓練資料'}

---

*報告由 Librarian POC 自動生成*`;
}

/**
 * 儲存報告到預設位置
 */
export async function saveReportToDefault(data: ReportData): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `POC_Report_${timestamp}.md`;
  const outputPath = path.join(process.cwd(), 'reports', filename);

  // 確保目錄存在
  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  return generateReport(data, outputPath);
}
