/**
 * capture_thought Tool (Section 4.1)
 *
 * Captures external conversations, code snippets or web content
 * into Zentropy's Inbox or a specific Product.
 *
 * Required Scope: write:inbox
 */

import type { BackendApiClient } from "../backend-client/api-client.js";
import type { AuthContext } from "../types.js";

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
