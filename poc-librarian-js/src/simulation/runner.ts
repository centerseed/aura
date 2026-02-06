/**
 * POC Librarian Engine - Simulation Runner
 *
 * 執行完整的 3 階段 POC 驗證流程
 */

import { createNaruviaAdapter } from '../adapters/naruvia-adapter.js';
import { ALL_PERSONAS, getExpectedCategory, isCorrectClassification } from './personas.js';
import { generatePhaseInputs, simulateAIPrediction } from './generator.js';
import { DIFFERENTIATION_TESTS } from './scenarios.js';
import { UserMetricsTracker } from '../metrics/user-metrics.js';
import { generateReport, ReportData } from '../metrics/report-generator.js';
import type { Persona, SimulationConfig, UserMetrics, Rule } from '../core/types.js';

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: SimulationConfig = {
  personas: ALL_PERSONAS,
  inputsPerPhase: 10,
  totalPhases: 3,
  distillThreshold: 10,
  clusteringThreshold: 0.85,
};

// ============================================================================
// Simulation Runner
// ============================================================================

export class SimulationRunner {
  private config: SimulationConfig;
  private metricsTrackers: Map<string, UserMetricsTracker>;
  private userRules: Map<string, Rule[]>;

  constructor(config: Partial<SimulationConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.metricsTrackers = new Map();
    this.userRules = new Map();

    // 初始化每個 Persona 的 metrics tracker
    for (const persona of this.config.personas) {
      this.metricsTrackers.set(persona.id, new UserMetricsTracker(persona.id));
    }
  }

  /**
   * 執行完整的 POC 驗證流程
   */
  async run(): Promise<ReportData> {
    console.log('\n' + '='.repeat(60));
    console.log('🚀 Librarian POC - Per-User Learning 驗證');
    console.log('='.repeat(60));

    const startTime = Date.now();

    // 執行每個階段
    for (let phase = 1; phase <= this.config.totalPhases; phase++) {
      await this.runPhase(phase);
    }

    // 執行差異化測試
    const differentiationResults = await this.runDifferentiationTests();

    // 收集所有結果
    const allMetrics: Record<string, UserMetrics> = {};
    const allRules: Record<string, Rule[]> = {};

    for (const persona of this.config.personas) {
      const tracker = this.metricsTrackers.get(persona.id)!;
      allMetrics[persona.id] = tracker.getMetrics();
      allRules[persona.id] = this.userRules.get(persona.id) || [];
    }

    const totalTime = Date.now() - startTime;

    // 生成報告數據
    const reportData: ReportData = {
      executionTime: new Date().toISOString(),
      totalDurationMs: totalTime,
      config: this.config,
      userMetrics: allMetrics,
      userRules: allRules,
      differentiationResults,
    };

    // 列印摘要
    this.printSummary(reportData);

    return reportData;
  }

  /**
   * 執行單一階段
   */
  private async runPhase(phaseNumber: number): Promise<void> {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`📍 Phase ${phaseNumber}: ${this.getPhaseName(phaseNumber)}`);
    console.log('─'.repeat(60));

