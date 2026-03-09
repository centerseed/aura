/**
 * Embedding 工具模組
 *
 * 使用 Gemini Embedding API (gemini-embedding-001):
 * - 維度: 768 (透過 MRL 從 3072 縮減)
 * - 延遲: ~100-200ms (API 呼叫)
 * - 支援 100+ 語言
 * - 無需本地模型載入，零冷啟動
 */

import { prisma } from "./db";

// ============================================================================
// 配置
// ============================================================================

const GEMINI_EMBEDDING_MODEL = "gemini-embedding-001";
const EMBEDDING_DIM = 768;

// API 端點
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";
const DEFAULT_EMBEDDING_TIMEOUT_MS = 8000;

type EmbeddingOptions = {
  timeoutMs?: number;
  cacheTtlMs?: number;
};

type CachedEmbedding = {
  vector: number[];
  expiresAt: number;
};

// Process-local cache: reduces repeated embedding calls for common short phrases.
const embeddingCache = new Map<string, CachedEmbedding>();
const inFlightEmbeddings = new Map<string, Promise<number[]>>();

function normalizeEmbeddingInput(text: string): string {
  return text.trim().replace(/\s+/g, " ").slice(0, 1200);
}

function getCachedEmbedding(key: string): number[] | null {
  const hit = embeddingCache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    embeddingCache.delete(key);
    return null;
  }
  return hit.vector;
}

function setCachedEmbedding(key: string, vector: number[], ttlMs: number): void {
  embeddingCache.set(key, {
    vector,
    expiresAt: Date.now() + ttlMs,
  });
}

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
export async function callGeminiEmbedding(
  text: string,
  timeoutMs: number = DEFAULT_EMBEDDING_TIMEOUT_MS
): Promise<number[]> {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is not set");
  }

  const url = `${GEMINI_API_BASE}/models/${GEMINI_EMBEDDING_MODEL}:embedContent?key=${apiKey}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: `models/${GEMINI_EMBEDDING_MODEL}`,
        content: {
          parts: [{ text }],
        },
        outputDimensionality: EMBEDDING_DIM,
      }),
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Gemini Embedding API timeout after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

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
export async function callGeminiBatchEmbedding(
  texts: string[],
  timeoutMs: number = DEFAULT_EMBEDDING_TIMEOUT_MS
): Promise<number[][]> {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is not set");
  }

  const url = `${GEMINI_API_BASE}/models/${GEMINI_EMBEDDING_MODEL}:batchEmbedContents?key=${apiKey}`;

  const requests = texts.map((text) => ({
    model: `models/${GEMINI_EMBEDDING_MODEL}`,
    content: {
      parts: [{ text }],
    },
    outputDimensionality: EMBEDDING_DIM,
  }));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ requests }),
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Gemini Batch Embedding API timeout after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini Batch Embedding API error: ${response.status} - ${error}`);
  }

  const data = (await response.json()) as GeminiBatchEmbeddingResponse;
  return data.embeddings.map((e) => e.values);
}

// ============================================================================
// 公開 API（保持與舊版相同的介面）
// ============================================================================

/**
 * 預熱（Gemini API 版本不需要，但保留介面相容性）
 */
export async function warmupModel(): Promise<void> {
  console.log("🔥 [embedding] Gemini API mode - no warmup needed");
}

/**
 * 檢查是否就緒（Gemini API 總是就緒）
 */
export function isModelReady(): boolean {
  return true;
}

/**
 * 取得 embedding 維度
 */
export function getEmbeddingDimension(): number {
  return EMBEDDING_DIM;
}

/**
 * 計算單一文本的 Embedding 向量
 */
export async function getEmbedding(
  text: string,
  options: EmbeddingOptions = {}
): Promise<number[]> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_EMBEDDING_TIMEOUT_MS;
  const cacheTtlMs = options.cacheTtlMs ?? 5 * 60 * 1000;
  const key = normalizeEmbeddingInput(text);

  const cached = getCachedEmbedding(key);
  if (cached) {
    return cached;
  }

  const inFlight = inFlightEmbeddings.get(key);
  if (inFlight) {
    return inFlight;
  }

  const task = (async () => {
    const startTime = Date.now();
    const embedding = await callGeminiEmbedding(text, timeoutMs);
    setCachedEmbedding(key, embedding, cacheTtlMs);
    console.log(`⏱️ [embedding] getEmbedding: ${Date.now() - startTime}ms`);
    return embedding;
  })().finally(() => {
    inFlightEmbeddings.delete(key);
  });

  inFlightEmbeddings.set(key, task);
  return task;
}

/**
 * 批次計算多個文本的 Embedding 向量
 */
