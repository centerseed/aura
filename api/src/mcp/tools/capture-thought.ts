/**
 * capture_thought Tool (Section 4.1)
 *
 * Captures external conversations, code snippets or web content
 * into Zentropy's Inbox via the brain-dump pipeline.
 *
 * Required Scope: write:inbox
 */

import { ValidationException } from "@/lib/api-response";
import type { BackendApiClient } from "../backend-client/api-client";
import type { AuthContext } from "../types";

export interface CaptureThoughtInput {
  content: string;
  source: string;
  context_hint?: string;
}

export interface CaptureThoughtResult {
  id: string;
  status: string;
  _warning?: string;
}

export async function handleCaptureThought(
  apiClient: BackendApiClient,
  authContext: AuthContext,
  input: Record<string, unknown>,
  sanitized: boolean,
): Promise<CaptureThoughtResult> {
  // 驗證並轉換參數
  const params = validateCaptureThoughtInput(input);

  const response = await apiClient.captureThought(authContext.userId, {
    content: params.content,
    source: params.source,
    context_hint: params.context_hint,
  });

  const result: CaptureThoughtResult = {
    id: response.id,
    status: response.status,
  };

  if (sanitized) {
    result._warning = "content_sanitized";
  }

  return result;
}

/**
 * 驗證 capture_thought 的輸入參數
 */
function validateCaptureThoughtInput(
  input: Record<string, unknown>,
): CaptureThoughtInput {
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

  // 驗證 source（必填）
  if (!input.source || typeof input.source !== "string") {
    throw new ValidationException(
      'source is required and must be a string (e.g., "mcp", "web", "mobile")',
      "source",
    );
  }

  // 驗證 context_hint（可選）
  if (input.context_hint !== undefined && typeof input.context_hint !== "string") {
    throw new ValidationException("context_hint must be a string", "context_hint");
  }

  return {
    content: input.content as string,
    source: input.source as string,
    context_hint: input.context_hint as string | undefined,
  };
}
