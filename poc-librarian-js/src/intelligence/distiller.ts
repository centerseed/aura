/**
 * POC Librarian Engine - Rule Distiller
 *
 * 從修正群集中蒸餾規則
 */

import { AdaptiveClusteringEngine } from './clustering.js';
import { distillRule } from '../core/llm-client.js';
import {
  getUnprocessedCorrections,
  markCorrectionsProcessed,
  storeRule,
  getEmbedding,
} from '../core/vector-store.js';
import type { Rule, Cluster, CorrectionWithEmbedding } from '../core/types.js';

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_DISTILL_THRESHOLD = 10;

// ============================================================================
// Rule Distiller
// ============================================================================

export class RuleDistiller {
  private clusteringEngine: AdaptiveClusteringEngine;
  private distillThreshold: number;

  constructor(options: {
    similarityThreshold?: number;
    distillThreshold?: number;
  } = {}) {
    this.clusteringEngine = new AdaptiveClusteringEngine(options.similarityThreshold);
    this.distillThreshold = options.distillThreshold ?? DEFAULT_DISTILL_THRESHOLD;
  }

  /**
   * 檢查是否應該觸發蒸餾
   */
  async shouldDistill(userId: string): Promise<boolean> {
    const unprocessed = await getUnprocessedCorrections(userId);
    return unprocessed.length >= this.distillThreshold;
  }

  /**
   * 執行蒸餾流程
   *
   * 1. 取得未處理的修正
   * 2. 分群
   * 3. 對每個群集蒸餾規則
   * 4. 儲存規則
   * 5. 標記修正為已處理
   */
  async distill(userId: string): Promise<Rule[]> {
    console.log(`\n🔄 開始蒸餾 (userId: ${userId})...`);

    // 1. 取得未處理的修正
    const corrections = await getUnprocessedCorrections(userId);
    console.log(`📥 取得 ${corrections.length} 筆未處理的修正`);

    if (corrections.length < 2) {
      console.log('⚠️ 修正數量不足，跳過蒸餾');
      return [];
    }

    // 2. 分群
    const { clusters, quality } = await this.clusteringEngine.cluster(corrections);
    console.log(`📊 分群完成：${clusters.length} 個群集 (策略: ${quality.strategy})`);

    if (clusters.length === 0) {
      console.log('⚠️ 無有效群集，跳過蒸餾');
      return [];
    }

    // 3. 對每個群集蒸餾規則
    const rules: Rule[] = [];

    for (const cluster of clusters) {
      console.log(`\n  📦 處理群集 ${cluster.id}（${cluster.corrections.length} 筆修正）...`);

      const distillResult = await distillRule(cluster.corrections);

      if (distillResult) {
        // 計算規則的 embedding
        const ruleEmbedding = await getEmbedding(distillResult.ruleDescription);

        // 儲存規則
        const ruleId = await storeRule({
          userId,
          description: distillResult.ruleDescription,
          triggerConditions: distillResult.triggerConditions,
          resultAction: distillResult.resultAction,
          confidence: distillResult.confidence,
          embedding: ruleEmbedding,
          isActive: true,
        });

        const rule: Rule = {
          id: ruleId,
          userId,
          description: distillResult.ruleDescription,
          triggerConditions: distillResult.triggerConditions,
          resultAction: distillResult.resultAction,
          confidence: distillResult.confidence,
          timesApplied: 0,
          timesCorrect: 0,
          embedding: ruleEmbedding,
          isActive: true,
          createdAt: new Date(),
        };

        rules.push(rule);
        console.log(`  ✅ 規則已建立: "${distillResult.ruleDescription}"`);
        console.log(`     信心度: ${(distillResult.confidence * 100).toFixed(0)}%`);
      } else {
        console.log('  ⚠️ 無法蒸餾規則，跳過此群集');
      }
    }

    // 4. 標記修正為已處理
    const processedIds = clusters.flatMap(c => c.corrections.map(corr => corr.id));
    await markCorrectionsProcessed(processedIds);
    console.log(`\n✅ 已標記 ${processedIds.length} 筆修正為已處理`);

    console.log(`\n🎉 蒸餾完成：產出 ${rules.length} 條規則`);

    return rules;
  }

  /**
   * 取得蒸餾摘要
   */
  async getDistillationSummary(userId: string): Promise<{
    pendingCorrections: number;
    threshold: number;
    readyToDistill: boolean;
  }> {
    const corrections = await getUnprocessedCorrections(userId);

    return {
      pendingCorrections: corrections.length,
      threshold: this.distillThreshold,
      readyToDistill: corrections.length >= this.distillThreshold,
    };
  }
}

// ============================================================================
// Distillation Utilities
// ============================================================================

/**
 * 格式化規則為可讀字串
 */
export function formatRule(rule: Rule): string {
  const accuracy =
    rule.timesApplied > 0
      ? ((rule.timesCorrect / rule.timesApplied) * 100).toFixed(0)
      : 'N/A';

  return `
規則: ${rule.description}
├─ 信心度: ${(rule.confidence * 100).toFixed(0)}%
├─ 應用次數: ${rule.timesApplied}
├─ 準確率: ${accuracy}%
├─ 觸發條件: ${rule.triggerConditions.join(', ')}
└─ 狀態: ${rule.isActive ? '啟用' : '停用'}
`.trim();
}

/**
 * 批次格式化規則
 */
export function formatRules(rules: Rule[]): string {
  if (rules.length === 0) {
    return '（無規則）';
  }

  return rules.map((rule, idx) => `${idx + 1}. ${formatRule(rule)}`).join('\n\n');
}
