/**
 * POC Librarian Engine - Naruvia Adapter
 *
 * Naruvia 專用的 Librarian Adapter
 * 處理任務分類的規則學習
 */

import { BaseLibrarianAdapter } from './base-adapter.js';
import { RuleDistiller } from '../intelligence/distiller.js';
import {
  getEmbedding,
  storeCorrection,
  searchSimilarRules,
  updateRuleUsage,
  getUserRules,
  boostRuleConfidence,
  getUnmatchedCorrectionCount,
} from '../core/vector-store.js';
import { classifyTask } from '../core/llm-client.js';
import type {
  ObserveEvent,
  RecallQuery,
  Rule,
  ClassificationResult,
} from '../core/types.js';

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_TOP_K = 5;
const RULE_RELEVANCE_THRESHOLD = 0.7;

// ============================================================================
// Naruvia Adapter
// ============================================================================

export class NaruviaAdapter extends BaseLibrarianAdapter {
  private distiller: RuleDistiller;
  private categories: string[] | null;

  constructor(
    userId: string,
    options: {
      domain?: string;
      distillThreshold?: number;
      warmThreshold?: number;
      similarityThreshold?: number;
      categories?: string[] | null;
    } = {}
  ) {
    super(userId, options.domain ?? 'naruvia');

    this.distiller = new RuleDistiller({
      domain: this.domain,
      distillThreshold: options.distillThreshold,
      warmThreshold: options.warmThreshold,
      similarityThreshold: options.similarityThreshold,
    });

    this.categories = options.categories !== undefined ? options.categories : [
      '公司資產',
      '營運成本',
      '人才投資',
      '個人娛樂',
      '工作工具',
      '職涯發展',
    ];
  }

  /**
   * 記錄用戶修正
   *
   * 三層觸發策略（ADR-001）:
   * - Hot Path: 每次修正立即比對現有規則，匹配則 boost confidence（0 次 LLM）
   * - Warm Path: 累積 3 筆未匹配修正 → 嘗試歸納 1 條新規則（1 次 LLM）
   * - Cold Path: 累積 10 筆 → 完整蒸餾（N 次 LLM）
   */
  async observe(event: ObserveEvent): Promise<void> {
    console.log(`📝 記錄修正: "${event.input}"`);
    console.log(`   AI 預測: ${JSON.stringify(event.aiPrediction)}`);
    console.log(`   用戶修正: ${JSON.stringify(event.userCorrection)}`);

    // 計算 embedding
    const embedding = await getEmbedding(this.formatCorrectionText(event));

    // ========== Hot Path: 即時比對現有規則 ==========
    const matchedRule = await this.hotPathMatch(event, embedding);

    // 儲存修正（Hot Path 匹配到的標記為已處理）
    await storeCorrection({
      userId: event.userId,
      domain: this.domain,
      originalInput: event.input,
      aiPrediction: event.aiPrediction,
      userCorrection: event.userCorrection,
      correctedField: 'category',
      embedding,
      processed: matchedRule !== null,
      phaseNumber: event.phaseNumber,
    });

    if (matchedRule) {
      console.log(`   ⚡ Hot Path: 匹配規則 "${matchedRule.description}"，已 boost confidence`);
      return;
    }

    console.log('   ✅ 修正已記錄（未匹配現有規則）');

    // ========== 檢查觸發條件 ==========
    const summary = await this.distiller.getDistillationSummary(event.userId);

    if (summary.readyToDistill) {
      // Cold Path
      console.log(`   🔔 Cold Path: 已達蒸餾閾值 (${summary.pendingCorrections}/${summary.threshold})`);
    } else if (summary.pendingCorrections >= 3) {
      // Warm Path
      console.log(`   ⚡ Warm Path: 嘗試快速蒸餾 (${summary.pendingCorrections} 筆)...`);
      const warmRule = await this.distiller.warmDistill(event.userId);
      if (warmRule) {
        console.log(`   ✅ Warm Path 產出規則: "${warmRule.description}"`);
      }
    }
  }

