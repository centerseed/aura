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
  private categories: string[];

  constructor(
    userId: string,
    options: {
      distillThreshold?: number;
      similarityThreshold?: number;
      categories?: string[];
    } = {}
  ) {
    super(userId);

    this.distiller = new RuleDistiller({
      distillThreshold: options.distillThreshold,
      similarityThreshold: options.similarityThreshold,
    });

    this.categories = options.categories ?? [
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
   */
  async observe(event: ObserveEvent): Promise<void> {
    console.log(`📝 記錄修正: "${event.input}"`);
    console.log(`   AI 預測: ${JSON.stringify(event.aiPrediction)}`);
    console.log(`   用戶修正: ${JSON.stringify(event.userCorrection)}`);

    // 計算 embedding
    const embedding = await getEmbedding(this.formatCorrectionText(event));

    // 儲存修正
    await storeCorrection({
      userId: event.userId,
      originalInput: event.input,
      aiPrediction: event.aiPrediction,
      userCorrection: event.userCorrection,
      correctedField: 'category',
      embedding,
      processed: false,
      phaseNumber: event.phaseNumber,
    });

    console.log('   ✅ 修正已記錄');

    // 檢查是否需要觸發蒸餾
    const summary = await this.distiller.getDistillationSummary(event.userId);
    if (summary.readyToDistill) {
      console.log(`   🔔 已達蒸餾閾值 (${summary.pendingCorrections}/${summary.threshold})`);
    }
  }

  /**
   * 檢索相關規則
   */
  async recall(query: RecallQuery): Promise<Rule[]> {
    const topK = query.topK ?? DEFAULT_TOP_K;

    // 計算查詢的 embedding
    const queryEmbedding = await getEmbedding(query.input);

    // 向量相似度搜尋
    const rules = await searchSimilarRules(query.userId, queryEmbedding, topK);

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
        input,
        topK: DEFAULT_TOP_K,
      });
    }

    const result = await classifyTask(input, {
      useRag,
      rules,
      categories: this.categories,
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
    return getUserRules(this.userId);
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
    distillThreshold?: number;
    similarityThreshold?: number;
    categories?: string[];
  }
): NaruviaAdapter {
  return new NaruviaAdapter(userId, options);
}
