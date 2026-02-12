/**
 * Knowledge Assets Resource (Section 3.1)
 *
 * URI Pattern: zentropy://{area}/{product}/{topic}/...
 * Required Scope: read:knowledge (or read:tasks for Active tasks)
 */

import type { BackendApiClient } from "../backend-client/api-client.js";

export interface KnowledgeAssetResult {
  content: string;
  metadata: Record<string, unknown>;
}

/**
 * Parse a zentropy:// URI into components.
 * Example: zentropy://Work/Naruvia/Specs/Librarian_Engine
 */
export function parseZentropyUri(uri: string): {
  area: string;
  product: string;
  topic: string;
} | null {
  const match = uri.match(
    /^zentropy:\/\/([^/]+)\/([^/]+)\/(.+)$/,
  );
  if (!match) return null;

  return {
    area: decodeURIComponent(match[1]),
    product: decodeURIComponent(match[2]),
    topic: decodeURIComponent(match[3]),
  };
}

export async function readKnowledgeAsset(
  apiClient: BackendApiClient,
  accessToken: string,
  uri: string,
): Promise<KnowledgeAssetResult> {
  const parsed = parseZentropyUri(uri);
  if (!parsed) {
    throw new Error(`Invalid Zentropy URI: ${uri}`);
  }

  const response = await apiClient.getKnowledgeAsset(
    accessToken,
    parsed.area,
    parsed.product,
    parsed.topic,
  );

  return {
    content: response.content,
    metadata: response.metadata,
  };
}
