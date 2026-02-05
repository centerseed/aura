/**
 * POC Librarian Engine - Vector Store
 *
 * 提供 Embedding 生成和向量相似度搜尋功能
 * 使用 gemini-embedding-001 模型（3072 維）
 */

import { google } from '@ai-sdk/google';
import { embed, embedMany } from 'ai';
import { queryInSchema } from './db.js';
import type { Correction, Rule, CorrectionWithEmbedding } from './types.js';

// ============================================================================
// Configuration
// ============================================================================

const EMBEDDING_MODEL = 'gemini-embedding-001';
const EMBEDDING_DIMENSIONS = 3072;

// ============================================================================
// Embedding Generation
// ============================================================================

/**
 * 計算單一文本的 Embedding 向量
 */
export async function getEmbedding(text: string): Promise<number[]> {
  const { embedding } = await embed({
    model: google.textEmbeddingModel(EMBEDDING_MODEL),
    value: text,
  });

  return embedding;
}

/**
 * 批次計算多個文本的 Embedding 向量
 */
export async function batchGetEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) {
    return [];
  }

  const { embeddings } = await embedMany({
    model: google.textEmbeddingModel(EMBEDDING_MODEL),
    values: texts,
  });

  return embeddings;
}

// ============================================================================
// Similarity Calculation
// ============================================================================

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
      user_id, original_input, ai_prediction, user_correction,
      corrected_field, embedding, processed, phase_number
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING id`,
    [
      correction.userId,
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
      user_id, description, trigger_conditions, result_action,
      confidence, embedding, is_active
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id`,
    [
      rule.userId,
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
export async function getUnprocessedCorrections(userId: string): Promise<CorrectionWithEmbedding[]> {
  const result = await queryInSchema<{
    id: string;
    user_id: string;
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
     WHERE user_id = $1 AND processed = false AND embedding IS NOT NULL
     ORDER BY created_at ASC`,
    [userId]
  );

  return result.rows.map(row => ({
    id: row.id,
    userId: row.user_id,
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
  topK: number = 5
): Promise<Rule[]> {
  const result = await queryInSchema<{
    id: string;
    user_id: string;
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
     WHERE user_id = $2 AND is_active = true AND embedding IS NOT NULL
     ORDER BY embedding <=> $1::vector
     LIMIT $3`,
    [`[${queryEmbedding.join(',')}]`, userId, topK]
  );

  return result.rows.map(row => ({
    id: row.id,
    userId: row.user_id,
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
export async function getUserRules(userId: string): Promise<Rule[]> {
  const result = await queryInSchema<{
    id: string;
    user_id: string;
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
    `SELECT * FROM rules WHERE user_id = $1 ORDER BY confidence DESC`,
    [userId]
  );

  return result.rows.map(row => ({
    id: row.id,
    userId: row.user_id,
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
