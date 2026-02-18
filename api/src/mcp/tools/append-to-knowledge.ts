/**
 * append_to_knowledge Tool (Section 4.2)
 *
 * Writes structured knowledge into a specified Reference area.
 *
 * Required Scope: write:knowledge
 */

import { ValidationException } from "@/lib/api-response";
import type { BackendApiClient } from "../backend-client/api-client";
import type { AuthContext } from "../types";

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
): Promise<AppendToKnowledgeResult> {
  // 驗證並轉換參數
  const params = validateAppendToKnowledgeInput(input);

  const response = await apiClient.appendToKnowledge(authContext.userId, {
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

/**
 * 驗證 append_to_knowledge 的輸入參數
 */
function validateAppendToKnowledgeInput(
  input: Record<string, unknown>,
): AppendToKnowledgeInput {
  // 驗證 product_name（必填）
  if (!input.product_name || typeof input.product_name !== "string") {
    throw new ValidationException(
      "product_name is required and must be a string",
      "product_name",
    );
  }

  // 驗證 topic_name（必填）
  if (!input.topic_name || typeof input.topic_name !== "string") {
    throw new ValidationException(
      "topic_name is required and must be a string",
      "topic_name",
    );
  }

  // 驗證 title（必填）
  if (!input.title || typeof input.title !== "string") {
    throw new ValidationException(
      "title is required and must be a string",
      "title",
    );
  }

  // 驗證 content（必填）
  if (!input.content || typeof input.content !== "string") {
    throw new ValidationException(
      "content is required and must be a string",
      "content",
    );
  }

  if (input.content.trim().length === 0) {
    throw new ValidationException(
      "content cannot be empty or contain only whitespace",
      "content",
    );
  }

  return {
    product_name: input.product_name as string,
    topic_name: input.topic_name as string,
    title: input.title as string,
    content: input.content as string,
  };
}
