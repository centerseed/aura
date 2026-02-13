/**
 * Rolling Sagas Resource (Section 3.2)
 *
 * URI Pattern: zentropy://saga/{product_id}
 * Required Scope: read:knowledge
 */

import type { BackendApiClient } from "../backend-client/api-client";

export interface RollingSagaResult {
  content: string;
  level: string;
}

export function parseSagaUri(uri: string): string | null {
  const match = uri.match(/^zentropy:\/\/saga\/(.+)$/);
  return match ? decodeURIComponent(match[1]) : null;
}

export async function readRollingSaga(
  apiClient: BackendApiClient,
  accessToken: string,
  uri: string,
): Promise<RollingSagaResult> {
  const productId = parseSagaUri(uri);
  if (!productId) {
    throw new Error(`Invalid saga URI: ${uri}`);
  }

  const response = await apiClient.getRollingSaga(accessToken, productId);

  return {
    content: response.content,
    level: response.level,
  };
}
