/**
 * capture_thought Tool (Section 4.1)
 *
 * Captures external conversations, code snippets or web content
 * into Zentropy's Inbox via the brain-dump pipeline.
 *
 * Required Scope: write:inbox
 */

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
  _authContext: AuthContext,
  input: Record<string, unknown>,
  sanitized: boolean,
  accessToken: string,
): Promise<CaptureThoughtResult> {
  const params = input as unknown as CaptureThoughtInput;
  const response = await apiClient.captureThought(accessToken, {
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