    for (const persona of this.config.personas) {
      await this.runPhaseForPersona(persona, phaseNumber);
    }
  }

  /**
   * 為單一 Persona 執行階段
   */
  private async runPhaseForPersona(
    persona: Persona,
    phaseNumber: number
  ): Promise<void> {
    console.log(`\n👤 ${persona.name}:`);

    const adapter = createNaruviaAdapter(persona.id, {
      distillThreshold: this.config.distillThreshold,
      similarityThreshold: this.config.clusteringThreshold,
    });

    const tracker = this.metricsTrackers.get(persona.id)!;
    const inputs = generatePhaseInputs(persona, phaseNumber);

    let corrections = 0;
    let rulesApplied = 0;
    let rulesEffective = 0;

    for (const { input, expectedCategory } of inputs) {
      const startTime = Date.now();

      // 分類（使用 RAG，如果有規則的話）
      const useRag = phaseNumber > 1; // Phase 1 是 Zero-Shot
      const result = await adapter.classify(input, { useRag });

      const latencyMs = Date.now() - startTime;
      const isCorrect = result.category === expectedCategory;

      // 記錄指標
      tracker.recordInput(phaseNumber, !isCorrect, result.rulesUsed.length, isCorrect);

      if (result.rulesUsed.length > 0) {
        rulesApplied++;
        if (isCorrect) {
          rulesEffective++;
        }
        // 更新規則使用統計
        await adapter.recordClassificationResult(result.rulesUsed, isCorrect);
      }

      if (!isCorrect) {
        corrections++;

        // 記錄修正（observe 內部自動執行 Hot/Warm Path）
        await adapter.observe({
          userId: persona.id,
          domain: 'naruvia',
          type: 'correction',
          input,
          aiPrediction: { category: result.category },
          userCorrection: { category: expectedCategory },
          phaseNumber,
        });

        // 同步更新本地規則快取（Warm Path 可能已產出新規則）
        this.userRules.set(persona.id, await adapter.getRules());
      }
    }

    // 階段結束後，檢查是否需要 Cold Path 蒸餾
    const status = await adapter.getDistillationStatus();
    if (status.readyToDistill) {
      console.log(`   🔄 Cold Path 蒸餾 (${status.pendingCorrections} 筆修正)...`);
      const newRules = await adapter.reflect(persona.id);

      // 更新用戶規則
      this.userRules.set(persona.id, await adapter.getRules());

      console.log(`   ✅ 蒸餾完成：產出 ${newRules.length} 條新規則`);
    }

    // 列印階段結果
    const phaseMetrics = tracker.getPhaseMetrics(phaseNumber);
    if (phaseMetrics) {
      console.log(`   📊 修正率: ${(phaseMetrics.correctionRate * 100).toFixed(0)}%` +
        ` (${phaseMetrics.corrections}/${phaseMetrics.inputs})`);
    }
  }

  /**
   * 執行差異化測試
   */
  private async runDifferentiationTests(): Promise<{
    total: number;
    passed: number;
    results: Array<{
      input: string;
      predictions: Record<string, string>;
      expected: Record<string, string>;
      passed: boolean;
    }>;
  }> {
    console.log(`\n${'─'.repeat(60)}`);
    console.log('🔍 差異化測試：同一輸入，不同用戶');
    console.log('─'.repeat(60));

    const results: Array<{
      input: string;
      predictions: Record<string, string>;
      expected: Record<string, string>;
      passed: boolean;
    }> = [];

    let passed = 0;

    for (const test of DIFFERENTIATION_TESTS) {
      const predictions: Record<string, string> = {};

      for (const persona of this.config.personas) {
        const adapter = createNaruviaAdapter(persona.id);
        const result = await adapter.classify(test.input, { useRag: true });
        predictions[persona.id] = result.category;
      }

      // 檢查是否符合預期
      let testPassed = true;
      for (const persona of this.config.personas) {
        const expected = test.expectedOutputs[persona.id];
        if (predictions[persona.id] !== expected) {
          testPassed = false;
          break;
        }
      }

      if (testPassed) passed++;

      results.push({
        input: test.input,
        predictions,
        expected: test.expectedOutputs,
        passed: testPassed,
      });

      // 列印結果
      const status = testPassed ? '✅' : '❌';
      console.log(`\n   ${status} "${test.input}"`);
      for (const persona of this.config.personas) {
        const expected = test.expectedOutputs[persona.id];
        const actual = predictions[persona.id];
        const match = actual === expected ? '✓' : '✗';
        console.log(`      ${persona.name}: ${actual} (期望: ${expected}) ${match}`);
      }
    }

    console.log(`\n   📊 差異化成功率: ${passed}/${DIFFERENTIATION_TESTS.length}` +
      ` (${((passed / DIFFERENTIATION_TESTS.length) * 100).toFixed(0)}%)`);

    return {
      total: DIFFERENTIATION_TESTS.length,
      passed,
      results,
    };
  }

  /**
   * 列印結果摘要
   */
  private printSummary(reportData: ReportData): void {
    console.log('\n' + '='.repeat(60));
    console.log('📋 驗證結果摘要');
    console.log('='.repeat(60));

    for (const persona of this.config.personas) {
      const metrics = reportData.userMetrics[persona.id];
      const rules = reportData.userRules[persona.id];

      console.log(`\n👤 ${persona.name}:`);
      console.log(`   學習曲線: ${metrics.learningCurve.map(r => `${(r * 100).toFixed(0)}%`).join(' → ')}`);
      console.log(`   改善幅度: ${(metrics.improvement * 100).toFixed(1)}%`);
      console.log(`   規則數量: ${rules.length} 條`);
    }

    console.log(`\n🎯 差異化測試: ${reportData.differentiationResults.passed}/${reportData.differentiationResults.total}` +
      ` (${((reportData.differentiationResults.passed / reportData.differentiationResults.total) * 100).toFixed(0)}%)`);

    console.log(`\n⏱️ 總執行時間: ${(reportData.totalDurationMs / 1000).toFixed(1)} 秒`);
  }

  /**
   * 取得階段名稱
   */
  private getPhaseName(phaseNumber: number): string {
    const names: Record<number, string> = {
      1: '冷啟動 (Zero-Shot)',
      2: '學習中 (Learning)',
      3: '成熟 (Mature)',
    };
    return names[phaseNumber] || `Phase ${phaseNumber}`;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * 建立並執行 POC 驗證
 */
export async function runPOC(
  config?: Partial<SimulationConfig>
): Promise<ReportData> {
  const runner = new SimulationRunner(config);
  return runner.run();
}