export async function batchGetEmbeddings(
  texts: string[],
  options: EmbeddingOptions = {}
): Promise<number[][]> {
  if (texts.length === 0) return [];
  if (texts.length === 1) {
    const embedding = await getEmbedding(texts[0], options);
    return [embedding];
  }

  const timeoutMs = options.timeoutMs ?? DEFAULT_EMBEDDING_TIMEOUT_MS;
  const cacheTtlMs = options.cacheTtlMs ?? 5 * 60 * 1000;

  const result = new Array<number[]>(texts.length);
  const misses: Array<{ idx: number; text: string; key: string }> = [];

  for (let i = 0; i < texts.length; i++) {
    const key = normalizeEmbeddingInput(texts[i]);
    const cached = getCachedEmbedding(key);
    if (cached) {
      result[i] = cached;
    } else {
      misses.push({ idx: i, text: texts[i], key });
    }
  }

  if (misses.length === 0) {
    return result;
  }

  if (misses.length === 1) {
    result[misses[0].idx] = await getEmbedding(misses[0].text, options);
    return result;
  }

  const startTime = Date.now();
  const embeddings = await callGeminiBatchEmbedding(
    misses.map((m) => m.text),
    timeoutMs
  );
  console.log(`⏱️ [embedding] batchGetEmbeddings (${misses.length} texts): ${Date.now() - startTime}ms`);

  for (let i = 0; i < misses.length; i++) {
    const vector = embeddings[i];
    const miss = misses[i];
    setCachedEmbedding(miss.key, vector, cacheTtlMs);
    result[miss.idx] = vector;
  }

  return result;
}

/**
 * 計算兩個向量的餘弦相似度
 * @returns 相似度分數 (0-1，越高越相似)
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    throw new Error("向量維度不匹配");
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

/**
 * Product 相似度計算結果
 */
export interface ProductSimilarity {
  productId: string;
  productName: string;
  similarity: number;
}

/**
 * 任務資訊（包含 sub_items）
 */
export interface TaskInfo {
  content: string;
  subItems?: string[];
}

/**
 * 找出與用戶輸入最相關的 Products
 */
export async function findRelevantProducts(
  userInput: string,
  products: Array<{
    id: string;
    name: string;
    description?: string | null;
    tasks?: TaskInfo[];
  }>,
  topK: number = 4
): Promise<ProductSimilarity[]> {
  if (products.length === 0) {
    return [];
  }

  // 過濾掉完全沒有內容的 Products
  const validProducts = products.filter((p) => {
    const hasDescription = p.description && p.description.trim().length > 0;
    const hasTasks = p.tasks && p.tasks.length > 0;
    return hasDescription || hasTasks;
  });

  if (validProducts.length === 0) {
    return [];
  }

  // 構建增強的 Product 描述
  const productTexts = validProducts.map((p) => {
    const parts = [p.name];

    if (p.description) {
      parts.push(p.description);
    }

    if (p.tasks && p.tasks.length > 0) {
      const taskTexts = p.tasks.map((t) => {
        if (t.subItems && t.subItems.length > 0) {
          return `${t.content}（${t.subItems.join("、")}）`;
        }
        return t.content;
      });
      parts.push("任務: " + taskTexts.join(", "));
    }

    return parts.join(" | ");
  });

  // 批次計算 Embedding
  const allTexts = [userInput, ...productTexts];
  const embeddings = await batchGetEmbeddings(allTexts);

  // 計算相似度
  const userEmbedding = embeddings[0];
  const similarities: ProductSimilarity[] = validProducts.map((product, idx) => ({
    productId: product.id,
    productName: product.name,
    similarity: cosineSimilarity(userEmbedding, embeddings[idx + 1]),
  }));

  return similarities
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, Math.min(topK, similarities.length));
}

// ============================================================================
// pgvector 快取功能
// ============================================================================

/**
 * 計算並存儲 Task 的 embedding 向量（fire-and-forget）
 */
export async function ensureTaskEmbedding(
  taskId: string,
  content: string
): Promise<void> {
  const embedding = await getEmbedding(content);
  const vectorStr = `[${embedding.join(",")}]`;

  await prisma.$executeRaw`
    UPDATE tasks
    SET embedding = ${vectorStr}::vector
    WHERE id = ${taskId}::uuid
  `;

  console.log(`✅ [embedding] Stored embedding for Task: "${content.slice(0, 30)}..."`);
}

/**
 * 計算並存儲 Product 的 embedding 向量
 */
export async function ensureProductEmbedding(
  productId: string,
  name: string,
  description: string | null,
  force: boolean = false
): Promise<void> {
  // 檢查是否已有 embedding
  if (!force) {
    const existing = await prisma.$queryRaw<Array<{ has_embedding: boolean }>>`
      SELECT embedding IS NOT NULL as has_embedding
      FROM products
      WHERE id = ${productId}::uuid
    `;

    if (existing.length > 0 && existing[0].has_embedding) {
      return;
    }
  }

  // 構建 embedding 文本
  const text = description ? `${name} | ${description}` : name;

  // 計算 embedding
  const embedding = await getEmbedding(text);

  // 存儲到資料庫
  const vectorStr = `[${embedding.join(",")}]`;

  await prisma.$executeRaw`
    UPDATE products
    SET embedding = ${vectorStr}::vector
    WHERE id = ${productId}::uuid
  `;

  console.log(`✅ [embedding] Stored embedding for Product: ${name}`);
}

