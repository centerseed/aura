/**
 * query_memory Tool (Section 4.3)
 *
 * Performs semantic search across past decisions and data.
 *
 * Required Scope: read:tasks OR read:knowledge
 */

import type { BackendApiClient } from "../backend-client/api-client.js";
import type { AuthContext, BackendSearchResult } from "../types.js";

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
  accessToken: string,
): Promise<QueryMemoryResult> {
  const params = input as unknown as QueryMemoryInput;
  const response = await apiClient.queryMemory(accessToken, {
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
