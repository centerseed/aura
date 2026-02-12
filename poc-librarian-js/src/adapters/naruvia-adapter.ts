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
  storeRule,
  searchSimilarRules,
  updateRuleUsage,
  getUserRules,
  boostRuleConfidence,
  checkRuleConflicts,
  enforceRuleLimit,
  getUnmatchedCorrectionCount,
  applyRuleAging,
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
      similarityThreshold?: number;
      categories?: string[] | null;
    } = {}
  ) {
    super(userId, options.domain ?? 'naruvia');

    this.distiller = new RuleDistiller({
      domain: this.domain,
      distillThreshold: options.distillThreshold,
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
    if (event.correctedTopic) {
      console.log(`   Topic 修正: ${event.originalTopic} → ${event.correctedTopic}`);
    }

    // 計算 embedding
    const embedding = await getEmbedding(this.formatCorrectionText(event));

    // ========== Hot Path: 即時比對現有規則 ==========
    const matchedRule = await this.hotPathMatch(event, embedding);

    if (matchedRule) {
      console.log(`   ⚡ Hot Path: 匹配規則 "${matchedRule.description}"，已 boost confidence`);
    }

    // ========== Instant Rule: 立即建立 raw rule，下次 brain dump 就能用 ==========
    let instantRuleCreated = false;
    if (!matchedRule) {
      instantRuleCreated = await this.createInstantRule(event, embedding);
    }

    // 儲存修正（Hot Path 匹配到 或 Instant Rule 建立成功 → 標記已處理）
    await storeCorrection({
      userId: event.userId,
      domain: this.domain,
      originalInput: event.input,
      aiPrediction: event.aiPrediction,
      userCorrection: event.userCorrection,
      correctedField: 'category',
      embedding,
      processed: matchedRule !== null || instantRuleCreated,
      phaseNumber: event.phaseNumber,
    });

    if (!matchedRule && !instantRuleCreated) {
      console.log('   ✅ 修正已記錄（未匹配現有規則）');
    }

    // ========== 檢查觸發條件（Cold Path 完整蒸餾） ==========
    const summary = await this.distiller.getDistillationSummary(event.userId);

    if (summary.readyToDistill) {
      console.log(`   🔔 Cold Path: 已達蒸餾閾值 (${summary.pendingCorrections}/${summary.threshold})`);
    }

    // ========== 順便跑 aging（輕量 SQL，不影響延遲） ==========
    await applyRuleAging(event.userId, this.domain);
  }

  /**
   * Instant Rule: 從單次修正直接建立低信心度規則
   *
   * 不經 LLM，直接用修正內容建規則。
   * 讓用戶「改一次就學會」— 下次 brain dump recall 就能撈到。
   * Cold Path 蒸餾時會合併/升級這些 raw rules。
   */
  private async createInstantRule(
    event: ObserveEvent,
    embedding: number[]
  ): Promise<boolean> {
    try {
      const userCorr = typeof event.userCorrection === 'string'
        ? event.userCorrection
        : (event.userCorrection as Record<string, unknown>)?.value as string
          ?? JSON.stringify(event.userCorrection);

      const description = event.input;
      const rulesToCreate: Array<{ field: string; value: string }> = [];

      // Product 修正
      if (userCorr && userCorr !== JSON.stringify(event.aiPrediction)) {
        rulesToCreate.push({ field: 'product', value: userCorr });
      }

      // Topic 修正
      if (event.correctedTopic) {
        rulesToCreate.push({ field: 'topic', value: event.correctedTopic });
      }

      if (rulesToCreate.length === 0) return false;

      let created = false;
      for (const resultAction of rulesToCreate) {
        // 檢查是否與現有規則重複
        const conflictCheck = await checkRuleConflicts(
          event.userId,
          description,
          resultAction,
          embedding,
          this.domain
        );

        if (conflictCheck.hasConflict) {
          const conflict = conflictCheck.conflictingRules[0];
          if (conflict.conflictType === 'duplicate' || conflict.conflictType === 'similar') {
            console.log(`   ⏭️ Instant Rule 跳過（${resultAction.field}）：與現有規則重複/相似`);
            continue;
          }
        }

        const ruleId = await storeRule({
          userId: event.userId,
          domain: this.domain,
          description,
          triggerConditions: [],
          resultAction,
          confidence: 0.7,
          embedding,
          isActive: true,
        });

        console.log(`   ⚡ Instant Rule 已建立: "${description}" → ${resultAction.field}: ${resultAction.value} (id: ${ruleId}, 信心度: 70%)`);
        created = true;
      }

      if (created) {
        // 強制上限 20 條，超過歸檔 confidence 最低的
        const archived = await enforceRuleLimit(event.userId, 20, this.domain);
        if (archived > 0) {
          console.log(`   🗄️ 規則上限清理: 歸檔 ${archived} 條低信心度規則`);
        }
      }

      return created;
    } catch (error) {
      console.warn('   ⚠️ Instant Rule 建立失敗:', error instanceof Error ? error.message : error);
      return false;
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
      const ruleAction = rule.resultAction as { field?: string; value?: string };
      const ruleValue = ruleAction?.value;
      const correction = event.userCorrection as Record<string, unknown>;
      const correctionValue = typeof event.userCorrection === 'string'
        ? event.userCorrection
        : (correction?.value ?? correction?.category ?? correction?.topic ?? (ruleAction?.field ? correction?.[ruleAction.field] : undefined)) as string | undefined;

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
    similarityThreshold?: number;
    categories?: string[] | null;
  }
): NaruviaAdapter {
  return new NaruviaAdapter(userId, options);
}