/**
 * 批次確保多個 Products 都有 embedding
 */
export async function ensureProductEmbeddings(
  products: Array<{ id: string; name: string; description: string | null }>
): Promise<void> {
  const productIds = products.map((p) => p.id);

  const missingEmbeddings = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id::text
    FROM products
    WHERE id = ANY(${productIds}::uuid[])
      AND embedding IS NULL
  `;

  const missingIds = new Set(missingEmbeddings.map((r) => r.id));

  if (missingIds.size === 0) {
    return;
  }

  const productsToEmbed = products.filter((p) => missingIds.has(p.id));

  console.log(
    `📊 [embedding] Computing embeddings for ${productsToEmbed.length} Products...`
  );

  // 批次計算 embeddings
  const texts = productsToEmbed.map((p) =>
    p.description ? `${p.name} | ${p.description}` : p.name
  );
  const embeddings = await batchGetEmbeddings(texts);

  // 批次存儲
  for (let i = 0; i < productsToEmbed.length; i++) {
    const vectorStr = `[${embeddings[i].join(",")}]`;
    await prisma.$executeRaw`
      UPDATE products
      SET embedding = ${vectorStr}::vector
      WHERE id = ${productsToEmbed[i].id}::uuid
    `;
  }

  console.log(`✅ [embedding] Stored ${productsToEmbed.length} embeddings`);
}

/**
 * 使用 pgvector 找出最相關的 Products
 */
export async function findRelevantProductsByVector(
  userInput: string,
  userId: string,
  topK: number = 4
): Promise<ProductSimilarity[]> {
  const userEmbedding = await getEmbedding(userInput);
  const vectorStr = `[${userEmbedding.join(",")}]`;

  const results = await prisma.$queryRaw<
    Array<{ id: string; name: string; similarity: number }>
  >`
    SELECT
      id::text,
      name,
      1 - (embedding <=> ${vectorStr}::vector) as similarity
    FROM products
    WHERE user_id = ${userId}::uuid
      AND deleted_at IS NULL
      AND embedding IS NOT NULL
    ORDER BY embedding <=> ${vectorStr}::vector
    LIMIT ${topK}
  `;

  return results.map((r) => ({
    productId: r.id,
    productName: r.name,
    similarity: Number(r.similarity),
  }));
}

/**
 * 混合搜尋：優先使用 pgvector
 */
export async function findRelevantProductsHybrid(
  userInput: string,
  userId: string,
  topK: number = 4
): Promise<{ results: ProductSimilarity[]; allCached: boolean }> {
  const t1 = Date.now();
  const userEmbedding = await getEmbedding(userInput);
  const embeddingTime = Date.now() - t1;

  const vectorStr = `[${userEmbedding.join(",")}]`;

  const t2 = Date.now();
  const results = await prisma.$queryRaw<
    Array<{
      id: string;
      name: string;
      similarity: number;
      total_products: bigint;
      products_with_embedding: bigint;
    }>
  >`
    WITH stats AS (
      SELECT
        COUNT(*) as total,
        COUNT(embedding) as with_embedding
      FROM products
      WHERE user_id = ${userId}::uuid AND deleted_at IS NULL
    ),
    ranked AS (
      SELECT
        id::text,
        name,
        1 - (embedding <=> ${vectorStr}::vector) as similarity
      FROM products
      WHERE user_id = ${userId}::uuid
        AND deleted_at IS NULL
        AND embedding IS NOT NULL
      ORDER BY embedding <=> ${vectorStr}::vector
      LIMIT ${topK}
    )
    SELECT
      r.id,
      r.name,
      r.similarity,
      s.total as total_products,
      s.with_embedding as products_with_embedding
    FROM ranked r
    CROSS JOIN stats s
  `;

  if (results.length === 0) {
    const countResult = await prisma.$queryRaw<Array<{ total: bigint }>>`
      SELECT COUNT(*) as total FROM products
      WHERE user_id = ${userId}::uuid AND deleted_at IS NULL
    `;
    const total = Number(countResult[0]?.total || 0);
    return { results: [], allCached: total === 0 };
  }

  const sqlTime = Date.now() - t2;
  const total = Number(results[0].total_products);
  const withEmbedding = Number(results[0].products_with_embedding);
  const allCached = withEmbedding === total;

  console.log(
    `⏱️ [embedding] embedding=${embeddingTime}ms, sql=${sqlTime}ms, total=${embeddingTime + sqlTime}ms`
  );

  if (!allCached) {
    console.log(
      `⚠️ [embedding] ${total - withEmbedding}/${total} Products missing embedding`
    );
  }

  return {
    results: results.map((r) => ({
      productId: r.id,
      productName: r.name,
      similarity: Number(r.similarity),
    })),
    allCached,
  };
}
