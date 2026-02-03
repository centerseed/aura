/**
 * Embedding 工具模組
 *
 * 提供語意向量計算與相似度比對功能，用於兩階段檢索優化
 *
 * 使用 gemini-embedding-001 模型（取代 text-embedding-004）
 * - 支援 100+ 種語言，包括繁體中文、簡體中文、日文等
 * - 輸出 3072 維向量
 * - 修復了 text-embedding-004 對中文/日文返回相同向量的 bug
 */

import { google } from "@ai-sdk/google";
import { embed, embedMany } from "ai";

// Embedding 模型配置
const EMBEDDING_MODEL = "gemini-embedding-001";

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
  const { embeddings } = await embedMany({
    model: google.textEmbeddingModel(EMBEDDING_MODEL),
    values: texts,
  });

  return embeddings;
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
  subItems?: string[];  // sub_items 的名稱列表
}

/**
 * 找出與用戶輸入最相關的 Products
 *
 * @param userInput - 用戶輸入的文本
 * @param products - 所有可用的 Products
 * @param topK - 返回前 K 個最相似的 Products（預設 4）
 * @returns 按相似度排序的 Product 列表
 */
export async function findRelevantProducts(
  userInput: string,
  products: Array<{
    id: string;
    name: string;
    description?: string | null;
    tasks?: TaskInfo[];  // 任務內容（包含 sub_items）
  }>,
  topK: number = 4
): Promise<ProductSimilarity[]> {
  // 如果沒有 Product，直接返回空陣列
  if (products.length === 0) {
    return [];
  }

  // 過濾掉完全沒有內容的 Products（沒有 description 也沒有 tasks）
  // 這些空 Product 會產生異常的 embedding 向量
  const validProducts = products.filter(p => {
    const hasDescription = p.description && p.description.trim().length > 0;
    const hasTasks = p.tasks && p.tasks.length > 0;
    return hasDescription || hasTasks;
  });

  // 如果過濾後沒有有效的 Product，返回空陣列
  if (validProducts.length === 0) {
    return [];
  }

  // 構建增強的 Product 描述（名稱 + 描述 + 任務 + sub_items）
  const productTexts = validProducts.map(p => {
    const parts = [p.name];

    if (p.description) {
      parts.push(p.description);
    }

    // 加入所有未完成任務內容及其 sub_items 作為語意輔助
    if (p.tasks && p.tasks.length > 0) {
      const taskTexts = p.tasks.map(t => {
        if (t.subItems && t.subItems.length > 0) {
          return `${t.content}（${t.subItems.join("、")}）`;
        }
        return t.content;
      });
      parts.push("任務: " + taskTexts.join(", "));
    }

    return parts.join(" | ");
  });

  // 批次計算 Embedding（用戶輸入 + 所有 Products）
  const allTexts = [userInput, ...productTexts];
  const embeddings = await batchGetEmbeddings(allTexts);

  // 計算相似度
  const userEmbedding = embeddings[0];
  const similarities: ProductSimilarity[] = validProducts.map((product, idx) => ({
    productId: product.id,
    productName: product.name,
    similarity: cosineSimilarity(userEmbedding, embeddings[idx + 1]),
  }));

  // 按相似度排序並返回 top K
  return similarities
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, Math.min(topK, similarities.length));
}
