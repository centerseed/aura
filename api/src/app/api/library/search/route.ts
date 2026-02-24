/**
 * POST /api/library/search - 語意搜尋
 *
 * 使用 pgvector 對 tasks 和 products 進行語意搜尋。
 * 供 MCP query_memory / search 工具呼叫。
 */

import { NextRequest } from "next/server";
import { authenticateRequest } from "@/lib/auth-middleware";
import { prisma } from "@/lib/db";
import {
  ApiResponseBuilder,
  ValidationException,
  catchDomainException,
} from "@/lib/api-response";
import { checkAiRateLimit, incrementAiUsage } from "@/lib/ai-rate-limit";
import { getEmbedding } from "@/lib/embedding";

interface SearchRequestBody {
  query: string;
  scope?: string;
  limit?: number;
}

interface ReferenceMetadata {
  id: string;
  type: "url" | "note";
  title?: string | null;
  created_at: string;
}

interface SearchResultItem {
  id: string;
  title: string;
  content: string;
  score: number;
  product_name?: string;
  area_name?: string;
  references?: ReferenceMetadata[];
}

export async function POST(request: NextRequest) {
  return catchDomainException(async () => {
    const userId = await authenticateRequest(request, prisma);
    await checkAiRateLimit(userId);
    const body = (await request.json()) as SearchRequestBody;

    if (!body.query || typeof body.query !== "string" || body.query.trim().length === 0) {
      throw new ValidationException("query is required");
    }

    const limit = Math.min(body.limit ?? 20, 50);

    // 計算 query embedding（消耗 AI quota）
    const queryEmbedding = await getEmbedding(body.query.trim());
    await incrementAiUsage(userId);
    const vectorStr = `[${queryEmbedding.join(",")}]`;

    // 搜尋 tasks（有 embedding 的）
    const taskResults = await prisma.$queryRaw<
      Array<{
        id: string;
        title: string;
        content: string;
        similarity: number;
        product_name: string | null;
        area_name: string | null;
      }>
    >`
      SELECT
        t.id::text,
        LEFT(t.content, 100) as title,
        t.content as content,
        1 - (t.embedding <=> ${vectorStr}::vector) as similarity,
        p.name as product_name,
        a.name as area_name
      FROM tasks t
      LEFT JOIN products p ON t.product_id = p.id
      LEFT JOIN areas a ON p.area_id = a.id
      WHERE t.user_id = ${userId}::uuid
        AND t.deleted_at IS NULL
        AND t.embedding IS NOT NULL
      ORDER BY t.embedding <=> ${vectorStr}::vector
      LIMIT ${limit}
    `;

    // 搜尋 products（有 embedding 的）
    const productResults = await prisma.$queryRaw<
      Array<{
        id: string;
        title: string;
        content: string;
        similarity: number;
        area_name: string | null;
        references: any;
      }>
    >`
      SELECT
        p.id::text,
        p.name as title,
        COALESCE(p.description, '') as content,
        1 - (p.embedding <=> ${vectorStr}::vector) as similarity,
        a.name as area_name,
        p.references
      FROM products p
      LEFT JOIN areas a ON p.area_id = a.id
      WHERE p.user_id = ${userId}::uuid
        AND p.deleted_at IS NULL
        AND p.embedding IS NOT NULL
      ORDER BY p.embedding <=> ${vectorStr}::vector
      LIMIT ${limit}
    `;

    // 合併結果並按相似度排序
    const results: SearchResultItem[] = [
      ...taskResults.map((r) => ({
        id: r.id,
        title: r.title || "",
        content: r.content || "",
        score: Number(r.similarity),
        product_name: r.product_name ?? undefined,
        area_name: r.area_name ?? undefined,
      })),
      ...productResults.map((r) => ({
        id: r.id,
        title: r.title || "",
        content: r.content || "",
        score: Number(r.similarity),
        product_name: r.title, // product itself
        area_name: r.area_name ?? undefined,
        references: (r.references || []).map((ref: any) => ({
          id: ref.id,
          type: ref.type,
          title: ref.title,
          created_at: ref.created_at,
          // 不包含 content，避免 response 太大
        })),
      })),
    ]
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return ApiResponseBuilder.success({
      results,
      total: results.length,
    });
  });
}
