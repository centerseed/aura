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
  checkRuleConflicts,
  mergeRules,
  applyRuleAging,
  findMergeCandidates,
  calculateRuleHealthScore,
} from '../core/vector-store.js';
import type { Rule, Cluster, CorrectionWithEmbedding, RuleValidationResult } from '../core/types.js';

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
   * 執行蒸餾流程（多階段版本）
   *
   * Stage 1: 分群 - 使用 Adaptive Clustering
   * Stage 2: 蒸餾 - 對每個群集歸納規則
   * Stage 3: 驗證 - 檢查衝突、合併相似規則
   */
  async distill(userId: string): Promise<Rule[]> {
    console.log(`\n🔄 開始多階段蒸餾 (userId: ${userId})...`);

    // ========== Stage 0: 規則老化 ==========
    console.log('\n📅 Stage 0: 執行規則老化...');
    const agingResult = await applyRuleAging(userId);
    if (agingResult.staleCount > 0 || agingResult.archivedCount > 0) {
      console.log(`   ⏰ 降權 ${agingResult.staleCount} 條過時規則`);
      console.log(`   📦 歸檔 ${agingResult.archivedCount} 條長期未用規則`);
    }

    // ========== Stage 1: 取得並分群 ==========
    console.log('\n📊 Stage 1: 分群階段...');
    const corrections = await getUnprocessedCorrections(userId);
    console.log(`   📥 取得 ${corrections.length} 筆未處理的修正`);

    if (corrections.length < 2) {
      console.log('   ⚠️ 修正數量不足，跳過蒸餾');
      return [];
    }

    const { clusters, quality } = await this.clusteringEngine.cluster(corrections);
    console.log(`   ✅ 分群完成：${clusters.length} 個群集 (策略: ${quality.strategy})`);
    if (quality.silhouetteScore) {
      console.log(`   📈 Silhouette Score: ${quality.silhouetteScore.toFixed(3)}`);
    }

    if (clusters.length === 0) {
      console.log('   ⚠️ 無有效群集，跳過蒸餾');
      return [];
    }

    // ========== Stage 2: 蒸餾規則 ==========
    console.log('\n🧪 Stage 2: 蒸餾階段...');
    const candidateRules: Array<{
      distillResult: NonNullable<Awaited<ReturnType<typeof distillRule>>>;
      embedding: number[];
      clusterId: number;
    }> = [];

    for (const cluster of clusters) {
      console.log(`   📦 處理群集 ${cluster.id}（${cluster.corrections.length} 筆修正）...`);

      const distillResult = await distillRule(cluster.corrections);

      if (distillResult) {
        const ruleEmbedding = await getEmbedding(distillResult.ruleDescription);
        candidateRules.push({
          distillResult,
          embedding: ruleEmbedding,
          clusterId: cluster.id,
        });
        console.log(`      ✅ 候選規則: "${distillResult.ruleDescription}"`);
      } else {
        console.log('      ⚠️ 無法蒸餾規則，跳過此群集');
      }
    }

    // ========== Stage 3: 驗證與儲存 ==========
    console.log('\n🔍 Stage 3: 驗證階段...');
    const rules: Rule[] = [];
    let mergedCount = 0;
    let skippedCount = 0;

    for (const candidate of candidateRules) {
      const { distillResult, embedding } = candidate;

      // 檢查與現有規則的衝突
      const conflictCheck = await checkRuleConflicts(
        userId,
        distillResult.ruleDescription,
        distillResult.resultAction,
        embedding
      );

      if (conflictCheck.hasConflict) {
        const conflict = conflictCheck.conflictingRules[0];

        if (conflict.conflictType === 'duplicate') {
          console.log(`      ⏭️ 跳過重複規則: "${distillResult.ruleDescription}"`);
          skippedCount++;
          continue;
        }

        if (conflict.conflictType === 'same_trigger_different_result') {
          // 同樣觸發條件但不同結果 → 保留信心度較高的
          if (distillResult.confidence > conflict.rule.confidence) {
            console.log(`      🔄 新規則信心度更高，替換: "${conflict.rule.description}"`);
            await mergeRules(conflict.rule.id, conflict.rule.id); // 停用舊規則
          } else {
            console.log(`      ⏭️ 現有規則信心度更高，跳過新規則`);
            skippedCount++;
            continue;
          }
        }

        if (conflict.conflictType === 'similar') {
          // 相似規則 → 合併統計到現有規則
          console.log(`      🔗 合併到相似規則: "${conflict.rule.description}"`);
          mergedCount++;
          continue;
        }
      }

      // 儲存新規則
      const ruleId = await storeRule({
        userId,
        description: distillResult.ruleDescription,
        triggerConditions: distillResult.triggerConditions,
        resultAction: distillResult.resultAction,
        confidence: distillResult.confidence,
        embedding,
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
        embedding,
        isActive: true,
        createdAt: new Date(),
      };

      rules.push(rule);
      console.log(`      ✅ 規則已建立: "${distillResult.ruleDescription}" (信心度: ${(distillResult.confidence * 100).toFixed(0)}%)`);
    }

    // ========== Stage 4: 標記已處理 ==========
    const processedIds = clusters.flatMap(c => c.corrections.map(corr => corr.id));
    await markCorrectionsProcessed(processedIds);

    // ========== 報告 ==========
    console.log('\n📋 蒸餾報告:');
    console.log(`   ✅ 新增規則: ${rules.length} 條`);
    console.log(`   🔗 合併規則: ${mergedCount} 條`);
    console.log(`   ⏭️ 跳過規則: ${skippedCount} 條`);
    console.log(`   📝 處理修正: ${processedIds.length} 筆`);

    return rules;
  }

  /**
   * 執行規則庫維護
   * - 老化過時規則
   * - 合併相似規則
   * - 清理低效規則
   */
  async maintainRules(userId: string): Promise<{
    aged: { stale: number; archived: number };
    merged: number;
    cleaned: number;
  }> {
    console.log(`\n🔧 開始規則庫維護 (userId: ${userId})...`);

    // 1. 老化
    const agingResult = await applyRuleAging(userId);
    console.log(`   ⏰ 老化: 降權 ${agingResult.staleCount}，歸檔 ${agingResult.archivedCount}`);

    // 2. 合併
    const mergeCandidates = await findMergeCandidates(userId);
    let mergedCount = 0;
    for (const candidate of mergeCandidates) {
      await mergeRules(candidate.sourceRule.id, candidate.targetRule.id);
      console.log(`   🔗 合併: "${candidate.sourceRule.description}" → "${candidate.targetRule.description}"`);
      mergedCount++;
    }

    // 3. 清理（此處可添加刪除極低效規則的邏輯）
    const cleanedCount = 0;

    return {
      aged: { stale: agingResult.staleCount, archived: agingResult.archivedCount },
      merged: mergedCount,
      cleaned: cleanedCount,
    };
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
