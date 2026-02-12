/**
 * POC Librarian Engine - Vector Store
 *
 * 使用 Gemini Embedding API (gemini-embedding-001):
 * - 維度: 768 (透過 MRL 從 3072 縮減)
 * - 延遲: ~100-200ms (API 呼叫)
 * - 支援 100+ 語言
 */

import { queryInSchema } from './db.js';
import type {
  Correction,
  Rule,
  CorrectionWithEmbedding,
  RuleAgeStatus,
  RuleHealthScore,
  RuleMergeCandidate,
} from './types.js';

// ============================================================================
// Configuration
// ============================================================================

const GEMINI_EMBEDDING_MODEL = 'gemini-embedding-001';
const EMBEDDING_DIM = 768;
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

// ============================================================================
// Gemini Embedding API
// ============================================================================

interface GeminiEmbeddingResponse {
  embedding: {
    values: number[];
  };
}

interface GeminiBatchEmbeddingResponse {
  embeddings: Array<{
    values: number[];
  }>;
}

/**
 * 呼叫 Gemini Embedding API
 */
async function callGeminiEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    throw new Error('GOOGLE_GENERATIVE_AI_API_KEY is not set');
  }

  const url = `${GEMINI_API_BASE}/models/${GEMINI_EMBEDDING_MODEL}:embedContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: `models/${GEMINI_EMBEDDING_MODEL}`,
      content: {
        parts: [{ text }],
      },
      outputDimensionality: EMBEDDING_DIM,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini Embedding API error: ${response.status} - ${error}`);
  }

  const data = (await response.json()) as GeminiEmbeddingResponse;
  return data.embedding.values;
}

/**
 * 批次呼叫 Gemini Embedding API
 */
