/**
 * NaruMemoryManager — Zentropy 的長期記憶層
 *
 * 使用原版 naru-agent-js 的 MemoryManager（mem0-equivalent pipeline）：
 *   1. LLM 萃取對話中的用戶事實
 *   2. Embedding 搜尋現有記憶，找出相似條目進行調和
 *   3. ADD / UPDATE / DELETE / NONE
 *   4. 寫入 pgvector（naru_memories 表）
 *
 * Store backend：PrismaVectorMemoryStore（Prisma raw query + pgvector）
 * Embedder：Gemini embedding-001（768 dim）
 * LLM：Gemini 2.0 Flash（事實萃取 + reconciliation）
 */

import { MemoryManager, type MemoryStore, type MemoryItem } from "naru-agent-js"
import { google } from "@ai-sdk/google"
import { prisma } from "@/lib/db"
import { batchGetEmbeddings, getEmbedding } from "@/lib/embedding"

// ============================================================================
// PrismaVectorMemoryStore — pgvector backend via Prisma raw queries
// ============================================================================

class PrismaVectorMemoryStore implements MemoryStore {
  async add(item: MemoryItem, embedding: number[]): Promise<void> {
    const vectorStr = `[${embedding.join(",")}]`
    await prisma.$executeRaw`
      INSERT INTO naru_memories (id, user_id, content, metadata, embedding, created_at, updated_at)
      VALUES (
        ${item.id},
        ${item.userId},
        ${item.content},
        ${JSON.stringify(item.metadata)}::jsonb,
        ${vectorStr}::vector,
        ${item.createdAt},
        ${item.updatedAt}
      )
      ON CONFLICT (id) DO UPDATE
        SET content = EXCLUDED.content,
            metadata = EXCLUDED.metadata,
            embedding = EXCLUDED.embedding,
            updated_at = EXCLUDED.updated_at
    `
  }

  async search(userId: string, embedding: number[], topK = 5): Promise<MemoryItem[]> {
    const vectorStr = `[${embedding.join(",")}]`
    const rows = await prisma.$queryRaw<Array<{
      id: string
      user_id: string
      content: string
      metadata: Record<string, unknown>
      score: number
      created_at: Date
      updated_at: Date
    }>>`
      SELECT
        id, user_id, content, metadata,
        1 - (embedding <=> ${vectorStr}::vector) AS score,
        created_at, updated_at
      FROM naru_memories
      WHERE user_id = ${userId}
      ORDER BY embedding <=> ${vectorStr}::vector
      LIMIT ${topK}
    `
    return rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      content: r.content,
      metadata: r.metadata ?? {},
      score: Number(r.score),
      createdAt: new Date(r.created_at),
      updatedAt: new Date(r.updated_at),
    }))
  }

  async update(itemId: string, content: string, embedding: number[]): Promise<void> {
    const vectorStr = `[${embedding.join(",")}]`
    await prisma.$executeRaw`
      UPDATE naru_memories
      SET content = ${content},
          embedding = ${vectorStr}::vector,
          updated_at = NOW()
      WHERE id = ${itemId}
    `
  }

  async delete(itemId: string): Promise<void> {
    await prisma.$executeRaw`DELETE FROM naru_memories WHERE id = ${itemId}`
  }

  async getAll(userId: string): Promise<MemoryItem[]> {
    const rows = await prisma.$queryRaw<Array<{
      id: string
      user_id: string
      content: string
      metadata: Record<string, unknown>
      created_at: Date
      updated_at: Date
    }>>`
      SELECT id, user_id, content, metadata, created_at, updated_at
      FROM naru_memories
      WHERE user_id = ${userId}
      ORDER BY created_at
    `
    return rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      content: r.content,
      metadata: r.metadata ?? {},
      createdAt: new Date(r.created_at),
      updatedAt: new Date(r.updated_at),
    }))
  }
}

// ============================================================================
// embedFn adapter — naru-agent-js EmbedFn 格式
// ============================================================================

async function embedFn(texts: string[]): Promise<number[][]> {
  return batchGetEmbeddings(texts)
}

// ============================================================================
// 匯出：使用原版 MemoryManager pipeline
// ============================================================================

export function createMemoryManager(): MemoryManager {
  return new MemoryManager({
    model: google("gemini-2.0-flash"),
    store: new PrismaVectorMemoryStore(),
    embedFn,
    reconciliationTopK: 3,
  })
}
