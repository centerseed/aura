/**
 * append_to_knowledge Tool (Section 4.2)
 *
 * Writes structured knowledge into a specified Reference area.
 *
 * Required Scope: write:knowledge
 */

import type { BackendApiClient } from "../backend-client/api-client.js";
import type { AuthContext } from "../types.js";

export interface AppendToKnowledgeInput {
  product_name: string;
  topic_name: string;
  title: string;
  content: string;
}

export interface AppendToKnowledgeResult {
  id: string;
  status: string;
  product_name: string;
  topic_name: string;
  _warning?: string;
}

export async function handleAppendToKnowledge(
  apiClient: BackendApiClient,
  authContext: AuthContext,
  input: Record<string, unknown>,
  sanitized: boolean,
  accessToken: string,
): Promise<AppendToKnowledgeResult> {
  const params = input as unknown as AppendToKnowledgeInput;
  const response = await apiClient.appendToKnowledge(accessToken, {
    product_name: params.product_name,
    topic_name: params.topic_name,
    title: params.title,
    content: params.content,
  });

  const result: AppendToKnowledgeResult = {
    id: response.id,
    status: response.status,
    product_name: response.product_name,
    topic_name: response.topic_name,
  };

  if (sanitized) {
    result._warning = "content_sanitized";
  }

  return result;
}