  /**
   * Hot Path: 比對修正是否與現有規則一致
   *
   * 如果用戶的修正結果與某條現有規則的 resultAction 一致，
   * 且輸入語意相似，則 boost 該規則的 confidence。
   * 純向量運算 + SQL，不呼叫 LLM。
   */
  private async hotPathMatch(
    event: ObserveEvent,
    correctionEmbedding: number[]
  ): Promise<Rule | null> {
    // 搜尋語意相似的規則
    const similarRules = await searchSimilarRules(event.userId, correctionEmbedding, 3, this.domain);

    for (const rule of similarRules) {
      // 檢查修正結果是否與規則一致
      const ruleValue = (rule.resultAction as { value?: string })?.value;
      const correctionValue = (event.userCorrection as { value?: string })?.value
        ?? (event.userCorrection as { category?: string })?.category;

      if (ruleValue && correctionValue && ruleValue === correctionValue) {
        // 修正方向一致 → boost confidence
        await boostRuleConfidence(rule.id);
        return rule;
      }
    }

    return null;
  }

  /**
   * 檢索相關規則
   */
  async recall(query: RecallQuery): Promise<Rule[]> {
    const topK = query.topK ?? DEFAULT_TOP_K;

    // 計算查詢的 embedding
    const queryEmbedding = await getEmbedding(query.input);

    // 向量相似度搜尋
    const rules = await searchSimilarRules(query.userId, queryEmbedding, topK, this.domain);

    // 過濾低相關度的規則
    const relevantRules = rules.filter(rule => {
      // 檢查語意相似度（透過 embedding 搜尋已經排序）
      // 這裡可以加入額外的關鍵字匹配檢查
      return this.checkRuleMatch(query.input, rule);
    });

    console.log(`🔍 檢索到 ${relevantRules.length} 條相關規則`);

    return relevantRules;
  }

  /**
   * 觸發蒸餾
   */
  async reflect(userId: string): Promise<Rule[]> {
    return this.distiller.distill(userId);
  }

  /**
   * 執行分類（整合 RAG）
   */
  async classify(
    input: string,
    options: { useRag?: boolean } = {}
  ): Promise<ClassificationResult> {
    const { useRag = true } = options;

    let rules: Rule[] = [];

    if (useRag) {
      rules = await this.recall({
        userId: this.userId,
        domain: this.domain,
        input,
        topK: DEFAULT_TOP_K,
      });
    }

    const result = await classifyTask(input, {
      useRag,
      rules,
      categories: this.categories ?? undefined,
    });

    return result;
  }

  /**
   * 記錄分類結果的正確性（用於更新規則統計）
   */
  async recordClassificationResult(
    rulesUsed: string[],
    wasCorrect: boolean
  ): Promise<void> {
    for (const ruleId of rulesUsed) {
      await updateRuleUsage(ruleId, wasCorrect);
    }
  }

  /**
   * 取得用戶的所有規則
   */
  async getRules(): Promise<Rule[]> {
    return getUserRules(this.userId, this.domain);
  }

  /**
   * 取得蒸餾狀態
   */
  async getDistillationStatus(): Promise<{
    pendingCorrections: number;
    threshold: number;
    readyToDistill: boolean;
  }> {
    return this.distiller.getDistillationSummary(this.userId);
  }

  /**
   * 格式化修正文本（用於 embedding）
   */
  private formatCorrectionText(event: ObserveEvent): string {
    const parts = [
      `輸入: ${event.input}`,
      `AI 預測: ${JSON.stringify(event.aiPrediction)}`,
      `用戶修正: ${JSON.stringify(event.userCorrection)}`,
    ];

    return parts.join(' | ');
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * 建立 Naruvia Adapter
 */
export function createNaruviaAdapter(
  userId: string,
  options?: {
    domain?: string;
    distillThreshold?: number;
    warmThreshold?: number;
    similarityThreshold?: number;
    categories?: string[] | null;
  }
): NaruviaAdapter {
  return new NaruviaAdapter(userId, options);
}
