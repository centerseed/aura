/**
 * query_memory Tool (Section 4.3)
 *
 * Performs semantic search across past decisions and data.
 *
 * Required Scope: read:tasks OR read:knowledge
 */

import { ValidationException } from "@/lib/api-response";
import type { BackendApiClient } from "../backend-client/api-client";
import type { AuthContext } from "../types";

export interface QueryMemoryInput {
  query: string;
  scope?: string;
}

export interface QueryMemoryResult {
  results: Array<{
    id: string;
    title: string;
    content: string;
    score: number;
    product_name?: string;
    area_name?: string;
  }>;
  total: number;
  _warning?: string;
}

export async function handleQueryMemory(
  apiClient: BackendApiClient,
  authContext: AuthContext,
  input: Record<string, unknown>,
  sanitized: boolean,
): Promise<QueryMemoryResult> {
  // 驗證並轉換參數
  const params = validateQueryMemoryInput(input);

  const response = await apiClient.queryMemory(authContext.userId, {
    query: params.query,
    scope: params.scope,
  });

  const result: QueryMemoryResult = {
    results: response.results,
    total: response.total,
  };

  if (sanitized) {
    result._warning = "content_sanitized";
  }

  return result;
}

/**
 * 驗證 query_memory 的輸入參數
 */
function validateQueryMemoryInput(
  input: Record<string, unknown>,
): QueryMemoryInput {
  // 驗證 query（必填）
  if (!input.query || typeof input.query !== "string") {
    throw new ValidationException(
      "query is required and must be a string",
      "query",
    );
  }

  if (input.query.trim().length === 0) {
    throw new ValidationException(
      "query cannot be empty or contain only whitespace",
      "query",
    );
  }

  // 驗證 scope（可選）
  if (input.scope !== undefined && typeof input.scope !== "string") {
    throw new ValidationException("scope must be a string", "scope");
  }

  return {
    query: input.query as string,
    scope: input.scope as string | undefined,
  };
}