async function callGeminiBatchEmbedding(texts: string[]): Promise<number[][]> {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    throw new Error('GOOGLE_GENERATIVE_AI_API_KEY is not set');
  }

  const url = `${GEMINI_API_BASE}/models/${GEMINI_EMBEDDING_MODEL}:batchEmbedContents?key=${apiKey}`;

  const requests = texts.map((text) => ({
    model: `models/${GEMINI_EMBEDDING_MODEL}`,
    content: {
      parts: [{ text }],
    },
    outputDimensionality: EMBEDDING_DIM,
  }));

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ requests }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini Batch Embedding API error: ${response.status} - ${error}`);
  }

  const data = (await response.json()) as GeminiBatchEmbeddingResponse;
  return data.embeddings.map((e) => e.values);
}

// ============================================================================
// Public API
// ============================================================================

/**
 * 取得 embedding 維度
 */
export function getEmbeddingDimension(): number {
  return EMBEDDING_DIM;
}

/**
 * 計算單一文本的 Embedding 向量
 */
export async function getEmbedding(text: string): Promise<number[]> {
  return callGeminiEmbedding(text);
}

/**
 * 批次計算多個文本的 Embedding 向量
 */
export async function batchGetEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  if (texts.length === 1) {
    const embedding = await getEmbedding(texts[0]);
    return [embedding];
  }
  return callGeminiBatchEmbedding(texts);
}

/**
 * 計算兩個向量的餘弦相似度
 *
 * @returns 相似度分數 (0-1，越高越相似)
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    throw new Error(`向量維度不匹配：${vecA.length} vs ${vecB.length}`);
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);

  if (magnitude === 0) {
    return 0;
  }

  return dotProduct / magnitude;
}

// ============================================================================
// Vector Store Operations
// ============================================================================

/**
 * 儲存 Correction 到資料庫（含 embedding）
 */
export async function storeCorrection(
  correction: Omit<Correction, 'id' | 'createdAt'> & { embedding: number[] }
): Promise<string> {
  const result = await queryInSchema<{ id: string }>(
    `INSERT INTO corrections (
      user_id, domain, original_input, ai_prediction, user_correction,
      corrected_field, embedding, processed, phase_number
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING id`,
    [
      correction.userId,
      correction.domain,
      correction.originalInput,
      JSON.stringify(correction.aiPrediction),
      JSON.stringify(correction.userCorrection),
      correction.correctedField,
      `[${correction.embedding.join(',')}]`,
      correction.processed,
      correction.phaseNumber ?? null,
    ]
  );

  return result.rows[0].id;
}

/**
 * 儲存 Rule 到資料庫（含 embedding）
 */
export async function storeRule(
  rule: Omit<Rule, 'id' | 'createdAt' | 'timesApplied' | 'timesCorrect' | 'lastUsedAt'>
): Promise<string> {
  const result = await queryInSchema<{ id: string }>(
    `INSERT INTO rules (
      user_id, domain, description, trigger_conditions, result_action,
      confidence, embedding, is_active
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING id`,
    [
      rule.userId,
      rule.domain,
      rule.description,
      JSON.stringify(rule.triggerConditions),
      JSON.stringify(rule.resultAction),
      rule.confidence,
      rule.embedding ? `[${rule.embedding.join(',')}]` : null,
      rule.isActive,
    ]
  );

  return result.rows[0].id;
}

/**
 * 取得用戶未處理的 Corrections
 */
export async function getUnprocessedCorrections(userId: string, domain: string = 'naruvia'): Promise<CorrectionWithEmbedding[]> {
  const result = await queryInSchema<{
    id: string;
    user_id: string;
    domain: string;
    original_input: string;
    ai_prediction: Record<string, unknown>;
    user_correction: Record<string, unknown>;
    corrected_field: string;
    embedding: string;
    processed: boolean;
    phase_number: number | null;
    created_at: Date;
  }>(
    `SELECT * FROM corrections
     WHERE user_id = $1 AND domain = $2 AND processed = false AND embedding IS NOT NULL
     ORDER BY created_at ASC`,
    [userId, domain]
  );

  return result.rows.map(row => ({
    id: row.id,
    userId: row.user_id,
    domain: row.domain,
    originalInput: row.original_input,
    aiPrediction: row.ai_prediction,
    userCorrection: row.user_correction,
    correctedField: row.corrected_field,
    embedding: parseVector(row.embedding),
    processed: row.processed,
    phaseNumber: row.phase_number ?? undefined,
    createdAt: row.created_at,
  }));
}

/**
 * 標記 Corrections 為已處理
 */
export async function markCorrectionsProcessed(correctionIds: string[]): Promise<void> {
  if (correctionIds.length === 0) return;

  await queryInSchema(
    `UPDATE corrections SET processed = true WHERE id = ANY($1)`,
    [correctionIds]
  );
}

/**
 * 向量相似度搜尋 Rules
 */
export async function searchSimilarRules(
  userId: string,
  queryEmbedding: number[],
  topK: number = 5,
  domain: string = 'naruvia'
): Promise<Rule[]> {
  const result = await queryInSchema<{
    id: string;
    user_id: string;
    domain: string;
    description: string;
    trigger_conditions: string[];
    result_action: Record<string, unknown>;
    confidence: number;
    times_applied: number;
    times_correct: number;
    embedding: string;
    is_active: boolean;
    created_at: Date;
    last_used_at: Date | null;
    similarity: number;
  }>(
    `SELECT *, 1 - (embedding <=> $1::vector) AS similarity
     FROM rules
     WHERE user_id = $2 AND domain = $3 AND is_active = true AND embedding IS NOT NULL
     ORDER BY embedding <=> $1::vector
     LIMIT $4`,
    [`[${queryEmbedding.join(',')}]`, userId, domain, topK]
  );

  return result.rows.map(row => ({
    id: row.id,
    userId: row.user_id,
    domain: row.domain,
    description: row.description,
    triggerConditions: row.trigger_conditions,
    resultAction: row.result_action,
    confidence: row.confidence,
    timesApplied: row.times_applied,
    timesCorrect: row.times_correct,
    embedding: parseVector(row.embedding),
    isActive: row.is_active,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at ?? undefined,
  }));
}

/**
 * 更新 Rule 使用統計
 */
export async function updateRuleUsage(
  ruleId: string,
  wasCorrect: boolean
): Promise<void> {
  await queryInSchema(
    `UPDATE rules
     SET times_applied = times_applied + 1,
         times_correct = times_correct + $2,
         last_used_at = NOW()
     WHERE id = $1`,
    [ruleId, wasCorrect ? 1 : 0]
  );
}

/**
 * 取得用戶的所有 Rules
 */
export async function getUserRules(userId: string, domain: string = 'naruvia'): Promise<Rule[]> {
  const result = await queryInSchema<{
    id: string;
    user_id: string;
    domain: string;
    description: string;
    trigger_conditions: string[];
    result_action: Record<string, unknown>;
    confidence: number;
    times_applied: number;
    times_correct: number;
    embedding: string | null;
    is_active: boolean;
    created_at: Date;
    last_used_at: Date | null;
  }>(
    `SELECT * FROM rules WHERE user_id = $1 AND domain = $2 ORDER BY confidence DESC`,
    [userId, domain]
  );

  return result.rows.map(row => ({
    id: row.id,
    userId: row.user_id,
    domain: row.domain,
    description: row.description,
    triggerConditions: row.trigger_conditions,
    resultAction: row.result_action,
    confidence: row.confidence,
    timesApplied: row.times_applied,
    timesCorrect: row.times_correct,
    embedding: row.embedding ? parseVector(row.embedding) : undefined,
    isActive: row.is_active,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at ?? undefined,
  }));
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * 解析 PostgreSQL vector 字串為 number[]
 */
function parseVector(vectorStr: string): number[] {
  if (!vectorStr) return [];

  // PostgreSQL vector 格式: [1.0,2.0,3.0] 或 (1.0,2.0,3.0)
  const cleaned = vectorStr.replace(/[\[\]()]/g, '');
  return cleaned.split(',').map(Number);
}

/**
 * 計算向量的 centroid
 */
export function calculateCentroid(embeddings: number[][]): number[] {
  if (embeddings.length === 0) return [];

  const dim = embeddings[0].length;
  const centroid = new Array(dim).fill(0);

  for (const emb of embeddings) {
    for (let i = 0; i < dim; i++) {
      centroid[i] += emb[i];
    }
  }

  return centroid.map(v => v / embeddings.length);
}

// ============================================================================
// Rule Lifecycle Management (System 2 Improvements)
// ============================================================================

const STALE_THRESHOLD_DAYS = 30;
const ARCHIVE_THRESHOLD_DAYS = 60;
const SIMILARITY_MERGE_THRESHOLD = 0.9;

/**
 * 計算規則的老化狀態
 */
export function calculateRuleAgeStatus(rule: Rule): RuleAgeStatus {
  const now = new Date();
  const lastUsed = rule.lastUsedAt || rule.createdAt;
  const daysSinceLastUse = (now.getTime() - lastUsed.getTime()) / (1000 * 60 * 60 * 24);

  if (daysSinceLastUse >= ARCHIVE_THRESHOLD_DAYS) {
    return 'archived';
  } else if (daysSinceLastUse >= STALE_THRESHOLD_DAYS) {
    return 'stale';
  }
  return 'active';
}

/**
 * 計算規則健康分數
 *
 * 基於 ACT-R 認知架構的記憶強度公式：
 * - 準確率 (40%): 規則的正確率
 * - 使用頻率 (30%): 應用次數（對數衰減）
 * - 最近使用 (20%): 距離上次使用的時間
 * - 規則年齡 (10%): 規則存在時間（越老越穩定）
 */
export function calculateRuleHealthScore(rule: Rule): RuleHealthScore {
  const now = new Date();

  // 準確率 (0-1)
  const accuracy = rule.timesApplied > 0
    ? rule.timesCorrect / rule.timesApplied
    : 0.5; // 未使用的規則預設 0.5

  // 使用頻率 (對數衰減，最高 1)
  const frequency = Math.min(1, Math.log10(rule.timesApplied + 1) / 2);

  // 最近使用 (指數衰減，半衰期 30 天)
  const lastUsed = rule.lastUsedAt || rule.createdAt;
  const daysSinceLastUse = (now.getTime() - lastUsed.getTime()) / (1000 * 60 * 60 * 24);
  const recency = Math.exp(-daysSinceLastUse / 30);

  // 規則年齡 (越老越穩定，上限 1)
  const ageInDays = (now.getTime() - rule.createdAt.getTime()) / (1000 * 60 * 60 * 24);
  const age = Math.min(1, ageInDays / 90);

  // 綜合分數
  const score = accuracy * 0.4 + frequency * 0.3 + recency * 0.2 + age * 0.1;

  // 建議
  let recommendation: 'keep' | 'merge' | 'archive' | 'delete';
  if (score >= 0.7) {
    recommendation = 'keep';
  } else if (score >= 0.4) {
    recommendation = 'merge';
  } else if (score >= 0.2) {
    recommendation = 'archive';
  } else {
    recommendation = 'delete';
  }

  return {
    ruleId: rule.id,
    score,
    factors: { accuracy, frequency, recency, age },
    recommendation,
  };
}

/**
 * 找出可合併的規則對
 */
export async function findMergeCandidates(
  userId: string,
  threshold: number = SIMILARITY_MERGE_THRESHOLD,
  domain: string = 'naruvia'
): Promise<RuleMergeCandidate[]> {
  const rules = await getUserRules(userId, domain);
  const candidates: RuleMergeCandidate[] = [];

  for (let i = 0; i < rules.length; i++) {
    for (let j = i + 1; j < rules.length; j++) {
      const ruleA = rules[i];
      const ruleB = rules[j];

      // 只比較都有 embedding 的規則
      if (!ruleA.embedding || !ruleB.embedding) continue;

      const similarity = cosineSimilarity(ruleA.embedding, ruleB.embedding);

      if (similarity >= threshold) {
        // 判斷誰是 source（較弱的）誰是 target（較強的）
        const healthA = calculateRuleHealthScore(ruleA);
        const healthB = calculateRuleHealthScore(ruleB);

        const [sourceRule, targetRule] = healthA.score < healthB.score
          ? [ruleA, ruleB]
          : [ruleB, ruleA];

        candidates.push({
          sourceRule,
          targetRule,
          similarity,
          reason: `語意相似度 ${(similarity * 100).toFixed(1)}%，建議合併到較強的規則`,
        });
      }
    }
  }

  return candidates;
}

/**
 * 執行規則老化（降權過時規則）
 */
export async function applyRuleAging(userId: string, domain: string = 'naruvia'): Promise<{
  staleCount: number;
  archivedCount: number;
}> {
  // 30 天未使用 → 降低 confidence 50%
  const staleResult = await queryInSchema<{ count: string }>(
    `UPDATE rules
     SET confidence = confidence * 0.5
     WHERE user_id = $1 AND domain = $2
       AND is_active = true
       AND (last_used_at IS NULL OR last_used_at < NOW() - INTERVAL '30 days')
       AND created_at < NOW() - INTERVAL '30 days'
     RETURNING id`,
    [userId, domain]
  );

  // 60 天未使用 → 歸檔（停用）
  const archiveResult = await queryInSchema<{ count: string }>(
    `UPDATE rules
     SET is_active = false
     WHERE user_id = $1 AND domain = $2
       AND is_active = true
       AND (last_used_at IS NULL OR last_used_at < NOW() - INTERVAL '60 days')
       AND created_at < NOW() - INTERVAL '60 days'
     RETURNING id`,
    [userId, domain]
  );

  return {
    staleCount: staleResult.rowCount || 0,
    archivedCount: archiveResult.rowCount || 0,
  };
}

/**
 * 合併兩條規則
 */
export async function mergeRules(
  sourceRuleId: string,
  targetRuleId: string
): Promise<void> {
  // 將 source 的統計合併到 target
  await queryInSchema(
    `UPDATE rules AS target
     SET times_applied = target.times_applied + source.times_applied,
         times_correct = target.times_correct + source.times_correct,
         confidence = GREATEST(target.confidence, source.confidence)
     FROM rules AS source
     WHERE target.id = $1 AND source.id = $2`,
    [targetRuleId, sourceRuleId]
  );

  // 停用 source 規則
  await queryInSchema(
    `UPDATE rules SET is_active = false WHERE id = $1`,
    [sourceRuleId]
  );
}

/**
 * 即時增強規則信心度（Hot Path）
 *
 * 當新修正與現有規則匹配時，提升該規則的 confidence。
 * 純 SQL 操作，不呼叫 LLM。
 */
export async function boostRuleConfidence(
  ruleId: string,
  boostAmount: number = 0.02,
  maxConfidence: number = 0.98
): Promise<void> {
  await queryInSchema(
    `UPDATE rules
     SET confidence = LEAST($2, confidence + $3),
         last_used_at = NOW()
     WHERE id = $1`,
    [ruleId, maxConfidence, boostAmount]
  );
}

/**
 * 取得用戶未匹配的修正數量（未被 Hot Path 處理的修正）
 */
export async function getUnmatchedCorrectionCount(userId: string, domain: string = 'naruvia'): Promise<number> {
  const result = await queryInSchema<{ count: string }>(
    `SELECT COUNT(*) as count FROM corrections
     WHERE user_id = $1 AND domain = $2 AND processed = false AND embedding IS NOT NULL`,
    [userId, domain]
  );
  return parseInt(result.rows[0].count, 10);
}

/**
 * 強制規則數量上限
 *
 * 超過 maxRules 時，歸檔 confidence 最低的規則。
 */
export async function enforceRuleLimit(
  userId: string,
  maxRules: number = 20,
  domain: string = 'naruvia'
): Promise<number> {
  const result = await queryInSchema<{ id: string }>(
    `UPDATE rules SET is_active = false
     WHERE id IN (
       SELECT id FROM rules
       WHERE user_id = $1 AND domain = $2 AND is_active = true
       ORDER BY confidence DESC
       OFFSET $3
     )
     RETURNING id`,
    [userId, domain, maxRules]
  );
  return result.rowCount || 0;
}

/**
 * 歸檔單條規則（設為 is_active = false）
 */
export async function archiveRule(ruleId: string): Promise<void> {
  await queryInSchema(
    `UPDATE rules SET is_active = false WHERE id = $1`,
    [ruleId]
  );
}

/**
 * 歸檔所有低品質垃圾規則（confidence < threshold 且從未被使用）
 */
export async function archiveJunkRules(
  userId: string,
  confidenceThreshold: number = 0.5,
  domain: string = 'naruvia'
): Promise<number> {
  const result = await queryInSchema<{ id: string }>(
    `UPDATE rules SET is_active = false
     WHERE user_id = $1 AND domain = $2
       AND is_active = true
       AND confidence < $3
       AND times_applied = 0
     RETURNING id`,
    [userId, domain, confidenceThreshold]
  );
  return result.rowCount || 0;
}

/**
 * 檢查新規則是否與現有規則衝突
 */
export async function checkRuleConflicts(
  userId: string,
  newRuleDescription: string,
  newRuleAction: Record<string, unknown>,
  newRuleEmbedding: number[],
  domain: string = 'naruvia'
): Promise<{
  hasConflict: boolean;
  conflictingRules: Array<{
    rule: Rule;
    similarity: number;
    conflictType: 'same_trigger_different_result' | 'duplicate' | 'similar';
  }>;
}> {
  const existingRules = await searchSimilarRules(userId, newRuleEmbedding, 5, domain);
  const conflicts: Array<{
    rule: Rule;
    similarity: number;
    conflictType: 'same_trigger_different_result' | 'duplicate' | 'similar';
  }> = [];

  for (const rule of existingRules) {
    if (!rule.embedding) continue;

    const similarity = cosineSimilarity(newRuleEmbedding, rule.embedding);

    if (similarity >= 0.95) {
      // 幾乎完全相同
      const sameResult = JSON.stringify(rule.resultAction) === JSON.stringify(newRuleAction);
      conflicts.push({
        rule,
        similarity,
        conflictType: sameResult ? 'duplicate' : 'same_trigger_different_result',
      });
    } else if (similarity >= 0.8) {
      // 高度相似
      conflicts.push({
        rule,
        similarity,
        conflictType: 'similar',
      });
    }
  }

  return {
    hasConflict: conflicts.length > 0,
    conflictingRules: conflicts,
  };
}
